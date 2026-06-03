/**
 * Authentication and authorisation middleware for the user-service.
 *
 * authenticate  — Verifies the Bearer JWT on every protected route.
 *                 Attaches the decoded payload to req.user on success.
 *
 * authorize     — Role-based access control (RBAC) guard. Must be used
 *                 after authenticate. Accepts one or more allowed roles.
 *
 * Usage:
 *   router.get('/profile',      authenticate, handler)
 *   router.delete('/:id',       authenticate, authorize('admin'), handler)
 *   router.post('/bulk-assign', authenticate, authorize('admin', 'manager'), handler)
 */

require('dotenv').config({ path: '../../.env' });
const jwt = require('jsonwebtoken');

// ── JWT secret validation ─────────────────────────────────────────────────────
// A weak or missing secret allows tokens to be forged. Refuse to run silently
// with an insecure configuration; crash in production where it matters most.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  const msg = '[AUTH] WARNING: JWT_SECRET is missing or too short (minimum 32 characters required).';
  console.error(msg);
  console.error('[AUTH] Set a strong JWT_SECRET in your .env file. Example:');
  console.error('[AUTH]   JWT_SECRET=<run: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))")>');
  // Crash in production — weak secrets are unacceptable
  if (process.env.NODE_ENV === 'production') process.exit(1);
}
const SECRET = JWT_SECRET || 'dev_only_fallback_not_for_production_use';

// ── authenticate ──────────────────────────────────────────────────────────────
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    // Log missing/malformed token — could indicate misconfigured client or probing
    console.warn(`[AUTH] Missing token: ${req.method} ${req.url} from ${req.ip}`);
    return res.status(401).json({ error: 'Authorization token required' });
  }
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch (err) {
    // Differentiate expired tokens (may just need re-login) from invalid ones (possible attack)
    const isExpired = err.name === 'TokenExpiredError';
    const msg = isExpired ? 'Token has expired — please log in again' : 'Invalid token';
    console.warn(`[AUTH] ${isExpired ? 'Expired' : 'Invalid'} token: ${req.method} ${req.url} from ${req.ip}`);
    return res.status(401).json({ error: msg });
  }
}

// ── authorize ─────────────────────────────────────────────────────────────────
/**
 * Role-based access control middleware.
 * Usage: router.delete('/:id', authenticate, authorize('admin'), handler)
 * @param {...string} roles - Allowed roles (e.g. 'admin', 'inspector')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      // Log unauthorized access attempts — useful for detecting privilege escalation
      console.warn(`[AUTH] Unauthorized: user ${req.user.id} (${req.user.role}) attempted ${req.method} ${req.url} — requires [${roles.join(', ')}]`);
      return res.status(403).json({ error: `Access denied — requires role: ${roles.join(' or ')}` });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
