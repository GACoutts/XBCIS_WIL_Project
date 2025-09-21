import express from 'express';
import pool from '../db.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { sendMail } from '../utils/notify.js'; // import transporter

const router = express.Router();

const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const TTL_MIN = parseInt(process.env.RESET_TOKEN_TTL_MIN || '30', 10);

// -------- helpers ----------
function makeToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

// POST /api/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ message: 'Email is required' });

  try {
    const [rows] = await pool.execute(
      'SELECT UserID, Email FROM tblusers WHERE Email = ? LIMIT 1',
      [email]
    );

    const genericOk = { ok: true, message: 'If that email is registered, a reset link has been sent.' };
    if (!rows?.length) return res.json(genericOk);

    const user = rows[0];

    // Invalidate previous tokens
    await pool.execute(
      'UPDATE tblPasswordResets SET UsedAt = NOW() WHERE UserID = ? AND UsedAt IS NULL AND ExpiresAt > NOW()',
      [user.UserID]
    );

    // Create new token
    const { raw, hash } = makeToken();
    const expires = new Date(Date.now() + TTL_MIN * 60 * 1000);

    await pool.execute(
      'INSERT INTO tblPasswordResets (UserID, TokenHash, ExpiresAt) VALUES (?, ?, ?)',
      [user.UserID, hash, expires]
    );

    const resetUrl = `${APP_URL}/reset-password?token=${raw}`;

    // Send email using notify.js
    await sendMail({
      to: user.Email,
      subject: 'Reset your Rawson password',
      html: `
        <p>We received a request to reset your password.</p>
        <p><a href="${resetUrl}">Click here to reset your password</a></p>
        <p>This link expires in ${TTL_MIN} minutes. If you didn't request this, ignore this email.</p>
      `
    });

    return res.json(genericOk);

  } catch (e) {
    console.error('forgot-password error:', e);
    return res.json({ ok: true, message: 'If that email is registered, a reset link has been sent.' });
  }
});

// POST /api/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ message: 'Token and new password are required' });

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const [rows] = await pool.execute(
      `SELECT t.UserID
       FROM tblPasswordResets t
       WHERE t.TokenHash = ? AND t.UsedAt IS NULL AND t.ExpiresAt > NOW()
       LIMIT 1`,
      [tokenHash]
    );

    if (!rows?.length) return res.status(400).json({ message: 'Invalid or expired reset link.' });

    const { UserID } = rows[0];

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    const newHash = await bcrypt.hash(password, rounds);
    await pool.execute('UPDATE tblusers SET PasswordHash = ? WHERE UserID = ?', [newHash, UserID]);

    await pool.execute('UPDATE tblPasswordResets SET UsedAt = NOW() WHERE UserID = ? AND TokenHash = ?', [UserID, tokenHash]);

    return res.json({ ok: true, message: 'Password has been reset successfully.' });

  } catch (e) {
    console.error('reset-password error:', e);
    return res.status(500).json({ message: 'Server error resetting password' });
  }
});

export default router;
