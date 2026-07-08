import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getAuth, OAuthProvider, GoogleAuthProvider } from 'firebase/auth';

/**
 * FIREBASE CONFIGURATION
 *
 * The web API key is supplied at RUNTIME via VITE_FIREBASE_API_KEY (server-emitted env.js in
 * production — see server.js; or .env.local in dev — see README). It is deliberately NOT hardcoded
 * here, so no API key literal ships in the built client bundle. A Firebase web API key is an
 * identifier, not a secret — access control lives in firestore.rules, which MUST be deployed to the
 * project (`npm run rules:deploy`) for sharing to work.
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore with settings to ignore undefined properties
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true
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