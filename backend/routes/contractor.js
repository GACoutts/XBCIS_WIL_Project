// backend/routes/contractor.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../db.js';
import { requireAuth, permitRoles } from '../middleware/authMiddleware.js';
import { notifyUser } from '../utils/notify.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Apply authentication and role-based authorization to all contractor routes
router.use(requireAuth);
router.use(permitRoles('Contractor', 'Staff')); // Staff can also access for management

// Configure multer for job update photos (images only, 10MB limit)
const updatesStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/job-updates'),
  filename: (req, file, cb) => {
    const sanitizedName = file.originalname.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
    cb(null, Date.now() + '_' + sanitizedName);
  },
});

const updatesUpload = multer({
  storage: updatesStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype.toLowerCase())) {
      return cb(null, true);
    }
    return cb(new Error('Only image files (JPEG, PNG, WebP, GIF) up to 10MB are allowed'));
  }
});

// GET /api/contractor/jobs - List assigned jobs for authenticated contractor
router.get('/jobs', async (req, res) => {
  try {
    const contractorId = req.user.userId;
    const { page = 1, pageSize = 20, status } = req.query;
    
    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize) || 20));
    const offset = (pageNum - 1) * pageSizeNum;

    // Build query conditions
    let whereConditions = [];
    let queryParams = [contractorId, contractorId];
    
    if (status && status !== 'all') {
      whereConditions.push('t.CurrentStatus = ?');
      queryParams.push(status);
    }

    const whereClause = whereConditions.length > 0 ? `AND ${whereConditions.join(' AND ')}` : '';

    // Main query to get contractor's assigned jobs
    // Using fallback: tickets where contractor has an Approved quote (since AssignedContractorUserID may not exist)
    const jobsQuery = `
      SELECT 
        t.TicketID,
        t.TicketRefNumber,
        t.Description as Subject,
        t.Description,
        t.CurrentStatus,
        t.UrgencyLevel,
        t.CreatedAt,
        t.UpdatedAt,
        client.FullName as ClientName,
        client.Email as ClientEmail,
        client.Phone as ClientPhone,
        q.QuoteID,
        q.QuoteAmount,
        q.QuoteStatus,
        q.SubmittedAt as QuoteSubmittedAt,
        la.ApprovalStatus,
        la.ApprovedAt
      FROM tblTickets t
      LEFT JOIN tblusers client ON t.ClientUserID = client.UserID
      INNER JOIN tblQuotes q ON q.TicketID = t.TicketID 
        AND q.ContractorUserID = ? 
        AND q.QuoteStatus = 'Approved'
      LEFT JOIN tblLandlordApprovals la ON q.QuoteID = la.QuoteID
      WHERE 1=1 ${whereClause}
      ORDER BY COALESCE(t.UpdatedAt, t.CreatedAt) DESC
      LIMIT ? OFFSET ?
    `;

    queryParams.push(pageSizeNum, offset);
    const [jobs] = await pool.execute(jobsQuery, queryParams);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM tblTickets t
      INNER JOIN tblQuotes q ON q.TicketID = t.TicketID 
        AND q.ContractorUserID = ? 
        AND q.QuoteStatus = 'Approved'
      WHERE 1=1 ${whereConditions.length > 0 ? `AND ${whereConditions.join(' AND ')}` : ''}
    `;
    
    const countParams = [contractorId];
    if (status && status !== 'all') {
      countParams.push(status);
    }
    
    const [countResult] = await pool.execute(countQuery, countParams);
    const totalJobs = countResult[0].total;

    // Format response
    const formattedJobs = jobs.map(job => ({
      ticketId: job.TicketID,
      ticketRefNumber: job.TicketRefNumber,
      subject: job.Subject,
      description: job.Description,
      status: job.CurrentStatus,
      urgency: job.UrgencyLevel,
      createdAt: job.CreatedAt,
      updatedAt: job.UpdatedAt,
      client: {
        name: job.ClientName,
        email: job.ClientEmail,
        phone: job.ClientPhone
      },
      quote: {
        id: job.QuoteID,
        amount: parseFloat(job.QuoteAmount || 0),
        status: job.QuoteStatus,
        submittedAt: job.QuoteSubmittedAt,
        landlordApproval: {
          status: job.ApprovalStatus,
          approvedAt: job.ApprovedAt
        }
      }
    }));

    res.json({
      success: true,
      data: {
        jobs: formattedJobs,
        pagination: {
          page: pageNum,
          pageSize: pageSizeNum,
          total: totalJobs,
          totalPages: Math.ceil(totalJobs / pageSizeNum),
          hasMore: offset + pageSizeNum < totalJobs
        }
      },
      meta: {
        timestamp: new Date().toISOString(),
        contractorId: contractorId
      }
    });

  } catch (error) {
    console.error('Error fetching contractor jobs:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to fetch jobs at this time',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/contractor/jobs/:id/update - Submit progress note and photos
router.post('/jobs/:id/update', updatesUpload.array('photos', 5), async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const contractorId = req.user.userId;
    const { notes } = req.body;
    const uploadedFiles = req.files || [];

    if (!ticketId) {
      return res.status(400).json({
        success: false,
        message: 'Valid ticket ID is required'
      });
    }

    // Verify this contractor is assigned to this ticket (has approved quote)
    const [authCheck] = await pool.execute(`
      SELECT t.TicketID, t.CurrentStatus
      FROM tblTickets t
      INNER JOIN tblQuotes q ON q.TicketID = t.TicketID
        AND q.ContractorUserID = ?
        AND q.QuoteStatus = 'Approved'
      WHERE t.TicketID = ?
      LIMIT 1
    `, [contractorId, ticketId]);

    if (!authCheck.length) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this job'
      });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Create job update record
      const [updateResult] = await connection.execute(`
        INSERT INTO tblContractorUpdates (TicketID, ContractorUserID, UpdateType, UpdateContent)
        VALUES (?, ?, 'Note', ?)
      `, [ticketId, contractorId, notes || '']);

      const jobUpdateId = updateResult.insertId;

      // Store uploaded photo references
      const documents = [];
      if (uploadedFiles.length > 0) {
        const documentInserts = uploadedFiles.map(file => [
          jobUpdateId,
          'Photo',
          `/uploads/job-updates/${path.basename(file.path)}`
        ]);

        await connection.query(
          'INSERT INTO tblTicketMedia (TicketID, MediaType, MediaURL) VALUES ?',
          [documentInserts.map(([_, type, url]) => [ticketId, type, url])]
        );

        documents.push(...uploadedFiles.map(file => ({
          type: 'Photo',
          url: `/uploads/job-updates/${path.basename(file.path)}`,
          filename: file.originalname
        })));
      }

      // Add status history entry
      await connection.execute(`
        INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID)
        VALUES (?, 'Progress Updated', ?)
      `, [ticketId, contractorId]);

      await connection.commit();

      res.json({
        success: true,
        data: {
          updateId: jobUpdateId,
          ticketId: ticketId,
          notes: notes,
          documents: documents,
          createdAt: new Date().toISOString()
        },
        message: 'Job progress updated successfully'
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error updating job progress:', error);
    
    // Handle multer file upload errors
    if (error instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: 'FILE_UPLOAD_ERROR'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Unable to update job progress at this time',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/contractor/jobs/:id/schedule - Propose appointment time
router.post('/jobs/:id/schedule', async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const contractorId = req.user.userId;
    const { proposedStart, proposedEnd, notes } = req.body;

    if (!ticketId) {
      return res.status(400).json({
        success: false,
        message: 'Valid ticket ID is required'
      });
    }

    if (!proposedStart) {
      return res.status(400).json({
        success: false,
        message: 'Proposed start time is required'
      });
    }

    const startTime = new Date(proposedStart);
    const endTime = proposedEnd ? new Date(proposedEnd) : null;
    const now = new Date();

    // Validate dates
    if (startTime <= now) {
      return res.status(400).json({
        success: false,
        message: 'Proposed start time must be in the future'
      });
    }

    if (endTime && endTime < startTime) {
      return res.status(400).json({
        success: false,
        message: 'End time must be after start time'
      });
    }

    // Verify this contractor is assigned to this ticket
    const [authCheck] = await pool.execute(`
      SELECT t.TicketID, t.CurrentStatus
      FROM tblTickets t
      INNER JOIN tblQuotes q ON q.TicketID = t.TicketID
        AND q.ContractorUserID = ?
        AND q.QuoteStatus = 'Approved'
      WHERE t.TicketID = ?
      LIMIT 1
    `, [contractorId, ticketId]);

    if (!authCheck.length) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to schedule appointments for this job'
      });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Create schedule proposal
      const [scheduleResult] = await connection.execute(`
        INSERT INTO tblContractorSchedules (TicketID, ContractorUserID, ProposedDate, ClientConfirmed)
        VALUES (?, ?, ?, FALSE)
      `, [ticketId, contractorId, startTime]);

      const scheduleId = scheduleResult.insertId;

      // Update ticket status to indicate scheduling proposed
      await connection.execute(`
        UPDATE tblTickets 
        SET CurrentStatus = 'Awaiting Appointment' 
        WHERE TicketID = ?
      `, [ticketId]);

      // Add status history
      await connection.execute(`
        INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID)
        VALUES (?, 'Appointment Proposed', ?)
      `, [ticketId, contractorId]);

      await connection.commit();

      // After committing the proposal, notify the client of the proposed appointment
      try {
        // Fetch the ticket reference and client ID for notifications
        const [[ticket]] = await pool.query(
          'SELECT TicketRefNumber, ClientUserID FROM tblTickets WHERE TicketID = ? LIMIT 1',
          [ticketId]
        );
        if (ticket) {
          // Extract date and time strings (keep date/time separate for template)
          const dateStr = startTime.toISOString().split('T')[0];
          const timeStr = startTime.toISOString().split('T')[1]?.substring(0, 5) || '';
          const params = { ticketRef: ticket.TicketRefNumber, date: dateStr, time: timeStr };
          await notifyUser({
            userId: ticket.ClientUserID,
            ticketId: ticketId,
            template: 'appointment_proposed',
            params,
            eventKey: `appointment_proposed:${ticketId}:${scheduleId}`,
            fallbackToEmail: true
          });
        }
      } catch (notifyErr) {
        console.error('[contractor/schedule] notification error:', notifyErr);
      }

      res.json({
        success: true,
        data: {
          scheduleId: scheduleId,
          ticketId: ticketId,
          proposedStart: startTime.toISOString(),
          proposedEnd: endTime ? endTime.toISOString() : null,
          notes: notes || null,
          status: 'Proposed',
          clientConfirmed: false,
          createdAt: new Date().toISOString()
        },
        message: 'Appointment proposal submitted successfully'
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error creating appointment proposal:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to propose appointment at this time',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;