import crypto from 'node:crypto';

/**
 * Short-lived bearer tokens that let an agent sandbox call back into this server.
 *
 * The sandbox needs to hand finished documents back to us and fetch the teacher's pinned files.
 * It cannot hold a Firebase ID token (there is no user session in there), so instead the egress
 * proxy injects one of these into requests to our domain via the environment's network-allowlist
 * `transform` — the agent asks for a URL and the credential is added on the way out.
 *
 * A token is deliberately near-useless if it leaks: it names one uid, carries a scope list, and
 * expires. It cannot read planner data, cannot touch another teacher, and cannot outlive its run
 * by much. That matters because "the sandbox never sees it" is not quite true — a sufficiently
 * determined agent could curl an echo service and read it back out of the response.
 *
 * Format is a compact signed envelope rather than a JWT library: base64url(payload).base64url(sig).
 */

const b64url = (buf) => Buffer.from(buf).toString('base64url');

const secret = () => {
  const value = process.env.SANDBOX_TOKEN_SECRET;
  if (!value) throw new Error('SANDBOX_TOKEN_SECRET is not set; sandbox callbacks are disabled.');
  return value;
};

const sign = (payloadB64) =>
  crypto.createHmac('sha256', secret()).update(payloadB64).digest('base64url');

/** Scopes a sandbox token can carry. Keep these narrow and additive. */
export const SCOPES = {
  ARTIFACT_WRITE: 'artifact:write',
  WORKSPACE_READ: 'workspace:read',
};

/**
 * Mint a token for one agent run.
 *
 * Interactive runs get hours because an agent turn can be long and the teacher may continue the
 * conversation; scheduled runs get much longer because the trigger's stored configuration has to
 * keep working without anyone present to refresh it.
 */
export const mintSandboxToken = ({ uid, scopes, conversationId, triggerId, ttlSeconds = 24 * 60 * 60 }) => {
  if (!uid) throw new Error('mintSandboxToken requires a uid');
  const payload = {
    uid,
    scopes,
    conversationId,
    triggerId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    // A nonce keeps two tokens minted in the same second from being byte-identical, which makes
    // them distinguishable in logs when tracing which run uploaded what.
    n: crypto.randomBytes(6).toString('base64url'),
  };
  const encoded = b64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
};

/**
 * Verify a token and return its claims, or null if it is malformed, forged or expired.
 * Never throws — callers treat null as "reject the request".
 */
export const verifySandboxToken = (token) => {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [encoded, signature] = token.split('.', 2);
  if (!encoded || !signature) return null;

  let expected;
  try {
    expected = sign(encoded);
  } catch {
    return null; // secret missing
  }
  // Constant-time compare; length mismatch would make timingSafeEqual throw.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload?.uid || !Array.isArray(payload.scopes)) return null;
  if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null;
  return payload;
};

/** Express middleware: require a valid sandbox token carrying `scope`. */
export const requireSandboxToken = (scope) => (req, res, next) => {
  const claims = verifySandboxToken(req.get('X-Sandbox-Token') || '');
  if (!claims) return res.status(401).json({ error: 'Invalid or expired sandbox token' });
  if (!claims.scopes.includes(scope)) return res.status(403).json({ error: 'Token lacks the required scope' });
  req.sandbox = claims;
  next();
};
