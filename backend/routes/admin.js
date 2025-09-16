
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
    userAgent: req.headers['user-agent'] || 'Unknown'
  };
}

// GET /users - List all users
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 50, search, role, status } = req.query;
    const pageN = Math.max(1, parseInt(page, 10) || 1);
    const limitN = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageN - 1) * limitN;

    let base = `
      FROM tblusers
    `;

    const params = [];
    const where = [];

    if (search) {
      where.push('(FullName LIKE ? OR Email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const validRoles = ["Client", "Landlord", "Contractor", "Staff"];
    if (role && validRoles.includes(role)) {
      where.push("Role = ?");
      params.push(role);
    }
    const validStatuses = ["Active", "Inactive", "Suspended"];
    if (status && validStatuses.includes(status)) {
      where.push("Status = ?");
      params.push(status);
    }

    const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";

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

    const users = rows.map((user) => ({
      userId: user.UserID,
      fullName: user.FullName,
      email: user.Email,
      phone: user.Phone,
      role: user.Role,
      status: user.Status,
      dateRegistered: user.DateRegistered
    }));

    return res.json({
      users,
      pagination: {
        page: pageN,
        limit: limitN,
        total,
        pages: Math.ceil(total / limitN)
      }
    });
  } catch (err) {
    console.error('Get users error:', err);
    return res.status(500).json({ message: 'Server error retrieving users' });
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

    // Get user's active sessions count
    const [sessionRows] = await pool.execute(
      'SELECT COUNT(*) as sessionCount FROM tblRefreshTokens WHERE UserID = ? AND RevokedAt IS NULL AND ExpiresAt > NOW()',
      [id]
    );

    // Get recent audit logs for this user
    const [auditRows] = await pool.execute(
      `SELECT AuditID, ActorUserID, Action, Metadata, IP, CreatedAt,
              actor.FullName as ActorName
       FROM tblAuditLogs logs
       LEFT JOIN tblusers actor ON logs.ActorUserID = actor.UserID
       WHERE logs.TargetUserID = ?
       ORDER BY logs.CreatedAt DESC
       LIMIT 10`,
      [id]
    );

    const auditLogs = auditRows.map((log) => {
      let parsed = null;
      if (log.Metadata) {
        try { parsed = JSON.parse(log.Metadata); } catch { parsed = null; }
      }
      return {
        auditId: log.AuditID,
        actorUserId: log.ActorUserID,
        actorName: log.ActorName || "System",
        action: log.Action,
        metadata: parsed,
        ip: log.IP,
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
        activeSessions: sessionRows[0].sessionCount
      },
      auditLogs
    });
  } catch (err) {
    console.error('Get user details error:', err);
    return res.status(500).json({ message: 'Server error retrieving user details' });
  }
});

