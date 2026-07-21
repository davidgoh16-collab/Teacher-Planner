import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import {
  getAuth,
  OAuthProvider,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signInWithCustomToken,
  signOut as fbSignOut,
  type UserCredential,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';

// Cloud Function that bridges a native Firebase session into the JS SDK (see firebase functions/).
const MINT_CUSTOM_TOKEN_URL = 'https://europe-west2-school-apps-52c7d.cloudfunctions.net/mintCustomToken';

/**
 * FIREBASE CONFIGURATION
 *
 * The web API key is supplied at RUNTIME via VITE_FIREBASE_API_KEY (server-emitted env.js in
 * production — see server.js; or .env.local in dev — see README). It is deliberately NOT hardcoded
 * here, so no API key literal ships in the built client bundle. A Firebase web API key is an
 * identifier, not a secret — access control lives in firestore.rules, which MUST be deployed to the
 * project (`npm run rules:deploy`) for sharing to work.
 *
 * On the native (Capacitor) build there is no server to emit env.js, so the key falls through to
 * the build-time import.meta.env.VITE_FIREBASE_API_KEY value baked in from .env.local.
 */

const firebaseConfig = {
  apiKey:
    window.ENV?.VITE_FIREBASE_API_KEY ||
    import.meta.env.VITE_FIREBASE_API_KEY ||
    "",
  authDomain: "school-apps-52c7d.firebaseapp.com",
  projectId: "school-apps-52c7d",
  storageBucket: "school-apps-52c7d.firebasestorage.app",
  messagingSenderId: "982739442942",
  appId: "1:982739442942:web:ce32a1929b5615332359af",
  measurementId: "G-65DLPSXREY"
};

export const isNative = Capacitor.isNativePlatform();

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore. The offline-first persistent cache keeps the planner fully usable
// with no connection (essential for the installed app); it degrades automatically where IndexedDB
// is unavailable. ignoreUndefinedProperties is preserved from the original config.
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

// Initialize Auth
export const auth = getAuth(app);

// Initialize Microsoft Provider
export const microsoftProvider = new OAuthProvider('microsoft.com');
microsoftProvider.setCustomParameters({
  // Force account selection prompt
  prompt: 'select_account',
});

// Initialize Google Provider (email/password uses the auth instance directly).
// NOTE: enable Google + Email/Password providers in the Firebase console for these to work.
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

/**
 * Native OAuth sign-in goes through @capacitor-firebase/authentication (which drives the platform's
 * own browser/account chooser and returns a credential); we then sign the JS SDK in with that
 * credential. On web we keep the popup flow. The plugin is imported lazily so it never enters the
 * web bundle.
 */
export const loginWithGoogle = async (): Promise<UserCredential> => {
  if (isNative) {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    const result = await FirebaseAuthentication.signInWithGoogle();
    const credential = GoogleAuthProvider.credential(result.credential?.idToken);
    return signInWithCredential(auth, credential);
  }
  return signInWithPopup(auth, googleProvider);
};

export const loginWithMicrosoft = async (): Promise<UserCredential> => {
  if (isNative) {
    // Microsoft's OAuth id_token is nonce-bound and can't be replayed into the JS SDK via
    // signInWithCredential. So the plugin signs the NATIVE Firebase SDK in, we take that session's
    // Firebase ID token to the mintCustomToken Cloud Function, and sign the JS SDK in with the
    // returned custom token — landing on the SAME Firebase uid (and Firestore data) as the web.
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    await FirebaseAuthentication.signInWithMicrosoft();
    const { token: nativeIdToken } = await FirebaseAuthentication.getIdToken();
    if (!nativeIdToken) throw Object.assign(new Error('No native ID token'), { code: 'auth/no-native-token' });

    const res = await fetch(MINT_CUSTOM_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${nativeIdToken}` },
    });
    if (!res.ok) throw Object.assign(new Error('Custom token exchange failed'), { code: 'auth/custom-token-exchange-failed' });
    const { customToken } = await res.json();
    return signInWithCustomToken(auth, customToken);
  }
  return signInWithPopup(auth, microsoftProvider);
};

/** Sign out of both the JS SDK and (on native) the Capacitor auth plugin. */
export const logout = async (): Promise<void> => {
  if (isNative) {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    await FirebaseAuthentication.signOut().catch(() => { /* JS signOut is the source of truth */ });
  }
  await fbSignOut(auth);
};
