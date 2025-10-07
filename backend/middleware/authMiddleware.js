// backend/middleware/authMiddleware.js - RBAC auth (unified, robust)
import 'dotenv/config';
import pool from '../db.js';
import { verifyAccessToken, getRoleOrder } from '../utils/tokens.js';

/** Require a valid access token and an Active user in DB */
export async function requireAuth(req, res, next) {
  try {
    const raw =
      req.cookies?.access ||
      req.cookies?.access_token ||
      (req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, '') : '');
    if (!raw) return res.status(401).json({ message: 'Not authenticated' });

    // decoded = { jti, sub, role, type, iat, exp }
    const decoded = await verifyAccessToken(raw);

    // Enforce DB "Active" status - suspended users cannot make API calls
    const [rows] = await pool.execute(
      'SELECT Status FROM tblusers WHERE UserID = ? LIMIT 1',
      [decoded.sub]
    );
    if (!rows?.length) {
      return res.status(401).json({ message: 'User account not found' });
    }
    if (rows[0].Status === 'Suspended') {
      return res.status(403).json({ message: 'Account has been suspended' });
    }
    if (rows[0].Status !== 'Active') {
      return res.status(403).json({ message: 'Account is not active' });
    }

    req.user = { userId: decoded.sub, role: decoded.role, jti: decoded.jti };
    req.auth = { exp: decoded.exp }; // seconds since epoch
    return next();
  } catch (err) {
    console.error('requireAuth verify failed:', err?.name, err?.message);
    return res.status(401).json({ message: 'Invalid or expired session' });
  }
}

/** Exact-role gate */
export function permitRoles(...allowed) {
  return (req, res, next) => {
    if (!req.user?.role) return res.status(401).json({ message: 'Not authenticated' });
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient privileges' });
    }
    return next();
  };
}

/** Hierarchy gate (uses getRoleOrder from utils/tokens) */
export function hasRoleOrHigher(requiredRole) {
  return (req, res, next) => {
    if (!req.user?.role) return res.status(401).json({ message: 'Not authenticated' });
    const need = getRoleOrder?.(requiredRole) ?? 99;
    const have = getRoleOrder?.(req.user.role) ?? 0;
    if (have < need) return res.status(403).json({ message: 'Insufficient privileges' });
    return next();
  };
}

/** Optional helper to enrich req.user with full DB row when needed */
export async function loadUser(req, res, next) {
  try {
    if (!req.user?.userId) return next();
    const [rows] = await pool.execute(
      'SELECT UserID, FullName, Email, Role, Status FROM tblusers WHERE UserID = ? LIMIT 1',
      [req.user.userId]
    );
    if (!rows.length) return res.status(404).json({ message: 'User not found' });
    req.user = { ...req.user, ...rows[0] };
    return next();
  } catch (err) {
    console.error('Load user error:', err);
    return res.status(500).json({ message: 'Failed to load user' });
  }
}

/* Aliases for legacy imports */
export const authMiddleware = requireAuth;
export function authorizeRoles(...allowed) {
  return permitRoles(...allowed);
}

export default requireAuth;
