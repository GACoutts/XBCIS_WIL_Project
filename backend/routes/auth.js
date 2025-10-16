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

const router = express.Router();

// -----------------------------------------------------------------------------
// File upload setup for registration proof documents
// We reuse the backend/uploads directory used by other uploads.  Files are
// written with a "proof_" prefix and a sanitized basename.  Only image and
// PDF files up to 10MB are accepted.
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
// This route accepts both JSON bodies and multipart/form-data.  For tenants
// (role "Client") and landlords (role "Landlord"), clients must submit a
// property address along with a proof document (image or PDF).  For other
// roles (Contractor, Staff), the JSON body is sufficient.
router.post('/register', authRateLimit, proofUpload.single('proof'), async (req, res) => {
  try {
    // In a multipart request, multer populates req.body with string values and
    // req.file contains the uploaded file.  For JSON requests, req.file will be
    // undefined and req.body will contain the JSON payload.
    const { fullName, email, password, phone, role, address } = req.body;
    const proofFile = req.file;

    if (!fullName || !email || !password || !role) {
      return res.status(400).json({ message: 'Missing required fields: fullName, email, password, role' });
    }

    const validRoles = ['Client', 'Landlord', 'Contractor', 'Staff'];
    if (!validRoles.includes(role)) return res.status(400).json({ message: 'Invalid role' });

    // For tenants and landlords, ensure address and proof were supplied
    if ((role === 'Client' || role === 'Landlord')) {
      if (!address || !address.trim()) {
        return res.status(400).json({ message: 'Address is required for Clients and Landlords' });
      }
      if (!proofFile) {
        return res.status(400).json({ message: 'Proof document is required for Clients and Landlords' });
      }
    }

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    const hash = await bcrypt.hash(password, rounds);

    // Create user with Inactive status - requires staff approval
    const [result] = await pool.execute(
      'INSERT INTO tblusers (FullName, Email, PasswordHash, Phone, Role, Status) VALUES (?, ?, ?, ?, ?, ?)',
      [fullName, email, hash, phone || null, role, 'Inactive']
    );
    const newUserId = result.insertId;

    // If address and proof are provided, record them into tblUserProofs and
    // create a property and mapping.  Ensure tblUserProofs exists.
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
      // Create property record
      try {
        const propertyRef = 'PROP-' + Date.now();
        const [propRes] = await pool.execute(
          'INSERT INTO tblProperties (PropertyRef, AddressLine1) VALUES (?, ?)',
          [propertyRef, address]
        );
        const propertyId = propRes.insertId;
        if (role === 'Client') {
          // Insert into tenancies table
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
        console.error('Error creating property and mapping:', e);
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

    // Always return success with requiresApproval = true.  At the moment all
    // roles require staff activation prior to login.
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
