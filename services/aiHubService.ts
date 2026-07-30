import { getDocs, setDoc, deleteDoc, getDoc, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';
import { TeacherSkill, BrandKit, CustomAgent, McpServerConfig } from '../types';
import { userCol, userDocRef, currentUid } from './userScope';

/**
 * Storage for the things that shape how the AI works for this teacher: their saved formats
 * (skills), their school's branding, the assistants they've defined, and any external tool servers
 * they've connected.
 *
 * All per-user, all read server-side by the Admin SDK when a run is assembled.
 */

const SKILLS = 'teacher_planner_skills';
const AGENTS = 'teacher_planner_agents';
const MCP = 'teacher_planner_mcp_servers';
const BRAND = 'teacher_planner_brand_kit';

const now = () => Date.now();
const newId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/** Directory-safe name for the sandbox: lowercase, hyphenated, no surprises. */
export const slugify = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'skill';

// --- Skills ---------------------------------------------------------------------------------

export const fetchSkills = async (): Promise<TeacherSkill[]> => {
  try {
    const snap = await getDocs(query(userCol(SKILLS), orderBy('updatedAt', 'desc')));
    return snap.docs.map(d => d.data() as TeacherSkill);
  } catch (e) {
    console.error('Error fetching skills', e);
    return [];
  }
};

export const saveSkill = async (skill: Partial<TeacherSkill> & { name: string; instructions: string }): Promise<TeacherSkill> => {
  const id = skill.id || newId('skill');
  const record: TeacherSkill = {
    id,
    name: skill.name,
    slug: skill.slug || slugify(skill.name),
    description: skill.description || '',
    instructions: skill.instructions,
    assets: skill.assets || [],
    enabled: skill.enabled !== false,
    createdAt: skill.createdAt || now(),
    updatedAt: now(),
  };
  await setDoc(userDocRef(SKILLS, id), record);
  return record;
};

export const deleteSkill = async (skill: TeacherSkill): Promise<void> => {
  await deleteDoc(userDocRef(SKILLS, skill.id));
  for (const asset of skill.assets || []) {
    await deleteObject(ref(storage, asset.storagePath)).catch(() => { /* index entry is gone; sweep handles the rest */ });
  }
};

/** Pull `{ name, description }` frontmatter and the body out of a SKILL.md file. */
const parseSkillMarkdown = (raw: string, fallbackName: string): { name: string; description: string; instructions: string } => {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { name: fallbackName, description: '', instructions: raw.trim() };
  const meta: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) meta[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
  }
  return { name: meta.name || fallbackName, description: meta.description || '', instructions: match[2].trim() };
};

/**
 * Import a skill from a `.skill` package — the same format this app materialises server-side
 * (`.agents/skills/<slug>/SKILL.md` plus any supporting files), and the format Claude's own Agent
 * Skills use. It's a zip: a SKILL.md with name/description frontmatter, optionally alongside
 * reference files, scripts or assets a teacher may have bundled in.
 *
 * Falls back to treating the upload as a bare SKILL.md if it isn't a zip (or has no SKILL.md
 * inside one) — some exporters produce just the markdown file, and there's no reason to reject a
 * perfectly good skill for missing packaging.
 *
 * Returns which supporting files, if any, didn't make it — a skill package can legitimately
 * contain a references/ or scripts/ subfolder, and a permission or size problem on one of those
 * must not be swallowed. The skill itself is still saved with whatever did succeed.
 */
export const importSkillFile = async (file: File): Promise<{ skill: TeacherSkill; failedAssets: string[] }> => {
  let raw: string | null = null;
  let assetDir = '';
  let assetEntries: Array<[string, any]> = [];

  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(file);
    const entryPath = Object.keys(zip.files).find(p => /(^|\/)SKILL\.md$/i.test(p) && !zip.files[p].dir);
    if (entryPath) {
      raw = await zip.files[entryPath].async('string');
      assetDir = entryPath.includes('/') ? entryPath.slice(0, entryPath.lastIndexOf('/') + 1) : '';
      assetEntries = Object.entries(zip.files).filter(([path, entry]: [string, any]) =>
        !entry.dir && path !== entryPath && path.startsWith(assetDir) && !path.startsWith('__MACOSX/'));
    }
  } catch {
    // Not a zip — fall through and read it as plain text below.
  }

  if (raw === null) raw = await file.text();

  const fallbackName = file.name.replace(/\.(skill|zip|md|markdown)$/i, '');
  const parsed = parseSkillMarkdown(raw, fallbackName);
  // A skill package's directory name is often its canonical slug (e.g. "lesson-plan-format/SKILL.md")
  // and worth keeping if the imported skill is used elsewhere too.
  const dirSlug = assetDir ? assetDir.replace(/\/$/, '').split('/').pop() : '';

  const id = newId('skill');
  const assets: TeacherSkill['assets'] = [];
  const failedAssets: string[] = [];
  for (const [path, entry] of assetEntries) {
    const name = path.slice(assetDir.length);
    try {
      const blob: Blob = await entry.async('blob');
      assets.push(await uploadSkillAsset(id, new File([blob], name, { type: blob.type || 'application/octet-stream' })));
    } catch (e) {
      console.warn(`Could not import asset "${path}" from ${file.name}`, e);
      failedAssets.push(name);
    }
  }

  const skill = await saveSkill({
    id,
    name: parsed.name,
    slug: slugify(dirSlug || parsed.name),
    description: parsed.description,
    instructions: parsed.instructions,
    assets,
    enabled: true,
  });
  return { skill, failedAssets };
};

