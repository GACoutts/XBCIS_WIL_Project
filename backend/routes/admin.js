// backend/routes/admin.js
import express from 'express';
import pool from '../db.js';
import { authMiddleware, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

/** Direct role management (optional but handy) */
router.get('/users', authMiddleware, authorizeRoles('Staff'), async (_req, res) => {
  const [rows] = await pool.execute(
    'SELECT UserID, FullName, Email, Role, Status FROM tblusers ORDER BY UserID DESC LIMIT 200'
  );
  return res.json({
    users: rows.map(r => ({
      userId: r.UserID,
      fullName: r.FullName,
      email: r.Email,
      role: r.Role,
      status: r.Status,
    }))
  });
});

router.post('/users/:userId/role', authMiddleware, authorizeRoles('Staff'), async (req, res) => {
  try {
    const targetId = parseInt(req.params.userId, 10);
    const { role } = req.body || {};
    const valid = ['Client', 'Landlord', 'Contractor', 'Staff'];
    if (!valid.includes(role)) return res.status(400).json({ message: 'Invalid role' });
    if (targetId === req.user.userId && role !== 'Staff') {
      return res.status(400).json({ message: 'You cannot demote yourself' });
    }
    await pool.execute('UPDATE tblusers SET Role = ? WHERE UserID = ?', [role, targetId]);
    return res.json({ ok: true });
  } catch (e) {
    console.error('update role error', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

/** Role-request review workflow (Staff only) */

// List role requests (default Pending)
router.get('/role-requests', authMiddleware, authorizeRoles('Staff'), async (req, res) => {
  const status = ['Pending','Approved','Rejected'].includes(req.query.status) ? req.query.status : 'Pending';
  const [rows] = await pool.execute(
    `SELECT rr.RequestID, rr.UserID, rr.RequestedRole, rr.Status, rr.Notes, rr.CreatedAt, rr.ReviewedBy, rr.ReviewedAt,
            u.FullName, u.Email, u.Role AS CurrentRole
       FROM tblRoleRequests rr
       JOIN tblusers u ON u.UserID = rr.UserID
      WHERE rr.Status = ?
      ORDER BY rr.CreatedAt ASC
      LIMIT 500`,
    [status]
  );
  return res.json({ requests: rows });
});

// Approve a request
router.post('/role-requests/:id/approve', authMiddleware, authorizeRoles('Staff'), async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  const reviewerId = req.user.userId;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      'SELECT RequestID, UserID, RequestedRole, Status FROM tblRoleRequests WHERE RequestID = ? FOR UPDATE',
      [requestId]
    );
    const rr = rows[0];
    if (!rr) { await conn.rollback(); return res.status(404).json({ message: 'Request not found' }); }
    if (rr.Status !== 'Pending') {
      await conn.rollback(); return res.status(400).json({ message: `Cannot approve a ${rr.Status} request` });
    }

    // Update user role
    await conn.execute('UPDATE tblusers SET Role = ? WHERE UserID = ?', [rr.RequestedRole, rr.UserID]);

    // Mark request approved
    await conn.execute(
      'UPDATE tblRoleRequests SET Status = "Approved", ReviewedBy = ?, ReviewedAt = NOW() WHERE RequestID = ?',
      [reviewerId, requestId]
    );

    await conn.commit();
    return res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    console.error('approve role error', e);
    return res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
});

// Reject a request
router.post('/role-requests/:id/reject', authMiddleware, authorizeRoles('Staff'), async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  const reviewerId = req.user.userId;
  const { notes } = req.body || {};
  try {
    const [rows] = await pool.execute(
      'SELECT Status FROM tblRoleRequests WHERE RequestID = ?',
      [requestId]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Request not found' });
    if (rows[0].Status !== 'Pending') return res.status(400).json({ message: `Cannot reject a ${rows[0].Status} request` });

    await pool.execute(
      'UPDATE tblRoleRequests SET Status = "Rejected", Notes = IFNULL(?, Notes), ReviewedBy = ?, ReviewedAt = NOW() WHERE RequestID = ?',
      [notes || null, reviewerId, requestId]
    );
    return res.json({ ok: true });
  } catch (e) {
    console.error('reject role error', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
