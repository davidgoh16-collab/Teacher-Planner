#!/usr/bin/env node
/**
 * Spikes for the sandbox artifact pipeline, run against the real Interactions API.
 *
 * Three unknowns decide the design, and all three are cheaper to answer than to guess:
 *   S2  can the sandbox pip-install python-docx/pptx/openpyxl under a network allowlist?
 *   S3  does an allowlist `transform` really inject credentials into an arbitrary curl?
 *   S8  what does the environment look like — is there a writable /workspace, what's preinstalled?
 *
 * Usage: node scripts/spike-sandbox.mjs [s2|s3|s8]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const AGENT = 'antigravity-preview-05-2026';

const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY
  || readFileSync(path.join(ROOT, '.env.local'), 'utf8')
      .split('\n').find(l => l.startsWith('VITE_GEMINI_API_KEY='))?.split('=', 2)[1].trim();

const run = async (label, body) => {
  console.log(`\n=== ${label} ===`);
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': key,
      'Api-Revision': '2026-05-20',
    },
    body: JSON.stringify({
      agent: AGENT,
      agent_config: { type: 'antigravity', model: 'gemini-3.5-flash', max_total_tokens: 120_000 },
      ...body,
    }),
    signal: AbortSignal.timeout(900_000),
  });
  const raw = await res.text();
  let data;
  try { data = JSON.parse(raw); } catch { console.log(`HTTP ${res.status}: ${raw.slice(0, 500)}`); return null; }
  if (!res.ok) { console.log(`HTTP ${res.status}:`, JSON.stringify(data).slice(0, 500)); return null; }

  const text = (data.steps || [])
    .filter(s => s.type === 'model_output')
    .map(s => Array.isArray(s.content) ? s.content.map(c => c.text || '').join('') : (s.content?.text || ''))
    .join('').trim();
  console.log(`status=${data.status} env=${data.environment_id}`);
  console.log(text.slice(0, 2000));
  return data;
};

const which = process.argv[2] || 'all';

// S8 — what is actually in the box?
if (which === 's8' || which === 'all') {
  await run('S8 environment shape', {
    environment: 'remote',
    input: `Report exactly, as a short plain-text list, no commentary:
1. output of: python3 -c "import sys; print(sys.version)"
2. for each of docx, pptx, openpyxl: whether "python3 -c 'import <mod>'" succeeds (say PRESENT or MISSING)
3. whether /workspace exists and is writable (create /workspace/_probe then delete it)
4. output of: curl --version | head -1`,
  });
}

// S2 — pip install under an allowlist. If the libraries are already present this is moot, but the
// scheduled/offline case still needs to know whether installing works when they aren't.
if (which === 's2' || which === 'all') {
  await run('S2 pip install under allowlist', {
    environment: {
      type: 'remote',
      network: {
        allowlist: [
          { domain: 'pypi.org' },
          { domain: 'files.pythonhosted.org' },
        ],
      },
    },
    input: `Run: pip install --quiet python-docx python-pptx openpyxl
Then run: python3 -c "import docx, pptx, openpyxl; print('IMPORTS_OK')"
Report only the final line of output, plus the word FAILED and the error if it did not work.`,
  });
}

// S3 — the mechanism the whole artifact pipeline depends on: can the sandbox reach our server with
// a credential it never sees, injected by the egress proxy from the allowlist transform?
if (which === 's3' || which === 'all') {
  const SENTINEL = 'tp-spike-secret-value-9182';
  const data = await run('S3 transform-injected auth header', {
    environment: {
      type: 'remote',
      network: {
        allowlist: [
          { domain: 'postman-echo.com', transform: { 'X-Sandbox-Token': SENTINEL } },
        ],
      },
    },
    input: `Run: curl -s https://postman-echo.com/headers
Print the raw JSON response exactly as returned, and nothing else.
Then, separately, print whether a header named x-sandbox-token appeared in it (YES or NO).`,
  });
  const out = JSON.stringify(data || {});
  console.log(`\nsentinel visible to the agent's own output: ${out.includes(SENTINEL) ? 'YES (proxy echoed it back)' : 'no'}`);
}
