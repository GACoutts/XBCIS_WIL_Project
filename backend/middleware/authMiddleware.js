// backend/middleware/authMiddleware.js
import 'dotenv/config';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import { ROLES, getRoleOrder } from '../utils/tokens.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// -----------------------------
// Verify JWT and attach user
// -----------------------------
export function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.access_token || req.cookies?.token;
    if (!token) return res.status(401).json({ message: 'Not authenticated' });

    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = {
      userId: decoded.sub || decoded.userId,
      role: decoded.role || decoded.Role
    };

    next();
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// -----------------------------
// Role-based access control
// -----------------------------
export function permitRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient privileges' });
    }

    next();
  };
}

// Role hierarchy: user has required role or higher
export function hasRoleOrHigher(requiredRole) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

    const userLevel = getRoleOrder(req.user.role);
    const requiredLevel = getRoleOrder(requiredRole);

    if (userLevel < requiredLevel) {
      return res.status(403).json({ message: 'Insufficient privileges' });
    }

    next();
  };
}

// -----------------------------
// Optional: load user from DB
// -----------------------------
export async function loadUser(req, res, next) {
  try {
    if (!req.user) return next();

    const [rows] = await pool.query(
      'SELECT UserID, FullName, Email, Role, Status FROM tblusers WHERE UserID = ? LIMIT 1',
      [req.user.userId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    req.user = { ...req.user, ...rows[0] };
    next();
  } catch (err) {
    console.error('Load user error:', err);
    return res.status(500).json({ message: 'Failed to load user' });
  }
}

// Legacy compatibility
export const authMiddleware = requireAuth;
