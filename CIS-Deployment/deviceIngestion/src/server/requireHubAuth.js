/**
 * Verifies the same JWT alarm-engine issues on login — this service is
 * only ever meant to be called from the Hub UI (via the /device-ingestion
 * proxy), by a logged-in user, so it should require the same proof of
 * login rather than trusting anything reachable on the docker network.
 *
 * Deliberately does NOT re-implement alarm-engine's role/permission system
 * here — "is this a valid, unexpired Hub session" is the bar for this
 * admin API, matching how lightly the equivalent alarm-engine endpoints
 * are gated today (any authenticated user, not specifically an admin
 * role). If that ever needs tightening, decode the token's `role`/
 * `permissions` claims (already present) rather than adding a second
 * authorization system.
 */

const jwt = require('jsonwebtoken');
const env = require('../env');

/** Matches JwtService.java's key derivation exactly: the secret's raw
 * UTF-8 bytes, zero-padded up to 32 bytes if shorter. */
function signingKey() {
  const raw = Buffer.from(env.HUB_AUTH_JWT_SECRET, 'utf8');
  if (raw.length >= 32) return raw;
  const padded = Buffer.alloc(32);
  raw.copy(padded);
  return padded;
}

const KEY = signingKey();

function requireHubAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    jwt.verify(token, KEY, { algorithms: ['HS256', 'HS384', 'HS512'] });
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

module.exports = { requireHubAuth };
