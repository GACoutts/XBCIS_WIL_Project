// backend/routes/tickets.js
import express from 'express';
import pool from '../db.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { notifyUser } from '../utils/notify.js';

const router = express.Router();

// -------------------------------------------------------------------------------------
// Stable paths relative to this file (ESM-safe)
// -------------------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// uploads/ lives inside backend/
const uploadFolder = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder, { recursive: true });

// -------------------------------------------------------------------------------------
// Multer setup (limits + basic type filter)
// -------------------------------------------------------------------------------------
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadFolder),
  filename: (req, file, cb) => {
    const ticketId = req.params.ticketId || 'temp';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^\w\-]+/g, '_');
    cb(null, `${ticketId}_${timestamp}_${base}${ext}`);
  }
});

const fileFilter = (_req, file, cb) => {
  const ok =
    file.mimetype.startsWith('image/') ||
    file.mimetype === 'video/mp4' ||
    file.mimetype === 'video/quicktime' ||
    file.mimetype === 'video/webm';
  cb(ok ? null : new Error('Unsupported file type'), ok);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

// -------------------------------------------------------------------------------------
// Helper: ensure clients can only touch their own tickets (for media upload)
// -------------------------------------------------------------------------------------
async function authorizeTicketAccess(req, res, next) {
  try {
    const { ticketId } = req.params;
    const [rows] = await pool.query('SELECT ClientUserID FROM tblTickets WHERE TicketID = ?', [ticketId]);

    if (!rows.length) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    if (req.user.role === 'Client' && rows[0].ClientUserID !== req.user.userId) {
      return res.status(403).json({ message: 'Forbidden: You can only upload media to your own tickets' });
    }
    next();
  } catch (err) {
    console.error('Authorize ticket access error:', err);
    res.status(500).json({ message: 'Authorization error' });
  }
}

// -------------------------------------------------------------------------------------
// Create a ticket  (sets status to AWAITING LANDLORD APPROVAL, saves optional files, notifies landlord)
// -------------------------------------------------------------------------------------
router.post('/', authMiddleware, upload.array('files', 8), async (req, res) => {
  try {
    const { description, urgencyLevel } = req.body;
    const userId = req.user.userId;
    const files = req.files || [];

    if (!description || !urgencyLevel) {
      return res.status(400).json({ message: 'Missing required fields: description, urgencyLevel' });
    }

    // Normalize urgency: map "critical" -> "High" (or just drop it UI-side)
    const normalizedUrgency = String(urgencyLevel).toLowerCase() === 'critical' ? 'High' : urgencyLevel;

    const ticketRefNumber = 'TCKT-' + Date.now();

    // Resolve property for this client (tenant first, else landlord primary)
    let propertyId = null;
    try {
      const [[tenancy]] = await pool.query(
        'SELECT PropertyID FROM tblTenancies WHERE TenantUserID = ? AND IsActive = 1 LIMIT 1',
        [userId]
      );
      if (tenancy?.PropertyID) propertyId = tenancy.PropertyID;
    } catch (_) {}
    if (!propertyId) {
      try {
        const [[lprop]] = await pool.query(
          'SELECT PropertyID FROM tblLandlordProperties WHERE LandlordUserID = ? AND (ActiveTo IS NULL OR ActiveTo >= CURDATE()) AND IsPrimary = 1 LIMIT 1',
          [userId]
        );
        if (lprop?.PropertyID) propertyId = lprop.PropertyID;
      } catch (_) {}
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Create ticket at "Awaiting Landlord Approval"
      const [result] = await connection.execute(
        `INSERT INTO tblTickets (ClientUserID, TicketRefNumber, Description, UrgencyLevel, PropertyID, CurrentStatus, CreatedAt)
         VALUES (?, ?, ?, ?, ?, 'Awaiting Landlord Approval', NOW())`,
        [userId, ticketRefNumber, description, normalizedUrgency, propertyId]
      );
      const ticketId = result.insertId;

      // History
      try {
        await connection.execute(
          `INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID, ChangedAt)
           VALUES (?, 'Awaiting Landlord Approval', ?, NOW())`,
          [ticketId, userId]
        );
      } catch {}

      // Seed pending approvals for mapped landlords
      try {
        const [landlords] = await connection.query(
          `SELECT LandlordUserID
             FROM tblLandlordProperties
            WHERE PropertyID = ?
              AND (ActiveTo IS NULL OR ActiveTo >= CURDATE())`,
          [propertyId]
        );
        if (landlords.length) {
          const values = landlords.map(l => [ticketId, l.LandlordUserID, 'Pending']);
          await connection.query(
            `INSERT INTO tblLandlordTicketApprovals (TicketID, LandlordUserID, ApprovalStatus)
             VALUES ?`,
            [values]
          );
        }
      } catch (e) {
        console.warn('[tickets/create] seed landlord approvals warn:', e?.message || e);
      }

      // Save uploaded media (if any)
      if (files.length) {
        const mediaRows = files.map(f => [
          ticketId,
          f.mimetype.startsWith('image/') ? 'Image' :
          (f.mimetype.startsWith('video/') ? 'Video' : 'File'),
          `/uploads/${path.basename(f.path)}`,
        ]);
        await connection.query(
          `INSERT INTO tblTicketMedia (TicketID, MediaType, MediaURL) VALUES ?`,
          [mediaRows]
        );
      }

      await connection.commit();

      // Notify mapped landlords (fallback to staff if none)
      try {
        const [landlords] = await pool.query(
          `SELECT LandlordUserID
             FROM tblLandlordProperties
            WHERE PropertyID = ?
              AND (ActiveTo IS NULL OR ActiveTo >= CURDATE())`,
          [propertyId]
        );
        const actorRows = landlords.length
          ? landlords.map(l => ({ UserID: l.LandlordUserID }))
          : (await pool.query(`SELECT UserID FROM tblusers WHERE Role='Staff'`))[0];

        let clientName = 'Client';
        try {
          const [[clientRow]] = await pool.query(
            'SELECT FullName FROM tblusers WHERE UserID = ? LIMIT 1',
            [userId]
          );
          if (clientRow?.FullName) clientName = clientRow.FullName;
        } catch {}

        await Promise.allSettled(
          actorRows.map(s =>
            notifyUser({
              userId: s.UserID,
              ticketId,
              template: 'ticket_created_landlord_review',
              params: { ticketRef: ticketRefNumber, clientName, urgency: normalizedUrgency, description },
              eventKey: `ticket_created:${ticketId}`,
              fallbackToEmail: true
            })
          )
        );
      } catch (e) {
        console.error('[tickets/create] notify landlord/staff error:', e);
      }

      res.status(201).json({
        ticketId,
        ticketRefNumber,
        message: 'Ticket created successfully',
        uploaded: files.length
      });
    } catch (err) {
      try { await connection.rollback(); } catch {}
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Error creating ticket:', err);
    const msg = (err && err.message) || 'Error creating ticket';
    res.status(500).json({ message: msg });
  }
});


// -------------------------------------------------------------------------------------
// Upload media for a ticket (field: "file")
// -------------------------------------------------------------------------------------
router.post('/:ticketId/media', authMiddleware, authorizeTicketAccess, upload.single('file'), async (req, res) => {
  try {
    const { ticketId } = req.params;
    const file = req.file;
    if (!file) return res.status(400).json({ message: 'No file uploaded.' });

    const publicUrl = `/uploads/${path.basename(file.path)}`;
    const mediaType = file.mimetype.startsWith('video/')
      ? 'Video'
      : file.mimetype.startsWith('image/')
        ? 'Image'
        : 'Other';

    await pool.execute(
      `INSERT INTO tblTicketMedia (TicketID, MediaType, MediaURL)
       VALUES (?, ?, ?)`,
      [ticketId, mediaType, publicUrl]
    );

    res.json({
      message: 'File uploaded successfully',
      file: {
        name: file.originalname,
        servedAt: publicUrl,
        mimeType: file.mimetype,
        size: file.size
      }
    });
  } catch (err) {
    console.error('Error uploading file:', err);
    res.status(500).json({ message: 'Error uploading file' });
  }
});

// -------------------------------------------------------------------------------------
// Get all tickets (role-based, with correct visibility windows)
// -------------------------------------------------------------------------------------
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { userId, role } = req.user;

    let query = '';
    let params = [];

    if (role === 'Client') {
      // Clients see only their tickets
      query = `
        SELECT t.*, p.AddressLine1 AS PropertyAddress
        FROM tblTickets t
        LEFT JOIN tblProperties p ON t.PropertyID = p.PropertyID
        WHERE t.ClientUserID = ?
        ORDER BY t.TicketID DESC`;
      params = [userId];

    } else if (role === 'Landlord') {
      // Landlords see tickets for their mapped properties
      query = `
        SELECT t.*, p.AddressLine1 AS PropertyAddress
        FROM tblTickets t
        LEFT JOIN tblProperties p ON t.PropertyID = p.PropertyID
        JOIN tblLandlordProperties lp
          ON lp.PropertyID = t.PropertyID
         AND lp.LandlordUserID = ?
         AND (lp.ActiveTo IS NULL OR lp.ActiveTo >= CURDATE())
        ORDER BY t.TicketID DESC`;
      params = [userId];

    } else if (role === 'Staff') {
      // Staff see tickets AFTER landlord approval only
      query = `
        SELECT t.*, p.AddressLine1 AS PropertyAddress
        FROM tblTickets t
        LEFT JOIN tblProperties p ON t.PropertyID = p.PropertyID
        WHERE t.CurrentStatus IN (
          'Awaiting Staff Assignment',
          'Quoting',
          'Awaiting Landlord Quote Approval',
          'Approved',
          'Awaiting Appointment',
          'Scheduled',
          'Completed'
        )
        ORDER BY t.TicketID DESC`;

    } else if (role === 'Contractor') {
      // Contractors see tickets related to them
      // - assigned to them (Tickets.AssignedContractorID)
      // - OR they have submitted a quote
      // - OR they are the approved contractor
      query = `
        SELECT DISTINCT t.*, p.AddressLine1 AS PropertyAddress
        FROM tblTickets t
        LEFT JOIN tblProperties p ON t.PropertyID = p.PropertyID
        LEFT JOIN tblQuotes qMine
               ON qMine.TicketID = t.TicketID
              AND qMine.ContractorUserID = ?
        LEFT JOIN (
          SELECT TicketID, ContractorUserID
          FROM tblQuotes
          WHERE QuoteStatus = 'Approved'
        ) qApproved
               ON qApproved.TicketID = t.TicketID
              AND qApproved.ContractorUserID = ?
        WHERE t.AssignedContractorID = ?
           OR qMine.QuoteID IS NOT NULL
           OR qApproved.TicketID IS NOT NULL
        ORDER BY t.TicketID DESC`;
      params = [userId, userId, userId];

    } else {
      // Fallback (shouldn't be hit with your roles)
      query = `
        SELECT t.*, p.AddressLine1 AS PropertyAddress
        FROM tblTickets t
        LEFT JOIN tblProperties p ON t.PropertyID = p.PropertyID
        ORDER BY t.TicketID DESC`;
    }

    const [rows] = await pool.query(query, params);
    res.json({ tickets: rows });
  } catch (err) {
    console.error('Error fetching tickets:', err);
    res.status(500).json({ message: 'Error fetching tickets' });
  }
});

