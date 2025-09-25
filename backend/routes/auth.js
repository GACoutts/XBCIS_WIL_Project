// backend/routes/auth.js - Dual-token (access + refresh) cookie auth
import 'dotenv/config';
import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import pool from '../db.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { authRateLimit } from '../middleware/rateLimiter.js';
import {
  issueSession,
  rotateRefreshToken,
  addRevokedAccessJti,
  clearAuthCookies,
  logAudit
} from '../utils/tokens.js';

const router = express.Router();

// Extract client info from request
function getClientInfo(req) {
  const xf = req.headers['x-forwarded-for'];
  const forwarded = typeof xf === 'string' ? xf : Array.isArray(xf) ? xf[0] : '';
  return {
    ip:
      forwarded?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      req.connection?.remoteAddress ||
      'Unknown',
    userAgent: req.headers['user-agent'] || 'Unknown',
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


    if (!user.PasswordHash || !user.PasswordHash.startsWith('$2')) {
      console.error('Login error: invalid PasswordHash for user', user.UserID);
      return res.status(500).json({ message: 'Server error during login' });
    }

    const ok = await bcrypt.compare(password, user.PasswordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const { ip, userAgent } = getClientInfo(req);
    const session = await issueSession({
      res,
      user: { userId: user.UserID, role: user.Role },
      userAgent,
      ip
    });

    try {
      await logAudit({
        actorUserId: user.UserID,
        targetUserId: user.UserID,
        action: 'login',
        metadata: { sessionId: session.tokenId },
        ip,
        userAgent
      });
    } catch (e) {
      console.warn('Audit log failure (login):', e?.message || e);
    }

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
    console.error('Login error:', err?.message || err);
    if (err?.stack) console.error(err.stack);
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

    try {
      await logAudit({
        actorUserId: result.insertId,
        targetUserId: result.insertId,
        action: 'register',
        metadata: { sessionId: session.tokenId },
        ip,
        userAgent
      });
    } catch (e) {
      console.warn('Audit log failure (register):', e?.message || e);
    }

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

// POST /refresh - rotate refresh + access cookies
router.post('/refresh', async (req, res) => {
  try {
    const { ip, userAgent } = getClientInfo(req);

    const result = await rotateRefreshToken({ req, res, userAgent, ip });
    if (result?.error) {
      // rotation rejected (invalid, expired, or reuse detected)
      clearAuthCookies(res);
      return res.status(result.status || 401).json({ message: result.error });
    }

    // cookies are already set; return minimal ok
    return res.json({ ok: true });
  } catch (err) {
    clearAuthCookies(res);
    return res.status(401).json({ message: 'Could not refresh session' });
  }
});

// POST /logout - revoke current access JTI; best-effort revoke presented refresh; clear cookies
router.post('/logout', requireAuth, async (req, res) => {
  try {
    // 1) Revoke current access token JTI in DB until its exp
    if (req.user?.jti && req.user?.userId && req.auth?.exp) {
      await addRevokedAccessJti({
        jti: req.user.jti,
        userId: req.user.userId,
        exp: req.auth.exp, // seconds since epoch
        reason: 'logout',
      });
    }

    // 2) Best-effort revoke the *presented* refresh cookie row (if any)
    const rawRefresh = req.cookies?.refresh;
    if (rawRefresh) {
      const hash = crypto.createHash('sha256').update(rawRefresh, 'utf8').digest('hex');
      await pool.execute(
        'UPDATE tblRefreshTokens SET RevokedAt = NOW() WHERE TokenHash = ? AND RevokedAt IS NULL',
        [hash]
      );
    }
  } catch (err) {
    // swallow errors on logout
  } finally {
    // 3) Clear cookies regardless
    clearAuthCookies(res);
    return res.json({ message: 'Logged out' });
  }
});

// GET /sessions - list this user's sessions (refresh tokens)
router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const raw = req.cookies?.refresh || null;
    const currentHash = raw
      ? crypto.createHash('sha256').update(raw, 'utf8').digest('hex')
      : null;

    const [rows] = await pool.execute(
      `SELECT TokenID, FamilyID, IssuedAt, ExpiresAt, RevokedAt,
              ReplacedByTokenID, UserAgent, IP, TokenHash
         FROM tblRefreshTokens
        WHERE UserID = ?
        ORDER BY IssuedAt DESC`,
      [req.user.userId]
    );

    const sessions = rows.map(r => ({
      tokenId: r.TokenID,
      familyId: r.FamilyID,
      issuedAt: r.IssuedAt,
      expiresAt: r.ExpiresAt,
      revokedAt: r.RevokedAt,
      replacedByTokenId: r.ReplacedByTokenID,
      userAgent: r.UserAgent,
      ip: r.IP,
      isCurrent: currentHash ? r.TokenHash === currentHash : false,
    }));

    return res.json({ sessions });
  } catch (e) {
    console.error('GET /auth/sessions error:', e?.message || e);
    return res.status(500).json({ message: 'Failed to load sessions' });
  }
});

