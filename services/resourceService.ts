import { getDocs, setDoc, deleteDoc, updateDoc, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getBlob, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';
import { TeacherResource, ResourceType } from '../types';
import { userCol, userDocRef, currentUid } from './userScope';

/**
 * The Resources library: everything the teacher has made with the AI or uploaded.
 *
 * Firestore holds the index (name, type, provenance, tags) and Cloud Storage holds the bytes. They
 * are written index-last on create and index-first on delete, so a failure never leaves a resource
 * listed that can't be opened.
 */

const RESOURCES_COLLECTION = 'teacher_planner_resources';

/** Storage path for a resource's single file. */
const storagePathFor = (uid: string, resourceId: string, fileName: string) =>
  `users/${uid}/resources/${resourceId}/${fileName}`;

const EXTENSION_TYPES: Record<string, ResourceType> = {
  docx: 'docx', pptx: 'pptx', xlsx: 'xlsx', pdf: 'pdf', md: 'md', markdown: 'md',
  html: 'html', htm: 'html', csv: 'csv', txt: 'txt', text: 'txt',
  png: 'png', jpg: 'jpg', jpeg: 'jpg',
};

const MIME_TYPES: Record<ResourceType, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
  md: 'text/markdown',
  html: 'text/html',
  csv: 'text/csv',
  txt: 'text/plain',
  png: 'image/png',
  jpg: 'image/jpeg',
};

/** Classify a file by extension. Unknown extensions are treated as plain text. */
export const resourceTypeFromName = (fileName: string): ResourceType =>
  EXTENSION_TYPES[(fileName.split('.').pop() || '').toLowerCase()] || 'txt';

export const mimeTypeFor = (type: ResourceType): string => MIME_TYPES[type] || 'application/octet-stream';

/** Types whose contents can be shown inline rather than only downloaded. */
export const isPreviewable = (type: ResourceType): boolean =>
  type === 'md' || type === 'txt' || type === 'csv' || type === 'html' || type === 'png' || type === 'jpg';

/** Office formats are zipped XML, which is what the download-time rehydration pass understands. */
export const isOfficeDocument = (type: ResourceType): boolean =>
  type === 'docx' || type === 'pptx' || type === 'xlsx';

export const fetchResources = async (): Promise<TeacherResource[]> => {
  try {
    const snapshot = await getDocs(query(userCol(RESOURCES_COLLECTION), orderBy('createdAt', 'desc')));
    return snapshot.docs.map(d => d.data() as TeacherResource);
  } catch (e) {
    console.error('Error fetching resources', e);
    return [];
  }
};

interface SaveResourceArgs {
  name: string;
  data: Blob;
  source: TeacherResource['source'];
  conversationId?: string;
  interactionId?: string;
  agentId?: string;
  triggerId?: string;
  summary?: string;
  tags?: string[];
  /** Set for anything produced inside the agent sandbox — it contains pseudonymised names. */
  pseudonymised?: boolean;
}

/** Store a file and index it. Returns the saved resource. */
export const saveResource = async ({
  name, data, source, conversationId, interactionId, agentId, triggerId, summary, tags, pseudonymised,
}: SaveResourceArgs): Promise<TeacherResource> => {
  const uid = currentUid();
  const id = `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const type = resourceTypeFromName(name);
  const storagePath = storagePathFor(uid, id, name);
  const mimeType = data.type || mimeTypeFor(type);

  // Bytes first: an orphaned object is invisible and harmless, whereas an index entry with no file
  // behind it is a broken row the teacher can see and click.
  await uploadBytes(ref(storage, storagePath), data, { contentType: mimeType });

  const now = Date.now();
  const resource: TeacherResource = {
    id, name, type, mimeType, size: data.size, storagePath, source,
    conversationId, interactionId, agentId, triggerId, summary, tags,
    pinnedToWorkspace: false,
    pseudonymised: !!pseudonymised,
    createdAt: now, updatedAt: now,
  };
  await setDoc(userDocRef(RESOURCES_COLLECTION, id), resource);
  return resource;
};

/** Convenience wrapper for saving generated text (a markdown lesson plan, a research report). */
export const saveTextResource = async (
  name: string,
  text: string,
  rest: Omit<SaveResourceArgs, 'name' | 'data'>,
): Promise<TeacherResource> => {
  const type = resourceTypeFromName(name);
  return saveResource({ ...rest, name, data: new Blob([text], { type: mimeTypeFor(type) }) });
};

/** Fetch a resource's bytes. Uses getBlob (not a download URL) so the SDK applies the auth token. */
export const getResourceBlob = async (resource: TeacherResource): Promise<Blob> =>
  getBlob(ref(storage, resource.storagePath));

export const setResourcePinned = async (id: string, pinned: boolean): Promise<void> => {
  await updateDoc(userDocRef(RESOURCES_COLLECTION, id), { pinnedToWorkspace: pinned, updatedAt: Date.now() });
};

export const renameResource = async (id: string, name: string): Promise<void> => {
  await updateDoc(userDocRef(RESOURCES_COLLECTION, id), { name, updatedAt: Date.now() });
};

/** Remove the index entry, then the file. */
export const deleteResource = async (resource: TeacherResource): Promise<void> => {
  await deleteDoc(userDocRef(RESOURCES_COLLECTION, resource.id));
  try {
    await deleteObject(ref(storage, resource.storagePath));
  } catch (e) {
    // The row is already gone, so the resource has disappeared from the teacher's point of view.
    // A leftover object is cleaned up by the retention sweep rather than blocking the delete.
    console.warn('Resource file could not be deleted; index entry removed', e);
  }
};
