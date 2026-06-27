import { db } from '../firebase';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, query, where } from 'firebase/firestore';
import { ownerCol, ownerDocRef } from './userScope';
import { findUserByEmail } from './userService';
import { WeeklyTimetable, Project, Task } from '../types';

/**
 * Sharing of timetables (live, read-only) and projects (read-only, optionally editable).
 *
 * A `shares/{id}` doc records who shared what with whom. Alongside it we maintain a per-owner
 * `users/{ownerUid}/grants/{recipientUid}` index that security rules consult (a single get()) to
 * authorise a recipient's reads/writes of the owner's live data — so shared timetables are always
 * current rather than snapshots.
 */

export type ShareType = 'timetable' | 'project';
export type SharePermission = 'view' | 'edit';

export interface Share {
  id: string;
  ownerUid: string;
  ownerEmail: string;
  ownerName: string;
  recipientUid: string;
  recipientEmail: string;
  type: ShareType;
  resourceId: string;     // projectId for projects; 'timetable' for the timetable
  resourceName: string;   // project name, or 'Timetable'
  permission: SharePermission; // meaningful for projects; timetables are always 'view'
  createdAt: number;
}

const SHARES = 'shares';

const shareId = (ownerUid: string, recipientUid: string, type: ShareType, resourceId: string) =>
  `${ownerUid}__${recipientUid}__${type}__${resourceId}`;

/** Recompute users/{ownerUid}/grants/{recipientUid} from the owner's current shares to that user. */
const rebuildGrants = async (ownerUid: string, recipientUid: string): Promise<void> => {
  const snap = await getDocs(query(
    collection(db, SHARES),
    where('ownerUid', '==', ownerUid),
    where('recipientUid', '==', recipientUid),
  ));
  let timetable = false;
  const projects: Record<string, SharePermission> = {};
  let recipientEmail = '';
  snap.forEach(d => {
    const s = d.data() as Share;
    recipientEmail = s.recipientEmail || recipientEmail;
    if (s.type === 'timetable') timetable = true;
    else if (s.type === 'project') projects[s.resourceId] = s.permission;
  });

  const grantRef = doc(db, 'users', ownerUid, 'grants', recipientUid);
  if (!timetable && Object.keys(projects).length === 0) {
    await deleteDoc(grantRef).catch(() => {});
  } else {
    await setDoc(grantRef, { recipientEmail, timetable, projects });
  }
};

export const createShare = async (params: {
  owner: { uid: string; email: string; displayName: string };
  type: ShareType;
  resourceId: string;
  resourceName: string;
  recipientEmail: string;
  permission?: SharePermission;
}): Promise<{ ok: boolean; error?: string }> => {
  const recipient = await findUserByEmail(params.recipientEmail);
  if (!recipient) return { ok: false, error: 'No registered user with that email address.' };
  if (recipient.uid === params.owner.uid) return { ok: false, error: "You can't share with yourself." };

  const id = shareId(params.owner.uid, recipient.uid, params.type, params.resourceId);
  const share: Share = {
    id,
    ownerUid: params.owner.uid,
    ownerEmail: params.owner.email,
    ownerName: params.owner.displayName || params.owner.email,
    recipientUid: recipient.uid,
    recipientEmail: recipient.emailLower,
    type: params.type,
    resourceId: params.resourceId,
    resourceName: params.resourceName,
    permission: params.type === 'project' ? (params.permission || 'view') : 'view',
    createdAt: Date.now(),
  };
  await setDoc(doc(db, SHARES, id), share);
  await rebuildGrants(params.owner.uid, recipient.uid);
  return { ok: true };
};

export const setSharePermission = async (share: Share, permission: SharePermission): Promise<void> => {
  await updateDoc(doc(db, SHARES, share.id), { permission });
  await rebuildGrants(share.ownerUid, share.recipientUid);
};

export const revokeShare = async (share: Share): Promise<void> => {
  await deleteDoc(doc(db, SHARES, share.id));
  await rebuildGrants(share.ownerUid, share.recipientUid);
};

export const listSharesByMe = async (uid: string): Promise<Share[]> => {
  const snap = await getDocs(query(collection(db, SHARES), where('ownerUid', '==', uid)));
  return snap.docs.map(d => d.data() as Share).sort((a, b) => b.createdAt - a.createdAt);
};

export const listSharesWithMe = async (uid: string): Promise<Share[]> => {
  const snap = await getDocs(query(collection(db, SHARES), where('recipientUid', '==', uid)));
  return snap.docs.map(d => d.data() as Share).sort((a, b) => b.createdAt - a.createdAt);
};

/** Read an owner's live timetable (default academic year) for a recipient to view/overlay. */
export const fetchOwnerTimetable = async (
  ownerUid: string,
): Promise<{ week1: WeeklyTimetable; week2: WeeklyTimetable; yearName?: string } | null> => {
  try {
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
  } catch (e) {
    console.error('Failed to fetch shared timetable', e);
    return null;
  }
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
  try {
    const pSnap = await getDoc(ownerDocRef(ownerUid, 'teacher_planner_projects', projectId));
    const project = pSnap.exists() ? (pSnap.data() as Project) : null;
    const tSnap = await getDocs(ownerCol(ownerUid, 'teacher_planner_tasks'));
    const tasks = tSnap.docs.map(d => d.data() as Task).filter(t => t.projectId === projectId);
    return { project, tasks };
  } catch (e) {
    console.error('Failed to fetch shared project', e);
    return { project: null, tasks: [] };
  }
};
