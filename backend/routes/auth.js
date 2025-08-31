// backend/routes/auth.js - Dual-token authentication system
import 'dotenv/config';
import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import pool from '../db.js';
import { requireAuth, tryRefresh } from '../middleware/authMiddleware.js';
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

// POST /login - Authenticate user and issue session
router.post('/login', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const identifier = email || username;

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Email/Username and password are required' });
    }

    const [rows] = await pool.execute(
      'SELECT UserID, FullName, Email, PasswordHash, Role, Status FROM tblusers WHERE Email = ? LIMIT 1',
      [identifier]
    );

    if (!rows?.length) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = rows[0];

    if (user.Status !== 'Active') {
      return res.status(403).json({ message: `Account status is ${user.Status}` });
    }

    const ok = await bcrypt.compare(password, user.PasswordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    // Issue new session
    const { ip, userAgent } = getClientInfo(req);
    const session = await issueSession({
      res,
      user: { userId: user.UserID, role: user.Role },
      userAgent,
      ip
    });

    // Log audit event
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

// POST /register - Register new user and issue session
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password, phone, role } = req.body;

    if (!fullName || !email || !password || !role) {
      return res
        .status(400)
        .json({ message: 'Missing required fields: fullName, email, password, role' });
    }

    const validRoles = ['Client', 'Landlord', 'Contractor', 'Staff'];
    if (!validRoles.includes(role)) {
      return res
        .status(400)
        .json({ message: 'Invalid role. Must be one of: ' + validRoles.join(', ') });
    }

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    const hash = await bcrypt.hash(password, rounds);

    const [result] = await pool.execute(
      'INSERT INTO tblusers (FullName, Email, PasswordHash, Phone, Role) VALUES (?, ?, ?, ?, ?)',
      [fullName, email, hash, phone || null, role]
    );

    // Issue session for new user
    const { ip, userAgent } = getClientInfo(req);
    const session = await issueSession({
      res,
      user: { userId: result.insertId, role },
      userAgent,
      ip
    });

    // Log audit event
    await logAudit({
      actorUserId: result.insertId,
      targetUserId: result.insertId,
      action: 'register',
      metadata: { sessionId: session.tokenId },
      ip,
      userAgent
    });

    return res.status(201).json({
      user: {
        userId: result.insertId,
        email,
        fullName,
        role,
      },
      message: 'User registered successfully',
    });
  } catch (err) {
    console.error('Registration error:', err);
    if (err?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Email already exists' });
    }
    return res.status(500).json({ message: 'Server error during registration' });
  }
});

// GET /me - Get current user with auto-refresh fallback
router.get('/me', tryRefresh, async (req, res) => {
  try {
    // Get fresh user data from database
    const [rows] = await pool.execute(
      'SELECT UserID, FullName, Email, Role, Status FROM tblusers WHERE UserID = ? LIMIT 1',
      [req.user.userId]
    );

    if (!rows?.length || rows[0].Status !== 'Active') {
      return res.status(401).json({ message: 'Invalid session' });
    }

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
    console.error('Session restore error:', err);
    return res.status(401).json({ message: 'Invalid session' });
  }
});

// POST /refresh - Manually refresh tokens
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ message: 'No refresh token' });
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
      return res.status(401).json({ message: 'Invalid refresh token' });
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

    // Log audit event
    await logAudit({
      actorUserId: user.UserID,
      targetUserId: user.UserID,
      action: 'token-refresh',
      metadata: { newSessionId: rotateResult.tokenId },
      ip,
      userAgent
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('Token refresh error:', err);
    return res.status(500).json({ message: 'Server error during token refresh' });
  }
});

// POST /logout - Revoke current session
router.post('/logout', requireAuth, async (req, res) => {
  try {
    const { ip, userAgent } = getClientInfo(req);
    
    // Revoke current refresh token if present
    const refreshToken = req.cookies?.refresh_token;
    if (refreshToken) {
      const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await pool.execute(
        'UPDATE tblRefreshTokens SET RevokedAt = NOW() WHERE TokenHash = ? AND RevokedAt IS NULL',
        [refreshHash]
      );
    }

    // Add current access token to revocation list
    if (req.user.jti) {
      // Get token expiry from JWT
      const accessToken = req.cookies?.access_token;
      if (accessToken) {
        try {
          const decoded = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
          await addRevokedAccessJti({
            jti: req.user.jti,
            userId: req.user.userId,
            exp: decoded.exp,
            reason: 'logout'
          });
        } catch (e) {
          console.error('Error adding JTI to revocation list:', e);
        }
      }
    }

    // Clear cookies
    clearAuthCookies(res);

    // Log audit event
    await logAudit({
      actorUserId: req.user.userId,
      targetUserId: req.user.userId,
      action: 'logout',
      metadata: { jti: req.user.jti },
      ip,
      userAgent
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ message: 'Server error during logout' });
  }
});

