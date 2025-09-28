// backend/routes/admin.js - Staff-only user and role management
import 'dotenv/config';
import express from 'express';
import pool from '../db.js';
import { requireAuth, permitRoles } from '../middleware/authMiddleware.js';
import { revokeAllUserRefreshTokens, logAudit } from '../utils/tokens.js';

const router = express.Router();

// All routes require Staff role
router.use(requireAuth);
router.use(permitRoles('Staff'));

// Extract client info from request
function getClientInfo(req) {
  return {
    ip:
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.ip ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      'Unknown',
    userAgent: req.headers['user-agent'] || 'Unknown',
  };
}

// GET /users - List all users
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 50, search, role, status } = req.query;
    const pageN = Math.max(1, parseInt(page, 10) || 1);
    const limitN = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageN - 1) * limitN;

    const base = `FROM tblusers`;
    const params = [];
    const where = [];

    if (search) {
      where.push('(FullName LIKE ? OR Email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const validRoles = ['Client', 'Landlord', 'Contractor', 'Staff'];
    if (role && validRoles.includes(role)) {
      where.push('Role = ?');
      params.push(role);
    }

    const validStatuses = ['Active', 'Inactive', 'Suspended', 'Rejected'];
    if (status && validStatuses.includes(status)) {
      where.push('Status = ?');
      params.push(status);
    }

    const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

    const [rows] = await pool.execute(
      `
      SELECT UserID, FullName, Email, Role, Status, DateRegistered, Phone
      ${base}
      ${whereSql}
      ORDER BY DateRegistered DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limitN, offset]
    );

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total ${base} ${whereSql}`,
      params
    );
    const total = countRows[0]?.total || 0;

    const users = rows.map(u => ({
      userId: u.UserID,
      fullName: u.FullName,
      email: u.Email,
      phone: u.Phone,
      role: u.Role,
      status: u.Status,
      dateRegistered: u.DateRegistered,
    }));

    return res.json({
      users,
      pagination: {
        page: pageN,
        limit: limitN,
        total,
        pages: Math.ceil(total / limitN),
      },
    });
  } catch (err) {
    console.error('Get users error:', err);
    return res.status(500).json({ message: 'Server error retrieving users' });
  }
});

