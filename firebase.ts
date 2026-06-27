import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getAuth, OAuthProvider, GoogleAuthProvider } from 'firebase/auth';

/**
 * FIREBASE CONFIGURATION
 *
 * To make this app work across devices, you need to create a project at:
 * https://console.firebase.google.com/
 *
 * 1. Create a project.
 * 2. Add a Web App to the project.
 * 3. Copy the 'firebaseConfig' object they provide.
 * 4. Paste the values below.
 * 5. In Firebase Console -> Firestore Database -> Rules, set them to allow read/write for testing:
 *    allow read, write: if true;
 */

const firebaseConfig = {
  apiKey: "AIzaSyDsHETgCAabxH8VTLI9yE9oXAyU9XlttIg",
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