import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';

/**
 * The England knowledge base, and how it reaches the agent.
 *
 * Three tiers, because they have genuinely different lifetimes:
 *
 *   system   Behavioural rules — safeguarding, inspection language, don't-assume. Injected into
 *            every run, always, because they are about what the assistant must not get wrong.
 *   tier 1   Stable reference (key stages, grading, the Teachers' Standards). Baked into the image.
 *            An index of one-line summaries goes into every prompt; full text is fetched on demand.
 *   tier 2   Statutory guidance revised on a schedule (KCSIE, exclusions, RSHE, STPCD). Never baked
 *            in — editions supersede each other, and a stale copy quoted confidently is worse than
 *            no copy. Only the canonical URL lives in the repo; current summaries are cached in
 *            Firestore with the date they were fetched, and the agent is told to say so.
 *
 * The teacher's OWN school is deliberately not here. That comes from their configuration or from
 * asking them — see knowledge/system/ask-dont-assume.md.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_ROOT = path.join(__dirname, '..', '..', 'knowledge');
const SYSTEM_DIR = path.join(KNOWLEDGE_ROOT, 'system');
const TIER1_DIR = path.join(KNOWLEDGE_ROOT, 'england', 'tier1');
const TIER2_MANIFEST = path.join(KNOWLEDGE_ROOT, 'england', 'tier2', 'manifest.json');

/** Pull the frontmatter and body out of a knowledge file. */
const parseDoc = (raw) => {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  const meta = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { meta, body: match[2] };
};

// Read once: these files ship inside the image and cannot change while it runs.
let cache = null;
const load = () => {
  if (cache) return cache;

  const system = existsSync(SYSTEM_DIR)
    ? readdirSync(SYSTEM_DIR).filter(f => f.endsWith('.md'))
        .map(f => readFileSync(path.join(SYSTEM_DIR, f), 'utf8').trim())
    : [];

  const tier1 = existsSync(TIER1_DIR)
    ? readdirSync(TIER1_DIR).filter(f => f.endsWith('.md')).map(f => {
        const { meta, body } = parseDoc(readFileSync(path.join(TIER1_DIR, f), 'utf8'));
        return { id: meta.id || f.replace(/\.md$/, ''), title: meta.title || f, summary: meta.summary || '', body };
      })
    : [];

  let tier2 = { topics: [] };
  try { tier2 = JSON.parse(readFileSync(TIER2_MANIFEST, 'utf8')); } catch { /* optional */ }

  cache = { system, tier1, tier2 };
  return cache;
};

export const getTier1Doc = (id) => load().tier1.find(d => d.id === id) || null;
export const listTier1 = () => load().tier1.map(({ id, title, summary }) => ({ id, title, summary }));
export const listTier2Topics = () => load().tier2.topics || [];

/** Which statutory topics a message is actually about — keyword match, kept deliberately simple. */
const matchTier2 = (text) => {
  const lower = (text || '').toLowerCase();
  return listTier2Topics().filter(t => (t.keywords || []).some(k => lower.includes(k)));
};

/** Cached current-edition summaries, written by scripts/kb-refresh.mjs. */
const fetchTier2Cache = async (ids) => {
  if (ids.length === 0) return [];
  try {
    const snaps = await Promise.all(
      ids.map(id => admin.firestore().collection('kb_tier2').doc(id).get()),
    );
    return snaps.filter(s => s.exists).map(s => s.data());
  } catch (e) {
    console.error('Could not read the statutory-guidance cache:', e?.message || e);
    return [];
  }
};

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Build the preamble prepended to an agent run.
 *
 * `userText` is used only to decide which statutory topics are relevant; nothing is stored.
 */
export const buildKnowledgePreamble = async (userText = '') => {
  const { system } = load();
  const parts = [];

  parts.push('# How to work with this teacher\n');
  parts.push(...system);

  const index = listTier1();
  if (index.length) {
    parts.push(
      '# England reference available to you\n\n'
      + 'You have accurate reference material on the English school system. Summaries:\n\n'
      + index.map(d => `- **${d.title}** — ${d.summary}`).join('\n')
      + '\n\nUse it rather than generic or American schooling assumptions. British spelling throughout.',
    );
  }

  const relevant = matchTier2(userText);
  if (relevant.length) {
    const cached = await fetchTier2Cache(relevant.map(t => t.id));
    const byId = new Map(cached.map(c => [c.topicId, c]));

    const lines = ['# Statutory guidance relevant to this request\n'];
    for (const topic of relevant) {
      const entry = byId.get(topic.id);
      if (entry?.summaryMd) {
        const age = Date.now() - (entry.fetchedAt || 0);
        const stale = age > 13 * MONTH_MS;
        lines.push(
          `## ${topic.title}${entry.editionLabel ? ` (${entry.editionLabel})` : ''}\n\n`
          + `${entry.summaryMd}\n\n`
          + `Source: ${entry.sourceUrl || topic.canonicalUrl} — checked ${new Date(entry.fetchedAt || 0).toISOString().slice(0, 10)}.`
          + (stale ? ' This was checked a while ago; verify against the source before relying on specifics.' : ''),
        );
      } else {
        // Better to admit we haven't checked than to let the model fill the gap from training data.
        lines.push(
          `## ${topic.title}\n\n`
          + `This is statutory guidance that is revised periodically, and you do not have the current `
          + `version to hand. ${topic.editionNote || ''} Do not state its detailed contents from memory. `
          + `Read ${topic.canonicalUrl} if the task needs specifics, and tell the teacher which edition `
          + `you used.`,
        );
      }
    }
    parts.push(lines.join('\n\n'));
  }

  return parts.join('\n\n---\n\n');
};
