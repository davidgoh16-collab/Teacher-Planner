import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import admin from 'firebase-admin';
import { GoogleGenAI } from '@google/genai';
import { requireSandboxToken, SCOPES } from './server/lib/sandboxToken.mjs';
import { assembleEnvironment } from './server/lib/environment.mjs';
import { saveAgentArtifact, readResource } from './server/lib/adminData.mjs';
import { runInteraction, providerName, defaultAgentConfig } from './server/lib/agentProvider.mjs';
import { buildKnowledgePreamble, getTier1Doc, listTier1 } from './server/lib/kb.mjs';
import {
  listTriggers, createTrigger, setTriggerStatus, deleteTrigger, runTriggerNow, listExecutions,
  refreshStaleTriggers, triggersAvailable,
} from './server/lib/triggers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// The Firebase project this app authenticates against (from firebase.ts config).
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'school-apps-52c7d';

// The native-audio voice model the Live API ephemeral token is scoped to.
const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

// Initialise Firebase Admin for ID-token verification (Application Default Credentials on
// Cloud Run; only the project id is needed to verify tokens minted for this project).
if (!admin.apps.length) {
  admin.initializeApp({ projectId: FIREBASE_PROJECT_ID });
}

// Trust the immediate proxy (Cloud Run ingress) so express-rate-limit sees the real client IP.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Security headers.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Base64 images/PDFs can be large, so allow a generous JSON body.
// Sandbox uploads are raw file bytes with their own parser on the route, and a .docx announced as
// application/json would otherwise be swallowed here and arrive as a broken object.
const jsonParser = express.json({ limit: '50mb' });
app.use((req, res, next) =>
  req.path === '/api/sandbox/artifacts' ? next() : jsonParser(req, res, next));

// Runtime environment for the browser. ONLY the Firebase web API key is exposed — it is an
// identifier, not a secret (access control lives in firestore.rules). The Gemini API key is
// NEVER shipped to the client; it stays server-side behind the /api proxies below.
app.get('/env.js', (req, res) => {
  // The Firebase web API key is a public client identifier (not a secret — access control lives in
  // firestore.rules). Default to the known project key so the app works even if the runtime env var
  // is unset; it is served to the browser here rather than being hardcoded into the client bundle.
  const firebaseKey = process.env.VITE_FIREBASE_API_KEY || 'AIzaSyDsHETgCAabxH8VTLI9yE9oXAyU9XlttIg';

  // The whole Firebase config can be supplied at runtime. This is what lets the school edition run
  // against its own Firebase project from the same image — without it, the project id is welded
  // into the bundle and a second deployment would need a fork.
  let firebaseConfig;
  if (process.env.FIREBASE_WEB_CONFIG) {
    try {
      firebaseConfig = JSON.parse(process.env.FIREBASE_WEB_CONFIG);
    } catch {
      console.error('FIREBASE_WEB_CONFIG is not valid JSON; falling back to the built-in config.');
    }
  }

  const env = {
    VITE_FIREBASE_API_KEY: firebaseKey,
    EDITION: process.env.EDITION || 'personal',
    ...(firebaseConfig ? { FIREBASE_CONFIG: firebaseConfig } : {}),
    ...(process.env.MINT_CUSTOM_TOKEN_URL ? { MINT_CUSTOM_TOKEN_URL: process.env.MINT_CUSTOM_TOKEN_URL } : {}),
  };

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(`window.ENV = ${JSON.stringify(env)};\n`);
});

// Serve the built SPA.
app.use(express.static(path.join(__dirname, 'dist')));

// Coarse per-IP backstop across every API route. This exists to blunt unauthenticated floods, not
// to meter usage — a single agent run legitimately makes many calls, so the ceiling is high and the
// real metering is the per-user limiters below.
const ipBackstopLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', ipBackstopLimiter);

/**
 * Per-user limiter, keyed on the Firebase uid so one busy user can't spend everyone's budget.
 * Must be mounted AFTER `authenticate` so `req.user` exists; falls back to IP if it somehow
 * doesn't. Route groups get their own buckets because their costs differ by orders of magnitude
 * (an agent step can run for minutes; a poll is nearly free).
 */