// GET /contractors/active - List all active contractors
router.get('/contractors/active', async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT UserID, FullName, Email
         FROM tblusers
        WHERE Role = 'Contractor' AND Status = 'Active'
        ORDER BY FullName ASC`
    );
    return res.json({ contractors: rows });
  } catch (err) {
    console.error('Get active contractors error:', err);
    return res.status(500).json({ message: 'Server error retrieving contractors' });
  }
});

// POST /contractor-assign - Assign a contractor to a ticket (no date yet)
router.post('/contractor-assign', async (req, res) => {
  try {
    const { TicketID, ContractorUserID } = req.body;
    if (!TicketID || !ContractorUserID) {
      return res.status(400).json({ message: 'TicketID and ContractorUserID are required' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Insert contractor assignment (no date/time yet)
      await connection.execute(
        `INSERT INTO tblContractorSchedules (TicketID, ContractorUserID)
         VALUES (?, ?)`,
        [TicketID, ContractorUserID]
      );

      // Update ticket status to "In Review"
      await connection.execute(
        `UPDATE tblTickets
            SET Status = 'In Review'
          WHERE TicketID = ?`,
        [TicketID]
      );

      // Audit log
      await logAudit({
        actorUserId: req.user.userId,
        targetUserId: ContractorUserID,
        action: 'contractor-assigned',
        metadata: { ticketId: TicketID },
        ...getClientInfo(req),
        connection
      });

      await connection.commit();
      return res.json({ message: 'Contractor assigned successfully and ticket moved to In Review' });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Contractor assignment error:', err);
    return res.status(500).json({ message: 'Server error assigning contractor' });
  }
});

// GET /users/:id - Get specific user details
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.execute(
      `SELECT UserID, FullName, Email, Phone, Role, Status, DateRegistered
         FROM tblusers
        WHERE UserID = ? LIMIT 1`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = rows[0];

    // Active sessions count
    const [sessionRows] = await pool.execute(
      `SELECT COUNT(*) as sessionCount
         FROM tblRefreshTokens
        WHERE UserID = ?
          AND RevokedAt IS NULL
          AND ExpiresAt > NOW()`,
      [id]
    );

    // Recent audit logs for this user
    const [auditRows] = await pool.execute(
      `SELECT logs.AuditID, logs.ActorUserID, logs.Action, logs.Metadata, logs.IP, logs.UserAgent, logs.CreatedAt,
              actor.FullName as ActorName
         FROM tblAuditLogs logs
    LEFT JOIN tblusers actor ON logs.ActorUserID = actor.UserID
        WHERE logs.TargetUserID = ?
        ORDER BY logs.CreatedAt DESC
        LIMIT 10`,
      [id]
    );

    const auditLogs = auditRows.map(log => {
      let parsed = null;
      if (log.Metadata) {
        try { parsed = JSON.parse(log.Metadata); } catch { parsed = null; }
      }
      return {
        auditId: log.AuditID,
        actorUserId: log.ActorUserID,
        actorName: log.ActorName || 'System',
        action: log.Action,
        metadata: parsed,
        ip: log.IP,
        userAgent: log.UserAgent,
        createdAt: log.CreatedAt,
      };
    });

    return res.json({
      user: {
        userId: user.UserID,
        fullName: user.FullName,
        email: user.Email,
        phone: user.Phone,
        role: user.Role,
        status: user.Status,
        dateRegistered: user.DateRegistered,
        activeSessions: sessionRows[0].sessionCount,
      },
      auditLogs,
    });
  } catch (err) {
    console.error('Get user details error:', err);
    return res.status(500).json({ message: 'Server error retrieving user details' });
  }
});

// PUT /users/:id/status - Change user status
router.put('/users/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const { ip, userAgent } = getClientInfo(req);

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const validStatuses = ['Active', 'Inactive', 'Suspended', 'Rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: 'Invalid status. Must be one of: ' + validStatuses.join(', '),
      });
    }

    // Get current user info
    const [rows] = await pool.execute(
      'SELECT UserID, FullName, Email, Role, Status FROM tblusers WHERE UserID = ? LIMIT 1',
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: 'User not found' });

    const targetUser = rows[0];
    const oldStatus = targetUser.Status;

    // Prevent self-deactivation
    if (req.user.userId === parseInt(id, 10) && status !== 'Active') {
      return res.status(403).json({ message: 'Cannot deactivate or suspend yourself' });
    }

    // No-op if unchanged
    if (oldStatus === status) {
      return res.json({
        message: 'User status unchanged',
        user: { userId: targetUser.UserID, status: oldStatus },
      });
    }

    // Minimal transaction: only update status
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        'UPDATE tblusers SET Status = ? WHERE UserID = ?',
        [status, id]
      );
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    // Revoke sessions (outside transaction)
    if (status === 'Inactive' || status === 'Suspended') {
      await revokeAllUserRefreshTokens({
        userId: parseInt(id, 10),
        reason: `status-change-${status.toLowerCase()}`,
      });
    }

    // Audit log (outside transaction)
    await logAudit({
      actorUserId: req.user.userId,
      targetUserId: parseInt(id, 10),
      action: 'status-change',
      metadata: {
        fromStatus: oldStatus,
        toStatus: status,
        targetUserEmail: targetUser.Email,
        targetUserName: targetUser.FullName,
      },
      ip,
      userAgent,
    });

    return res.json({
      message: `User status changed from ${oldStatus} to ${status}`,
      user: {
        userId: targetUser.UserID,
        fullName: targetUser.FullName,
        email: targetUser.Email,
        role: targetUser.Role,
        status,
      },
    });
  } catch (err) {
    console.error('Change user status error:', err);
    return res.status(500).json({ message: 'Server error changing user status' });
  }
});


// GET /audit-logs - Get system audit logs (with filtering)
router.get('/audit-logs', async (req, res) => {
  try {
    const { page = 1, limit = 100, action, userId, startDate, endDate } = req.query;
    const pageN = Math.max(1, parseInt(page, 10) || 1);
    const limitN = Math.min(500, Math.max(1, parseInt(limit, 10) || 100));
    const offset = (pageN - 1) * limitN;

    const base = `
      FROM tblAuditLogs logs
      LEFT JOIN tblusers actor ON logs.ActorUserID = actor.UserID
      LEFT JOIN tblusers target ON logs.TargetUserID = target.UserID
    `;

    const params = [];
    const where = [];

    if (action) { where.push('logs.Action = ?'); params.push(action); }
    if (userId) { where.push('(logs.ActorUserID = ? OR logs.TargetUserID = ?)'); params.push(userId, userId); }
    if (startDate) { where.push('logs.CreatedAt >= ?'); params.push(startDate); }
    if (endDate) { where.push('logs.CreatedAt <= ?'); params.push(endDate); }

    const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

    const [rows] = await pool.execute(
      `
      SELECT logs.AuditID, logs.ActorUserID, logs.TargetUserID, logs.Action,
             logs.Metadata, logs.IP, logs.UserAgent, logs.CreatedAt,
             actor.FullName as ActorName, actor.Email as ActorEmail,
             target.FullName as TargetName, target.Email as TargetEmail
      ${base}
      ${whereSql}
      ORDER BY logs.CreatedAt DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limitN, offset]
    );

    const auditLogs = rows.map(log => {
      let parsed = null;
      if (log.Metadata) {
        try { parsed = JSON.parse(log.Metadata); } catch { parsed = null; }
      }
      return {
        auditId: log.AuditID,
        actorUserId: log.ActorUserID,
        actorName: log.ActorName || 'System',
        actorEmail: log.ActorEmail,
        targetUserId: log.TargetUserID,
        targetName: log.TargetName,
        targetEmail: log.TargetEmail,
        action: log.Action,
        metadata: parsed,
        ip: log.IP,
        userAgent: log.UserAgent,
        createdAt: log.CreatedAt,
      };
    });

    return res.json({ auditLogs });
  } catch (err) {
    console.error('Get audit logs error:', err);
    return res.status(500).json({ message: 'Server error retrieving audit logs' });
  }
});

