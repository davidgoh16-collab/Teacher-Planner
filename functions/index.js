const admin = require('firebase-admin');

admin.initializeApp();

/**
 * mintCustomToken — bridges a NATIVE Firebase session into the in-webview JS Firebase SDK.
 *
 * On Android the app signs in with Microsoft through @capacitor-firebase/authentication, which
 * authenticates the *native* Firebase SDK (the nonce-bound Microsoft credential cannot be replayed
 * into the JS SDK via signInWithCredential). The app then sends the native Firebase ID token here;
 * we verify it and mint a custom token for the SAME uid, which the JS SDK signs in with. The user
 * ends up on the identical Firebase uid (and therefore the identical Firestore data) as on the web.
 *
 * Security: the caller must present a valid Firebase ID token for the account it wants a custom
 * token for — verifyIdToken proves that. We only ever mint a token for the uid inside that verified
 * token, so this cannot be used to impersonate another user. Deployed with --allow-unauthenticated
 * because the ID-token check *is* the authentication.
 */
exports.mintCustomToken = async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const authz = req.get('Authorization') || '';
    const idToken = authz.startsWith('Bearer ')
      ? authz.slice(7)
      : (req.body && req.body.idToken) || '';
    if (!idToken) return res.status(401).json({ error: 'Missing ID token' });

    const decoded = await admin.auth().verifyIdToken(idToken);
    const customToken = await admin.auth().createCustomToken(decoded.uid);
    return res.json({ customToken });
  } catch (err) {
    console.error('mintCustomToken error:', err && err.message ? err.message : err);
    return res.status(401).json({ error: 'Invalid ID token' });
  }
};
