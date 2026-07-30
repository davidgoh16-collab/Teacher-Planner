#!/usr/bin/env node
/**
 * Refresh the cached summaries of statutory guidance (Tier 2).
 *
 * These documents are reissued on a schedule — KCSIE most Septembers, and both the exclusions and
 * RSHE guidance changed during 2026 — so nothing about them is baked into the repo except the
 * canonical URL. This reads each current page via the agent and writes a summary to Firestore,
 * stamped with the date, so the assistant can say which edition it is working from.
 *
 * Run it each August, and again whenever a known change lands.
 *
 *   node scripts/kb-refresh.mjs                # all topics
 *   node scripts/kb-refresh.mjs kcsie          # one topic
 *   node scripts/kb-refresh.mjs --dry-run      # fetch and print, write nothing
 *
 * Auth: Application Default Credentials for Firestore, plus a Gemini key for the agent.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MANIFEST = path.join(ROOT, 'knowledge', 'england', 'tier2', 'manifest.json');
const PROJECT = process.env.FIREBASE_PROJECT_ID || 'school-apps-52c7d';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const only = args.filter(a => !a.startsWith('--'));

const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY
  || readFileSync(path.join(ROOT, '.env.local'), 'utf8')
      .split('\n').find(l => l.startsWith('VITE_GEMINI_API_KEY='))?.split('=', 2)[1].trim();
if (!key) {
  console.error('No Gemini key. Set GEMINI_API_KEY.');
  process.exit(1);
}

if (!dryRun && !admin.apps.length) admin.initializeApp({ projectId: PROJECT });

const { topics } = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const wanted = only.length ? topics.filter(t => only.includes(t.id)) : topics;

const summarise = async (topic) => {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key, 'Api-Revision': '2026-05-20' },
    body: JSON.stringify({
      agent: 'antigravity-preview-05-2026',
      agent_config: { type: 'antigravity', model: 'gemini-3.5-flash', max_total_tokens: 200_000 },
      environment: 'remote',
      tools: [{ type: 'url_context' }, { type: 'google_search' }],
      input:
        `Read ${topic.canonicalUrl} and identify the version of "${topic.title}" that is currently in force.\n\n`
        + `Reply with EXACTLY this, and nothing else:\n\n`
        + `EDITION: <how the current version is named, e.g. "2026 edition" or "in force from 26 July 2026">\n`
        + `EFFECTIVE: <the date it came into force, as YYYY-MM-DD, or "unknown">\n`
        + `URL: <the URL of the current document or landing page you actually used>\n`
        + `SUMMARY:\n`
        + `<400-700 words of markdown covering what this guidance requires of schools: the duties, `
        + `the key terminology and definitions, any timescales, and anything that changed in this `
        + `edition. Write it for a teacher. Do not invent anything you did not read.>`,
    }),
    signal: AbortSignal.timeout(900_000),
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${raw.slice(0, 200)}`);
  const data = JSON.parse(raw);
  const text = (data.steps || [])
    .filter(s => s.type === 'model_output')
    .map(s => (Array.isArray(s.content) ? s.content.map(c => c.text || '').join('') : s.content?.text || ''))
    .join('').trim();

  const field = (name) => (text.match(new RegExp(`^${name}:\\s*(.+)$`, 'm')) || [])[1]?.trim() || '';
  const summaryIdx = text.indexOf('SUMMARY:');
  return {
    editionLabel: field('EDITION'),
    effectiveFrom: field('EFFECTIVE'),
    sourceUrl: field('URL') || topic.canonicalUrl,
    summaryMd: summaryIdx >= 0 ? text.slice(summaryIdx + 'SUMMARY:'.length).trim() : text,
  };
};

let ok = 0;
for (const topic of wanted) {
  process.stdout.write(`${topic.id} … `);
  try {
    const result = await summarise(topic);
    if (!result.summaryMd || result.summaryMd.length < 200) throw new Error('summary too short to trust');

    if (dryRun) {
      console.log(`${result.editionLabel || '(no edition)'} — ${result.summaryMd.length} chars`);
    } else {
      await admin.firestore().collection('kb_tier2').doc(topic.id).set({
        topicId: topic.id,
        title: topic.title,
        canonicalUrl: topic.canonicalUrl,
        ...result,
        fetchedAt: Date.now(),
        status: 'current',
      });
      console.log(`saved (${result.editionLabel || 'edition unknown'})`);
    }
    ok += 1;
  } catch (e) {
    console.log(`FAILED — ${e.message}`);
  }
}

console.log(`\n${ok}/${wanted.length} topics refreshed.`);
process.exit(ok === wanted.length ? 0 : 1);
