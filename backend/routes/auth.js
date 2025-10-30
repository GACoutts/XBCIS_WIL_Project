// backend/routes/auth.js - Dual-token (access + refresh) cookie auth
import 'dotenv/config';
import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import pool from '../db.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth } from '../middleware/authMiddleware.js';
import { authRateLimit } from '../middleware/rateLimiter.js';
import {
  issueSession,
  rotateRefreshToken,
  addRevokedAccessJti,
  clearAuthCookies,
  logAudit
} from '../utils/tokens.js';
import { normalizePlaceId } from '../utils/geo.js';

const router = express.Router();

// -----------------------------------------------------------------------------
// File upload setup for registration proof documents
const uploadsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const proofStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^\w\-]+/g, '_');
    cb(null, `proof_${timestamp}_${base}${ext}`);
  }
});

const proofFileFilter = (_req, file, cb) => {
  const allowed = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
  cb(allowed ? null : new Error('Unsupported proof file type'), allowed);
};

const proofUpload = multer({
  storage: proofStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: proofFileFilter
});

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
router.post('/register', authRateLimit, proofUpload.single('proof'), async (req, res) => {
  try {
    // include geo fields from Google Autocomplete
    const b = req.body || {};
    const fullName = (b.fullName || '').trim();
    const email = (b.email || '').trim().toLowerCase();
    const password = b.password || '';
    const phone = (b.phone || '').trim() || null;
    const role = (b.role || '').trim(); // Client / Landlord / Contractor / Staff
    const address = (b.address || '').trim();
    const proofFile = req.file;

    // Accept either casing; clamp safely for DB
    const safePlaceId = normalizePlaceId(b.placeId || b.PlaceId || null);

    // Lat/lng as nullable floats
    const latNum =
      b.latitude !== undefined && b.latitude !== null && `${b.latitude}`.trim() !== '' ? Number(b.latitude) : null;
    const lngNum =
      b.longitude !== undefined && b.longitude !== null && `${b.longitude}`.trim() !== '' ? Number(b.longitude) : null;

    if (!fullName || !email || !password || !role) {
      return res.status(400).json({ message: 'Missing required fields: fullName, email, password, role' });
    }

    const validRoles = ['Client', 'Landlord', 'Contractor', 'Staff'];
    if (!validRoles.includes(role)) return res.status(400).json({ message: 'Invalid role' });

    if ((role === 'Client' || role === 'Landlord')) {
      if (!address) return res.status(400).json({ message: 'Address is required for Clients and Landlords' });
      if (!proofFile) return res.status(400).json({ message: 'Proof document is required for Clients and Landlords' });
    }

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    const hash = await bcrypt.hash(password, rounds);

    // Create user with Inactive status - requires staff approval
    const [result] = await pool.execute(
      `INSERT INTO tblusers
       (FullName, Email, PasswordHash, Phone, Role, Status, PlaceId, Latitude, Longitude)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fullName,
        email,
        hash,
        phone,
        role,
        'Inactive',
        safePlaceId || null,
        Number.isFinite(latNum) ? latNum : null,
        Number.isFinite(lngNum) ? lngNum : null
      ]
    );
    const newUserId = result.insertId;

    // Proofs + property creation/mapping
    if ((role === 'Client' || role === 'Landlord') && address && proofFile) {
      try {
        await pool.execute(`CREATE TABLE IF NOT EXISTS tblUserProofs (
          ProofID INT AUTO_INCREMENT PRIMARY KEY,
          UserID INT NOT NULL,
          FilePath VARCHAR(255) NOT NULL,
          Address VARCHAR(255) DEFAULT NULL,
          UploadedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_userproofs_user FOREIGN KEY (UserID) REFERENCES tblusers(UserID)
            ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      } catch (e) {
        console.error('Error ensuring tblUserProofs exists:', e);
      }

      const filePath = `/uploads/${proofFile.filename}`;
      try {
        await pool.execute(
          'INSERT INTO tblUserProofs (UserID, FilePath, Address) VALUES (?, ?, ?)',
          [newUserId, filePath, address]
        );
      } catch (e) {
        console.error('Error inserting into tblUserProofs:', e);
      }

      // Create or reuse a property record by PlaceId
      try {
        let propertyId = null;

        if (safePlaceId) {
          const [exists] = await pool.execute(
            'SELECT PropertyID FROM tblProperties WHERE PlaceId = ? LIMIT 1',
            [safePlaceId]
          );
          if (exists.length) propertyId = exists[0].PropertyID;
        }

        if (!propertyId) {
          const [propRes] = await pool.execute(
            `INSERT INTO tblProperties
             (PropertyRef, AddressLine1, PlaceId, Latitude, Longitude)
             VALUES (?, ?, ?, ?, ?)`,
            [
              'PROP-' + Date.now(),
              address,
              safePlaceId || null,
              Number.isFinite(latNum) ? latNum : null,
              Number.isFinite(lngNum) ? lngNum : null,
            ]
          );
          propertyId = propRes.insertId;
        }

        if (role === 'Client') {
          await pool.execute(
            'INSERT INTO tblTenancies (PropertyID, TenantUserID, StartDate, IsActive) VALUES (?, ?, CURDATE(), 1)',
            [propertyId, newUserId]
          );
        } else if (role === 'Landlord') {
          await pool.execute(
            'INSERT INTO tblLandlordProperties (LandlordUserID, PropertyID, ActiveFrom, IsPrimary) VALUES (?, ?, CURDATE(), 1)',
            [newUserId, propertyId]
          );
        }
      } catch (e) {
        console.error('Error creating/reusing property at register:', e);
      }
    }

    const { ip, userAgent } = getClientInfo(req);
    try {
      await logAudit({
        actorUserId: newUserId,
        targetUserId: newUserId,
        action: 'register',
        metadata: {
          role,
          email,
          status: 'Inactive',
          pendingApproval: true
        },
        ip,
        userAgent
      });
    } catch (e) {
      console.warn('Audit log failure (register):', e?.message || e);
    }

    return res.status(201).json({
      user: { userId: newUserId, email, fullName, role, status: 'Inactive' },
      message: 'Registration successful! Your account is pending approval by staff.',
      requiresApproval: true
    });
  } catch (err) {
    console.error('Registration error:', err);
    if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Email already exists' });
    return res.status(500).json({ message: 'Server error during registration' });
  }
});

