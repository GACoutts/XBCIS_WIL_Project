// backend/routes/auth.js - Single-token authentication system
import 'dotenv/config';
import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import pool from '../db.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { authRateLimit, passwordResetRateLimit } from '../middleware/rateLimiter.js';
import { 
  issueSession, 
  rotateRefreshToken, 
  revokeAllUserRefreshTokens,
  addRevokedAccessJti,
  clearAuthCookies,
  logAudit
} from '../utils/tokens.js';

const router = express.Router();

// Extract client info from request
function getClientInfo(req) {
  return {
    ip: req.ip || req.connection.remoteAddress || req.socket.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0]?.trim(),
    userAgent: req.headers['user-agent'] || 'Unknown'
  };
}

// POST /login
router.post('/login', authRateLimit, async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const identifier = email || username;

    if (!identifier || !password) return res.status(400).json({ message: 'Email/Username and password are required' });

    const [rows] = await pool.execute(
      'SELECT UserID, FullName, Email, PasswordHash, Role, Status FROM tblusers WHERE Email = ? LIMIT 1',
      [identifier]
    );

    if (!rows?.length) return res.status(401).json({ message: 'Invalid credentials' });

    const user = rows[0];
    if (user.Status !== 'Active') return res.status(403).json({ message: `Account status is ${user.Status}` });

    const ok = await bcrypt.compare(password, user.PasswordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const { ip, userAgent } = getClientInfo(req);
    const session = await issueSession({
      res,
      user: { userId: user.UserID, role: user.Role },
      userAgent,
      ip
    });

    await logAudit({
      actorUserId: user.UserID,
      targetUserId: user.UserID,
      action: 'login',
      metadata: { sessionId: session.tokenId },
      ip,
      userAgent
    });

    return res.json({
      user: {
        userId: user.UserID,
        username: user.Email,
        fullName: user.FullName,
        email: user.Email,
        role: user.Role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Server error during login' });
  }
});

// POST /register
router.post('/register', authRateLimit, async (req, res) => {
  try {
    const { fullName, email, password, phone, role } = req.body;

    if (!fullName || !email || !password || !role) {
      return res.status(400).json({ message: 'Missing required fields: fullName, email, password, role' });
    }

    const validRoles = ['Client', 'Landlord', 'Contractor', 'Staff'];
    if (!validRoles.includes(role)) return res.status(400).json({ message: 'Invalid role' });

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    const hash = await bcrypt.hash(password, rounds);

    const [result] = await pool.execute(
      'INSERT INTO tblusers (FullName, Email, PasswordHash, Phone, Role) VALUES (?, ?, ?, ?, ?)',
      [fullName, email, hash, phone || null, role]
    );

    const { ip, userAgent } = getClientInfo(req);
    const session = await issueSession({
      res,
      user: { userId: result.insertId, role },
      userAgent,
      ip
    });

    await logAudit({
      actorUserId: result.insertId,
      targetUserId: result.insertId,
      action: 'register',
      metadata: { sessionId: session.tokenId },
      ip,
      userAgent
    });

    return res.status(201).json({
      user: { userId: result.insertId, email, fullName, role },
      message: 'User registered successfully',
    });
  } catch (err) {
    console.error('Registration error:', err);
    if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Email already exists' });
    return res.status(500).json({ message: 'Server error during registration' });
  }
});

// GET /me - Get current user
router.get('/me', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT UserID, FullName, Email, Role, Status FROM tblusers WHERE UserID = ? LIMIT 1',
      [req.user.userId]
    );

    if (!rows?.length || rows[0].Status !== 'Active') return res.status(401).json({ message: 'Invalid session' });

    const u = rows[0];
    return res.json({
      user: {
        userId: u.UserID,
        username: u.Email,
        fullName: u.FullName,
        email: u.Email,
        role: u.Role,
      },
    });
  } catch (err) {
    console.error('Session error:', err);
    return res.status(500).json({ message: 'Server error retrieving session' });
  }
});

// All other routes remain unchanged...
// Just remove any `tryRefresh` usage and only use `requireAuth` for protected routes

export default router;
