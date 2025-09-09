import express from 'express';
import pool from '../db.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authMiddleware } from '../middleware/authMiddleware.js'; // fixed path

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
router.post('/', async (req, res) => {
  try {
    const { userId, description, urgencyLevel } = req.body;

    if (!userId || !description || !urgencyLevel) {
      return res.status(400).json({
        message: 'Missing required fields: userId, description, urgencyLevel'
      });
    }

    const ticketRefNumber = 'TCKT-' + Date.now();

    const [result] = await pool.execute(
      `INSERT INTO tblTickets (ClientUserID, TicketRefNumber, Description, UrgencyLevel)
       VALUES (?, ?, ?, ?)`,
      [userId, ticketRefNumber, description, urgencyLevel]
    );

    res.status(201).json({
      ticketId: result.insertId,
      ticketRefNumber,
      message: 'Ticket created successfully'
    });
  } catch (err) {
    console.error('Error creating ticket:', err);
    res.status(500).json({ message: 'Error creating ticket' });
  }
});

// -------------------------------------------------------------------------------------
// Upload media for a ticket
// Field name must be "file"
// -------------------------------------------------------------------------------------
router.post('/:ticketId/media', upload.single('file'), async (req, res) => {
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

    const [tickets] = await pool.query('SELECT * FROM tblTickets WHERE TicketID = ?', [ticketId]);
    if (!tickets.length) return res.status(404).json({ message: 'Ticket not found' });

    const t = tickets[0];
    if (role === 'Client' && t.ClientUserID !== userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const [rows] = await pool.query(
      `SELECT AppointmentID, TicketID, ContractorUserID, ScheduledAt, Status, Notes, CreatedAt, UpdatedAt
       FROM tblAppointments
       WHERE TicketID = ?
       ORDER BY ScheduledAt DESC`,
      [ticketId]
    );

    res.json({ ticketId, appointments: rows });
  } catch (err) {
    console.error('Error fetching appointments:', err);
    res.status(500).json({ message: 'Error fetching appointments' });
  }
});

export default router;
