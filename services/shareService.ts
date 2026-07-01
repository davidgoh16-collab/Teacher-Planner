import { db } from '../firebase';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, query, where } from 'firebase/firestore';
import { ownerCol, ownerDocRef } from './userScope';
import { findUserByEmail } from './userService';
import { WeeklyTimetable, Project, Task } from '../types';

/**
 * Sharing of timetables (live, read-only) and projects (read-only, optionally editable).
 *
 * A single `shares/{id}` doc is both the registry entry (drives the "Shared with me" UI) and the
 * access grant itself: ids are deterministic — `${ownerUid}__${recipientUid}__${type}__${resourceId}`
 * — so the security rules authorise a recipient's reads/writes with one exists()/get() on that id,
 * and shared data is always live rather than a snapshot.
 *
 * Sharing with an email that hasn't signed up yet creates a *pending* share keyed by
 * `email:${emailLower}` with `recipientUid: null`. When that person first signs in,
 * `claimPendingShares` (called from bootstrapUser) converts each pending doc into a uid-keyed
 * share — create the claimed copy first, then delete the pending doc, because the rules validate
 * the copy against the still-existing pending original.
 */

export type ShareType = 'timetable' | 'project';
export type SharePermission = 'view' | 'edit';

export interface Share {
  id: string;
  ownerUid: string;
  ownerEmail: string;
  ownerName: string;
  recipientUid: string | null;  // null = pending invite (recipient hasn't signed up yet)
  recipientEmail: string;       // always lower-case
  type: ShareType;
  resourceId: string;     // projectId for projects; 'timetable' for the timetable
  resourceName: string;   // project name, or 'Timetable'
  permission: SharePermission; // meaningful for projects; timetables are always 'view'
  createdAt: number;
}

const SHARES = 'shares';

const shareId = (ownerUid: string, recipientKey: string, type: ShareType, resourceId: string) =>
  `${ownerUid}__${recipientKey}__${type}__${resourceId}`;

export const createShare = async (params: {
  owner: { uid: string; email: string; displayName: string };
  type: ShareType;
  resourceId: string;
  resourceName: string;
  recipientEmail: string;
  permission?: SharePermission;
}): Promise<{ ok: boolean; pending?: boolean; error?: string }> => {
  const emailLower = params.recipientEmail.trim().toLowerCase();
  if (!emailLower.includes('@')) return { ok: false, error: 'Please enter a valid email address.' };
  if (emailLower === (params.owner.email || '').toLowerCase()) {
    return { ok: false, error: "You can't share with yourself." };
  }

  const recipient = await findUserByEmail(emailLower);
  if (recipient && recipient.uid === params.owner.uid) {
    return { ok: false, error: "You can't share with yourself." };
  }

  const recipientKey = recipient ? recipient.uid : `email:${emailLower}`;
  const id = shareId(params.owner.uid, recipientKey, params.type, params.resourceId);
  const share: Share = {
    id,
    ownerUid: params.owner.uid,
    ownerEmail: params.owner.email,
    ownerName: params.owner.displayName || params.owner.email,
    recipientUid: recipient ? recipient.uid : null,
    recipientEmail: recipient ? recipient.emailLower : emailLower,
    type: params.type,
    resourceId: params.resourceId,
    resourceName: params.resourceName,
    permission: params.type === 'project' ? (params.permission || 'view') : 'view',
    createdAt: Date.now(),
  };
  await setDoc(doc(db, SHARES, id), share);
  return { ok: true, pending: !recipient };
};

export const setSharePermission = async (share: Share, permission: SharePermission): Promise<void> => {
  await updateDoc(doc(db, SHARES, share.id), { permission });
};

export const revokeShare = async (share: Share): Promise<void> => {
  await deleteDoc(doc(db, SHARES, share.id));
};

export const listSharesByMe = async (uid: string): Promise<Share[]> => {
  const snap = await getDocs(query(collection(db, SHARES), where('ownerUid', '==', uid)));
  return snap.docs.map(d => d.data() as Share).sort((a, b) => b.createdAt - a.createdAt);
};

