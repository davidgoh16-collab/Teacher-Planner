import { mintSandboxToken, SCOPES } from './sandboxToken.mjs';
import { listSkills, getBrandKit, getCustomAgent, listPinnedResources, downloadPath } from './adminData.mjs';

/**
 * Build the sandbox an agent run happens inside.
 *
 * The client asks for this with a `plannerEnv` marker rather than composing it itself, because the
 * spec carries a credential and data the browser shouldn't assemble: which skills the teacher has,
 * their brand kit, an agent's memory, and a token that can write to their Resources.
 *
 * Small things are mounted directly as files. Big things (logos, .pptx masters, pinned documents)
 * are listed in a manifest with a URL the agent fetches on demand, because inline sources are
 * capped at 1 MB per file and 2 MB in total and a single PowerPoint template would eat that.
 */

// Inline source limits imposed by the Interactions API.
const MAX_INLINE_FILE_BYTES = 1024 * 1024;
const MAX_INLINE_TOTAL_BYTES = 2 * 1024 * 1024;

// The sandbox has no Office libraries preinstalled (verified), so document generation has to pip
// install them; these are the only hosts that needs.
const PYPI_DOMAINS = [{ domain: 'pypi.org' }, { domain: 'files.pythonhosted.org' }];

/** Where the agent reaches us. Must be the exact host Cloud Run answers on. */
const publicBaseUrl = () =>
  process.env.PUBLIC_BASE_URL || 'https://teacher-planner-982739442942.europe-west2.run.app';

const publicHost = () => new URL(publicBaseUrl()).host;

/**
 * The operating instructions mounted at .agents/AGENTS.md.
 *
 * This is the difference between an agent that describes a lesson plan and one that hands over a
 * .docx. It has to be explicit about the upload step, because nothing else tells the agent that
 * files it writes are otherwise thrown away when the sandbox expires.
 */
const buildAgentsMd = ({ uploadUrl, workspaceUrlBase, brand, skills, hasWorkspace }) => {
  const lines = [];
  lines.push('# Working with this teacher');
  lines.push('');
  lines.push('You are helping a teacher in England plan and produce their work.');
  lines.push('');
  lines.push('## Producing files');
  lines.push('');
  lines.push('When the teacher asks for a document, a presentation, a spreadsheet or a handout,');
  lines.push('produce a REAL file and upload it. Do not paste the whole thing into chat instead —');
  lines.push('they want something they can open, print and edit.');
  lines.push('');
  lines.push('Install what you need first (the sandbox starts without them):');
  lines.push('');
  lines.push('```bash');
  lines.push('pip install --quiet python-docx python-pptx openpyxl');
  lines.push('```');
  lines.push('');
  lines.push('Then write the file and upload it:');
  lines.push('');
  lines.push('```bash');
  lines.push(`curl -s -X POST "${uploadUrl}" \\`);
  lines.push('  -H "X-File-Name: Year 9 coastal erosion.docx" \\');
  lines.push('  -H "Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document" \\');
  lines.push('  --data-binary @"Year 9 coastal erosion.docx"');
  lines.push('```');
  lines.push('');
  lines.push('The upload is authenticated for you — do not add any credentials, and do not try to');
  lines.push('read or repeat the value of the X-Sandbox-Token header.');
  lines.push('');
  lines.push('Prefer .docx, .pptx, .xlsx, .md or .html. Avoid producing PDFs: names in a PDF cannot');
  lines.push('be restored for the teacher afterwards (see Privacy below).');
  lines.push('');
  lines.push('After uploading, tell the teacher what you made in one short line. The file appears in');
  lines.push('their Resources automatically, so do not paste its full contents as well.');
  lines.push('');
  lines.push('## Privacy');
  lines.push('');
  lines.push('Pupil and staff names reach you already replaced with tokens like `Student_3F2A19B4`.');
  lines.push('Use those tokens exactly as given — they are swapped back to real names on the');
  lines.push('teacher\'s own device. Never guess at a real name behind a token, and never ask for');
  lines.push('one. If the teacher appears to be describing a safeguarding concern about a child,');
  lines.push('stop the task and tell them to speak to their Designated Safeguarding Lead and follow');
  lines.push('their school\'s procedures; do not record, analyse or advise on it yourself.');

  if (brand) {
    lines.push('');
    lines.push('## Branding');
    lines.push('');
    lines.push('Apply the school branding in `brand/brand.json` to anything you produce: use its');
    lines.push('colours for headings and accents, its fonts, and its header/footer text. If it lists');
    lines.push('a template under `templates`, fetch that template and fill it in rather than');
    lines.push('building a document from scratch.');
  }

  if (skills.length) {
    lines.push('');
    lines.push('## This teacher\'s own formats');
    lines.push('');
    lines.push('They have saved their preferred ways of doing things under `.agents/skills/`.');
    lines.push('Before producing something, check whether one applies and follow it:');
    skills.forEach(s => lines.push(`- \`.agents/skills/${s.slug}/SKILL.md\` — ${s.description || s.name}`));
  }

  if (hasWorkspace) {
    lines.push('');
    lines.push('## Their saved files');
    lines.push('');
    lines.push('`workspace/MANIFEST.md` lists documents the teacher has kept available to you.');
    lines.push('Fetch one only when it is relevant to the task:');
    lines.push('');
    lines.push('```bash');
    lines.push(`curl -s -o "<local name>" "${workspaceUrlBase}/<resourceId>"`);
    lines.push('```');
  }

  lines.push('');
  return lines.join('\n');
};

