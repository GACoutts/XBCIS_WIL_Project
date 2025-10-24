// backend/routes/staff.js
import express from 'express';
import db from '../db.js';
import { requireAuth, permitRoles } from '../middleware/authMiddleware.js';
import { notifyUser } from '../utils/notify.js';

const router = express.Router();

/**
 * POST /api/staff/tickets/:ticketId/assign
 * Body: { contractorUserId }
 * Requires Role: Staff
 * Moves status to 'Quoting' and sets AssignedContractorID
 */
router.post('/tickets/:ticketId/assign', requireAuth, permitRoles('Staff'), async (req, res) => {
  const connection = await db.getConnection();
  try {
    const staffUserId = req.user.userId;
    const ticketId = Number.parseInt(req.params.ticketId, 10);
    const contractorUserId = Number.parseInt(req.body?.contractorUserId, 10);

    if (!Number.isFinite(ticketId)) return res.status(400).json({ message: 'Invalid ticketId' });
    if (!Number.isFinite(contractorUserId)) return res.status(400).json({ message: 'Invalid contractorUserId' });

    await connection.beginTransaction();

    // Only assign if the ticket has passed landlord stage
    const [[row]] = await connection.query(
      `SELECT CurrentStatus, TicketRefNumber FROM tblTickets WHERE TicketID = ? LIMIT 1`,
      [ticketId]
    );
    if (!row) {
      await connection.rollback();
      return res.status(404).json({ message: 'Ticket not found' });
    }
    if (row.CurrentStatus !== 'Awaiting Staff Assignment' && row.CurrentStatus !== 'In Review') {
      await connection.rollback();
      return res.status(400).json({ message: 'Ticket is not awaiting staff assignment' });
    }

    await connection.query(
      `UPDATE tblTickets
          SET AssignedContractorID = ?, CurrentStatus = 'Quoting'
        WHERE TicketID = ?`,
      [contractorUserId, ticketId]
    );

    await connection.query(
      `INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID)
       VALUES (?, 'Quoting', ?)`,
      [ticketId, staffUserId]
    );

    await connection.commit();

    // Notify contractor they have been assigned
    try {
      await notifyUser({
        userId: contractorUserId,
        ticketId,
        template: 'contractor_assigned',
        params: { ticketRef: row.TicketRefNumber },
        eventKey: `contractor_assigned:${ticketId}:${contractorUserId}`,
        fallbackToEmail: true
      });
    } catch (e) {
      console.error('[staff/assign] notify error:', e);
    }

    return res.json({ success: true, message: 'Contractor assigned, ticket moved to Quoting' });
  } catch (err) {
    try { await connection.rollback(); } catch {}
    console.error('Staff assign error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    connection.release();
  }
});

// GET /api/staff/tickets/:id/media  (staff-visible media list)
router.get('/tickets/:id/media', requireAuth, permitRoles('Staff'), async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id, 10);
    if (!Number.isFinite(ticketId)) {
      return res.status(400).json({ success: false, message: 'Valid ticket ID is required' });
    }

    const [rows] = await db.query(
      `
        SELECT MediaID, TicketID, MediaType, MediaURL, UploadedAt
          FROM tblTicketMedia
         WHERE TicketID = ?
         ORDER BY COALESCE(UploadedAt, MediaID) DESC
      `,
      [ticketId]
    );

    const host = `${req.protocol}://${req.get('host')}`;
    const media = rows.map(r => {
      const absolute = r.MediaURL?.startsWith('http')
        ? r.MediaURL
        : `${host}${r.MediaURL?.startsWith('/') ? '' : '/'}${r.MediaURL || ''}`;
      return { ...r, MediaURL: absolute };
    });

    return res.json({ success: true, data: media });
  } catch (err) {
    console.error('[staff/tickets/:id/media] error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
