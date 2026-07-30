#!/usr/bin/env node
/**
 * End-to-end smoke test for the Antigravity managed agent, run against the real Interactions API.
 *
 * Covers the four behaviours the app depends on and that unit tests can't reach:
 *   1. blocking create      — and that the answer is recoverable from the response
 *   2. SSE streaming        — reasoning/answer deltas arrive in the shapes agentService.ts parses
 *   3. function calling     — a custom tool is requested and the result round-trips (stateful)
 *   4. environment reuse    — a file written in one interaction is still there in the next
 * Plus it probes the error shape for a dead environment, which stale-session recovery keys on.
 *
 * Usage:  node scripts/smoke-agent.mjs            (reads VITE_GEMINI_API_KEY / GEMINI_API_KEY)
 *         node scripts/smoke-agent.mjs --quick    (skips 3 and 4)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const AGENT = 'antigravity-preview-05-2026';
const API_REVISION = '2026-05-20';
// Pin the model the school edition is allowed to use (europe-west2 in-region confirmed) so the
// smoke test exercises the same path production does.
const MODEL = process.env.AGENT_MODEL || 'gemini-3.5-flash';
const AGENT_CONFIG = { type: 'antigravity', model: MODEL, max_total_tokens: 60_000 };

const readKey = () => {
  const fromEnv = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (fromEnv) return fromEnv;
  try {
    const envFile = readFileSync(path.join(ROOT, '.env.local'), 'utf8');
    const line = envFile.split('\n').find(l => l.startsWith('VITE_GEMINI_API_KEY='));
    if (line) return line.slice('VITE_GEMINI_API_KEY='.length).trim();
  } catch { /* fall through */ }
  throw new Error('No Gemini key: set GEMINI_API_KEY or add VITE_GEMINI_API_KEY to .env.local');
};

const API_KEY = readKey();
const headers = (extra = {}) => ({
  'Content-Type': 'application/json',
  'x-goog-api-key': API_KEY,
  'Api-Revision': API_REVISION,
  ...extra,
});

const post = async (body, { stream = false } = {}) => {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: headers(stream ? { Accept: 'text/event-stream' } : {}),
    body: JSON.stringify({ agent: AGENT, agent_config: AGENT_CONFIG, ...body }),
    signal: AbortSignal.timeout(600_000),
  });
  return res;
};

/**
 * Read an interaction response. A non-streaming request can still come back as an SSE error frame
 * (`event: error`), so never assume JSON — surface the raw body instead of throwing a parse error.
 */
const readInteraction = async (res, label) => {
  const raw = await res.text();
  try {
    return JSON.parse(raw);
  } catch {
    console.log(`  [${label}] non-JSON response (HTTP ${res.status}): ${raw.slice(0, 400).replace(/\s+/g, ' ')}`);
    return { status: 'error', _raw: raw, _httpStatus: res.status };
  }
};

/** The answer text lives in `model_output` steps; the API does not return a top-level output_text. */
const outputTextOf = (interaction) => {
  const parts = [];
  for (const step of interaction.steps || []) {
    if (step.type !== 'model_output') continue;
    const content = step.content;
    if (typeof content === 'string') parts.push(content);
    else if (Array.isArray(content)) parts.push(content.map(c => c?.text || '').join(''));
    else if (content?.text) parts.push(content.text);
  }
  return parts.join('').trim();
};

const pendingCallsOf = (interaction) => {
  const steps = interaction.steps || [];
  const resolved = new Set(steps.filter(s => s.type === 'function_result' && s.call_id).map(s => s.call_id));
  return steps.filter(s => s.type === 'function_call' && s.id && !resolved.has(s.id));
};

const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

// 1. Blocking create -----------------------------------------------------------------------
console.log('\n[1] Blocking interaction');
const r1 = await post({ input: 'Reply with exactly: PONG', environment: 'remote' });
if (!r1.ok) {
  console.error(`  HTTP ${r1.status}: ${(await r1.text()).slice(0, 400)}`);
  process.exit(1);
}
const i1 = await readInteraction(r1, 'blocking');
record('blocking create completes', i1.status === 'completed', `status=${i1.status}`);
record('answer recoverable from steps', /PONG/i.test(outputTextOf(i1)), JSON.stringify(outputTextOf(i1)).slice(0, 60));
record('no top-level output_text (client must derive it)', !('output_text' in i1), 'confirms the fallback-path fix is needed');
record('environment_id returned', !!i1.environment_id, i1.environment_id);