const userLimiter = (max, windowMs = 15 * 60 * 1000) => rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.uid || req.ip,
  message: { error: 'Too many requests, please try again later.' },
});

const agentLimiter = userLimiter(40);   // multi-minute autonomous runs
const contentLimiter = userLimiter(120); // ordinary chat / generation calls
const pollLimiter = userLimiter(300);   // status polling for background work

// Defence-in-depth data minimisation: mask any email address in outbound Gemini payloads, in
// case upstream client code fails to scrub it. Skips binary/base64 fields (inlineData.data) so
// image/PDF payloads are never mangled. Must NOT be applied to any webhook that intentionally
// carries real personal data.
const EMAIL_REGEX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const maskEmailsDeep = (value) => {
  if (typeof value === 'string') return value.replace(EMAIL_REGEX, '[EMAIL]');
  if (Array.isArray(value)) return value.map(maskEmailsDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = (key === 'data' || key === 'inlineData') ? val : maskEmailsDeep(val);
    }
    return out;
  }
  return value;
};

// Build the server-side Gemini client from the secret key held only on the server.
const getAiClient = () => {
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    console.error('GEMINI_API_KEY environment variable not set.');
    throw new Error('API Key not available.');
  }
  return new GoogleGenAI({ apiKey: API_KEY });
};

