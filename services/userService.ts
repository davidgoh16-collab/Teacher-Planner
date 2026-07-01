import { db } from '../firebase';
import { collection, doc, getDoc, setDoc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import type { User } from 'firebase/auth';

/**
 * User profiles (`users/{uid}`).
 *
 * The profile doc holds the user's identity + preferences and doubles as the registry that powers
 * sharing-by-email (lookup by `emailLower`). Keep it minimal — it is readable by any signed-in user
 * so the email lookup works, so no sensitive data should live here.
 */

const USERS = 'users';

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system';
  themeColor?: string; // base hex for the app-wide accent palette
  onboardingComplete?: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  emailLower: string;
  displayName: string;
  photoURL: string;
  createdAt: number;
  preferences: UserPreferences;
  legacyMigrated?: boolean;
}

/** Create the profile on first login, or merge in any changed identity fields on subsequent logins. */
export const ensureUserProfile = async (user: User): Promise<UserProfile> => {
  const ref = doc(db, USERS, user.uid);
  const snap = await getDoc(ref);
  const email = user.email || '';

  if (!snap.exists()) {
    const profile: UserProfile = {
      uid: user.uid,
      email,
      emailLower: email.toLowerCase(),
      displayName: user.displayName || email || 'Teacher',
      photoURL: user.photoURL || '',
      createdAt: Date.now(),
      preferences: { theme: 'system', onboardingComplete: false },
    };
    await setDoc(ref, profile);
    return profile;
  }

  const data = snap.data() as UserProfile;
  const patch: Record<string, any> = {};
  if (email && data.email !== email) {
    patch.email = email;
    patch.emailLower = email.toLowerCase();
  }
  if (user.displayName && data.displayName !== user.displayName) patch.displayName = user.displayName;
  if (user.photoURL && data.photoURL !== user.photoURL) patch.photoURL = user.photoURL;
  if (Object.keys(patch).length) await updateDoc(ref, patch);
  return { ...data, ...patch } as UserProfile;
};

export const getProfile = async (uid: string): Promise<UserProfile | null> => {
  const snap = await getDoc(doc(db, USERS, uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
};

/** Patch one or more preference keys (theme, themeColor, onboardingComplete). */
export const updatePreferences = async (uid: string, patch: Partial<UserPreferences>): Promise<void> => {
  const updates: Record<string, any> = {};
  Object.entries(patch).forEach(([k, v]) => { updates[`preferences.${k}`] = v; });
  await updateDoc(doc(db, USERS, uid), updates);
};

export const setLegacyMigrated = async (uid: string): Promise<void> => {
  await updateDoc(doc(db, USERS, uid), { legacyMigrated: true });
};

/** Find a registered user by email (case-insensitive). Powers sharing. */
export const findUserByEmail = async (email: string): Promise<UserProfile | null> => {
  try {
    const q = query(collection(db, USERS), where('emailLower', '==', email.trim().toLowerCase()));
    const snap = await getDocs(q);
    return snap.empty ? null : (snap.docs[0].data() as UserProfile);
  } catch (e: any) {
    if (e?.code === 'permission-denied') {
      throw new Error('User lookup was blocked by the server security rules — the firestore.rules in this repo need deploying (see README).');
    }
    throw e;
  }
};