// DELETE /sessions/:id - revoke a specific session by TokenID (if it belongs to the user)
router.delete('/sessions/:id', requireAuth, async (req, res) => {
  try {
    const tokenId = parseInt(req.params.id, 10);
    if (!Number.isFinite(tokenId)) return res.status(400).json({ message: 'Invalid session id' });

    // is this the current refresh?
    const raw = req.cookies?.refresh || null;
    const currentHash = raw
      ? crypto.createHash('sha256').update(raw, 'utf8').digest('hex')
      : null;

    const [rows] = await pool.execute(
      `SELECT TokenID, TokenHash
         FROM tblRefreshTokens
        WHERE TokenID = ? AND UserID = ? AND RevokedAt IS NULL
        LIMIT 1`,
      [tokenId, req.user.userId]
    );
    if (!rows.length) return res.status(404).json({ message: 'Session not found' });

    await pool.execute(
      'UPDATE tblRefreshTokens SET RevokedAt = NOW() WHERE TokenID = ?',
      [tokenId]
    );

    // If user deleted their current session, clear cookies
    if (currentHash && rows[0].TokenHash === currentHash) {
      clearAuthCookies(res);
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /auth/sessions/:id error:', e?.message || e);
    return res.status(500).json({ message: 'Failed to revoke session' });
  }
});

// DELETE /sessions - revoke ALL sessions for this user (logout-all)
router.delete('/sessions', requireAuth, async (req, res) => {
  try {
    // blacklist current access JTI until its exp (best-effort)
    if (req.user?.jti && req.auth?.exp) {
      await addRevokedAccessJti({
        jti: req.user.jti,
        userId: req.user.userId,
        exp: req.auth.exp,
        reason: 'logout-all',
      });
    }

    await pool.execute(
      'UPDATE tblRefreshTokens SET RevokedAt = NOW() WHERE UserID = ? AND RevokedAt IS NULL',
      [req.user.userId]
    );

    clearAuthCookies(res);
    return res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /auth/sessions error:', e?.message || e);
    return res.status(500).json({ message: 'Failed to revoke all sessions' });
  }
});

// POST /logout-all - alias of DELETE /sessions (Just incase)
router.post('/logout-all', requireAuth, async (req, res) => {
  try {
    if (req.user?.jti && req.auth?.exp) {
      await addRevokedAccessJti({
        jti: req.user.jti,
        userId: req.user.userId,
        exp: req.auth.exp,
        reason: 'logout-all',
      });
    }
    await pool.execute(
      'UPDATE tblRefreshTokens SET RevokedAt = NOW() WHERE UserID = ? AND RevokedAt IS NULL',
      [req.user.userId]
    );
    clearAuthCookies(res);
    return res.json({ ok: true });
  } catch (e) {
    console.error('POST /auth/logout-all error:', e?.message || e);
    return res.status(500).json({ message: 'Failed to revoke all sessions' });
  }
});


export default router;