// Firebase auth middleware — every /api call must present a valid Firebase ID token.
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    req.user = await admin.auth().verifyIdToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// Generic Gemini text/vision proxy. Keeps GEMINI_API_KEY server-side; the browser only ever
// calls this same-origin route. maskEmailsDeep is a server-side backstop over the client-side
// pseudonymisation.
app.post('/api/generate-content', authenticate, contentLimiter, async (req, res) => {
  try {
    const { model, contents, config } = req.body;
    const response = await getAiClient().models.generateContent({
      model,
      contents: maskEmailsDeep(contents),
      config: maskEmailsDeep(config),
    });
    res.json({ text: response.text, candidates: response.candidates });
  } catch (error) {
    console.error('generate-content error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Antigravity Interactions API proxy (managed agent). Forwards the interaction body to the
// generativelanguage interactions endpoint with the server key.
//
// Streamed runs are piped through chunk-by-chunk rather than buffered: the whole point of the
// stream is the live thought process, and awaiting the full body before responding delayed every
// frame until the run had already finished.
app.post('/api/interactions/step', authenticate, agentLimiter, async (req, res) => {
  const upstreamAbort = new AbortController();
  try {
    // Only the consumer-API provider needs a key; Agent Platform authenticates with the runtime
    // service account.
    if (providerName() === 'gemini-api' && !process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    const body = req.body;
    if (!body || !body.agent) {
      return res.status(400).json({ error: 'Missing agent in request body' });
    }

    // `plannerEnv` asks us to assemble the sandbox: the teacher's skills, brand kit, saved files
    // and a callback credential. It is not a field the Interactions API understands, so it is
    // always replaced by a real `environment` (or simply dropped) before forwarding.
    const { plannerEnv, ...forwardBody } = body;

    if (plannerEnv) {
      // Only ever build an environment for the caller's own uid — never one named in the request.
      // And only for a fresh run: continuing a turn must stay in the sandbox it started in.
      const continuing = typeof forwardBody.environment === 'string' && forwardBody.environment !== 'remote';
      if (!continuing) {
        try {
          const { environment } = await assembleEnvironment({
            uid: req.user.uid,
            agentId: plannerEnv.agentId,
            skillIds: plannerEnv.skillIds,
            conversationId: plannerEnv.conversationId,
            includeWorkspace: plannerEnv.includeWorkspace !== false,
          });
          forwardBody.environment = environment;
        } catch (e) {
          // A sandbox we couldn't furnish is still a usable sandbox — the agent just loses its
          // files and branding. Better a plainer answer than a failed run.
          console.error('Environment assembly failed; falling back to a bare sandbox:', e?.message || e);
        }
      }
    }

    // Data-minimisation backstop: strip any email address before it leaves our server.
    const safeBody = maskEmailsDeep(forwardBody);
    const wantsStream = !!safeBody.stream;

    // If the client hangs up mid-run, stop paying for the upstream generation.
    res.on('close', () => { if (!res.writableEnded) upstreamAbort.abort(); });

    // Fall back to the configured model/budget when the client didn't pin one, so the deployment
    // controls which model a school edition is allowed to use.
    if (!safeBody.agent_config) safeBody.agent_config = defaultAgentConfig();

    // Prepend the England knowledge preamble on a fresh run. Doing it here rather than in the
    // client means the safeguarding and inspection-language rules cannot be edited or dropped by
    // the browser, and updating them needs no client deploy. A continuation already has them.
    const startingFresh = !safeBody.previous_interaction_id;
    if (startingFresh && typeof safeBody.input === 'string') {
      try {
        const preamble = await buildKnowledgePreamble(safeBody.input);
        safeBody.input = `${preamble}\n\n---\n\n${safeBody.input}`;
      } catch (e) {
        console.error('Knowledge preamble failed; continuing without it:', e?.message || e);
      }
    } else if (startingFresh && Array.isArray(safeBody.input)) {
      const firstText = safeBody.input.find(part => part?.type === 'text');
      if (firstText) {
        try {
          const preamble = await buildKnowledgePreamble(firstText.text || '');
          firstText.text = `${preamble}\n\n---\n\n${firstText.text || ''}`;
        } catch (e) {
          console.error('Knowledge preamble failed; continuing without it:', e?.message || e);
        }
      }
    }

    const { upstream, emulatedStream } = await runInteraction({
      body: safeBody,
      wantsStream,
      res,
      abortSignal: upstreamAbort.signal,
    });
    // The provider already wrote and closed an emulated stream (Agent Platform has no foreground
    // streaming, so it polls a background run and emits the same events).
    if (emulatedStream) return;

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      console.error(`Interactions API error ${upstream.status}: ${text.slice(0, 500)}`);
      // 404 means the referenced environment/interaction is gone (sandboxes expire after 7 days).
      // Pass it through intact so the client can silently restart the run instead of erroring.
      if (upstream.status === 404) {
        return res.status(404).type('application/json').send(text || '{"error":{"code":"not_found"}}');
      }
      const status = upstream.status === 429 ? 429 : 502;
      return res.status(status).json({ error: `Agent unavailable (${upstream.status})` });
    }

    const contentType = upstream.headers.get('content-type') || 'application/json';
    if (!wantsStream || !upstream.body || !contentType.includes('event-stream')) {
      const text = await upstream.text();
      if (!res.headersSent) res.type(contentType).send(text);
      return;
    }

    // Pipe the SSE stream straight through. `no-transform` and `X-Accel-Buffering: no` stop any
    // intermediary from coalescing frames, which would silently reintroduce the buffering bug.
    res.status(200);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    for await (const chunk of upstream.body) {
      if (res.writableEnded) break;
      res.write(chunk);
    }
    res.end();
  } catch (error) {
    if (upstreamAbort.signal.aborted) return; // client went away; nothing to report
    console.error('interactions proxy error:', error?.message || error);
    if (!res.headersSent) res.status(502).json({ error: 'Agent unavailable' });
    else res.end();
  }
});

// Mint a short-lived ephemeral token for the Live (native-audio) API so the browser can open a
// realtime session WITHOUT ever seeing the raw Gemini key. If the installed SDK can't mint one,
// return { token: null, disabled: true } and the client shows the voice assistant as unavailable
// rather than falling back to shipping the raw key.
app.post('/api/live-token', authenticate, pollLimiter, async (req, res) => {
  try {
    const ai = getAiClient();
    if (!ai.authTokens || typeof ai.authTokens.create !== 'function') {
      return res.json({ token: null, disabled: true });
    }
    const tok = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(Date.now() + 9 * 60000).toISOString(),
        liveConnectConstraints: { model: LIVE_MODEL },
      },
    });
    return res.json({ token: tok.name });
  } catch (error) {
    console.error('live-token error:', error?.message || error);
    return res.json({ token: null, disabled: true });
  }
});

/**
 * Sandbox callbacks.
 *
 * These are authenticated by a sandbox token, not a Firebase session: the caller is an agent
 * sandbox with no user signed in. The token names the uid it may act for, so nothing here reads an
 * identity out of the request body.
 *
 * Uploads arrive as a raw body. `express.json` is mounted globally and would try to parse a .docx
 * as JSON, so this route declares its own raw parser ahead of it.
 */
const sandboxUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.sandbox?.uid || req.ip,
  message: { error: 'Too many uploads, please try again later.' },
});

