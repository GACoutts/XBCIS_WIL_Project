import express from 'express';
import pool from '../db.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

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
    // sanitize filename (keep ext)
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^\w\-]+/g, '_');
    cb(null, `${ticketId}_${timestamp}_${base}${ext}`); // e.g. 123_1712345678_photo.jpg
  }
});

const fileFilter = (_req, file, cb) => {
  // allow common image/video types; adjust as needed
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
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB
  }
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

    // Build the public URL served by server.js static middleware
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
        servedAt: publicUrl,     // use this in the frontend <img src=...> or <video src=...>
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
// Get all tickets
// -------------------------------------------------------------------------------------
router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM tblTickets ORDER BY TicketID DESC'
    );
    res.json({ tickets: rows });
  } catch (err) {
    console.error('Error fetching tickets:', err);
    res.status(500).json({ message: 'Error fetching tickets' });
  }
});

// -------------------------------------------------------------------------------------
// Get single ticket with media
// -------------------------------------------------------------------------------------
router.get('/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params;

    const [tickets] = await pool.query(
      'SELECT * FROM tblTickets WHERE TicketID = ?',
      [ticketId]
    );
    if (!tickets.length) return res.status(404).json({ message: 'Ticket not found' });

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