// POST /logout-all - Revoke all user sessions
router.post('/logout-all', requireAuth, async (req, res) => {
  try {
    const { ip, userAgent } = getClientInfo(req);

    // Revoke all refresh tokens for user
    await revokeAllUserRefreshTokens({
      userId: req.user.userId,
      reason: 'logout-all'
    });

    // Add current access token to revocation list
    if (req.user.jti) {
      const accessToken = req.cookies?.access_token;
      if (accessToken) {
        try {
          const decoded = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
          await addRevokedAccessJti({
            jti: req.user.jti,
            userId: req.user.userId,
            exp: decoded.exp,
            reason: 'logout-all'
          });
        } catch (e) {
          console.error('Error adding JTI to revocation list:', e);
        }
      }
    }

    // Clear cookies
    clearAuthCookies(res);

    // Log audit event
    await logAudit({
      actorUserId: req.user.userId,
      targetUserId: req.user.userId,
      action: 'logout-all',
      metadata: { jti: req.user.jti },
      ip,
      userAgent
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('Logout all error:', err);
    return res.status(500).json({ message: 'Server error during logout' });
  }
});

// GET /sessions - List active sessions (protected)
router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT TokenID, IssuedAt, ExpiresAt, IP, UserAgent, FamilyID
       FROM tblRefreshTokens 
       WHERE UserID = ? AND RevokedAt IS NULL AND ExpiresAt > NOW()
       ORDER BY IssuedAt DESC`,
      [req.user.userId]
    );

    const sessions = rows.map(row => ({
      tokenId: row.TokenID,
      issuedAt: row.IssuedAt,
      expiresAt: row.ExpiresAt,
      ip: row.IP,
      userAgent: row.UserAgent,
      familyId: row.FamilyID
    }));

    return res.json({ sessions });
  } catch (err) {
    console.error('Get sessions error:', err);
    return res.status(500).json({ message: 'Server error retrieving sessions' });
  }
});

// DELETE /sessions/:tokenId - Revoke specific session
router.delete('/sessions/:tokenId', requireAuth, async (req, res) => {
  try {
    const { tokenId } = req.params;
    const { ip, userAgent } = getClientInfo(req);

    // Verify token belongs to user and revoke it
    const [result] = await pool.execute(
      'UPDATE tblRefreshTokens SET RevokedAt = NOW() WHERE TokenID = ? AND UserID = ? AND RevokedAt IS NULL',
      [tokenId, req.user.userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Log audit event
    await logAudit({
      actorUserId: req.user.userId,
      targetUserId: req.user.userId,
      action: 'session-revoked',
      metadata: { tokenId },
      ip,
      userAgent
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('Revoke session error:', err);
    return res.status(500).json({ message: 'Server error revoking session' });
  }
});

// DELETE /sessions - Revoke all other sessions except current
router.delete('/sessions', requireAuth, async (req, res) => {
  try {
    const { ip, userAgent } = getClientInfo(req);
    const refreshToken = req.cookies?.refresh_token;
    
    if (refreshToken) {
      const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      
      // Revoke all tokens except the current one
      await pool.execute(
        'UPDATE tblRefreshTokens SET RevokedAt = NOW() WHERE UserID = ? AND TokenHash != ? AND RevokedAt IS NULL',
        [req.user.userId, refreshHash]
      );
    } else {
      // No current refresh token, revoke all
      await revokeAllUserRefreshTokens({
        userId: req.user.userId,
        reason: 'revoke-other-sessions'
      });
    }

    // Log audit event
    await logAudit({
      actorUserId: req.user.userId,
      targetUserId: req.user.userId,
      action: 'other-sessions-revoked',
      metadata: {},
      ip,
      userAgent
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('Revoke other sessions error:', err);
    return res.status(500).json({ message: 'Server error revoking sessions' });
  }
});

export default router;
