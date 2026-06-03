/**
 * Authentication and authorisation middleware for the extinguisher-service.
 *
 * authenticate  — Verifies the Bearer JWT on every protected route.
 *                 Attaches the decoded payload to req.user on success.
 *
 * authorize     — Role-based access control (RBAC) guard. Must be used
 *                 after authenticate. Accepts one or more allowed roles.
 *
 * Usage:
 *   router.get('/',      authenticate, handler)
 *   router.delete('/:id', authenticate, authorize('admin'), handler)
 *   router.post('/',      authenticate, authorize('admin', 'inspector'), handler)
 */

require('dotenv').config({ path: '../../.env' });
const jwt = require('jsonwebtoken');

// ── JWT secret validation ─────────────────────────────────────────────────────
// A weak or missing secret lets attackers forge tokens for any user or role.
// Crash in production rather than silently run with an insecure configuration.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('[AUTH] WARNING: JWT_SECRET is missing or too short (minimum 32 characters).');
  console.error('[AUTH] Set a strong secret in .env:');
  console.error('[AUTH]   node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  if (process.env.NODE_ENV === 'production') process.exit(1);
}
const SECRET = JWT_SECRET || 'dev_only_fallback_not_for_production_use';

// ── authenticate ──────────────────────────────────────────────────────────────
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    // Log missing/malformed token — could indicate a probing attempt
    console.warn(`[AUTH] Missing token: ${req.method} ${req.url} from ${req.ip}`);
    return res.status(401).json({ error: 'Authorization token required' });
  }
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch (err) {
    // Differentiate expired tokens (user needs to re-login) vs invalid ones (possible attack)
    const isExpired = err.name === 'TokenExpiredError';
    const msg = isExpired ? 'Token has expired — please log in again' : 'Invalid token';
    console.warn(`[AUTH] ${isExpired ? 'Expired' : 'Invalid'} token: ${req.method} ${req.url} from ${req.ip}`);
    return res.status(401).json({ error: msg });
  }
}

// ── authorize ─────────────────────────────────────────────────────────────────
/**
 * Role-based access control middleware.
 * @param {...string} roles - Allowed roles (e.g. 'admin', 'inspector')
 * @example router.delete('/:id', authenticate, authorize('admin'), handler)
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      // Log all privilege escalation attempts for security auditing
      console.warn(`[AUTH] Unauthorized: user ${req.user.id} (${req.user.role}) → ${req.method} ${req.url} requires [${roles.join(', ')}]`);
      return res.status(403).json({ error: `Access denied — requires role: ${roles.join(' or ')}` });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