// -------------------------------------------------------------------------------------
// Client tickets shortcut (MUST be before "/:ticketId" to avoid route collision)
// -------------------------------------------------------------------------------------
router.get('/client/tickets', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'Client') {
      return res.status(403).json({ message: 'Only clients can access their own tickets' });
    }
    const [rows] = await pool.query(
      'SELECT * FROM tblTickets WHERE ClientUserID = ? ORDER BY TicketID DESC',
      [req.user.userId]
    );
    return res.json({ tickets: rows });
  } catch (err) {
    console.error('Error fetching client tickets:', err);
    return res.status(500).json({ message: 'Error fetching client tickets' });
  }
});

// -------------------------------------------------------------------------------------
// Approved contractor lookup (shows after quote approved)
// -------------------------------------------------------------------------------------
router.get('/:ticketId/approved-contractor', authMiddleware, async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { ticketId } = req.params;

    const [[ticket]] = await pool.query(
      'SELECT TicketID, ClientUserID, AssignedContractorID FROM tblTickets WHERE TicketID = ? LIMIT 1',
      [ticketId]
    );
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    if (role === 'Client' && ticket.ClientUserID !== userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const [[approved]] = await pool.query(
      `SELECT q.ContractorUserID, u.FullName, u.Email, u.Phone
         FROM tblQuotes q
         JOIN tblusers u ON u.UserID = q.ContractorUserID
        WHERE q.TicketID = ? AND q.QuoteStatus = 'Approved'
        LIMIT 1`,
      [ticketId]
    );

    let contractor = null;
    if (approved) {
      contractor = {
        userId: approved.ContractorUserID,
        fullName: approved.FullName,
        email: approved.Email,
        phone: approved.Phone
      };
    } else if (ticket.AssignedContractorID) {
      const [[assigned]] = await pool.query(
        `SELECT u.UserID, u.FullName, u.Email, u.Phone
           FROM tblusers u
          WHERE u.UserID = ? LIMIT 1`,
        [ticket.AssignedContractorID]
      );
      if (assigned) {
        contractor = {
          userId: assigned.UserID,
          fullName: assigned.FullName,
          email: assigned.Email,
          phone: assigned.Phone
        };
      }
    }

    return res.json({ ticketId: Number(ticketId), contractor });
  } catch (err) {
    console.error('Error fetching approved contractor:', err);
    res.status(500).json({ message: 'Error fetching approved contractor' });
  }
});