app.post(
  '/api/sandbox/artifacts',
  requireSandboxToken(SCOPES.ARTIFACT_WRITE),
  sandboxUploadLimiter,
  express.raw({ type: '*/*', limit: '25mb' }),
  async (req, res) => {
    try {
      const buffer = req.body;
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        return res.status(400).json({ error: 'Empty upload' });
      }
      const resource = await saveAgentArtifact({
        uid: req.sandbox.uid,
        fileName: req.get('X-File-Name') || 'document',
        buffer,
        contentType: req.get('Content-Type'),
        source: req.sandbox.triggerId ? 'trigger' : 'agent',
        conversationId: req.sandbox.conversationId,
        triggerId: req.sandbox.triggerId,
        summary: req.get('X-File-Summary') || undefined,
      });
      // Keep the reply small and boring: it goes back into the agent's context.
      res.json({ ok: true, resourceId: resource.id, name: resource.name });
    } catch (error) {
      console.error('sandbox artifact upload failed:', error?.message || error);
      res.status(500).json({ error: 'Could not save that file' });
    }
  },
);

app.get('/api/sandbox/workspace/:resourceId', requireSandboxToken(SCOPES.WORKSPACE_READ), async (req, res) => {
  try {
    const found = await readResource(req.sandbox.uid, req.params.resourceId);
    if (!found) return res.status(404).json({ error: 'Not found' });
    res.type(found.resource.mimeType || 'application/octet-stream').send(found.buffer);
  } catch (error) {
    console.error('sandbox workspace read failed:', error?.message || error);
    res.status(500).json({ error: 'Could not read that file' });
  }
});


/**
 * Scheduled runs ("every Monday at 7am, prepare my week") and deep research.
 *
 * Both are server-side because they need the Gemini key and because a scheduled run has to keep
 * working when nobody is signed in.
 */
const triggerLimiter = userLimiter(60);

app.get('/api/triggers', authenticate, triggerLimiter, async (req, res) => {
  try {
    res.json({ available: triggersAvailable(), triggers: await listTriggers(req.user.uid) });
  } catch (error) {
    console.error('list triggers failed:', error?.message || error);
    res.status(500).json({ error: 'Could not load your automations' });
  }
});

app.post('/api/triggers', authenticate, triggerLimiter, async (req, res) => {
  try {
    if (!triggersAvailable()) return res.status(501).json({ error: 'Scheduling is not available on this deployment' });
    const { name, cron, timeZone, prompt, agentId, skillIds } = req.body || {};
    if (!name || !cron || !timeZone || !prompt) {
      return res.status(400).json({ error: 'name, cron, timeZone and prompt are all required' });
    }
    res.json(await createTrigger({ uid: req.user.uid, name, cron, timeZone, prompt, agentId, skillIds }));
  } catch (error) {
    console.error('create trigger failed:', error?.message || error);
    res.status(502).json({ error: 'Could not create that automation' });
  }
});