export const listSharesWithMe = async (uid: string): Promise<Share[]> => {
  const snap = await getDocs(query(collection(db, SHARES), where('recipientUid', '==', uid)));
  return snap.docs.map(d => d.data() as Share).sort((a, b) => b.createdAt - a.createdAt);
};

/**
 * Convert any pending shares addressed to this email into uid-keyed shares for the signed-in
 * user. Called at login (bootstrapUser); best-effort — failures leave the pending doc in place
 * so the next login retries.
 */
export const claimPendingShares = async (uid: string, email: string): Promise<number> => {
  const emailLower = (email || '').trim().toLowerCase();
  if (!emailLower) return 0;

  const snap = await getDocs(query(
    collection(db, SHARES),
    where('recipientEmail', '==', emailLower),
    where('recipientUid', '==', null),
  ));

  let claimed = 0;
  for (const d of snap.docs) {
    const s = d.data() as Share;
    const newId = shareId(s.ownerUid, uid, s.type, s.resourceId);
    try {
      await setDoc(doc(db, SHARES, newId), { ...s, id: newId, recipientUid: uid });
      await deleteDoc(doc(db, SHARES, d.id));
      claimed++;
    } catch (e) {
      // A uid-keyed share may already exist (the owner re-shared after this user signed up),
      // in which case the pending doc is redundant and safe to remove. Any other failure keeps
      // the pending doc for a retry on the next login.
      try {
        const existing = await getDoc(doc(db, SHARES, newId));
        if (existing.exists()) {
          await deleteDoc(doc(db, SHARES, d.id));
          claimed++;
        } else {
          console.error('Could not claim shared item', d.id, e);
        }
      } catch {
        console.error('Could not claim shared item', d.id, e);
      }
    }
  }
  return claimed;
};

/** Read an owner's live timetable (default academic year) for a recipient to view/overlay. */
export const fetchOwnerTimetable = async (
  ownerUid: string,
): Promise<{ week1: WeeklyTimetable; week2: WeeklyTimetable; yearName?: string }> => {
  // Errors (e.g. permission-denied when rules aren't deployed) propagate so the UI can show
  // them — a silent {} here used to render as "this colleague has an empty timetable".
  const yearsSnap = await getDocs(ownerCol(ownerUid, 'teacher_planner_academic_years'));
  if (yearsSnap.empty) return { week1: {}, week2: {} };
  const years = yearsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  const def = years.find((y: any) => y.isDefault) || years[0];
  const ttSnap = await getDocs(ownerCol(ownerUid, 'teacher_planner_academic_years', def.id, 'teacher_planner_timetables'));
  let week1: WeeklyTimetable = {};
  let week2: WeeklyTimetable = {};
  ttSnap.forEach(d => {
    if (d.id === 'week1') week1 = d.data() as WeeklyTimetable;
    else if (d.id === 'week2') week2 = d.data() as WeeklyTimetable;
  });
  return { week1, week2, yearName: def.name };
};

/** Write a task back to the owner's data (used by an edit-permission collaborator). */
export const saveOwnerTask = async (ownerUid: string, task: Task): Promise<void> => {
  await setDoc(ownerDocRef(ownerUid, 'teacher_planner_tasks', task.id), task);
};

/** Read an owner's shared project plus its tasks. */
export const fetchOwnerProject = async (
  ownerUid: string,
  projectId: string,
): Promise<{ project: Project | null; tasks: Task[] }> => {
  const pSnap = await getDoc(ownerDocRef(ownerUid, 'teacher_planner_projects', projectId));
  const project = pSnap.exists() ? (pSnap.data() as Project) : null;
  // The projectId filter must be in the QUERY, not applied client-side: security rules authorise
  // task reads per-document by resource.data.projectId, so an unfiltered list over all the owner's
  // tasks is rejected wholesale with permission-denied as soon as any task belongs to another project.
  const tSnap = await getDocs(query(
    ownerCol(ownerUid, 'teacher_planner_tasks'),
    where('projectId', '==', projectId),
  ));
  const tasks = tSnap.docs.map(d => d.data() as Task);
  return { project, tasks };
};