// -------------------------------------------------------------------------------------
// Get ticket status history (timeline)
// -------------------------------------------------------------------------------------
router.get('/:ticketId/history', authMiddleware, async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { ticketId } = req.params;

    const [tickets] = await pool.query('SELECT * FROM tblTickets WHERE TicketID = ?', [ticketId]);
    if (!tickets.length) return res.status(404).json({ message: 'Ticket not found' });

    const t = tickets[0];
    if (role === 'Client' && t.ClientUserID !== userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const [history] = await pool.query(
      `SELECT TicketID,
              Status,
              '' AS Notes,
              COALESCE(UpdatedByUserID, ChangedBy, CreatedBy) AS UpdatedByUserID,
              COALESCE(UpdatedAt, ChangedAt, CreatedAt, NOW()) AS UpdatedAt
         FROM tblTicketStatusHistory
        WHERE TicketID = ?
        ORDER BY UpdatedAt ASC`,
      [ticketId]
    );

    const createdAt =
      t.CreatedAt || t.SubmittedAt || t.CreatedOn || t.CreatedDate || null;

    const createdEvent = createdAt
      ? {
          TicketID: t.TicketID,
          Status: 'Created',
          Notes: t.Description || null,
          UpdatedByUserID: t.ClientUserID,
          UpdatedAt: createdAt
        }
      : null;

    const timeline = createdEvent ? [createdEvent, ...history] : history;

    res.json({ ticketId: ticketId, timeline });
  } catch (err) {
    console.error('Error fetching history:', err);
    res.status(500).json({ message: 'Error fetching history' });
  }
});

