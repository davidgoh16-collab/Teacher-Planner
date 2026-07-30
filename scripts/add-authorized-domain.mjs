#!/usr/bin/env node
/**
 * Add a domain to Firebase Auth's authorised-domains list — safely.
 *
 * The Identity Toolkit config PATCH REPLACES the whole `authorizedDomains` array. Sending only the
 * new domain deletes every other entry and breaks sign-in for every app in the project, and this
 * project is shared with other apps. So: read the current config, append, and write the merged list
 * back, all in one process, refusing to proceed if the read looks wrong.
 *
 * Usage: node scripts/add-authorized-domain.mjs <domain> [--project id] [--dry-run]
 * Auth:  gcloud auth print-access-token (needs Firebase Auth admin rights on the project)
 */
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const domain = args.find(a => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const projectIdx = args.indexOf('--project');
const PROJECT = projectIdx !== -1 ? args[projectIdx + 1] : 'school-apps-52c7d';

// A sane floor for "the read returned a real list". Firebase always includes localhost and the two
// default hosting domains, so anything smaller means we got a partial/failed read — and writing
// that back would be the exact wipe this script exists to prevent.
const MIN_EXPECTED_DOMAINS = 3;

if (!domain) {
  console.error('Usage: node scripts/add-authorized-domain.mjs <domain> [--project id] [--dry-run]');
  process.exit(1);
}

const token = execFileSync('gcloud', ['auth', 'print-access-token', '--project', PROJECT], {
  encoding: 'utf8',
  env: { ...process.env, CLOUDSDK_PYTHON: process.env.CLOUDSDK_PYTHON || '/opt/homebrew/bin/python3.14' },
}).trim();

const CONFIG_URL = `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT}/config`;
const authHeaders = {
  Authorization: `Bearer ${token}`,
  'x-goog-user-project': PROJECT,
  'Content-Type': 'application/json',
};

const getRes = await fetch(CONFIG_URL, { headers: authHeaders });
if (!getRes.ok) {
  console.error(`Read failed (HTTP ${getRes.status}): ${(await getRes.text()).slice(0, 400)}`);
  process.exit(1);
}
const config = await getRes.json();
const current = config.authorizedDomains;

if (!Array.isArray(current) || current.length < MIN_EXPECTED_DOMAINS) {
  console.error(`Refusing to write: read back ${Array.isArray(current) ? current.length : 'no'} domains, expected at least ${MIN_EXPECTED_DOMAINS}.`);
  console.error('Writing this list back would delete the real one. Investigate before retrying.');
  process.exit(1);
}

console.log(`Current authorised domains (${current.length}):`);
current.forEach(d => console.log(`  - ${d}`));

if (current.includes(domain)) {
  console.log(`\n"${domain}" is already authorised. Nothing to do.`);
  process.exit(0);
}

const merged = [...current, domain];
console.log(`\nAdding "${domain}" -> ${merged.length} domains total.`);

if (dryRun) {
  console.log('--dry-run: not writing.');
  process.exit(0);
}

const patchRes = await fetch(`${CONFIG_URL}?updateMask=authorizedDomains`, {
  method: 'PATCH',
  headers: authHeaders,
  body: JSON.stringify({ authorizedDomains: merged }),
});
if (!patchRes.ok) {
  console.error(`Write failed (HTTP ${patchRes.status}): ${(await patchRes.text()).slice(0, 400)}`);
  process.exit(1);
}

// Read back independently rather than trusting the PATCH response.
const verify = await (await fetch(CONFIG_URL, { headers: authHeaders })).json();
const after = verify.authorizedDomains || [];
const lost = current.filter(d => !after.includes(d));
if (lost.length) {
  console.error(`\nDOMAINS LOST: ${lost.join(', ')} — restore them in the Firebase console now.`);
  process.exit(1);
}
console.log(`\nVerified: ${after.length} domains, "${domain}" present, none lost.`);