export const uploadSkillAsset = async (skillId: string, file: File) => {
  const uid = currentUid();
  const storagePath = `users/${uid}/skills/${skillId}/${file.name}`;
  await uploadBytes(ref(storage, storagePath), file, { contentType: file.type || 'application/octet-stream' });
  return { name: file.name, storagePath, size: file.size, mimeType: file.type || 'application/octet-stream' };
};

// --- Brand kit ------------------------------------------------------------------------------

const DEFAULT_BRAND: BrandKit = {
  colors: { primary: '#5d7752', secondary: '#436d88', accent: '#a8763e', text: '#1f2937' },
  fonts: { heading: 'Merriweather', body: 'Merriweather' },
  templates: [],
  updatedAt: 0,
};

export const fetchBrandKit = async (): Promise<BrandKit> => {
  try {
    const snap = await getDoc(userDocRef(BRAND, 'default'));
    return snap.exists() ? { ...DEFAULT_BRAND, ...(snap.data() as BrandKit) } : { ...DEFAULT_BRAND };
  } catch (e) {
    console.error('Error fetching brand kit', e);
    return { ...DEFAULT_BRAND };
  }
};

export const saveBrandKit = async (kit: BrandKit): Promise<void> => {
  await setDoc(userDocRef(BRAND, 'default'), { ...kit, updatedAt: now() });
};

export const uploadBrandLogo = async (file: File): Promise<string> => {
  const uid = currentUid();
  const storagePath = `users/${uid}/brand/logo-${Date.now()}.${(file.name.split('.').pop() || 'png')}`;
  await uploadBytes(ref(storage, storagePath), file, { contentType: file.type || 'image/png' });
  return storagePath;
};

export const uploadBrandTemplate = async (file: File) => {
  const uid = currentUid();
  const id = newId('tpl');
  const storagePath = `users/${uid}/brand/templates/${id}-${file.name}`;
  await uploadBytes(ref(storage, storagePath), file, { contentType: file.type || 'application/octet-stream' });
  const type = file.name.toLowerCase().endsWith('.pptx') ? 'pptx' : 'docx';
  return { id, name: file.name, type: type as 'docx' | 'pptx', storagePath };
};

// --- Custom agents --------------------------------------------------------------------------

export const fetchCustomAgents = async (): Promise<CustomAgent[]> => {
  try {
    const snap = await getDocs(query(userCol(AGENTS), orderBy('updatedAt', 'desc')));
    return snap.docs.map(d => d.data() as CustomAgent);
  } catch (e) {
    console.error('Error fetching custom agents', e);
    return [];
  }
};

export const saveCustomAgent = async (agent: Partial<CustomAgent> & { name: string; instructions: string }): Promise<CustomAgent> => {
  const id = agent.id || newId('agent');
  const record: CustomAgent = {
    id,
    name: agent.name,
    description: agent.description || '',
    instructions: agent.instructions,
    model: agent.model || 'gemini-3.5-flash',
    maxTotalTokens: agent.maxTotalTokens,
    tools: agent.tools || { plannerTools: false, codeExecution: true, googleSearch: true, urlContext: true },
    mcpServerIds: agent.mcpServerIds || [],
    skillIds: agent.skillIds || [],
    includePlannerContext: agent.includePlannerContext !== false,
    memoryEnabled: !!agent.memoryEnabled,
    memory: agent.memory,
    sensitiveAckAt: agent.sensitiveAckAt,
    createdAt: agent.createdAt || now(),
    updatedAt: now(),
  };
  await setDoc(userDocRef(AGENTS, id), record);
  return record;
};

export const deleteCustomAgent = async (id: string): Promise<void> => {
  await deleteDoc(userDocRef(AGENTS, id));
};

/**
 * Replace an agent's memory.
 *
 * `content` is stored exactly as given. When the agent writes its own memory that text is
 * pseudonymised (it never saw real names), and keeping it that way means the stored record can't
 * quietly become a place identifying details accumulate.
 */
export const setAgentMemory = async (agent: CustomAgent, content: string): Promise<CustomAgent> => {
  const updated: CustomAgent = { ...agent, memory: { content, updatedAt: now() }, updatedAt: now() };
  await setDoc(userDocRef(AGENTS, agent.id), updated);
  return updated;
};

// --- MCP servers ----------------------------------------------------------------------------

/** The provider requires lowercase alphanumeric names; uppercase gets a bare 400. */
export const isValidMcpName = (name: string): boolean => /^[a-z0-9_-]+$/.test(name);

export const fetchMcpServers = async (): Promise<McpServerConfig[]> => {
  try {
    const snap = await getDocs(query(userCol(MCP), orderBy('updatedAt', 'desc')));
    return snap.docs.map(d => d.data() as McpServerConfig);
  } catch (e) {
    console.error('Error fetching MCP servers', e);
    return [];
  }
};

export const saveMcpServer = async (server: Partial<McpServerConfig> & { name: string; url: string }): Promise<McpServerConfig> => {
  const id = server.id || newId('mcp');
  const record: McpServerConfig = {
    id,
    name: server.name,
    url: server.url,
    headers: server.headers || {},
    allowedTools: server.allowedTools || [],
    enabled: server.enabled !== false,
    createdAt: server.createdAt || now(),
    updatedAt: now(),
  };
  await setDoc(userDocRef(MCP, id), record);
  return record;
};

export const deleteMcpServer = async (id: string): Promise<void> => {
  await deleteDoc(userDocRef(MCP, id));
};