// -------------------------------------------------------------------------------------
// Get ticket appointments (confirmed only)
// -------------------------------------------------------------------------------------
router.get('/:ticketId/appointments', authMiddleware, async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { ticketId } = req.params;

    const [[t]] = await pool.query(
      'SELECT TicketID, ClientUserID FROM tblTickets WHERE TicketID = ?',
      [ticketId]
    );
    if (!t) return res.status(404).json({ message: 'Ticket not found' });
    if (role === 'Client' && t.ClientUserID !== userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const [rows] = await pool.query(
      `SELECT 
         ScheduleID        AS AppointmentID,
         TicketID,
         ContractorUserID,
         ProposedDate      AS ScheduledAt,
         ProposedEndDate   AS ScheduledEndAt,
         Notes,
         ClientConfirmed,
         CreatedAt,
         UpdatedAt
       FROM tblContractorSchedules
       WHERE TicketID = ? AND ClientConfirmed = TRUE
       ORDER BY ProposedDate DESC`,
      [ticketId]
    );

    const appointments = rows.map(r => ({
      AppointmentID: r.AppointmentID,
      TicketID: r.TicketID,
      ContractorUserID: r.ContractorUserID,
      ScheduledAt: r.ScheduledAt,
      ScheduledEndAt: r.ScheduledEndAt,
      Notes: r.Notes,
      Status: 'Scheduled',
      ClientConfirmed: !!r.ClientConfirmed,
      CreatedAt: r.CreatedAt,
      UpdatedAt: r.UpdatedAt
    }));

    res.json({ ticketId, appointments });
  } catch (err) {
    console.error('Error fetching appointments:', err);
    res.status(500).json({ message: 'Error fetching appointments' });
  }
});

