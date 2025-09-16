// Token utilities for dual-token authentication system
import 'dotenv/config';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db.js';

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '20m';
const JWT_REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '14d';

// Robust env parsing (matches server.js)
const envBool = (v, def=false) => {
  if (v === undefined) return def;
  const s = String(v).toLowerCase().trim();
  return ['1','true','yes','on'].includes(s);
};
const COOKIE_SECURE = envBool(process.env.COOKIE_SECURE, process.env.NODE_ENV === 'production');
const COOKIE_DOMAIN = (process.env.COOKIE_DOMAIN || '').trim() || undefined;

// Normalize SameSite values (accept any casing)
const normSameSite = (v, fallback) => {
  const s = (v || '').toString().trim().toLowerCase();
  if (s === 'lax') return 'Lax';
  if (s === 'strict') return 'Strict';
  if (s === 'none') return 'None';
  return fallback;
};
const COOKIE_SAME_SITE_ACCESS  = normSameSite(process.env.COOKIE_SAME_SITE_ACCESS, 'Lax');
const COOKIE_SAME_SITE_REFRESH = normSameSite(process.env.COOKIE_SAME_SITE_REFRESH, 'Strict');
const MAX_SESSIONS_PER_USER = parseInt(process.env.MAX_SESSIONS_PER_USER || '5', 10);

// Role hierarchy (higher index = higher privilege)
export const ROLES = {
  Client: 0,
  Contractor: 1,
  Landlord: 2,
  Staff: 3
};

// Get role hierarchy order
export function getRoleOrder(role) {
  return ROLES[role] ?? -1;
}

// Sign access token with JTI
export function signAccessToken(user) {
  const jti = uuidv4();
  const payload = {
    jti,
    sub: user.userId || user.UserID,
    role: user.role || user.Role,
    type: 'access'
  };

  return {
    token: jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_ACCESS_EXPIRES }),
    jti
  };
}

// Create refresh token
export function makeRefreshToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

// Convert duration string to milliseconds
function parseDuration(duration) {
  const unit = duration.slice(-1);
  const value = parseInt(duration.slice(0, -1), 10);
  
  switch (unit) {
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return parseInt(duration, 10);
  }
}

// Set access token cookie
export function setAccessCookie(res, token) {
  const maxAge = parseDuration(JWT_ACCESS_EXPIRES);
  
  res.cookie('access_token', token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAME_SITE_ACCESS,
    domain: COOKIE_DOMAIN,
    path: '/',
    maxAge
  });
}

// Set refresh token cookie
export function setRefreshCookie(res, rawRefresh) {
  const maxAge = parseDuration(JWT_REFRESH_EXPIRES);
  
  res.cookie('refresh_token', rawRefresh, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAME_SITE_REFRESH,
    domain: COOKIE_DOMAIN,
    path: '/api',
    maxAge
  });
}

// Clear auth cookies
export function clearAuthCookies(res) {
  const base = {
    httpOnly: true,
    secure: COOKIE_SECURE,
    domain: COOKIE_DOMAIN,
    path: '/'
  };

   res.clearCookie('access_token', { ...base, sameSite: COOKIE_SAME_SITE_ACCESS });
   res.clearCookie('refresh_token', { ...base, sameSite: COOKIE_SAME_SITE_REFRESH, path: '/api' });
}

