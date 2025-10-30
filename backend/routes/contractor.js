import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../db.js';
import { requireAuth, permitRoles } from '../middleware/authMiddleware.js';
import { notifyUser } from '../utils/notify.js';
import fs from 'fs';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Auth: contractors (and staff for management views)
router.use(requireAuth);
router.use(permitRoles('Contractor', 'Staff'));

// --------- Uploads for job updates (images only, 10MB) ----------
const updatesDir = path.join(__dirname, '..', 'uploads', 'job-updates');
if (!fs.existsSync(updatesDir)) fs.mkdirSync(updatesDir, { recursive: true });

const updatesStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, updatesDir),
  filename: (_req, file, cb) => {
    const sanitized = file.originalname.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
    cb(null, `${Date.now()}_${sanitized}`);
  },
});

const updatesUpload = multer({
  storage: updatesStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype.toLowerCase())) return cb(null, true);
    return cb(new Error('Only image files (JPEG/PNG/WebP/GIF) up to 10MB are allowed'));
  },
});

// --------- GET /api/contractor/jobs ----------
router.get('/jobs', async (req, res) => {
  try {
    const contractorId = req.user.userId;
    const { page = 1, pageSize = 20, status } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize) || 20));
    const offset = (pageNum - 1) * pageSizeNum;

    const whereConditions = [];
    const params = [contractorId, contractorId, contractorId, contractorId];

    if (status && status !== 'all') {
      if (status === 'Completed') {
        whereConditions.push(`t.CurrentStatus IN ('Completed','Closed')`);
      } else {
        whereConditions.push(`t.CurrentStatus = ?`);
        params.push(status);
      }
    }
    const whereClause = whereConditions.length ? `AND ${whereConditions.join(' AND ')}` : '';

    const jobsQuery = `
  SELECT DISTINCT
    t.TicketID,
    t.TicketRefNumber,
    t.Title,
    t.Description,
    t.CurrentStatus,
    t.UrgencyLevel,
    t.CreatedAt,
    client.FullName AS ClientName,
    client.Email AS ClientEmail,
    client.Phone AS ClientPhone,
    p.AddressLine1 AS PropertyAddress,
    q.QuoteID,
    q.QuoteAmount,
    q.QuoteStatus,
    q.SubmittedAt AS QuoteSubmittedAt,
    la.ApprovalStatus,
    la.ApprovedAt,
    th.CompletedAt  -- ← derived completion timestamp
  FROM tblTickets t
  INNER JOIN (
    SELECT TicketID FROM tblContractorSchedules WHERE ContractorUserID = ?
      UNION
        SELECT TicketID FROM tblQuotes WHERE ContractorUserID = ? AND QuoteStatus = 'Approved'
      UNION
        SELECT TicketID FROM tblTickets WHERE AssignedContractorID = ?

  ) assigned ON assigned.TicketID = t.TicketID
  LEFT JOIN tblQuotes q
    ON q.TicketID = t.TicketID
   AND q.ContractorUserID = ?
  LEFT JOIN tblLandlordApprovals la
    ON la.QuoteID = q.QuoteID
  LEFT JOIN tblusers client ON t.ClientUserID = client.UserID
  LEFT JOIN tblProperties p ON p.PropertyID = t.PropertyID
  /* latest completion-ish timestamp from history */
  LEFT JOIN (
    SELECT TicketID, MAX(UpdatedAt) AS CompletedAt
    FROM tblTicketStatusHistory
    WHERE Status IN ('Completed','Closed','Job Completed')
    GROUP BY TicketID
  ) th ON th.TicketID = t.TicketID
  WHERE 1=1 ${whereClause}
  ORDER BY t.CreatedAt DESC
  LIMIT ${pageSizeNum} OFFSET ${offset}
`;

    const [jobs] = await pool.execute(jobsQuery, params);

    // Count for pagination (mirror visibility + optional status)
    const countParams = [contractorId, contractorId, contractorId];
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM tblTickets t
      INNER JOIN (
        SELECT TicketID FROM tblContractorSchedules WHERE ContractorUserID = ?
        UNION
        SELECT TicketID FROM tblQuotes WHERE ContractorUserID = ? AND QuoteStatus = 'Approved'
        UNION
        SELECT TicketID FROM tblTickets WHERE AssignedContractorID = ?
      ) assigned ON assigned.TicketID = t.TicketID
      WHERE 1=1 ${whereConditions.length ? `AND ${whereConditions.join(' AND ')}` : ''}
    `;
    if (status && status !== 'all' && status !== 'Completed') countParams.push(status);

    const [countRows] = await pool.execute(countQuery, countParams);
    const totalJobs = countRows[0]?.total || 0;

    // Fetch latest schedule snapshot for the listed tickets (one round trip)
    const ticketIds = jobs.map(j => j.TicketID);
    let scheduleMap = new Map();
    if (ticketIds.length) {
      const [schedRows] = await pool.query(
        `
          SELECT
            s.ScheduleID,
            s.TicketID,
            s.ContractorUserID,
            s.ProposedDate,
            s.ClientConfirmed,
            s.ContractorConfirmed,
            s.ProposedBy,
            s.Notes
          FROM tblContractorSchedules s
          WHERE s.TicketID IN (?)
          ORDER BY (s.ClientConfirmed + s.ContractorConfirmed) DESC,
          s.ProposedDate DESC, s.ScheduleID DESC
        `,
        [ticketIds]
      );
      // Keep the latest row per ticket
      for (const row of schedRows) {
        if (!scheduleMap.has(row.TicketID)) {
          scheduleMap.set(row.TicketID, row);
        }
      }
    }

    const formattedJobs = jobs.map(j => {
      const latest = scheduleMap.get(j.TicketID) || null;
      return {
        ticketId: j.TicketID,
        ticketRefNumber: j.TicketRefNumber,
        title: j.Title || null,    
        description: j.Description,
        status: j.CurrentStatus,
        urgency: j.UrgencyLevel,
        createdAt: j.CreatedAt,
        completedAt: j.CompletedAt || null,
        client: { name: j.ClientName, email: j.ClientEmail, phone: j.ClientPhone },
        propertyAddress: j.PropertyAddress || null,
        quote: j.QuoteID
          ? {
            id: j.QuoteID,
            amount: parseFloat(j.QuoteAmount || 0),
            status: j.QuoteStatus,
            submittedAt: j.QuoteSubmittedAt,
            landlordApproval: { status: j.ApprovalStatus, approvedAt: j.ApprovedAt },
          }
          : null,
        schedule: latest
          ? {
            scheduleId: latest.ScheduleID,
            proposedDate: latest.ProposedDate,
            clientConfirmed: !!latest.ClientConfirmed,
            contractorConfirmed: !!latest.ContractorConfirmed,
            proposedBy: latest.ProposedBy || null,
            notes: latest.Notes ?? null,
          }
          : null,
      };
    });

    res.json({
      success: true,
      data: {
        jobs: formattedJobs,
        pagination: {
          page: pageNum,
          pageSize: pageSizeNum,
          total: totalJobs,
          totalPages: Math.ceil(totalJobs / pageSizeNum),
          hasMore: offset + pageSizeNum < totalJobs,
        },
      },
      meta: { timestamp: new Date().toISOString(), contractorId },
    });
  } catch (error) {
    console.error('Error fetching contractor jobs:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to fetch jobs at this time',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// --------- GET /api/contractor/jobs/:id/schedule ----------
// Returns the latest schedule row for this ticket
router.get('/jobs/:id/schedule', async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id, 10);
    if (!Number.isFinite(ticketId)) {
      return res.status(400).json({ success: false, message: 'Valid ticket ID is required' });
    }

    // Visibility: same as jobs list - must be related in any of the ways
    const contractorId = req.user.userId;
    const [[auth]] = await pool.query(
      `
    SELECT 1 FROM (
      SELECT TicketID FROM tblContractorSchedules WHERE ContractorUserID = ?
      UNION
      SELECT TicketID FROM tblQuotes WHERE ContractorUserID = ? AND QuoteStatus = 'Approved'
      UNION
      SELECT TicketID FROM tblTickets WHERE AssignedContractorID = ?
    ) x
    WHERE x.TicketID = ?
    LIMIT 1
  `,
      [contractorId, contractorId, contractorId, ticketId]
    );

    if (!auth) {
      return res.status(403).json({ success: false, message: 'Not authorized to view schedule for this job' });
    }

    const [rows] = await pool.query(
      `
        SELECT ScheduleID, TicketID, ContractorUserID, ProposedDate,
        ClientConfirmed, ContractorConfirmed, ProposedBy, Notes        
        FROM tblContractorSchedules
        WHERE TicketID = ?
        ORDER BY (ClientConfirmed + ContractorConfirmed) DESC,
        ProposedDate DESC, ScheduleID DESC
        LIMIT 1
      `,
      [ticketId]
    );

    const row = rows[0] || null;
    return res.json({
      success: true,
      data: row
        ? {
          ScheduleID: row.ScheduleID,
          TicketID: row.TicketID,
          ContractorUserID: row.ContractorUserID,
          ProposedDate: row.ProposedDate,
          ClientConfirmed: !!row.ClientConfirmed,
          ContractorConfirmed: !!row.ContractorConfirmed,
          ProposedBy: row.ProposedBy || null,
          Notes: row.Notes ?? null,
        }
        : null,
    });
  } catch (err) {
    console.error('Error fetching schedule:', err);
    res.status(500).json({ success: false, message: 'Unable to fetch schedule' });
  }
});

// GET /api/contractor/jobs/:id/media  (contractor-visible media list)
router.get('/jobs/:id/media', async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id, 10);
    if (!Number.isFinite(ticketId)) {
      return res.status(400).json({ success: false, message: 'Valid ticket ID is required' });
    }

    // Same visibility as other contractor endpoints
    const contractorId = req.user.userId;
    const [[auth]] = await pool.query(
      `
        SELECT 1 FROM (
          SELECT TicketID FROM tblContractorSchedules WHERE ContractorUserID = ?
          UNION
          SELECT TicketID FROM tblQuotes WHERE ContractorUserID = ? AND QuoteStatus = 'Approved'
          UNION
          SELECT TicketID FROM tblTickets WHERE AssignedContractorID = ?
        ) x WHERE x.TicketID = ? LIMIT 1
      `,
      [contractorId, contractorId, contractorId, ticketId]
    );
    if (!auth) {
      return res.status(403).json({ success: false, message: 'Not authorized to view media for this job' });
    }

    const [rows] = await pool.query(
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
    console.error('[contractor/jobs/:id/media] error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});


// --------- POST /api/contractor/jobs/:id/update ----------
router.post('/jobs/:id/update', updatesUpload.array('photos', 5), async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id, 10);
    const contractorId = req.user.userId;
    const { notes } = req.body;
    const uploadedFiles = req.files || [];

    if (!Number.isFinite(ticketId)) {
      return res.status(400).json({ success: false, message: 'Valid ticket ID is required' });
    }

    // Must have an approved quote to post updates
    const [authCheck] = await pool.execute(
      `
      SELECT t.TicketID
      FROM tblTickets t
      INNER JOIN tblQuotes q
        ON q.TicketID = t.TicketID
       AND q.ContractorUserID = ?
       AND q.QuoteStatus = 'Approved'
      WHERE t.TicketID = ?
      LIMIT 1
      `,
      [contractorId, ticketId]
    );
    if (!authCheck.length) {
      return res.status(403).json({ success: false, message: 'You are not authorized to update this job' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [updateRes] = await conn.execute(
        `INSERT INTO tblContractorUpdates (TicketID, ContractorUserID, UpdateType, UpdateContent)
         VALUES (?, ?, 'Note', ?)`,
        [ticketId, contractorId, notes || '']
      );
      const jobUpdateId = updateRes.insertId;

      if (uploadedFiles.length) {
        await conn.query(
          'INSERT INTO tblTicketMedia (TicketID, MediaType, MediaURL) VALUES ?',
          [
            uploadedFiles.map(f => [
              ticketId,
              'Photo',
              `/uploads/job-updates/${path.basename(f.path)}`,
            ]),
          ]
        );
      }

      await conn.execute(
        `INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID)
         VALUES (?, 'Progress Updated', ?)`,
        [ticketId, contractorId]
      );

      await conn.commit();

      res.json({
        success: true,
        data: {
          updateId: jobUpdateId,
          ticketId,
          notes: notes || '',
          documents: uploadedFiles.map(f => ({
            type: 'Photo',
            url: `/uploads/job-updates/${path.basename(f.path)}`,
            filename: f.originalname,
          })),
          createdAt: new Date().toISOString(),
        },
        message: 'Job progress updated successfully',
      });
    } catch (e) {
      try { await conn.rollback(); } catch { }
      throw e;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('Error updating job progress:', error);
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: error.message, code: 'FILE_UPLOAD_ERROR' });
    }
    res.status(500).json({
      success: false,
      message: 'Unable to update job progress at this time',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// --------- POST /api/contractor/jobs/:id/schedule ----------
router.post('/jobs/:id/schedule', async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id, 10);
    const contractorId = req.user.userId;

    const scheduledAtRaw = req.body.scheduledAt ?? req.body.proposedStart;
    const { proposedEnd, notes } = req.body;
    if (!scheduledAtRaw) return res.status(400).json({ success: false, message: 'scheduledAt is required' });

    const startTime = new Date(scheduledAtRaw);
    const endTime = proposedEnd ? new Date(proposedEnd) : null;
    if (!Number.isFinite(ticketId)) return res.status(400).json({ success: false, message: 'Valid ticket ID is required' });
    if (startTime <= new Date()) return res.status(400).json({ success: false, message: 'Proposed start time must be in the future' });
    if (endTime && endTime < startTime) return res.status(400).json({ success: false, message: 'End time must be after start time' });

    // Must have an approved quote to propose schedule
    const [authCheck] = await pool.execute(
      `
      SELECT t.TicketID
      FROM tblTickets t
      INNER JOIN tblQuotes q
        ON q.TicketID = t.TicketID
       AND q.ContractorUserID = ?
       AND q.QuoteStatus = 'Approved'
      WHERE t.TicketID = ?
      LIMIT 1
      `,
      [contractorId, ticketId]
    );
    if (!authCheck.length) {
      return res.status(403).json({ success: false, message: 'You are not authorized to schedule appointments for this job' });
    }

    const conn = await pool.getConnection();
    let scheduleId;
    try {
      await conn.beginTransaction();

      const [[existing]] = await conn.query(
        `
          SELECT ScheduleID
          FROM tblContractorSchedules
          WHERE TicketID = ? AND ContractorUserID = ? AND ClientConfirmed = 0
          ORDER BY ProposedDate DESC, ScheduleID DESC
          LIMIT 1
        `,
        [ticketId, contractorId]
      );

      if (existing) {
        await conn.execute(
          `UPDATE tblContractorSchedules
           SET ProposedDate = ?,
           Notes = ?,
           ClientConfirmed = FALSE,
           ContractorConfirmed = TRUE,
           ProposedBy = 'Contractor'
          WHERE ScheduleID = ?`,
          [startTime, notes ?? null, existing.ScheduleID]
        );
        scheduleId = existing.ScheduleID;
      } else {
        const [schedRes] = await conn.execute(
          `INSERT INTO tblContractorSchedules
       (TicketID, ContractorUserID, ProposedDate,
        ClientConfirmed, ContractorConfirmed, ProposedBy, Notes)
     VALUES (?, ?, ?, FALSE, TRUE, 'Contractor', ?)`,
          [ticketId, contractorId, startTime, notes ?? null]
        );
        scheduleId = schedRes.insertId;
      }

      await conn.execute(
        `
          UPDATE tblTickets
             SET CurrentStatus = 'Awaiting Appointment'
           WHERE TicketID = ?
             AND CurrentStatus NOT IN ('Scheduled','In Progress','Completed','Closed','Cancelled')
        `,
        [ticketId]
      );

      await conn.execute(
        `INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID)
         VALUES (?, 'Appointment Proposed (Contractor)', ?)`,
        [ticketId, contractorId]
      );

      await conn.commit();

      // Notify client
      try {
        const [[ticket]] = await pool.query(
          'SELECT TicketRefNumber, ClientUserID FROM tblTickets WHERE TicketID = ? LIMIT 1',
          [ticketId]
        );
        if (ticket) {
          const dateStr = startTime.toISOString().split('T')[0];
          const timeStr = startTime.toISOString().split('T')[1]?.substring(0, 5) || '';
          await notifyUser({
            userId: ticket.ClientUserID,
            ticketId,
            template: 'appointment_proposed',
            params: { ticketRef: ticket.TicketRefNumber, date: dateStr, time: timeStr },
            eventKey: `appointment_proposed:${ticketId}:${scheduleId}`,
            fallbackToEmail: true,
          });
        }
      } catch (e) {
        console.error('[contractor/schedule] notification error:', e);
      }

      res.json({
        success: true,
        data: {
          scheduleId,
          ticketId,
          scheduledAt: startTime.toISOString(),
          proposedEnd: endTime ? endTime.toISOString() : null,
          proposedStart: startTime.toISOString(),
          notes: notes || null,
          status: 'Proposed',
          clientConfirmed: false,
          contractorConfirmed: true,
          createdAt: new Date().toISOString(),
        },
        message: existing ? 'Appointment proposal updated successfully' : 'Appointment proposal submitted successfully',
      });
    } catch (e) {
      try { await conn.rollback(); } catch { }
      throw e;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('Error creating appointment proposal:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to propose appointment at this time',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// --------- POST /api/contractor/jobs/:id/opt-out ----------
router.post('/jobs/:id/opt-out', async (req, res) => {
  try {
    const ticketId = Number.parseInt(req.params.id, 10);
    const contractorId = req.user.userId;
    const reason = (req.body?.reason || '').toString().slice(0, 500) || null;

    if (!Number.isFinite(ticketId)) {
      return res.status(400).json({ success: false, message: 'Invalid ticket ID' });
    }

    const [[auth]] = await pool.query(
      `
      SELECT t.TicketID
      FROM tblTickets t
      LEFT JOIN tblQuotes q
        ON q.TicketID = t.TicketID
       AND q.ContractorUserID = ?
       AND q.QuoteStatus = 'Approved'
      WHERE t.TicketID = ?
      AND (t.AssignedContractorID = ? OR q.QuoteID IS NOT NULL)
      LIMIT 1
      `,
      [contractorId, ticketId, contractorId]
    );
    if (!auth) {
      return res.status(403).json({ success: false, message: 'Not authorized to opt out of this ticket' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.execute(
        `UPDATE tblTickets
            SET AssignedContractorID = NULL,
                CurrentStatus = 'Awaiting Staff Assignment'
          WHERE TicketID = ?`,
        [ticketId]
      );

      await conn.execute(
        `INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID)
         VALUES (?, 'Contractor Opted Out', ?)`,
        [ticketId, contractorId]
      );

      await conn.commit();
    } catch (e) {
      try { await conn.rollback(); } catch { }
      throw e;
    } finally {
      conn.release();
    }

    // Notify staff
    try {
      const [[ctx]] = await pool.query(
        `SELECT TicketRefNumber FROM tblTickets WHERE TicketID = ? LIMIT 1`,
        [ticketId]
      );
      const [staff] = await pool.query(`SELECT UserID FROM tblusers WHERE Role='Staff'`);
      await Promise.allSettled(
        staff.map(s =>
          notifyUser({
            userId: s.UserID,
            ticketId,
            template: 'contractor_opted_out',
            params: { ticketRef: ctx?.TicketRefNumber || String(ticketId), reason: reason || '' },
            eventKey: `contractor_opted_out:${ticketId}:${contractorId}`,
            fallbackToEmail: true,
          })
        )
      );
    } catch (e) {
      console.error('[contractor/opt-out] notify error:', e);
    }

    return res.json({ success: true, message: 'You have opted out. Staff will reassign this job.' });
  } catch (error) {
    console.error('Error opting out:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to opt out at this time',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

export default router;
