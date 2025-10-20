import express from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /api/profile/me
// Returns the current user's profile information.  Does not include
// sensitive fields like password hashes.  The response format is
// { success: true, data: { userId, fullName, email, phone, role, status } }.
router.get('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const [rows] = await pool.execute(
      `SELECT UserID, FullName, Email, Phone, Role, Status
       FROM tblusers
       WHERE UserID = ?
       LIMIT 1`,
      [userId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const user = rows[0];
    return res.json({ success: true, data: {
      userId: user.UserID,
      fullName: user.FullName,
      email: user.Email,
      phone: user.Phone,
      role: user.Role,
      status: user.Status
    } });
  } catch (err) {
    console.error('Profile /me error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/profile/me
// Allows the user to update their FullName and Phone number.  The
// request body should include { fullName, phone }.  Fields not
// provided will remain unchanged.  Returns the updated profile.
router.put('/me', requireAuth, async (req, res) => {
  const userId = req.user.userId;
  const { fullName, phone } = req.body || {};
  if (!fullName && !phone) {
    return res.status(400).json({ success: false, message: 'No fields to update' });
  }
  try {
    // Build dynamic update
    const sets = [];
    const params = [];
    if (fullName) {
      sets.push('FullName = ?');
      params.push(fullName.trim());
    }
    if (phone) {
      sets.push('Phone = ?');
      params.push(phone.trim());
    }
    params.push(userId);
    await pool.execute(
      `UPDATE tblusers SET ${sets.join(', ')} WHERE UserID = ?`,
      params
    );
    // Return updated record
    const [rows] = await pool.execute(
      `SELECT UserID, FullName, Email, Phone, Role, Status
       FROM tblusers
       WHERE UserID = ?
       LIMIT 1`,
      [userId]
    );
    const user = rows[0];
    return res.json({ success: true, data: {
      userId: user.UserID,
      fullName: user.FullName,
      email: user.Email,
      phone: user.Phone,
      role: user.Role,
      status: user.Status
    } });
  } catch (err) {
    console.error('Profile update error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;