// Issue new session (access + refresh tokens)
export async function issueSession({ res, user, userAgent, ip }) {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    // Generate tokens
    const { token: accessToken, jti } = signAccessToken(user);
    const { raw: refreshRaw, hash: refreshHash } = makeRefreshToken();
    const familyId = uuidv4();
    const expiresAt = new Date(Date.now() + parseDuration(JWT_REFRESH_EXPIRES));

    // Check session limit
    const [existingSessions] = await connection.execute(
      'SELECT TokenID FROM tblRefreshTokens WHERE UserID = ? AND RevokedAt IS NULL AND ExpiresAt > NOW() ORDER BY IssuedAt ASC',
      [user.userId || user.UserID]
    );

    // Revoke oldest sessions if over limit
    if (existingSessions.length >= MAX_SESSIONS_PER_USER) {
      const tokensToRevoke = existingSessions.slice(0, existingSessions.length - MAX_SESSIONS_PER_USER + 1);
      const tokenIds = tokensToRevoke.map(t => t.TokenID);
      
      if (tokenIds.length > 0) {
        await connection.execute(
          `UPDATE tblRefreshTokens SET RevokedAt = NOW() WHERE TokenID IN (${tokenIds.map(() => '?').join(',')})`,
          tokenIds
        );
      }
    }

    // Insert new refresh token
    const [result] = await connection.execute(
      'INSERT INTO tblRefreshTokens (UserID, TokenHash, FamilyID, ExpiresAt, UserAgent, IP) VALUES (?, ?, ?, ?, ?, ?)',
      [user.userId || user.UserID, refreshHash, familyId, expiresAt, userAgent, ip]
    );

    await connection.commit();

    // Set cookies
    setAccessCookie(res, accessToken);
    setRefreshCookie(res, refreshRaw);

    return {
      accessToken,
      refreshToken: refreshRaw,
      jti,
      tokenId: result.insertId,
      familyId,
      expiresAt
    };

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Rotate refresh token
export async function rotateRefreshToken({ res, oldTokenHash, user, userAgent, ip }) {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    // Find existing token
    const [rows] = await connection.execute(
      'SELECT TokenID, UserID, FamilyID, RevokedAt, ReplacedByTokenID FROM tblRefreshTokens WHERE TokenHash = ? AND ExpiresAt > NOW()',
      [oldTokenHash]
    );

    if (!rows.length) {
      await connection.rollback();
      return { error: 'Invalid refresh token', status: 401 };
    }

    const oldToken = rows[0];

    // Check for reuse (token already revoked or replaced)
    if (oldToken.RevokedAt || oldToken.ReplacedByTokenID) {
      // Token reuse detected - revoke entire family
      await revokeTokenFamily({ userId: oldToken.UserID, familyId: oldToken.FamilyID, reason: 'refresh-reuse' });
      await connection.rollback();
      if (res) clearAuthCookies(res);
      return { error: 'Token reuse detected', status: 401 };
    }

    // Generate new tokens
    const { token: accessToken, jti } = signAccessToken(user);
    const { raw: refreshRaw, hash: refreshHash } = makeRefreshToken();
    const expiresAt = new Date(Date.now() + parseDuration(JWT_REFRESH_EXPIRES));

    // Insert new refresh token
    const [result] = await connection.execute(
      'INSERT INTO tblRefreshTokens (UserID, TokenHash, FamilyID, ExpiresAt, UserAgent, IP) VALUES (?, ?, ?, ?, ?, ?)',
      [oldToken.UserID, refreshHash, oldToken.FamilyID, expiresAt, userAgent, ip]
    );

    // Mark old token as replaced
    await connection.execute(
      'UPDATE tblRefreshTokens SET RevokedAt = NOW(), ReplacedByTokenID = ? WHERE TokenID = ?',
      [result.insertId, oldToken.TokenID]
    );

    await connection.commit();

    // Set new cookies
    if (res) {
      setAccessCookie(res, accessToken);
      setRefreshCookie(res, refreshRaw);
    }

    return {
      accessToken,
      refreshToken: refreshRaw,
      jti,
      tokenId: result.insertId
    };

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Revoke token family
export async function revokeTokenFamily({ userId, familyId, reason }) {
  await pool.execute(
    'UPDATE tblRefreshTokens SET RevokedAt = NOW() WHERE UserID = ? AND FamilyID = ? AND RevokedAt IS NULL',
    [userId, familyId]
  );

  // Log audit event
  await logAudit({
    actorUserId: userId,
    targetUserId: userId,
    action: 'token-family-revoked',
    metadata: { familyId, reason }
  });
}

// Revoke all user refresh tokens
export async function revokeAllUserRefreshTokens({ userId, reason }) {
  await pool.execute(
    'UPDATE tblRefreshTokens SET RevokedAt = NOW() WHERE UserID = ? AND RevokedAt IS NULL',
    [userId]
  );

  // Log audit event
  await logAudit({
    actorUserId: userId,
    targetUserId: userId,
    action: 'all-tokens-revoked',
    metadata: { reason }
  });
}

// Add revoked access JTI
export async function addRevokedAccessJti({ jti, userId, exp, reason }) {
  const expiresAt = new Date(exp * 1000); // JWT exp is in seconds
  
  await pool.execute(
    'INSERT INTO tblRevokedAccessJti (Jti, UserID, ExpiresAt, Reason) VALUES (?, ?, ?, ?)',
    [jti, userId, expiresAt, reason]
  );
}

// Check if access JTI is revoked
export async function isAccessJtiRevoked(jti) {
  const [rows] = await pool.execute(
    'SELECT 1 FROM tblRevokedAccessJti WHERE Jti = ? AND ExpiresAt > NOW()',
    [jti]
  );
  return rows.length > 0;
}

// Cleanup expired revoked JTIs (run periodically)
export async function cleanupExpiredJtis() {
  const [result] = await pool.execute(
    'DELETE FROM tblRevokedAccessJti WHERE ExpiresAt <= NOW()'
  );
  return result.affectedRows;
}

// Log audit event
export async function logAudit({ actorUserId, targetUserId, action, metadata, ip, userAgent, connection }) {
  const metaStr = metadata ? JSON.stringify(metadata) : null;

  if (!connection) {
    // fallback to pool
    const sql = 'INSERT INTO tblAuditLogs (ActorUserID, TargetUserID, Action, Metadata, IP, UserAgent) VALUES (?, ?, ?, ?, ?, ?)';
    await pool.execute(sql, [actorUserId, targetUserId, action, metaStr, ip, userAgent]);
  } else {
    await connection.execute(
      'INSERT INTO tblAuditLogs (ActorUserID, TargetUserID, Action, Metadata, IP, UserAgent) VALUES (?, ?, ?, ?, ?, ?)',
      [actorUserId, targetUserId, action, metaStr, ip, userAgent]
    );
  }
}

