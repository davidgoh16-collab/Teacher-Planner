import admin from 'firebase-admin';

/**
 * Server-side reads and writes for agent runs, using the Admin SDK.
 *
 * The sandbox pipeline needs data the browser can't be trusted to supply (which skills exist, what
 * the brand kit says) and has to write artifacts on behalf of a user who isn't holding the request
 * (a scheduled run has no browser at all). Everything here is scoped by an explicit uid taken from
 * a verified token — never from request input.
 */

// Resources live in the UK bucket, not the project's default us-central1 one.
export const RESOURCES_BUCKET = process.env.RESOURCES_BUCKET || 'teacher-planner-eu-982739442942';

const db = () => admin.firestore();
const bucket = () => admin.storage().bucket(RESOURCES_BUCKET);

const userCol = (uid, name) => db().collection('users').doc(uid).collection(name);

const EXTENSION_TYPES = {
  docx: 'docx', pptx: 'pptx', xlsx: 'xlsx', pdf: 'pdf', md: 'md', markdown: 'md',
  html: 'html', htm: 'html', csv: 'csv', txt: 'txt', png: 'png', jpg: 'jpg', jpeg: 'jpg',
};

/** Strip any path components a filename might carry — the sandbox chooses this string. */
export const safeFileName = (raw) => {
  const base = String(raw || 'file').split(/[/\\]/).pop() || 'file';
  const cleaned = base.replace(/[^A-Za-z0-9._ -]/g, '_').trim().slice(0, 120);
  return cleaned || 'file';
};

export const resourceTypeFromName = (fileName) =>
  EXTENSION_TYPES[(fileName.split('.').pop() || '').toLowerCase()] || 'txt';

/**
 * Store a file produced by an agent run and index it, so it appears in the teacher's Resources.
 * Anything from the sandbox is flagged pseudonymised: the agent only ever saw tokenised names, so
 * the client puts the real ones back at download time.
 */
export const saveAgentArtifact = async ({
  uid, fileName, buffer, contentType, source, conversationId, interactionId, agentId, triggerId, summary,
}) => {
  const name = safeFileName(fileName);
  const id = `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const storagePath = `users/${uid}/resources/${id}/${name}`;
  const type = resourceTypeFromName(name);

  await bucket().file(storagePath).save(buffer, {
    contentType: contentType || 'application/octet-stream',
    resumable: false,
  });

  const now = Date.now();
  const resource = {
    id,
    name,
    type,
    mimeType: contentType || 'application/octet-stream',
    size: buffer.length,
    storagePath,
    source: source || 'agent',
    pinnedToWorkspace: false,
    pseudonymised: true,
    createdAt: now,
    updatedAt: now,
    ...(conversationId ? { conversationId } : {}),
    ...(interactionId ? { interactionId } : {}),
    ...(agentId ? { agentId } : {}),
    ...(triggerId ? { triggerId } : {}),
    ...(summary ? { summary } : {}),
  };
  await userCol(uid, 'teacher_planner_resources').doc(id).set(resource);
  return resource;
};

/** Fetch one of a user's resources by id, with its bytes. Returns null if it isn't theirs. */
export const readResource = async (uid, resourceId) => {
  const snap = await userCol(uid, 'teacher_planner_resources').doc(resourceId).get();
  if (!snap.exists) return null;
  const resource = snap.data();
  const [buffer] = await bucket().file(resource.storagePath).download();
  return { resource, buffer };
};

/** The resources the teacher has pinned — mounted into every new sandbox as their workspace. */
export const listPinnedResources = async (uid, limit = 25) => {
  const snap = await userCol(uid, 'teacher_planner_resources')
    .where('pinnedToWorkspace', '==', true)
    .limit(limit)
    .get();
  return snap.docs.map(d => d.data());
};

/** Enabled skills, optionally narrowed to a chosen subset. */
export const listSkills = async (uid, skillIds) => {
  const snap = await userCol(uid, 'teacher_planner_skills').where('enabled', '==', true).get();
  const all = snap.docs.map(d => d.data());
  if (!skillIds || skillIds.length === 0) return all;
  const wanted = new Set(skillIds);
  return all.filter(s => wanted.has(s.id));
};

export const getBrandKit = async (uid) => {
  const snap = await userCol(uid, 'teacher_planner_brand_kit').doc('default').get();
  return snap.exists ? snap.data() : null;
};

export const getCustomAgent = async (uid, agentId) => {
  if (!agentId) return null;
  const snap = await userCol(uid, 'teacher_planner_agents').doc(agentId).get();
  return snap.exists ? snap.data() : null;
};

/** Download a Storage object as a Buffer (brand logos, skill assets, templates). */
export const downloadPath = async (storagePath) => {
  const [buffer] = await bucket().file(storagePath).download();
  return buffer;
};
