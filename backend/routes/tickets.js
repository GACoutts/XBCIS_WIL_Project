import express from 'express';
import pool from '../db.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authMiddleware } from '../middleware/authMiddleware.js';
import jwt from 'jsonwebtoken';
import { notifyUser } from '../utils/notify.js'; // <-- added

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
// Create a ticket
// -------------------------------------------------------------------------------------
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { description, urgencyLevel } = req.body;
    const userId = req.user.userId; // Get user ID from authenticated session

    if (!description || !urgencyLevel) {
      return res.status(400).json({
        message: 'Missing required fields: description, urgencyLevel'
      });
    }

    const ticketRefNumber = 'TCKT-' + Date.now();

    const [result] = await pool.execute(
      `INSERT INTO tblTickets (ClientUserID, TicketRefNumber, Description, UrgencyLevel)
       VALUES (?, ?, ?, ?)`,
      [userId, ticketRefNumber, description, urgencyLevel]
    );

    const ticketId = result.insertId;

    // --- Notify all Staff (WhatsApp -> Email fallback) ----------------------------
    // Fetch client name for template (fallback to "Client" if missing)
    let clientName = 'Client';
    try {
      const [[clientRow]] = await pool.query(
        'SELECT FullName FROM tblusers WHERE UserID = ? LIMIT 1',
        [userId]
      );
      if (clientRow?.FullName) clientName = clientRow.FullName;
    } catch (e) {
      console.warn('[tickets/create] could not fetch client name:', e.message);
    }

    try {
      const [staffRows] = await pool.query(
        `SELECT UserID FROM tblusers WHERE Role='Staff'`
      );

      await Promise.allSettled(
        staffRows.map(s =>
          notifyUser({
            userId: s.UserID,
            ticketId,
            template: 'ticket_created',
            params: {
              ticketRef: ticketRefNumber,
              clientName,
              urgency: urgencyLevel,
              description
            },
            eventKey: `ticket_created:${ticketId}`,
            fallbackToEmail: true
          })
        )
      );
    } catch (e) {
      console.error('[tickets/create] notify staff error:', e);
      // Do not fail the request if notifications fail
    }
    // ------------------------------------------------------------------------------

    res.status(201).json({
      ticketId,
      ticketRefNumber,
      message: 'Ticket created successfully'
    });
  } catch (err) {
    console.error('Error creating ticket:', err);
    res.status(500).json({ message: 'Error creating ticket' });
  }
});

// Authorization middleware to check ticket access
async function authorizeTicketAccess(req, res, next) {
  try {
    const { ticketId } = req.params;
    const [rows] = await pool.query('SELECT ClientUserID FROM tblTickets WHERE TicketID = ?', [ticketId]);
    
    if (!rows.length) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    // Allow Staff and admins to access any ticket, but restrict Clients to their own tickets
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
// Upload media for a ticket
// Field name must be "file"
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
// Auth middleware
// -------------------------------------------------------------------------------------
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function legacyAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ message: 'Not authenticated' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { userId: decoded.userId, role: decoded.role };
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid session' });
  }
}

// -------------------------------------------------------------------------------------
// Get all tickets (role-based)
// -------------------------------------------------------------------------------------
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { userId, role } = req.user;

    let query = 'SELECT * FROM tblTickets';
    let params = [];

    if (role === 'Client') {
      query += ' WHERE ClientUserID = ?';
      params.push(userId);
    }

    query += ' ORDER BY TicketID DESC';

    const [rows] = await pool.query(query, params);
    res.json({ tickets: rows });
  } catch (err) {
    console.error('Error fetching tickets:', err);
    res.status(500).json({ message: 'Error fetching tickets' });
  }
});

// -------------------------------------------------------------------------------------
// Get single ticket with media (secured for clients)
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

// -------------------------------------------------------------------------------------
// Get ticket status history (timeline)
// -------------------------------------------------------------------------------------
router.get('/:ticketId/history', authMiddleware, async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { ticketId } = req.params;

    // Load ticket and basic access control (clients can only see their own ticket)
    const [tickets] = await pool.query('SELECT * FROM tblTickets WHERE TicketID = ?', [ticketId]);
    if (!tickets.length) return res.status(404).json({ message: 'Ticket not found' });

    const t = tickets[0];
    if (role === 'Client' && t.ClientUserID !== userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Pull the timeline from history table
    const [history] = await pool.query(
      `SELECT TicketID, Status, Notes, UpdatedByUserID, UpdatedAt
       FROM tblTicketStatusHistory
       WHERE TicketID = ?
       ORDER BY UpdatedAt ASC`,
      [ticketId]
    );

    // (Optional) include created event if you don’t already log it into tblTicketStatusHistory
    const createdEvent = {
      TicketID: t.TicketID,
      Status: 'Created',
      Notes: t.Description || null,
      UpdatedByUserID: t.ClientUserID,
      UpdatedAt: t.CreatedAt || t.SubmittedAt || t.CreatedOn || t.CreatedDate || null
    };

    const withCreated = createdEvent.UpdatedAt ? [createdEvent, ...history] : history;

    res.json({ ticketId: ticketId, timeline: withCreated });
  } catch (err) {
    console.error('Error fetching history:', err);
    res.status(500).json({ message: 'Error fetching history' });
  }
});