// GET /me
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

// POST /refresh
router.post('/refresh', async (req, res) => {
  try {
    const { ip, userAgent } = getClientInfo(req);

    const result = await rotateRefreshToken({ req, res, userAgent, ip });
    if (result?.error) {
      clearAuthCookies(res);
      return res.status(result.status || 401).json({ message: result.error });
    }
    return res.json({ ok: true });
  } catch (err) {
    clearAuthCookies(res);
    return res.status(401).json({ message: 'Could not refresh session' });
  }
});

// POST /logout
router.post('/logout', requireAuth, async (req, res) => {
  try {
    if (req.user?.jti && req.user?.userId && req.auth?.exp) {
      await addRevokedAccessJti({
        jti: req.user.jti,
        userId: req.user.userId,
        exp: req.auth.exp,
        reason: 'logout',
      });
    }

    const rawRefresh = req.cookies?.refresh;
    if (rawRefresh) {
      const hash = crypto.createHash('sha256').update(rawRefresh, 'utf8').digest('hex');
      await pool.execute(
        'UPDATE tblRefreshTokens SET RevokedAt = NOW() WHERE TokenHash = ? AND RevokedAt IS NULL',
        [hash]
      );
    }
  } catch {
    // swallow
  } finally {
    clearAuthCookies(res);
    return res.json({ message: 'Logged out' });
  }
});

// GET /sessions
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

// DELETE /sessions/:id
router.delete('/sessions/:id', requireAuth, async (req, res) => {
  try {
    const tokenId = parseInt(req.params.id, 10);
    if (!Number.isFinite(tokenId)) return res.status(400).json({ message: 'Invalid session id' });

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

    if (currentHash && rows[0].TokenHash === currentHash) {
      clearAuthCookies(res);
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /auth/sessions/:id error:', e?.message || e);
    return res.status(500).json({ message: 'Failed to revoke session' });
  }
});

// DELETE /sessions
router.delete('/sessions', requireAuth, async (req, res) => {
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
    console.error('DELETE /auth/sessions error:', e?.message || e);
    return res.status(500).json({ message: 'Failed to revoke all sessions' });
  }
});

// POST /logout-all
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