// PUT /users/:id/role - Change user role (staff promotion functionality)
router.put('/users/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const { ip, userAgent } = getClientInfo(req);

    if (!role) {
      return res.status(400).json({ message: 'Role is required' });
    }

    const validRoles = ['Client', 'Landlord', 'Contractor', 'Staff'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        message: 'Invalid role. Must be one of: ' + validRoles.join(', ')
      });
    }

    // Get current user info
    const [rows] = await pool.execute(
      'SELECT UserID, FullName, Email, Role, Status FROM tblusers WHERE UserID = ? LIMIT 1',
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetUser = rows[0];
    const oldRole = targetUser.Role;

    // Prevent self-demotion from Staff role
    if (req.user.userId === parseInt(id, 10) && req.user.role === 'Staff' && role !== 'Staff') {
      return res.status(403).json({ message: 'Cannot demote yourself from Staff role' });
    }

    // Check if role is actually changing
    if (oldRole === role) {
      return res.json({
        message: 'User role unchanged',
        user: {
          userId: targetUser.UserID,
          role: targetUser.Role
        }
      });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Update user role
      await connection.execute(
        'UPDATE tblusers SET Role = ? WHERE UserID = ?',
        [role, id]
      );

      // Revoke all refresh tokens to force re-login with new role
      await revokeAllUserRefreshTokens({ userId: parseInt(id, 10), reason: 'role-change' });

      // Log audit event
      await logAudit({
        actorUserId: req.user.userId,
        targetUserId: parseInt(id, 10),
        action: 'role-change',
        metadata: {
          fromRole: oldRole,
          toRole: role,
          targetUserEmail: targetUser.Email,
          targetUserName: targetUser.FullName
        },
        ip,
        userAgent
      });

      await connection.commit();

      return res.json({
        message: `User role changed from ${oldRole} to ${role}`,
        user: {
          userId: targetUser.UserID,
          fullName: targetUser.FullName,
          email: targetUser.Email,
          role: role,
          status: targetUser.Status
        }
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (err) {
    console.error('Change user role error:', err);
    return res.status(500).json({ message: 'Server error changing user role' });
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

    const validStatuses = ['Active', 'Inactive', 'Suspended'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      });
    }

    // Get current user info
    const [rows] = await pool.execute(
      'SELECT UserID, FullName, Email, Role, Status FROM tblusers WHERE UserID = ? LIMIT 1',
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetUser = rows[0];
    const oldStatus = targetUser.Status;

    // Prevent self-suspension/deactivation
    if (req.user.userId === parseInt(id, 10) && status !== 'Active') {
      return res.status(403).json({ message: 'Cannot deactivate or suspend yourself' });
    }

    // Check if status is actually changing
    if (oldStatus === status) {
      return res.json({
        message: 'User status unchanged',
        user: {
          userId: targetUser.UserID,
          status: targetUser.Status
        }
      });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Update user status
      await connection.execute(
        'UPDATE tblusers SET Status = ? WHERE UserID = ?',
        [status, id]
      );

      // If status is changing to Inactive or Suspended, revoke all sessions
      if (status === 'Inactive' || status === 'Suspended') {
        await revokeAllUserRefreshTokens({
          userId: parseInt(id, 10),
          reason: `status-change-${status.toLowerCase()}`
        });
      }

      // Log audit event
      await logAudit({
        actorUserId: req.user.userId,
        targetUserId: parseInt(id, 10),
        action: 'status-change',
        metadata: {
          fromStatus: oldStatus,
          toStatus: status,
          targetUserEmail: targetUser.Email,
          targetUserName: targetUser.FullName
        },
        ip,
        userAgent
      });

      await connection.commit();

      return res.json({
        message: `User status changed from ${oldStatus} to ${status}`,
        user: {
          userId: targetUser.UserID,
          fullName: targetUser.FullName,
          email: targetUser.Email,
          role: targetUser.Role,
          status: status
        }
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

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

    let base = `
      FROM tblAuditLogs logs
      LEFT JOIN tblusers actor ON logs.ActorUserID = actor.UserID
      LEFT JOIN tblusers target ON logs.TargetUserID = target.UserID
    `;

    const params = [];
    const where = [];

    if (action) { where.push("logs.Action = ?"); params.push(action); }
    if (userId) { where.push("(logs.ActorUserID = ? OR logs.TargetUserID = ?)"); params.push(userId, userId); }
    if (startDate) { where.push("logs.CreatedAt >= ?"); params.push(startDate); }
    if (endDate) { where.push("logs.CreatedAt <= ?"); params.push(endDate); }

    const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";

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

    const auditLogs = rows.map((log) => {
      let parsed = null;
      if (log.Metadata) {
        try { parsed = JSON.parse(log.Metadata); } catch { parsed = null; }
      }
      return {
        auditId: log.AuditID,
        actorUserId: log.ActorUserID,
        actorName: log.ActorName || "System",
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
    // Get user counts by role and status
    const [userStats] = await pool.execute(`
      SELECT 
        Role,
        Status,
        COUNT(*) as count
      FROM tblusers 
      GROUP BY Role, Status
      ORDER BY Role, Status
    `);

    // Get active sessions count
    const [sessionStats] = await pool.execute(`
      SELECT COUNT(*) as activeSessionsCount
      FROM tblRefreshTokens 
      WHERE RevokedAt IS NULL AND ExpiresAt > NOW()
    `);

    // Get recent activity counts
    const [activityStats] = await pool.execute(`
      SELECT 
        Action,
        COUNT(*) as count
      FROM tblAuditLogs 
      WHERE CreatedAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY Action
      ORDER BY count DESC
      LIMIT 10
    `);

    const stats = {
      users: {
        byRole: {},
        byStatus: {},
        total: 0
      },
      sessions: {
        active: sessionStats[0].activeSessionsCount
      },
      recentActivity: activityStats.map(stat => ({
        action: stat.Action,
        count: stat.count
      }))
    };

    // Process user stats
    userStats.forEach((s) => {
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

/* =========================
Role-request review (Staff)
========================= */

// GET /role-requests?status=Pending|Approved|Rejected
router.get("/role-requests", async (req, res) => {
  try {
    const status =
      ["Pending", "Approved", "Rejected"].includes(req.query.status)
        ? req.query.status
        : "Pending";

    const [rows] = await pool.execute(
      `SELECT rr.RequestID, rr.UserID, rr.RequestedRole, rr.Status, rr.Notes,
              rr.CreatedAt, rr.ReviewedBy, rr.ReviewedAt,
              u.FullName, u.Email, u.Role AS CurrentRole
       FROM tblRoleRequests rr
       JOIN tblusers u ON u.UserID = rr.UserID
       WHERE rr.Status = ?
       ORDER BY rr.CreatedAt ASC
       LIMIT 500`,
      [status]
    );

    return res.json({ requests: rows });
  } catch (e) {
    console.error("list role-requests error", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /role-requests/:id/approve
router.post("/role-requests/:id/approve", async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  const reviewerId = req.user.userId;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      "SELECT RequestID, UserID, RequestedRole, Status FROM tblRoleRequests WHERE RequestID = ? FOR UPDATE",
      [requestId]
    );
    const rr = rows[0];
    if (!rr) {
      await conn.rollback();
      return res.status(404).json({ message: "Request not found" });
    }
    if (rr.Status !== "Pending") {
      await conn.rollback();
      return res.status(400).json({ message: `Cannot approve a ${rr.Status} request` });
    }

    // Update user role
    await conn.execute("UPDATE tblusers SET Role = ? WHERE UserID = ?", [
      rr.RequestedRole,
      rr.UserID,
    ]);

    // Mark request approved
    await conn.execute(
      'UPDATE tblRoleRequests SET Status = "Approved", ReviewedBy = ?, ReviewedAt = NOW() WHERE RequestID = ?',
      [reviewerId, requestId]
    );

    // Revoke sessions and log audit
    await revokeAllUserRefreshTokens({ userId: rr.UserID, reason: "role-request-approved" });
    await logAudit({
      actorUserId: reviewerId,
      targetUserId: rr.UserID,
      action: "role-request-approve",
      metadata: { requestId, newRole: rr.RequestedRole },
      ip: getClientInfo(req).ip,
      userAgent: getClientInfo(req).userAgent,
    });

    await conn.commit();
    return res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    console.error("approve role error", e);
    return res.status(500).json({ message: "Server error" });
  } finally {
    conn.release();
  }
});

// POST /role-requests/:id/reject
router.post("/role-requests/:id/reject", async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  const reviewerId = req.user.userId;
  const { notes } = req.body || {};
  try {
    const [rows] = await pool.execute(
      "SELECT Status, UserID, RequestedRole FROM tblRoleRequests WHERE RequestID = ?",
      [requestId]
    );
    const rr = rows[0];
    if (!rr) return res.status(404).json({ message: "Request not found" });
    if (rr.Status !== "Pending")
      return res.status(400).json({ message: `Cannot reject a ${rr.Status} request` });

    await pool.execute(
      'UPDATE tblRoleRequests SET Status = "Rejected", Notes = IFNULL(?, Notes), ReviewedBy = ?, ReviewedAt = NOW() WHERE RequestID = ?',
      [notes || null, reviewerId, requestId]
    );

    await logAudit({
      actorUserId: reviewerId,
      targetUserId: rr.UserID,
      action: "role-request-reject",
      metadata: { requestId, requestedRole: rr.RequestedRole, notes: notes || null },
      ip: getClientInfo(req).ip,
      userAgent: getClientInfo(req).userAgent,
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error("reject role error", e);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;        