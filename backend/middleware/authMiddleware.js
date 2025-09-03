// backend/middleware/authMiddleware.js - Enhanced RBAC authentication
import 'dotenv/config';
import jwt from 'jsonwebtoken';
<<<<<<< HEAD
import crypto from 'crypto';
import pool from '../db.js';
import { ROLES, getRoleOrder, rotateRefreshToken, isAccessJtiRevoked, clearAuthCookies } from '../utils/tokens.js';
=======
import "dotenv/config";
import pool from '../db.js';
>>>>>>> user-roles-setup-(use-this)

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

<<<<<<< HEAD
// Extract client info from request
function getClientInfo(req) {
  return {
    ip: req.ip || req.connection.remoteAddress || req.socket.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0]?.trim(),
    userAgent: req.headers['user-agent'] || 'Unknown'
  };
}

// Verify access token and check revocation
async function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if token is revoked
    if (decoded.jti && await isAccessJtiRevoked(decoded.jti)) {
      return { error: 'Token revoked', status: 401 };
    }

    return { user: { userId: decoded.sub, role: decoded.role, jti: decoded.jti } };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return { error: 'Token expired', status: 401 };
    }
    return { error: 'Invalid token', status: 401 };
  }
}

// Main authentication middleware
export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.access_token;
    if (!token) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const result = await verifyAccessToken(token);
    if (result.error) {
      return res.status(result.status).json({ message: result.error });
    }

    req.user = result.user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ message: 'Authentication error' });
  }
}

// Try to refresh token transparently (for /api/me backward compatibility)
export async function tryRefresh(req, res, next) {
  try {
    // First try normal auth
    const accessToken = req.cookies?.access_token;
    if (accessToken) {
      const result = await verifyAccessToken(accessToken);
      if (!result.error) {
        req.user = result.user;
        return next();
      }
    }

    // If access token failed, try refresh
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ message: 'No session' });
    }

    // Hash refresh token
    const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    
    // Get user from refresh token
    const [rows] = await pool.execute(
      `SELECT u.UserID, u.FullName, u.Email, u.Role, u.Status 
       FROM tblRefreshTokens rt
       JOIN tblusers u ON rt.UserID = u.UserID
       WHERE rt.TokenHash = ? AND rt.RevokedAt IS NULL AND rt.ExpiresAt > NOW() AND u.Status = 'Active'
       LIMIT 1`,
      [refreshHash]
    );

    if (!rows.length) {
      return res.status(401).json({ message: 'Invalid session' });
    }

    const user = rows[0];
    const { ip, userAgent } = getClientInfo(req);

    // Rotate refresh token
    const rotateResult = await rotateRefreshToken({
      res,
      oldTokenHash: refreshHash,
      user: { userId: user.UserID, role: user.Role },
      userAgent,
      ip
    });

    if (rotateResult.error) {
      return res.status(rotateResult.status).json({ message: rotateResult.error });
    }

    // Set user for next middleware
    req.user = {
      userId: user.UserID,
      role: user.Role,
      jti: rotateResult.jti
    };

    next();
  } catch (error) {
    console.error('Refresh middleware error:', error);
    return res.status(500).json({ message: 'Session refresh error' });
  }
}

// Role-based access control - exact role match
export function permitRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient privileges' });
    }

    next();
  };
}

// Role hierarchy check - user has required role or higher
export function hasRoleOrHigher(requiredRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const userRoleLevel = getRoleOrder(req.user.role);
    const requiredRoleLevel = getRoleOrder(requiredRole);

    if (userRoleLevel < requiredRoleLevel) {
      return res.status(403).json({ message: 'Insufficient privileges' });
    }

    next();
  };
}

// Legacy compatibility - use requireAuth for existing code
export const authMiddleware = requireAuth;
=======
export async function authMiddleware(req, res, next) {
  try {
    const token = req.cookies?.access_token || req.cookies?.token;
    if (!token) return res.status(401).json({ message: "Not authenticated" });

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    // Always fetch the latest role & status from DB
    const [rows] = await pool.execute(
      'SELECT UserID, Role, Status FROM tblusers WHERE UserID = ? LIMIT 1',
      [userId]
    );
    if (!rows?.length || rows[0].Status !== 'Active') {
      return res.status(401).json({ message: 'Invalid session' });
    }

    req.user = { userId: rows[0].UserID, role: rows[0].Role };
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid session' });
  }
}

export function authorizeRoles(...allowed) {
  return (req, res, next) => {
    if (!req.user?.role) return res.status(401).json({ message: 'Not authenticated' });
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: insufficient role' });
    }
    return next(); 
  };
}
>>>>>>> user-roles-setup-(use-this)