// -------------------------------------------------------------------------------------
// Create (finalize) an appointment for a ticket
// -------------------------------------------------------------------------------------
router.post('/:ticketId/appointments', authMiddleware, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { scheduledAt, contractorUserId, notes } = req.body || {};
    const callerId = req.user.userId;
    const callerRole = req.user.role;

    if (!scheduledAt) {
      return res.status(400).json({ message: 'scheduledAt is required' });
    }
    const proposedDate = new Date(scheduledAt);
    if (Number.isNaN(proposedDate.getTime())) {
      return res.status(400).json({ message: 'Invalid scheduledAt date' });
    }
    if (proposedDate.getTime() <= Date.now()) {
      return res.status(400).json({ message: 'Appointment time must be in the future' });
    }

    // Determine contractor per role/flow
    let contractorId = null;
    if (callerRole === 'Contractor') {
      contractorId = callerId;
    }

    const [[ticket]] = await pool.query(
      'SELECT TicketID, ClientUserID, TicketRefNumber, CurrentStatus FROM tblTickets WHERE TicketID = ? LIMIT 1',
      [ticketId]
    );
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    if (callerRole === 'Contractor') {
      // Contractor must have an approved quote on this ticket
      const [authCheck] = await pool.execute(
        `SELECT 1
           FROM tblQuotes
          WHERE TicketID = ? AND ContractorUserID = ? AND QuoteStatus = 'Approved'
          LIMIT 1`,
        [ticketId, callerId]
      );
      if (!authCheck.length) {
        return res.status(403).json({ message: 'You are not authorized to schedule an appointment for this ticket' });
      }
    } else if (callerRole === 'Client') {
      // Client may schedule only after quote approved; contractor comes from approved quote
      const [[approved]] = await pool.query(
        `SELECT ContractorUserID FROM tblQuotes WHERE TicketID = ? AND QuoteStatus = 'Approved' LIMIT 1`,
        [ticketId]
      );
      if (!approved) {
        return res.status(400).json({ message: 'No approved contractor found for this ticket. Please wait for your landlord to approve a quote.' });
      }
      contractorId = approved.ContractorUserID;
    } else {
      // Staff/Landlord must supply a contractor id
      contractorId = parseInt(contractorUserId, 10);
      if (!contractorId || Number.isNaN(contractorId)) {
        return res.status(400).json({ message: 'contractorUserId must be provided for non-contractors and non-clients' });
      }
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [ins] = await connection.execute(
        `INSERT INTO tblContractorSchedules (TicketID, ContractorUserID, ProposedDate, ProposedEndDate, Notes, ClientConfirmed)
         VALUES (?, ?, ?, ?, ?, TRUE)`,
        [ticketId, contractorId, proposedDate, null, notes || null]
      );
      const appointmentId = ins.insertId;

      await connection.execute(
        `UPDATE tblTickets SET CurrentStatus = 'Scheduled' WHERE TicketID = ?`,
        [ticketId]
      );

      await connection.execute(
        `INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID)
         VALUES (?, 'Scheduled', ?)`,
        [ticketId, callerId]
      );

      await connection.commit();

      // Notifications
      try {
        const [[clientRow]] = await pool.query(
          'SELECT FullName FROM tblusers WHERE UserID = ? LIMIT 1',
          [ticket.ClientUserID]
        );
        const clientName = clientRow?.FullName || '';
        const [[contractorRow]] = await pool.query(
          'SELECT FullName FROM tblusers WHERE UserID = ? LIMIT 1',
          [contractorId]
        );
        const contractorName = contractorRow?.FullName || '';

        const eventKey = `appointment_scheduled:${ticketId}`;
        const dateStr = proposedDate.toISOString().split('T')[0];
        const timeStr = proposedDate.toISOString().split('T')[1]?.substring(0, 5) || '';
        const params = { ticketRef: ticket.TicketRefNumber, date: dateStr, time: timeStr, contractorName, clientName };

        await notifyUser({
          userId: ticket.ClientUserID,
          ticketId: ticketId,
          template: 'appointment_scheduled',
          params,
          eventKey,
          fallbackToEmail: true
        });
        if (callerId !== contractorId) {
          await notifyUser({
            userId: contractorId,
            ticketId: ticketId,
            template: 'appointment_scheduled',
            params,
            eventKey: `${eventKey}:contractor`,
            fallbackToEmail: true
          });
        }
      } catch (e) {
        console.error('[appointments/create] Notification error:', e);
      }

      return res.status(201).json({
        success: true,
        data: {
          appointmentId,
          ticketId: Number(ticketId),
          contractorUserId: contractorId,
          scheduledAt: proposedDate.toISOString(),
          clientConfirmed: true,
          status: 'Scheduled'
        },
        message: 'Appointment scheduled successfully'
      });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Error creating appointment:', err);
    res.status(500).json({ success: false, message: 'Error creating appointment', error: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
});

// -------------------------------------------------------------------------------------
// Mark a ticket/job as completed
// -------------------------------------------------------------------------------------
router.post('/:ticketId/complete', authMiddleware, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const callerId = req.user.userId;
    const callerRole = req.user.role;

    if (!(callerRole === 'Contractor' || callerRole === 'Staff')) {
      return res.status(403).json({ message: 'Only contractors or staff can complete a ticket' });
    }

    const [[ticket]] = await pool.query(
      'SELECT TicketID, ClientUserID, TicketRefNumber, CurrentStatus FROM tblTickets WHERE TicketID = ? LIMIT 1',
      [ticketId]
    );
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    if (callerRole === 'Contractor') {
      const [authCheck] = await pool.execute(
        `SELECT t.TicketID
           FROM tblTickets t
           INNER JOIN tblQuotes q
                   ON q.TicketID = t.TicketID
                  AND q.ContractorUserID = ?
                  AND q.QuoteStatus = 'Approved'
          WHERE t.TicketID = ?
          LIMIT 1`,
        [callerId, ticketId]
      );
      if (!authCheck.length) {
        return res.status(403).json({ message: 'You are not authorized to complete this ticket' });
      }
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.execute(
        `UPDATE tblTickets SET CurrentStatus = 'Completed' WHERE TicketID = ?`,
        [ticketId]
      );

      await connection.execute(
        `INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID)
         VALUES (?, 'Completed', ?)`,
        [ticketId, callerId]
      );

      await connection.commit();

      // Notifications (client, contractor, landlord(s))
      try {
        const [[clientRow]] = await pool.query(
          'SELECT FullName FROM tblusers WHERE UserID = ? LIMIT 1',
          [ticket.ClientUserID]
        );
        const clientName = clientRow?.FullName || '';

        let contractorName = '';
        let contractorUserId = null;
        if (callerRole === 'Contractor') {
          contractorUserId = callerId;
          const [[cRow]] = await pool.query(
            'SELECT FullName FROM tblusers WHERE UserID = ? LIMIT 1',
            [callerId]
          );
          contractorName = cRow?.FullName || '';
        } else {
          const [[cRow]] = await pool.query(
            `SELECT u.UserID, u.FullName
               FROM tblQuotes q
               JOIN tblusers u ON u.UserID = q.ContractorUserID
              WHERE q.TicketID = ? AND q.QuoteStatus = 'Approved'
              LIMIT 1`,
            [ticketId]
          );
          if (cRow) {
            contractorUserId = cRow.UserID;
            contractorName = cRow.FullName || '';
          }
        }

        const eventKey = `job_completed:${ticketId}`;
        const params = { ticketRef: ticket.TicketRefNumber, contractorName };

        await notifyUser({
          userId: ticket.ClientUserID,
          ticketId: ticketId,
          template: 'job_completed',
          params,
          eventKey,
          fallbackToEmail: true
        });

        if (contractorUserId && contractorUserId !== callerId) {
          await notifyUser({
            userId: contractorUserId,
            ticketId: ticketId,
            template: 'job_completed',
            params,
            eventKey: `${eventKey}:contractor`,
            fallbackToEmail: true
          });
        }

        try {
          const [landlords] = await pool.query(
            `SELECT LandlordUserID
               FROM tblLandlordProperties lp
               JOIN tblTickets t ON t.PropertyID = lp.PropertyID
              WHERE t.TicketID = ?
                AND (lp.ActiveTo IS NULL OR lp.ActiveTo >= CURDATE())`,
            [ticketId]
          );
          for (const row of landlords) {
            await notifyUser({
              userId: row.LandlordUserID,
              ticketId: ticketId,
              template: 'job_completed',
              params,
              eventKey: `${eventKey}:landlord:${row.LandlordUserID}`,
              fallbackToEmail: true
            });
          }
        } catch (e) {
          console.error('[complete] landlord notify error:', e);
        }
      } catch (e) {
        console.error('[complete] notification error:', e);
      }

      return res.json({ success: true, message: 'Ticket marked as completed' });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Error completing ticket:', err);
    res.status(500).json({ success: false, message: 'Error completing ticket', error: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
});

// -------------------------------------------------------------------------------------
// Latest assigned contractor (fallback – separate from approved-contractor)
// -------------------------------------------------------------------------------------
router.get('/:ticketId/contractor', authMiddleware, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticketIdNum = parseInt(ticketId, 10);
    if (!Number.isFinite(ticketIdNum)) return res.status(400).json({ message: 'Invalid ticketId' });

    const [[ticket]] = await pool.query(
      'SELECT TicketID, ClientUserID FROM tblTickets WHERE TicketID = ? LIMIT 1',
      [ticketIdNum]
    );
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    if (req.user.role === 'Client' && ticket.ClientUserID !== req.user.userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const [rows] = await pool.query(
      `SELECT cs.ContractorUserID, u.FullName, u.Email, u.Phone
         FROM tblContractorSchedules cs
         JOIN tblusers u ON u.UserID = cs.ContractorUserID
        WHERE cs.TicketID = ?
        ORDER BY cs.ScheduleID DESC
        LIMIT 1`,
      [ticketIdNum]
    );
    if (!rows.length) return res.json({ contractor: null });
    const contractor = {
      UserID: rows[0].ContractorUserID,
      FullName: rows[0].FullName,
      Email: rows[0].Email,
      Phone: rows[0].Phone,
    };
    return res.json({ contractor });
  } catch (err) {
    console.error('Error fetching assigned contractor:', err);
    return res.status(500).json({ message: 'Error fetching assigned contractor' });
  }
});

// -------------------------------------------------------------------------------------
// Close a ticket (client or staff)
// -------------------------------------------------------------------------------------
router.post('/:ticketId/close', authMiddleware, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const id = parseInt(ticketId, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid ticketId' });

    const [[ticket]] = await pool.query(
      'SELECT TicketID, ClientUserID, CurrentStatus FROM tblTickets WHERE TicketID = ? LIMIT 1',
      [id]
    );
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    if (req.user.role === 'Client' && ticket.ClientUserID !== req.user.userId) {
      return res.status(403).json({ message: 'You may only close your own tickets' });
    }
    if (req.user.role !== 'Client' && req.user.role !== 'Staff') {
      return res.status(403).json({ message: 'Only clients or staff may close tickets' });
    }

    if (ticket.CurrentStatus === 'Completed') {
      return res.json({ message: 'Ticket already completed', success: true });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.execute(
        'UPDATE tblTickets SET CurrentStatus = ? WHERE TicketID = ?',
        ['Completed', id]
      );

      await connection.execute(
        'INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID) VALUES (?, ?, ?)',
        [id, 'Completed', req.user.userId]
      );

      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    return res.json({ message: 'Ticket closed successfully', success: true });
  } catch (err) {
    console.error('Error closing ticket:', err);
    return res.status(500).json({ message: 'Error closing ticket' });
  }
});

// -------------------------------------------------------------------------------------
// Get single ticket with media (secured for clients) — keep LAST to avoid collisions
// -------------------------------------------------------------------------------------
router.get('/:ticketId', authMiddleware, async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { ticketId } = req.params;

    const [tickets] = await pool.query(
      'SELECT * FROM tblTickets WHERE TicketID = ?',
      [ticketId]
    );
    if (!tickets.length) return res.status(404).json({ message: 'Ticket not found' });

    if (role === 'Client' && tickets[0].ClientUserID !== userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const [media] = await pool.query(
      'SELECT * FROM tblTicketMedia WHERE TicketID = ?',
      [ticketId]
    );

    res.json({ ticket: tickets[0], media });
  } catch (err) {
    console.error('Error fetching ticket:', err);
    res.status(500).json({ message: 'Error fetching ticket' });
  }
});

export default router;
