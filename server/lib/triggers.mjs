import admin from 'firebase-admin';
import { assembleEnvironment } from './environment.mjs';
import { defaultAgentConfig, isAgentPlatform } from './agentProvider.mjs';

/**
 * Scheduled agent runs — "every Monday at 7am, prepare my week".
 *
 * The provider owns the schedule (its Triggers API fires on cron and reuses one sandbox across
 * runs); we keep a mirror in Firestore so the app can list, describe and clean up its own
 * automations without depending on that API for reads.
 *
 * The stored interaction is a snapshot: it embeds the assistant's instructions, its skills and a
 * long-lived sandbox token. That goes stale when the teacher edits the assistant, so every trigger
 * records when it was built and is rebuilt on demand.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/triggers';
const AGENT_API_REVISION = '2026-05-20';
const AGENT = 'antigravity-preview-05-2026';

const TRIGGERS_COLLECTION = 'teacher_planner_triggers';

const db = () => admin.firestore();
const userTriggers = (uid) => db().collection('users').doc(uid).collection(TRIGGERS_COLLECTION);

const headers = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  return {
    'Content-Type': 'application/json',
    'x-goog-api-key': key,
    'Api-Revision': AGENT_API_REVISION,
  };
};

/** Scheduling is only wired to the consumer API for now; the platform equivalent differs. */
export const triggersAvailable = () => !isAgentPlatform() && !!process.env.GEMINI_API_KEY;

const call = async (path = '', { method = 'GET', body } = {}) => {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: headers(),
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`Trigger API ${res.status}: ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return text ? JSON.parse(text) : {};
};

/**
 * Build the interaction a scheduled run executes.
 *
 * Custom function tools are deliberately omitted. Function calling is stateful — it needs a reply
 * turn — and there is nobody present at 7am to confirm a planner change, so a scheduled run would
 * simply stall. Scheduled runs research, write and file documents; they don't mutate the planner.
 */
const buildInteraction = async ({ uid, trigger }) => {
  const { environment } = await assembleEnvironment({
    uid,
    agentId: trigger.agentId,
    skillIds: trigger.skillIds,
    triggerId: trigger.id,
  });

  return {
    agent: AGENT,
    agent_config: defaultAgentConfig(),
    background: true,
    environment,
    input: [{
      type: 'text',
      text:
        `${trigger.prompt}\n\n`
        + `This is a scheduled run — nobody is watching it, so do not ask questions or wait for `
        + `confirmation. Produce the finished result and upload it as a file (see .agents/AGENTS.md); `
        + `it appears in the teacher's Resources.`,
    }],
    tools: [{ type: 'code_execution' }, { type: 'google_search' }, { type: 'url_context' }],
  };
};

export const listTriggers = async (uid) => {
  const snap = await userTriggers(uid).orderBy('createdAt', 'desc').get();
  return snap.docs.map(d => d.data());
};

export const createTrigger = async ({ uid, name, cron, timeZone, prompt, agentId, skillIds }) => {
  const id = `trg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const draft = { id, name, cron, timeZone, prompt, agentId, skillIds: skillIds || [] };
  const interaction = await buildInteraction({ uid, trigger: draft });

  const created = await call('', {
    method: 'POST',
    body: {
      schedule: cron,
      time_zone: timeZone,
      display_name: `${name} (${uid.slice(0, 8)})`,
      // Pause rather than pile up failures if something is persistently wrong.
      max_consecutive_failures: 3,
      execution_timeout_seconds: 1800,
      interaction,
    },
  });

  const now = Date.now();
  const record = {
    ...draft,
    enabled: true,
    googleTriggerName: created.id || created.name || '',
    materializedAt: now,
    nextRunTime: created.next_run_time || null,
    createdAt: now,
    updatedAt: now,
  };
  await userTriggers(uid).doc(id).set(record);
  return record;
};

export const setTriggerStatus = async (uid, id, enabled) => {
  const snap = await userTriggers(uid).doc(id).get();
  if (!snap.exists) return null;
  const trigger = snap.data();
  if (trigger.googleTriggerName) {
    await call(`/${trigger.googleTriggerName}`, {
      method: 'PATCH',
      body: { status: enabled ? 'active' : 'paused' },
    });
  }
  const updated = { ...trigger, enabled, updatedAt: Date.now() };
  await userTriggers(uid).doc(id).set(updated);
  return updated;
};

export const deleteTrigger = async (uid, id) => {
  const snap = await userTriggers(uid).doc(id).get();
  if (!snap.exists) return;
  const trigger = snap.data();
  if (trigger.googleTriggerName) {
    // A trigger already gone upstream shouldn't block removing our record.
    await call(`/${trigger.googleTriggerName}`, { method: 'DELETE' }).catch(() => {});
  }
  await userTriggers(uid).doc(id).delete();
};

export const runTriggerNow = async (uid, id) => {
  const snap = await userTriggers(uid).doc(id).get();
  if (!snap.exists) return null;
  const trigger = snap.data();
  await call(`/${trigger.googleTriggerName}/executions`, { method: 'POST' });
  const updated = { ...trigger, lastRunAt: Date.now(), lastStatus: 'started', updatedAt: Date.now() };
  await userTriggers(uid).doc(id).set(updated);
  return updated;
};

export const listExecutions = async (uid, id) => {
  const snap = await userTriggers(uid).doc(id).get();
  if (!snap.exists) return [];
  const trigger = snap.data();
  const result = await call(`/${trigger.googleTriggerName}/executions`);
  return result.trigger_executions || result.executions || [];
};

/**
 * Rebuild any trigger whose snapshot predates a change to what it depends on. Called when the app
 * loads, so editing an assistant or a skill quietly refreshes the automations that use it.
 */
export const refreshStaleTriggers = async (uid) => {
  const triggers = await listTriggers(uid);
  if (triggers.length === 0) return { refreshed: 0 };

  const userDoc = db().collection('users').doc(uid);
  const [agentsSnap, skillsSnap] = await Promise.all([
    userDoc.collection('teacher_planner_agents').get(),
    userDoc.collection('teacher_planner_skills').get(),
  ]);
  const newestChange = Math.max(
    0,
    ...agentsSnap.docs.map(d => d.data().updatedAt || 0),
    ...skillsSnap.docs.map(d => d.data().updatedAt || 0),
  );

  let refreshed = 0;
  for (const trigger of triggers) {
    if ((trigger.materializedAt || 0) >= newestChange) continue;
    try {
      const interaction = await buildInteraction({ uid, trigger });
      await call(`/${trigger.googleTriggerName}`, { method: 'PATCH', body: { interaction } });
      await userTriggers(uid).doc(trigger.id).set({ ...trigger, materializedAt: Date.now(), updatedAt: Date.now() });
      refreshed += 1;
    } catch (e) {
      console.error(`Could not refresh trigger ${trigger.id}:`, e?.message || e);
    }
  }
  return { refreshed };
};
