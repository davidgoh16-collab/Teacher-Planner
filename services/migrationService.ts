import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { ensureUserProfile, getProfile, setLegacyMigrated } from './userService';
import { claimPendingShares } from './shareService';

/**
 * One-time migration of the original (pre-multi-tenant) global data into the owner's user space,
 * plus a memoised per-user bootstrap that both App.tsx and PlannerContext await before loading data
 * (so the migration runs exactly once even though they react to auth independently).
 *
 * The legacy data was all created by a single Microsoft account; we key the migration on that exact
 * Firebase UID so only that account imports it and every other (new) user starts empty.
 */

export const LEGACY_OWNER_UID = 'oleZncmmoyNerACQDErqtfMcNYS2';

// Flat top-level legacy collections -> copied verbatim into users/{uid}/<name>.
const LEGACY_FLAT_COLLECTIONS = [
  'colleagues',
  'lessonPlans',
  'teacher_planner_projects',
  'teacher_planner_tasks',
  'teacher_planner_categories',
  'teacher_planner_ideas',
  'teacher_planner_key_dates',
  'teacher_planner_routine_tasks',
  'teacher_planner_apps',
  'teacher_planner_app_categories',
  'teacher_planner_ai_conversations',
];

// Nested legacy academic-year structure.
const ACADEMIC_YEARS = 'teacher_planner_academic_years';
const TERMS = 'teacher_planner_terms';
const TIMETABLES = 'teacher_planner_timetables';

const copyFlatCollection = async (uid: string, name: string): Promise<void> => {
  const snap = await getDocs(collection(db, name));
  if (snap.empty) return;
  let batch = writeBatch(db);
  let count = 0;
  for (const d of snap.docs) {
    batch.set(doc(db, 'users', uid, name, d.id), d.data());
    if (++count % 400 === 0) {
      await batch.commit();
      batch = writeBatch(db);
    }
  }
  if (count % 400 !== 0) await batch.commit();
};

const copyAcademicYears = async (uid: string): Promise<void> => {
  const yearsSnap = await getDocs(collection(db, ACADEMIC_YEARS));
  for (const yearDoc of yearsSnap.docs) {
    await setDoc(doc(db, 'users', uid, ACADEMIC_YEARS, yearDoc.id), yearDoc.data());
    const [termsSnap, ttSnap] = await Promise.all([
      getDocs(collection(db, ACADEMIC_YEARS, yearDoc.id, TERMS)),
      getDocs(collection(db, ACADEMIC_YEARS, yearDoc.id, TIMETABLES)),
    ]);
    for (const t of termsSnap.docs) {
      await setDoc(doc(db, 'users', uid, ACADEMIC_YEARS, yearDoc.id, TERMS, t.id), t.data());
    }
    for (const tt of ttSnap.docs) {
      await setDoc(doc(db, 'users', uid, ACADEMIC_YEARS, yearDoc.id, TIMETABLES, tt.id), tt.data());
    }
  }
};

/** Copy the legacy global data into the owner's user space, once. No-op for everyone else. */
export const migrateLegacyDataIfNeeded = async (uid: string): Promise<void> => {
  if (uid !== LEGACY_OWNER_UID) return;
  const profile = await getProfile(uid);
  if (profile?.legacyMigrated) return;

  try {
    for (const name of LEGACY_FLAT_COLLECTIONS) {
      await copyFlatCollection(uid, name);
    }
    await copyAcademicYears(uid);
    await setLegacyMigrated(uid);
    console.log('Legacy data migrated into user space.');
  } catch (e) {
    // Leave legacyMigrated unset so it retries next login rather than half-migrating silently.
    console.error('Legacy migration failed (will retry next login):', e);
  }
};

// Memoise per uid so concurrent callers (App + PlannerContext) share one run.
let bootstrap: { uid: string; promise: Promise<void> } | null = null;

/** Ensure the user's profile exists and any one-time migration has run, before data loads. */
export const bootstrapUser = (user: User): Promise<void> => {
  if (bootstrap && bootstrap.uid === user.uid) return bootstrap.promise;
  const promise = (async () => {
    await ensureUserProfile(user);
    if (user.email) {
      // Convert any invites sent to this email before the account existed. Best-effort:
      // a failure must never block login, and unclaimed docs are retried next login.
      try {
        await claimPendingShares(user.uid, user.email);
      } catch (e) {
        console.error('Claiming pending shares failed (will retry next login):', e);
      }
    }
    await migrateLegacyDataIfNeeded(user.uid);
  })();
  bootstrap = { uid: user.uid, promise };
  return promise;
};
