// backend/middleware/authMiddleware.js - RBAC auth (unified exports)
import 'dotenv/config';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import crypto from 'crypto';
import { isAccessJtiRevoked, rotateRefreshToken } from '../utils/tokens.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// Normalize decoded token -> { userId, role }
function toReqUser(decoded) {
  // decoded: { jti, sub, role, type, iat, exp }
  return {
    userId: decoded?.sub ?? decoded?.userId ?? decoded?.id,
    role: decoded?.role,
    jti: decoded?.jti,
    type: decoded?.type,
  };
}

/** Require a valid access token and an Active user in DB */
export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.access_token || req.cookies?.token;
    if (!token) return res.status(401).json({ message: 'Not authenticated' });

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    const u = toReqUser(decoded);
    if (!u.userId || u.type !== 'access' || !u.jti) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Enforce revocation list (logout/logout-all)
    if (await isAccessJtiRevoked(u.jti)) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // Always fetch latest role/status to reflect server truth
    const [rows] = await pool.execute(
      'SELECT UserID, Role, Status FROM tblusers WHERE UserID = ? LIMIT 1',
      [u.userId]
    );
    if (!rows?.length || rows[0].Status !== 'Active') {
      return res.status(401).json({ message: 'Invalid session' });
    }

    // Attach canonical user (role from DB wins)
    req.user = { userId: rows[0].UserID, role: rows[0].Role, jti: u.jti };
    return next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ message: 'Authentication error' });
  }
}

/**
 * tryRefresh
 * - If access token valid & not revoked → attach req.user and next()
 * - Else, try refresh rotation using refresh_token cookie:
 *   - Verifies refresh token in DB
 *   - Calls rotateRefreshToken (sets new cookies)
 *   - Verifies NEW access token and attaches req.user
 * - On failure: 401
 */
export async function tryRefresh(req, res, next) {
  const access = req.cookies?.access_token || req.cookies?.token; // legacy fallback

  // Fast path: accept current access if valid & not revoked
  if (access) {
    try {
      const decoded = jwt.verify(access, JWT_SECRET);
      const u = toReqUser(decoded);
      if (u.userId && u.type === 'access' && u.jti && !(await isAccessJtiRevoked(u.jti))) {
        req.user = u;
        return next();
      }
    } catch {
      // fall through to refresh
    }
  }

  // Attempt refresh
  try {
    const refresh = req.cookies?.refresh_token;
    if (!refresh) return res.status(401).json({ message: 'Unauthorized' });

    const refreshHash = crypto.createHash('sha256').update(refresh).digest('hex');

    // Verify refresh token in DB and fetch user context
    const [rows] = await pool.execute(
      `SELECT u.UserID, u.Role, u.Status
         FROM tblRefreshTokens rt
         JOIN tblusers u ON rt.UserID = u.UserID
        WHERE rt.TokenHash = ?
          AND rt.RevokedAt IS NULL
          AND rt.ExpiresAt > NOW()
          AND u.Status = 'Active'
        LIMIT 1`,
      [refreshHash]
    );
    if (!rows?.length) return res.status(401).json({ message: 'Unauthorized' });

    const dbUser = rows[0];

    // Rotate (sets new cookies + returns new access JWT)
    const rotate = await rotateRefreshToken({
      res,
      oldTokenHash: refreshHash,
      user: { userId: dbUser.UserID, role: dbUser.Role },
      userAgent: req.headers['user-agent'] || 'Unknown',
      ip:
        req.ip ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        req.headers['x-forwarded-for']?.split(',')[0]?.trim(),
    });

    if (rotate?.error) {
      return res.status(rotate.status || 401).json({ message: rotate.error });
    }

    // Verify the new access token and attach user
    const decoded = jwt.verify(rotate.accessToken, JWT_SECRET);
    const u = toReqUser(decoded);
    if (!u.userId || u.type !== 'access' || !u.jti) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (await isAccessJtiRevoked(u.jti)) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    req.user = u;
    return next();
  } catch (err) {
    console.error('tryRefresh error:', err);
    return res.status(401).json({ message: 'Unauthorized' });
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

/** Hierarchy gate (Client < Landlord/Contractor < Staff) */
const ROLE_ORDER = { Client: 1, Landlord: 2, Contractor: 2, Staff: 3 };
export function hasRoleOrHigher(requiredRole) {
  return (req, res, next) => {
    if (!req.user?.role) return res.status(401).json({ message: 'Not authenticated' });
    const need = ROLE_ORDER[requiredRole] ?? 99;
    const have = ROLE_ORDER[req.user.role] ?? 0;
    if (have < need) return res.status(403).json({ message: 'Insufficient privileges' });
    return next();
  };
}

/* ===== Aliases for the other branch names (do not remove) ===== */
export const authMiddleware = requireAuth;
export function authorizeRoles(...allowed) { return permitRoles(...allowed); }

export default requireAuth;
