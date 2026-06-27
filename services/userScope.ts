import { db, auth } from '../firebase';
import { collection, doc } from 'firebase/firestore';

/**
 * Per-user Firestore scoping.
 *
 * Every piece of planner data lives under `users/{uid}/...` so each signed-in user has a fully
 * isolated dataset. Services build their collection/document references through these helpers
 * instead of `collection(db, NAME)` / `doc(db, NAME, id)` so scoping happens in exactly one place.
 *
 * The `owner*` variants take an explicit uid and are used to read (and, when permitted, write)
 * another user's data for the sharing feature.
 */

/** The uid of the currently signed-in user. Throws if called before auth resolves. */
export const currentUid = (): string => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('No authenticated user; user-scoped data is unavailable.');
  return uid;
};

/** A collection under the current user, e.g. userCol('colleagues') -> users/{uid}/colleagues. */
export const userCol = (...segments: string[]) =>
  collection(db, 'users', currentUid(), ...segments);

/** A document under the current user, e.g. userDocRef('lessonPlans', id). */
export const userDocRef = (...segments: string[]) =>
  doc(db, 'users', currentUid(), ...segments);

/** A collection under an explicit owner (for shared resources). */
export const ownerCol = (ownerUid: string, ...segments: string[]) =>
  collection(db, 'users', ownerUid, ...segments);

/** A document under an explicit owner (for shared resources). */
export const ownerDocRef = (ownerUid: string, ...segments: string[]) =>
  doc(db, 'users', ownerUid, ...segments);