// GET /stats - Get system statistics
router.get('/stats', async (_req, res) => {
  try {
    const [userStats] = await pool.execute(`
      SELECT Role, Status, COUNT(*) as count
      FROM tblusers
      GROUP BY Role, Status
      ORDER BY Role, Status
    `);

    const [sessionStats] = await pool.execute(`
      SELECT COUNT(*) as activeSessionsCount
      FROM tblRefreshTokens
      WHERE RevokedAt IS NULL AND ExpiresAt > NOW()
    `);

    const [activityStats] = await pool.execute(`
      SELECT Action, COUNT(*) as count
      FROM tblAuditLogs
      WHERE CreatedAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY Action
      ORDER BY count DESC
      LIMIT 10
    `);

    const stats = {
      users: { byRole: {}, byStatus: {}, total: 0 },
      sessions: { active: sessionStats[0].activeSessionsCount },
      recentActivity: activityStats.map(stat => ({ action: stat.Action, count: stat.count })),
    };

    userStats.forEach(s => {
      stats.users.byRole[s.Role] = (stats.users.byRole[s.Role] || 0) + s.count;
      stats.users.byStatus[s.Status] = (stats.users.byStatus[s.Status] || 0) + s.count;
      stats.users.total += s.count;
    });

    return res.json({ stats });
  } catch (err) {
    console.error('Get stats error:', err);
    return res.status(500).json({ message: 'Server error retrieving statistics' });
  }
});

// GET /inactive-users - List all users with Status = 'Inactive'
router.get('/inactive-users', async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT UserID, FullName, Email, Role, Status
         FROM tblusers
        WHERE Status = 'Inactive'
        ORDER BY DateRegistered DESC`
    );
    return res.json({ users: rows });
  } catch (err) {
    console.error('Get inactive users error:', err);
    return res.status(500).json({ message: 'Server error retrieving inactive users' });
  }
});

export default router;
