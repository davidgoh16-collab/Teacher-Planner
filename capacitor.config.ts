import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.davidgoh.teacherplanner',
  appName: 'Teacher Planner',
  webDir: 'dist',
  plugins: {
    FirebaseAuthentication: {
      // Google is bridged to the JS SDK via signInWithCredential (its idToken has no nonce).
      // Microsoft's credential is nonce-bound and can't be replayed into the JS SDK, so we let the
      // plugin sign the NATIVE SDK in and bridge that session to the JS SDK with a custom token
      // (see firebase.ts loginWithMicrosoft + the mintCustomToken Cloud Function). That needs the
      // native SDK signed in, hence skipNativeAuth: false.
      skipNativeAuth: false,
      providers: ['google.com', 'microsoft.com'],
    },
  },
};

export default config;
