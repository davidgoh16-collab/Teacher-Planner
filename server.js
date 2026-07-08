import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import admin from 'firebase-admin';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// The Firebase project this app authenticates against (from firebase.ts config).
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'school-apps-52c7d';

// The native-audio voice model the Live API ephemeral token is scoped to.
const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

// The Antigravity Interactions API requires an explicit revision header on REST calls.
const AGENT_API_REVISION = '2026-05-20';

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
app.use(express.json({ limit: '50mb' }));

// Runtime environment for the browser. ONLY the Firebase web API key is exposed — it is an
// identifier, not a secret (access control lives in firestore.rules). The Gemini API key is
// NEVER shipped to the client; it stays server-side behind the /api proxies below.
app.get('/env.js', (req, res) => {
  // The Firebase web API key is a public client identifier (not a secret — access control lives in
  // firestore.rules). Default to the known project key so the app works even if the runtime env var
  // is unset; it is served to the browser here rather than being hardcoded into the client bundle.
  const firebaseKey = process.env.VITE_FIREBASE_API_KEY || 'AIzaSyDsHETgCAabxH8VTLI9yE9oXAyU9XlttIg';
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(`window.ENV = ${JSON.stringify({ VITE_FIREBASE_API_KEY: firebaseKey })};\n`);
});

// Serve the built SPA.
app.use(express.static(path.join(__dirname, 'dist')));

// Rate limiter for all API endpoints (authenticated-only burst guard).
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', apiLimiter);

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
app.post('/api/generate-content', authenticate, async (req, res) => {
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
// generativelanguage interactions endpoint with the server key. Buffers the response (including
// SSE streams) and returns it verbatim so the client keeps parsing it as before.
app.post('/api/interactions/step', authenticate, async (req, res) => {
  try {
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) return res.status(500).json({ error: 'Internal Server Error' });

    const body = req.body;
    if (!body || !body.agent) {
      return res.status(400).json({ error: 'Missing agent in request body' });
    }

    // Data-minimisation backstop: strip any email address before it leaves our server.
    const safeBody = maskEmailsDeep(body);

    const upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': API_KEY,
        'Api-Revision': AGENT_API_REVISION,
      },
      body: JSON.stringify(safeBody),
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      console.error(`Interactions API error ${upstream.status}: ${text.slice(0, 500)}`);
      const status = upstream.status === 429 ? 429 : 502;
      return res.status(status).json({ error: `Agent unavailable (${upstream.status})` });
    }
    if (!res.headersSent) {
      res.type(upstream.headers.get('content-type') || 'application/json').send(text);
    }
  } catch (error) {
    console.error('interactions proxy error:', error?.message || error);
    if (!res.headersSent) res.status(502).json({ error: 'Agent unavailable' });
  }
});

// Mint a short-lived ephemeral token for the Live (native-audio) API so the browser can open a
// realtime session WITHOUT ever seeing the raw Gemini key. If the installed SDK can't mint one,
// return { token: null, disabled: true } and the client shows the voice assistant as unavailable
// rather than falling back to shipping the raw key.
app.post('/api/live-token', authenticate, async (req, res) => {
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