// -------------------------------------------------------------------------------------
// Get ticket appointments (if you have tblAppointments)
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

    // Normalize into a stable shape
    const appointments = rows.map(r => ({
      AppointmentID: r.AppointmentID,
      TicketID: r.TicketID,
      ContractorUserID: r.ContractorUserID,
      ScheduledAt: r.ScheduledAt,
      ScheduledEndAt: r.ScheduledEndAt,
      Notes: r.Notes,
      Status: 'Scheduled',          // consistent with your POST semantics
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
// This allows authorized users (staff, landlords or assigned contractors) to
// directly create a confirmed appointment. Contractors must already have an
// approved quote for the ticket. The request body should contain a
// `scheduledAt` ISO date/time string and optionally a `contractorUserId` if
// the caller is not a contractor. A `notes` field is accepted but ignored
// currently since tblContractorSchedules does not store notes. Upon success
// the ticket status is set to "Scheduled" and history is logged. Notifications
// are dispatched to the client and contractor to inform them of the scheduled
// appointment.
router.post('/:ticketId/appointments', authMiddleware, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { scheduledAt, contractorUserId, notes } = req.body || {};
    const callerId = req.user.userId;
    const callerRole = req.user.role;

    // Validate required fields
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

    // Determine the contractor responsible for this appointment
    let contractorId = null;
    if (callerRole === 'Contractor') {
      contractorId = callerId;
    } else {
      contractorId = parseInt(contractorUserId, 10);
    }
    if (!contractorId || Number.isNaN(contractorId)) {
      return res.status(400).json({ message: 'contractorUserId must be provided for non-contractors' });
    }

    // Fetch ticket to ensure it exists and gather owner for notifications
    const [[ticket]] = await pool.query(
      'SELECT TicketID, ClientUserID, TicketRefNumber, CurrentStatus FROM tblTickets WHERE TicketID = ? LIMIT 1',
      [ticketId]
    );
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Authorization checks
    // Contractors can only schedule appointments for tickets they are assigned (have an approved quote)
    if (callerRole === 'Contractor') {
      const [authCheck] = await pool.execute(
        `SELECT t.TicketID
         FROM tblTickets t
         INNER JOIN tblQuotes q ON q.TicketID = t.TicketID AND q.ContractorUserID = ? AND q.QuoteStatus = 'Approved'
         WHERE t.TicketID = ?
         LIMIT 1`,
        [callerId, ticketId]
      );
      if (!authCheck.length) {
        return res.status(403).json({ message: 'You are not authorized to schedule an appointment for this ticket' });
      }
    } else if (callerRole === 'Client') {
      // Clients cannot create new appointments directly
      return res.status(403).json({ message: 'Clients are not permitted to create appointments' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Insert confirmed appointment into schedules table (notes/end date supported)
      const [ins] = await connection.execute(
        `INSERT INTO tblContractorSchedules (TicketID, ContractorUserID, ProposedDate, ProposedEndDate, Notes, ClientConfirmed)
         VALUES (?, ?, ?, ?, ?, TRUE)`,
        [ticketId, contractorId, proposedDate, null, notes || null]
      );
      const appointmentId = ins.insertId;

      // Update ticket status to Scheduled
      await connection.execute(
        `UPDATE tblTickets SET CurrentStatus = 'Scheduled' WHERE TicketID = ?`,
        [ticketId]
      );

      // Log status history
      await connection.execute(
        `INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID)
         VALUES (?, 'Scheduled', ?)`,
        [ticketId, callerId]
      );

      await connection.commit();

      // Notifications
      try {
        // Fetch client and contractor names for templates
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
        const timeStr = proposedDate.toISOString().split('T')[1]?.substring(0,5) || '';
        const params = { ticketRef: ticket.TicketRefNumber, date: dateStr, time: timeStr, contractorName, clientName };

        // Notify client
        await notifyUser({
          userId: ticket.ClientUserID,
          ticketId: ticketId,
          template: 'appointment_scheduled',
          params,
          eventKey,
          fallbackToEmail: true
        });
        // Notify contractor (if caller isn't the contractor)
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
// This endpoint allows a contractor or staff member to mark a job as finished. It
// updates the ticket status to "Completed", logs the event in history, and
// dispatches notifications to stakeholders. Contractors must be assigned via an
// approved quote to perform this action.
router.post('/:ticketId/complete', authMiddleware, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const callerId = req.user.userId;
    const callerRole = req.user.role;

    // Authorization: only Contractors or Staff can mark complete
    if (!(callerRole === 'Contractor' || callerRole === 'Staff')) {
      return res.status(403).json({ message: 'Only contractors or staff can complete a ticket' });
    }

    // Verify ticket exists and fetch details
    const [[ticket]] = await pool.query(
      'SELECT TicketID, ClientUserID, TicketRefNumber, CurrentStatus FROM tblTickets WHERE TicketID = ? LIMIT 1',
      [ticketId]
    );
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Contractors: ensure they have an approved quote for this ticket
    if (callerRole === 'Contractor') {
      const [authCheck] = await pool.execute(
        `SELECT t.TicketID
         FROM tblTickets t
         INNER JOIN tblQuotes q ON q.TicketID = t.TicketID AND q.ContractorUserID = ? AND q.QuoteStatus = 'Approved'
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

      // Update ticket status to Completed
      await connection.execute(
        `UPDATE tblTickets SET CurrentStatus = 'Completed' WHERE TicketID = ?`,
        [ticketId]
      );

      // Log status history
      await connection.execute(
        `INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID)
         VALUES (?, 'Completed', ?)`,
        [ticketId, callerId]
      );

      await connection.commit();

      // Notifications
      try {
        // Fetch names
        const [[clientRow]] = await pool.query(
          'SELECT FullName FROM tblusers WHERE UserID = ? LIMIT 1',
          [ticket.ClientUserID]
        );
        const clientName = clientRow?.FullName || '';
        // Determine assigned contractor (the caller if a contractor, otherwise fetch the approved contractor)
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
          // Fetch approved contractor for this ticket
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

        // Notify client
        await notifyUser({
          userId: ticket.ClientUserID,
          ticketId: ticketId,
          template: 'job_completed',
          params,
          eventKey,
          fallbackToEmail: true
        });
        // Notify assigned contractor if the caller was not the contractor and a contractor exists
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
        // Notify landlord(s) if applicable: find all landlords who own this ticket
        try {
          const [landlords] = await pool.query(
            `SELECT LandlordUserID FROM tblLandlordProperties lp
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

export default router;

// -------------------------------------------------------------------------------------
// Additional helper routes
// -------------------------------------------------------------------------------------

/**
 * GET /client/tickets
 * Convenience endpoint used by the client dashboard to list tickets for the
 * currently authenticated client. This simply proxies to the existing
 * `/api/tickets` handler and filters based on the authenticated user. It
 * enforces that the caller has the `Client` role to avoid exposing other
 * users' data. If you already fetch tickets via `/api/tickets`, you do
 * not need to use this route.
 */
router.get('/client/tickets', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'Client') {
      return res.status(403).json({ message: 'Only clients can access their own tickets' });
    }
    // Reuse the logic from the main GET handler: select tickets for this user
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

/**
 * GET /:ticketId/contractor
 * Returns the currently assigned contractor (if any) for a given ticket. The
 * assignment is stored in tblContractorSchedules. If no contractor is
 * assigned, the response contains `{ contractor: null }`. Only authenticated
 * users may access this endpoint. Clients will only receive the contractor
 * information for their own tickets. Staff and landlords can access any
 * ticket.
 */
router.get('/:ticketId/contractor', authMiddleware, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticketIdNum = parseInt(ticketId, 10);
    if (!Number.isFinite(ticketIdNum)) return res.status(400).json({ message: 'Invalid ticketId' });

    // Fetch the ticket row to enforce ownership for clients
    const [[ticket]] = await pool.query(
      'SELECT TicketID, ClientUserID FROM tblTickets WHERE TicketID = ? LIMIT 1',
      [ticketIdNum]
    );
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    // Clients may only view their own tickets
    if (req.user.role === 'Client' && ticket.ClientUserID !== req.user.userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Look up the most recent contractor assignment for this ticket
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

/**
 * POST /:ticketId/close
 * Allows a client or staff member to close a ticket prematurely. When
 * invoked, the ticket's current status is set to 'Completed' and a
 * corresponding history entry is recorded. Clients may only close their own
 * tickets. Staff can close any ticket. Contractors and landlords are not
 * permitted to close tickets. If the ticket is already completed
 * nothing happens and a success response is returned. This endpoint does
 * not delete the ticket or its media.
 */
router.post('/:ticketId/close', authMiddleware, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const id = parseInt(ticketId, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid ticketId' });

    // Verify ticket exists and fetch client ID and current status
    const [[ticket]] = await pool.query(
      'SELECT TicketID, ClientUserID, CurrentStatus FROM tblTickets WHERE TicketID = ? LIMIT 1',
      [id]
    );
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    // Authorization: only client owner or staff may close
    if (req.user.role === 'Client' && ticket.ClientUserID !== req.user.userId) {
      return res.status(403).json({ message: 'You may only close your own tickets' });
    }
    if (req.user.role !== 'Client' && req.user.role !== 'Staff') {
      return res.status(403).json({ message: 'Only clients or staff may close tickets' });
    }

    // If already completed, no change
    if (ticket.CurrentStatus === 'Completed') {
      return res.json({ message: 'Ticket already completed', success: true });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      // Set status to Completed (treated as closed in UI)
      await connection.execute(
        'UPDATE tblTickets SET CurrentStatus = ? WHERE TicketID = ?',
        ['Completed', id]
      );
      // Log status history
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
