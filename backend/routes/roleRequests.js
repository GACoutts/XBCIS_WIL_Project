import express from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// POST /api/roles/request  { requestedRole: 'Landlord' | 'Contractor' | 'Staff', notes? }
router.post('/request', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { requestedRole, notes } = req.body || {};
    const allowed = ['Landlord', 'Contractor', 'Staff']; // Users self-register as 'Client'; upgrades require approval
    if (!allowed.includes(requestedRole)) {
      return res.status(400).json({ message: 'Invalid requested role' });
    }

    // Fetch current role
    const [urows] = await pool.execute('SELECT Role FROM tblusers WHERE UserID = ?', [userId]);
    const currentRole = urows[0]?.Role;
    if (!currentRole) return res.status(404).json({ message: 'User not found' });
    if (currentRole === requestedRole) {
      return res.status(400).json({ message: 'You already have this role' });
    }

    // Prevent duplicate pending requests
    const [pending] = await pool.execute(
      'SELECT RequestID FROM tblRoleRequests WHERE UserID = ? AND Status = "Pending" LIMIT 1',
      [userId]
    );
    if (pending.length) return res.status(409).json({ message: 'You already have a pending request' });

    await pool.execute(
      'INSERT INTO tblRoleRequests (UserID, RequestedRole, Notes) VALUES (?, ?, ?)',
      [userId, requestedRole, notes || null]
    );
    return res.json({ ok: true, message: 'Role request submitted. Staff will review it shortly.' });
  } catch (e) {
    console.error('role request error', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
