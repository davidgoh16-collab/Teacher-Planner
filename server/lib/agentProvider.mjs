import { GoogleAuth } from 'google-auth-library';

/**
 * Where agent runs actually execute.
 *
 * Two providers, chosen per deployment by AGENT_PROVIDER:
 *
 *  `gemini-api`     — the consumer Gemini API with a server-held key. Preview features land here
 *                     first and it streams synchronously. Right for the personal edition.
 *
 *  `agent-platform` — the same Antigravity managed agent under a Google Cloud project on Gemini
 *                     Enterprise Agent Platform. This is the one to sell to schools: it runs under
 *                     the Cloud Data Processing Addendum, Google does not train on the data, and
 *                     zero-retention terms are available.
 *
 * They are not drop-in equivalents, which is the whole reason this seam exists. Verified against
 * both:
 *   - auth differs (API key header vs OAuth bearer + x-goog-user-project)
 *   - Agent Platform REFUSES a foreground interaction: "Agent interactions must set background to
 *     true". So a streamed request has to be emulated by polling.
 *   - only the `global` location currently accepts interactions, so UK-region pinning is not yet
 *     available for managed agents (see docs/compliance/data-map.md).
 *   - it returns transient "Internal error encountered" shortly after the API is first enabled,
 *     and occasionally after that, so creates are retried.
 *
 * Everything above is contained here. The client's contract — POST /api/interactions/step, an
 * optional SSE stream, an interaction object back — is identical either way.
 */

const AGENT_API_REVISION = '2026-05-20';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';

export const providerName = () => process.env.AGENT_PROVIDER || 'gemini-api';
export const isAgentPlatform = () => providerName() === 'agent-platform';

const platformConfig = () => ({
  project: process.env.AGENT_PLATFORM_PROJECT || process.env.FIREBASE_PROJECT_ID || 'school-apps-52c7d',
  // Interactions are only served from `global` today; the env var exists so pinning can be turned
  // on the day regional endpoints appear, without a code change.
  location: process.env.AGENT_PLATFORM_LOCATION || 'global',
});

const platformUrl = (suffix = '') => {
  const { project, location } = platformConfig();
  return `https://aiplatform.googleapis.com/v1beta1/projects/${project}/locations/${location}/interactions${suffix}`;
};

// Application Default Credentials on Cloud Run: the runtime service account needs roles/aiplatform.user.
let authClient;
const bearerToken = async () => {
  if (!authClient) {
    authClient = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  }
  const client = await authClient.getClient();
  const { token } = await client.getAccessToken();
  return token;
};

const platformHeaders = async () => {
  const { project } = platformConfig();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${await bearerToken()}`,
    'x-goog-user-project': project,
  };
};

const geminiHeaders = (extra = {}) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  return {
    'Content-Type': 'application/json',
    'x-goog-api-key': key,
    'Api-Revision': AGENT_API_REVISION,
    ...extra,
  };
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Send an interaction, retrying the transient platform errors that aren't the caller's fault.
 * A 4xx that isn't one of those is returned as-is so the route can pass it through (a 404 for an
 * expired sandbox in particular must reach the client intact).
 */
const postWithRetry = async (url, headers, body, { attempts = 3, signal } = {}) => {
  let last;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal });
    if (res.ok) return res;
    const text = await res.text().catch(() => '');
    last = { status: res.status, text };
    const transient = res.status >= 500
      || /Internal error encountered|Resource setup has just started/i.test(text);
    if (!transient) return new Response(text, { status: res.status, headers: res.headers });
    if (i < attempts - 1) await sleep(1500 * (i + 1));
  }
  return new Response(last.text, { status: last.status });
};

/** Frame a JSON payload as one SSE event, matching what the client's parser expects. */
const sseFrame = (payload) => `data: ${JSON.stringify(payload)}\n\n`;

/**
 * Run an interaction and write the result to `res`.
 *
 * `wantsStream` asks for SSE. On the Gemini API the upstream stream is piped through untouched. On
 * Agent Platform there is no foreground stream, so the run is started in the background, polled,
 * and the outcome is emitted as the same SSE events the client already understands. The live
 * thought process is the casualty: the client still gets "working" and then the answer, but not
 * the reasoning as it happens.
 */
export const runInteraction = async ({ body, wantsStream, res, abortSignal }) => {
  if (!isAgentPlatform()) {
    const upstream = await postWithRetry(
      GEMINI_API_URL,
      geminiHeaders(wantsStream ? { Accept: 'text/event-stream' } : {}),
      body,
      { signal: abortSignal },
    );
    return { upstream, emulatedStream: false };
  }

  // --- Agent Platform ---
  const headers = await platformHeaders();
  const created = await postWithRetry(platformUrl(), headers, { ...body, stream: false, background: true }, { signal: abortSignal });
  if (!created.ok) return { upstream: created, emulatedStream: false };

  const start = await created.json();
  if (!start?.id) {
    return { upstream: new Response(JSON.stringify(start), { status: 502 }), emulatedStream: false };
  }

  if (wantsStream) {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write(sseFrame({ event_type: 'interaction.created', interaction: { id: start.id, status: 'in_progress' } }));
  }

  const final = await pollInteraction(start.id, headers, {
    abortSignal,
    onTick: wantsStream
      ? () => res.write(sseFrame({ event_type: 'interaction.status_update', interaction_id: start.id, status: 'in_progress' }))
      : undefined,
  });

  if (wantsStream) {
    res.write(sseFrame({ event_type: 'interaction.completed', interaction: final }));
    res.write('data: [DONE]\n\n');
    res.end();
    return { upstream: null, emulatedStream: true };
  }
  return { upstream: new Response(JSON.stringify(final), { status: 200, headers: { 'Content-Type': 'application/json' } }), emulatedStream: false };
};

/** Poll a background interaction to completion. */
export const pollInteraction = async (id, headers, { abortSignal, onTick, timeoutMs = 55 * 60 * 1000 } = {}) => {
  const deadline = Date.now() + timeoutMs;
  const resolvedHeaders = headers || await platformHeaders();
  let interaction = { id, status: 'in_progress' };

  while (Date.now() < deadline) {
    if (abortSignal?.aborted) break;
    await sleep(4000);
    onTick?.();
    const res = await fetch(`${platformUrl()}/${id}`, { headers: resolvedHeaders, signal: abortSignal }).catch(() => null);
    if (!res?.ok) continue;
    interaction = await res.json().catch(() => interaction);
    if (interaction.status && interaction.status !== 'in_progress') return interaction;
  }
  return interaction;
};

/** Model + budget defaults, so the pinned model lives in configuration rather than in the client. */
export const defaultAgentConfig = () => ({
  type: 'antigravity',
  model: process.env.AGENT_MODEL || 'gemini-3.5-flash',
  ...(process.env.AGENT_MAX_TOKENS ? { max_total_tokens: Number(process.env.AGENT_MAX_TOKENS) } : {}),
});