app.patch('/api/triggers/:id', authenticate, triggerLimiter, async (req, res) => {
  try {
    const updated = await setTriggerStatus(req.user.uid, req.params.id, !!req.body?.enabled);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (error) {
    console.error('update trigger failed:', error?.message || error);
    res.status(502).json({ error: 'Could not update that automation' });
  }
});

app.delete('/api/triggers/:id', authenticate, triggerLimiter, async (req, res) => {
  try {
    await deleteTrigger(req.user.uid, req.params.id);
    res.json({ ok: true });
  } catch (error) {
    console.error('delete trigger failed:', error?.message || error);
    res.status(502).json({ error: 'Could not delete that automation' });
  }
});

app.post('/api/triggers/:id/run', authenticate, triggerLimiter, async (req, res) => {
  try {
    const updated = await runTriggerNow(req.user.uid, req.params.id);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (error) {
    console.error('run trigger failed:', error?.message || error);
    res.status(502).json({ error: 'Could not start that automation' });
  }
});

app.get('/api/triggers/:id/executions', authenticate, pollLimiter, async (req, res) => {
  try {
    res.json({ executions: await listExecutions(req.user.uid, req.params.id) });
  } catch (error) {
    console.error('list executions failed:', error?.message || error);
    res.status(502).json({ error: 'Could not load run history' });
  }
});

app.post('/api/triggers/refresh', authenticate, triggerLimiter, async (req, res) => {
  try {
    res.json(await refreshStaleTriggers(req.user.uid));
  } catch (error) {
    console.error('refresh triggers failed:', error?.message || error);
    res.status(500).json({ error: 'Could not refresh automations' });
  }
});

/**
 * Deep research. Runs for up to an hour, so it is always background: started here, polled by the
 * client, and the report saved to Resources when it lands.
 */
const RESEARCH_AGENT = process.env.RESEARCH_AGENT || 'deep-research-preview-04-2026';

app.post('/api/research', authenticate, agentLimiter, async (req, res) => {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return res.status(501).json({ error: 'Research is not available on this deployment' });
    const query = String(req.body?.query || '').trim();
    if (!query) return res.status(400).json({ error: 'A question is required' });

    const upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key, 'Api-Revision': '2026-05-20' },
      body: JSON.stringify({
        agent: RESEARCH_AGENT,
        input: maskEmailsDeep(query),
        background: true,
        agent_config: { thinking_summaries: 'auto', visualization: 'off' },
      }),
      signal: AbortSignal.timeout(120000),
    });
    const text = await upstream.text();
    if (!upstream.ok) {
      console.error(`research start failed ${upstream.status}: ${text.slice(0, 300)}`);
      return res.status(502).json({ error: 'Could not start that research' });
    }
    res.type('application/json').send(text);
  } catch (error) {
    console.error('research start failed:', error?.message || error);
    res.status(502).json({ error: 'Could not start that research' });
  }
});

app.get('/api/research/:id', authenticate, pollLimiter, async (req, res) => {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return res.status(501).json({ error: 'Research is not available on this deployment' });
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/interactions/${req.params.id}`, {
      headers: { 'x-goog-api-key': key, 'Api-Revision': '2026-05-20' },
      signal: AbortSignal.timeout(60000),
    });
    const text = await upstream.text();
    res.status(upstream.ok ? 200 : 502).type('application/json').send(text);
  } catch (error) {
    console.error('research poll failed:', error?.message || error);
    res.status(502).json({ error: 'Could not check that research' });
  }
});

// England reference, fetched on demand rather than loaded into every prompt.
app.get('/api/kb/topics', authenticate, pollLimiter, (req, res) => res.json({ topics: listTier1() }));

app.get('/api/kb/topic/:id', authenticate, pollLimiter, (req, res) => {
  const doc = getTier1Doc(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json(doc);
});

// Health check.
app.get('/health', (req, res) => res.status(200).send('OK'));

// SPA catch-all — serve index.html for any non-API, non-asset route.
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});

// Long AI generations can run for minutes; extend the timeouts.
server.keepAliveTimeout = 300000;
server.headersTimeout = 305000;
server.requestTimeout = 300000;
server.timeout = 300000;