// 2. Streaming -----------------------------------------------------------------------------
console.log('\n[2] SSE streaming');
const r2 = await post({ input: 'Say the single word: PONG', environment: 'remote', stream: true }, { stream: true });
record('stream opens', r2.ok && !!r2.body, `HTTP ${r2.status} content-type=${r2.headers.get('content-type')}`);

let reasoning = '', answer = '', envIdFromStream = '', firstChunkAt = 0;
const seenEvents = new Set();
{
  const started = Date.now();
  const reader = r2.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const handle = (frame) => {
    const data = frame.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('\n');
    if (!data || data === '[DONE]') return;
    let evt; try { evt = JSON.parse(data); } catch { return; }
    seenEvents.add(evt.event_type);
    if (evt.event_type === 'step.delta') {
      if (evt.delta?.type === 'thought_summary') reasoning += evt.delta.content?.text || '';
      if (evt.delta?.type === 'text') answer += evt.delta.text || '';
    }
    if (evt.event_type === 'interaction.completed') envIdFromStream = evt.interaction?.environment_id || '';
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!firstChunkAt) firstChunkAt = Date.now() - started;
    buffer += decoder.decode(value, { stream: true });
    let sep;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      handle(buffer.slice(0, sep));
      buffer = buffer.slice(sep + 2);
    }
  }
  if (buffer.trim()) handle(buffer);
}
record('reasoning deltas received', reasoning.length > 0, `${reasoning.length} chars`);
record('answer deltas received', /PONG/i.test(answer), JSON.stringify(answer.slice(0, 40)));
record('environment_id in completed event', !!envIdFromStream, envIdFromStream);
record('expected event types seen',
  ['interaction.created', 'step.start', 'step.delta', 'interaction.completed'].every(e => seenEvents.has(e)),
  [...seenEvents].join(','));
console.log(`  (first byte after ${firstChunkAt}ms)`);

if (process.argv.includes('--quick')) {
  summarise();
}

// 3. Function calling round-trip -------------------------------------------------------------
console.log('\n[3] Custom function calling (stateful round-trip)');
const tool = {
  type: 'function',
  name: 'get_period_label',
  description: 'Returns the school period label for a given slot number in the teacher timetable.',
  parameters: {
    type: 'object',
    properties: { slot: { type: 'integer', description: 'Slot number, 1-5' } },
    required: ['slot'],
  },
};
const r3 = await post({
  input: 'Call get_period_label for slot 3, then tell me the label it returned and nothing else.',
  environment: 'remote',
  tools: [{ type: 'code_execution' }, tool],
});
const i3 = await readInteraction(r3, 'fn-call');
const calls = pendingCallsOf(i3);
record('agent requests the custom function', calls.length > 0, calls.map(c => c.name).join(',') || `status=${i3.status}`);

if (calls.length > 0) {
  const call = calls[0];
  const r3b = await post({
    previous_interaction_id: i3.id,
    environment: i3.environment_id,
    input: [{ type: 'function_result', name: call.name, call_id: call.id, result: { label: 'Period 3 — Y10 Geography' } }],
  });
  const i3b = await readInteraction(r3b, 'fn-result');
  const text = outputTextOf(i3b);
  record('function result round-trips into the answer', /Period 3/i.test(text), JSON.stringify(text.slice(0, 80)));
}

// 4. Environment reuse / file persistence -----------------------------------------------------
console.log('\n[4] Environment reuse (files persist across interactions)');
const r4 = await post({
  input: 'Write the text "teacher-planner-smoke-ok" to /workspace/smoke.txt. Reply with just: WRITTEN',
  environment: 'remote',
});
const i4 = await readInteraction(r4, 'file-write');
const envId = i4.environment_id;
record('file-writing interaction completes', i4.status === 'completed', `env=${envId}`);

const r4b = await post({
  input: 'Read /workspace/smoke.txt and reply with its exact contents and nothing else.',
  previous_interaction_id: i4.id,
  environment: envId,
});
const i4b = await readInteraction(r4b, 'file-read');
record('file persists into the next interaction', /teacher-planner-smoke-ok/.test(outputTextOf(i4b)), JSON.stringify(outputTextOf(i4b).slice(0, 60)));
record('environment id is stable across the turn', i4b.environment_id === envId, `${i4b.environment_id} vs ${envId}`);

// 5. Dead-environment error shape (drives stale-session recovery) ------------------------------
console.log('\n[5] Dead-environment error shape (informational)');
const r5 = await post({ input: 'hello', environment: 'env_does_not_exist_smoke_test', previous_interaction_id: i4.id });
const body5 = await r5.text();
console.log(`  HTTP ${r5.status}: ${body5.slice(0, 300).replace(/\s+/g, ' ')}`);

summarise();

function summarise() {
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}
