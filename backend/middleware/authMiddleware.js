// backend/middleware/authMiddleware.js
import jwt from 'jsonwebtoken';
import "dotenv/config";
import pool from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

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