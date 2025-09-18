// backend/middleware/authMiddleware.js - RBAC auth (unified, robust)
import 'dotenv/config';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../db.js';
import {
  isAccessJtiRevoked,
  rotateRefreshToken,
  getRoleOrder, // from utils/tokens.js
} from '../utils/tokens.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

/** Normalize decoded token -> { userId, role, jti, type } */
function toReqUser(decoded) {
  return {
    userId: decoded?.sub ?? decoded?.userId ?? decoded?.id ?? null,
    role: decoded?.role ?? decoded?.Role ?? null,
    jti: decoded?.jti ?? null,
    type: decoded?.type ?? null,
  };
}

function getClientInfo(req) {
  return {
    ip:
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.ip ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      'Unknown',
    userAgent: req.headers['user-agent'] || 'Unknown',
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

    // Fetch latest role/status to reflect server truth (must be Active)
    const [rows] = await pool.execute(
      'SELECT UserID, Role, Status, FullName, Email FROM tblusers WHERE UserID = ? LIMIT 1',
      [u.userId]
    );
    if (!rows.length) return res.status(404).json({ message: 'User not found' });

    const dbUser = rows[0];
    if (dbUser.Status !== 'Active') {
      return res.status(403).json({ message: 'Account is not active' });
    }

    // Attach canonical user
    req.user = { userId: dbUser.UserID, role: dbUser.Role, jti: u.jti };
    return next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ message: 'Authentication error' });
  }
}

/**
 * tryRefresh
 * - If access token valid & not revoked → attach req.user and next()
 * - Else, attempt refresh rotation using refresh_token cookie:
 *   - Verify refresh token in DB (Active user only)
 *   - rotateRefreshToken (sets new cookies, returns new access JWT)
 *   - Verify NEW access token and attach req.user
 */
export async function tryRefresh(req, res, next) {
  const access = req.cookies?.access_token || req.cookies?.token; // legacy fallback

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

  try {
    const refresh = req.cookies?.refresh_token;
    if (!refresh) return res.status(401).json({ message: 'Unauthorized' });

    const refreshHash = crypto.createHash('sha256').update(refresh).digest('hex');

    // Verify refresh token and user is Active
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
    const { ip, userAgent } = getClientInfo(req);

    // Rotate (sets new cookies + returns new access JWT)
    const rotate = await rotateRefreshToken({
      res,
      oldTokenHash: refreshHash,
      user: { userId: dbUser.UserID, role: dbUser.Role },
      userAgent,
      ip,
    });
    if (rotate?.error) {
      return res.status(rotate.status || 401).json({ message: rotate.error });
    }

    // Verify the new access token
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
