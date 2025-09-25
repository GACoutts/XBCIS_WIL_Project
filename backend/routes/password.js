import express from 'express';
import pool from '../db.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

const router = express.Router();

const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const TTL_MIN = parseInt(process.env.RESET_TOKEN_TTL_MIN || '30', 10);

// -------- mailer ----------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false // Accept self-signed certificates for testing
  }
});
const FROM = process.env.SMTP_FROM || 'no-reply@rawson.local';

// -------- helpers ----------
function makeToken() {
  // raw token sent to user (keep secret); hash stored in DB
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

// POST /api/forgot-password  { email }
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ message: 'Email is required' });

  try {
    // find user
    const [rows] = await pool.execute(
      'SELECT UserID, Email FROM tblusers WHERE Email = ? LIMIT 1',
      [email]
    );

    // Always respond the same (don’t reveal existence)
    const genericOk = { ok: true, message: 'If that email is registered, a reset link has been sent.' };

    if (!rows?.length) {
      return res.json(genericOk);
    }

    const user = rows[0];

    // optional: invalidate previous active tokens
    await pool.execute(
      'UPDATE tblPasswordResets SET UsedAt = NOW() WHERE UserID = ? AND UsedAt IS NULL AND ExpiresAt > NOW()',
      [user.UserID]
    );

    // create token
    const { raw, hash } = makeToken();
    const expires = new Date(Date.now() + TTL_MIN * 60 * 1000);

    await pool.execute(
      'INSERT INTO tblPasswordResets (UserID, TokenHash, ExpiresAt) VALUES (?, ?, ?)',
      [user.UserID, hash, expires]
    );

    const resetUrl = `${APP_URL}/reset-password?token=${raw}`;

    // send email
    console.log(`[DEBUG] Sending password reset email to: ${user.Email}`);
    console.log(`[DEBUG] Reset URL: ${resetUrl}`);
    
    const emailResult = await transporter.sendMail({
      from: FROM,
      to: user.Email,
      subject: 'Reset your Rawson password',
      html: `
        <p>We received a request to reset your password.</p>
        <p><a href="${resetUrl}">Click here to reset your password</a></p>
        <p>This link expires in ${TTL_MIN} minutes. If you didn't request this, just ignore this email.</p>
      `
    });
    
    console.log(`[DEBUG] Email sent successfully. Message ID: ${emailResult.messageId}`);
    console.log(`[DEBUG] Preview URL: ${nodemailer.getTestMessageUrl(emailResult)}`);

    return res.json(genericOk);
  } catch (e) {
    console.error('forgot-password error:', e);
    // still hide existence
    return res.json({ ok: true, message: 'If that email is registered, a reset link has been sent.' });
  }
});

// POST /api/reset-password  { token, password }
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ message: 'Token and new password are required' });

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // find valid token
    const [rows] = await pool.execute(
      `SELECT t.UserID
       FROM tblPasswordResets t
       WHERE t.TokenHash = ? AND t.UsedAt IS NULL AND t.ExpiresAt > NOW()
       LIMIT 1`,
      [tokenHash]
    );

    if (!rows?.length) {
      return res.status(400).json({ message: 'Invalid or expired reset link.' });
    }

    const { UserID } = rows[0];

    // update password
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    const newHash = await bcrypt.hash(password, rounds);
    await pool.execute('UPDATE tblusers SET PasswordHash = ? WHERE UserID = ?', [newHash, UserID]);

    // invalidate token by marking as used
    await pool.execute('UPDATE tblPasswordResets SET UsedAt = NOW() WHERE UserID = ? AND TokenHash = ?', [UserID, tokenHash]);

    return res.json({ ok: true, message: 'Password has been reset successfully.' });
  } catch (e) {
    console.error('reset-password error:', e);
    return res.status(500).json({ message: 'Server error resetting password' });
  }
});

export default router;