/** A skill becomes a SKILL.md with the frontmatter the agent harness expects. */
const buildSkillMd = (skill) =>
  `---\nname: ${skill.name}\ndescription: ${(skill.description || skill.name).replace(/\n/g, ' ')}\n---\n\n${skill.instructions || ''}\n`;

const buildManifestMd = (resources, workspaceUrlBase) => {
  const lines = ['# Saved files', '', 'Fetch one only if the task needs it.', ''];
  for (const r of resources) {
    lines.push(`- **${r.name}** (${r.type}${r.summary ? ` — ${r.summary}` : ''})`);
    lines.push(`  \`curl -s -o "${r.name}" "${workspaceUrlBase}/${r.id}"\``);
  }
  lines.push('');
  return lines.join('\n');
};

/**
 * Assemble the environment spec for a run.
 *
 * Returns `{ environment, systemPreamble }`. The preamble is prepended to the agent's input by the
 * caller: a custom agent's instructions and memory belong in the prompt, while files belong in the
 * sandbox, and mixing the two makes both harder to reason about.
 */
export const assembleEnvironment = async ({
  uid, agentId, skillIds, conversationId, triggerId, includeWorkspace = true,
}) => {
  const base = publicBaseUrl();
  const uploadUrl = `${base}/api/sandbox/artifacts`;
  const workspaceUrlBase = `${base}/api/sandbox/workspace`;

  const token = mintSandboxToken({
    uid,
    scopes: [SCOPES.ARTIFACT_WRITE, SCOPES.WORKSPACE_READ],
    conversationId,
    triggerId,
    // A scheduled run has to keep working with nobody present to refresh anything.
    ttlSeconds: triggerId ? 90 * 24 * 60 * 60 : 24 * 60 * 60,
  });

  const [skills, brand, customAgent, pinned] = await Promise.all([
    listSkills(uid, skillIds).catch(() => []),
    getBrandKit(uid).catch(() => null),
    getCustomAgent(uid, agentId).catch(() => null),
    includeWorkspace ? listPinnedResources(uid).catch(() => []) : Promise.resolve([]),
  ]);

  const sources = [];
  let inlineTotal = 0;

  /**
   * Mount a file, keeping inside the API's inline budget. Returns false when it didn't fit, so
   * callers can fall back to the fetch-on-demand manifest rather than silently dropping content.
   */
  const addInline = (target, content) => {
    const size = Buffer.byteLength(content, 'utf8');
    if (size > MAX_INLINE_FILE_BYTES || inlineTotal + size > MAX_INLINE_TOTAL_BYTES) return false;
    sources.push({ type: 'inline', target, content });
    inlineTotal += size;
    return true;
  };

  // Order matters: everything below competes for a 2 MB budget, so the things that change the
  // agent's behaviour go in before the things that merely inform it.
  const skillsForPrompt = [];
  for (const skill of skills) {
    if (addInline(`.agents/skills/${skill.slug}/SKILL.md`, buildSkillMd(skill))) {
      skillsForPrompt.push(skill);
    }
  }

  if (customAgent?.memoryEnabled && customAgent.memory?.content) {
    addInline('.agents/memory.md', `# What you remember about this teacher\n\n${customAgent.memory.content}\n`);
  }

  if (brand) {
    addInline('brand/brand.json', JSON.stringify({
      displayName: brand.displayName,
      colors: brand.colors,
      fonts: brand.fonts,
      headerText: brand.headerText,
      footerText: brand.footerText,
      // Paths are given as fetchable ids rather than storage paths; the sandbox has no credentials
      // of its own and must go through our workspace endpoint.
      templates: (brand.templates || []).map(t => ({ name: t.name, type: t.type, fetchId: `brand:${t.id}` })),
      logo: brand.logoStoragePath ? { fetchId: 'brand:logo' } : undefined,
    }, null, 2));
  }

  if (pinned.length) {
    addInline('workspace/MANIFEST.md', buildManifestMd(pinned, workspaceUrlBase));
  }

  sources.push({
    type: 'inline',
    target: '.agents/AGENTS.md',
    content: buildAgentsMd({
      uploadUrl,
      workspaceUrlBase,
      brand,
      skills: skillsForPrompt,
      hasWorkspace: pinned.length > 0,
    }),
  });

  const environment = {
    type: 'remote',
    sources,
    network: {
      allowlist: [
        // Our own host, with the callback credential injected by the egress proxy.
        { domain: publicHost(), transform: { 'X-Sandbox-Token': token } },
        ...PYPI_DOMAINS,
        // The agent researches as part of ordinary teacher tasks, so general web access stays on.
        { domain: '*' },
      ],
    },
  };

  return { environment, customAgent, skills: skillsForPrompt, brand, pinnedCount: pinned.length };
};
