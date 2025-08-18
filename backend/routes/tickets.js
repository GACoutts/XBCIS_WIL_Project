import express from 'express';
import pool from '../db.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// ===== Local storage setup for uploaded files =====
const uploadFolder = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadFolder),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `${req.params.ticketId || 'temp'}_${timestamp}_${file.originalname}`);
  }
});

const upload = multer({ storage });

// ============================
// Create a ticket
// ============================
router.post('/', async (req, res) => {
  try {
    const { userId, description, urgencyLevel } = req.body;

    if (!userId || !description || !urgencyLevel) {
      return res.status(400).json({ message: 'Missing required fields: userId, description, urgencyLevel' });
    }

    // Generate a unique ticket reference number
    const ticketRefNumber = 'TCKT-' + Date.now();

    const [result] = await pool.execute(
      'INSERT INTO tblTickets (ClientUserID, TicketRefNumber, Description, UrgencyLevel) VALUES (?, ?, ?, ?)',
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

// ============================
// Upload media for a ticket
// ============================
router.post('/:ticketId/media', upload.single('file'), async (req, res) => {
  try {
    const { ticketId } = req.params;
    const file = req.file;

    if (!file) return res.status(400).json({ message: 'No file uploaded.' });

    // Save file info to database
    const mediaType = path.extname(file.originalname) === '.mp4' ? 'Video' : 'Image';
    await pool.execute(
      'INSERT INTO tblTicketMedia (TicketID, MediaType, MediaURL) VALUES (?, ?, ?)',
      [ticketId, mediaType, file.path]
    );

    res.json({
      message: 'File uploaded successfully',
      file: {
        name: file.originalname,
        path: file.path,
        mimeType: file.mimetype,
        size: file.size
      }
    });
  } catch (err) {
    console.error('Error uploading file:', err);
    res.status(500).json({ message: 'Error uploading file' });
  }
});

// ============================
// Get all tickets
// ============================
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM tblTickets ORDER BY TicketID DESC');
    res.json({ tickets: rows });
  } catch (err) {
    console.error('Error fetching tickets:', err);
    res.status(500).json({ message: 'Error fetching tickets' });
  }
});

// ============================
// Get single ticket with media
// ============================
router.get('/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params;

    const [tickets] = await pool.query('SELECT * FROM tblTickets WHERE TicketID = ?', [ticketId]);
    if (!tickets.length) return res.status(404).json({ message: 'Ticket not found' });

    const [media] = await pool.query('SELECT * FROM tblTicketMedia WHERE TicketID = ?', [ticketId]);

    res.json({ ticket: tickets[0], media });
  } catch (err) {
    console.error('Error fetching ticket:', err);
    res.status(500).json({ message: 'Error fetching ticket' });
  }
});

export default router;
