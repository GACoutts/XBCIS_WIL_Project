import express from 'express';
import pool from '../db.js';
import { requireAuth, permitRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /api/landlord/tickets - Enhanced endpoint with comprehensive data
router.get('/tickets', requireAuth, permitRoles('Landlord'), async (req, res) => {
  try {
    const { userId } = req.user;
    const { limit = 50, offset = 0, status, dateFrom, dateTo } = req.query;

    // Validate query parameters
    const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
    const offsetNum = Math.max(parseInt(offset) || 0, 0);

    // Build WHERE clause for filtering
    // NOTE: tblTickets does not have a direct LandlordUserID column in the schema.
    // We infer landlord ownership via approvals made by this landlord on quotes
    // associated with the ticket.
    let whereConditions = [
      `EXISTS (
         SELECT 1
         FROM tblQuotes qx
         JOIN tblLandlordApprovals lax ON lax.QuoteID = qx.QuoteID
         WHERE qx.TicketID = t.TicketID AND lax.LandlordUserID = ?
       )`
    ];
    let queryParams = [userId];

    if (status) {
      whereConditions.push('t.CurrentStatus = ?');
      queryParams.push(status);
    }

    if (dateFrom) {
      whereConditions.push('t.CreatedAt >= ?');
      queryParams.push(dateFrom);
    }

    if (dateTo) {
      whereConditions.push('t.CreatedAt <= ?');
      queryParams.push(dateTo);
    }

    const whereClause = whereConditions.join(' AND ');

    // Main query with comprehensive data including quotes and appointments
    const ticketsQuery = `
      SELECT 
        t.TicketID,
        t.TicketRefNumber,
        t.Description,
        t.UrgencyLevel,
        t.CreatedAt,
        t.CurrentStatus,
        
        -- Client information
        client.FullName as ClientName,
        client.Email as ClientEmail,
        client.Phone as ClientPhone,
        
        -- Quote summary (latest approved quote)
        q.QuoteID,
        q.QuoteAmount,
        q.QuoteStatus,
        q.SubmittedAt as QuoteSubmittedAt,
        contractor.FullName as ContractorName,
        contractor.Email as ContractorEmail,
        
        -- Appointment summary (next scheduled appointment)
        cs.ScheduleID,
        cs.ProposedDate as AppointmentDate,
        cs.ClientConfirmed as AppointmentConfirmed,
        
        -- Landlord approval status
        la.ApprovalStatus as LandlordApprovalStatus,
        la.ApprovedAt as LandlordApprovedAt
        
      FROM tblTickets t
      
      -- Join client information
      LEFT JOIN tblusers client ON t.ClientUserID = client.UserID
      
      -- Join latest approved quote (prioritize approved, then latest)
      LEFT JOIN tblQuotes q ON t.TicketID = q.TicketID 
        AND q.QuoteID = (
          SELECT q2.QuoteID FROM tblQuotes q2 
          WHERE q2.TicketID = t.TicketID 
          ORDER BY 
            CASE WHEN q2.QuoteStatus = 'Approved' THEN 1 ELSE 2 END,
            q2.SubmittedAt DESC
          LIMIT 1
        )
      
      -- Join contractor info for the quote
      LEFT JOIN tblusers contractor ON q.ContractorUserID = contractor.UserID
      
      -- Join next appointment
      LEFT JOIN tblContractorSchedules cs ON t.TicketID = cs.TicketID
        AND cs.ScheduleID = (
          SELECT cs2.ScheduleID FROM tblContractorSchedules cs2
          WHERE cs2.TicketID = t.TicketID
          AND cs2.ProposedDate >= NOW()
          ORDER BY cs2.ProposedDate ASC
          LIMIT 1
        )
      
      -- Join landlord approval
      LEFT JOIN tblLandlordApprovals la ON q.QuoteID = la.QuoteID
      
      WHERE ${whereClause}
      ORDER BY t.CreatedAt DESC
      LIMIT ? OFFSET ?
    `;

    queryParams.push(limitNum, offsetNum);

    const [tickets] = await pool.execute(ticketsQuery, queryParams);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM tblTickets t
      WHERE ${whereClause}
    `;
    
    const [countResult] = await pool.execute(countQuery, queryParams.slice(0, -2));
    const totalCount = countResult[0].total;

    // Transform the results to include nested objects
    const formattedTickets = tickets.map(ticket => ({
      ticketId: ticket.TicketID,
      referenceNumber: ticket.TicketRefNumber,
      description: ticket.Description,
      urgencyLevel: ticket.UrgencyLevel,
      status: ticket.CurrentStatus,
      createdAt: ticket.CreatedAt,
      
      client: {
        name: ticket.ClientName,
        email: ticket.ClientEmail,
        phone: ticket.ClientPhone
      },
      
      quote: ticket.QuoteID ? {
        id: ticket.QuoteID,
        amount: parseFloat(ticket.QuoteAmount || 0),
        status: ticket.QuoteStatus,
        submittedAt: ticket.QuoteSubmittedAt,
        contractor: {
          name: ticket.ContractorName,
          email: ticket.ContractorEmail
        },
        landlordApproval: {
          status: ticket.LandlordApprovalStatus,
          approvedAt: ticket.LandlordApprovedAt
        }
      } : null,
      
      nextAppointment: ticket.ScheduleID ? {
        id: ticket.ScheduleID,
        scheduledDate: ticket.AppointmentDate,
        clientConfirmed: ticket.AppointmentConfirmed
      } : null
    }));

    res.json({
      success: true,
      data: {
        tickets: formattedTickets,
        pagination: {
          total: totalCount,
          limit: limitNum,
          offset: offsetNum,
          hasMore: offsetNum + limitNum < totalCount
        }
      }
    });
    
  } catch (err) {
    console.error('Error fetching landlord tickets:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching tickets', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// GET /api/landlord/tickets/:ticketId/history
router.get("/tickets/:ticketId/history", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "landlord") {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const [history] = await db.query(
      "SELECT id AS HistoryID, status AS Status, changedAt AS ChangedAt, changedBy AS ChangedBy FROM tblTicketStatusHistory WHERE ticketId = ? ORDER BY changedAt ASC",
      [req.params.ticketId]
    );

    res.json({ ticketId: req.params.ticketId, timeline: history });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

// GET /api/landlord/tickets/:ticketId/quotes
router.get("/tickets/:ticketId/quotes", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "landlord") {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const [quotes] = await db.query(
      `SELECT q.id AS QuoteID, q.contractorId AS ContractorID, q.amount AS QuoteAmount, q.status AS QuoteStatus, q.createdAt AS CreatedAt, q.filePath AS Documents
       FROM tblQuotes q
       JOIN tblTickets t ON q.ticketId = t.id
       WHERE q.ticketId = ? AND t.landlordId = ?`,
      [req.params.ticketId, req.user.userId]
    );

    res.json(quotes);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

// POST /api/landlord/quotes/:quoteId/approve
router.post("/quotes/:quoteId/approve", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "landlord") {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Update quote
    await db.query("UPDATE tblQuotes SET status = 'Approved' WHERE id = ?", [req.params.quoteId]);

    // Add ticket history
    await db.query(
      "INSERT INTO tblTicketStatusHistory (ticketId, status, changedBy) VALUES (?, ?, ?)",
      [req.body.ticketId, "Quote Approved", req.user.userId]
    );

    res.json({ message: "Quote approved successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

// POST /api/landlord/quotes/:quoteId/reject
router.post("/quotes/:quoteId/reject", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "landlord") {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Update quote
    await db.query("UPDATE tblQuotes SET status = 'Rejected' WHERE id = ?", [req.params.quoteId]);

    // Add ticket history
    await db.query(
      "INSERT INTO tblTicketStatusHistory (ticketId, status, changedBy) VALUES (?, ?, ?)",
      [req.body.ticketId, "Quote Rejected", req.user.userId]
    );

    res.json({ message: "Quote rejected successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

// GET /api/landlord/tickets/:ticketId/appointments
router.get("/tickets/:ticketId/appointments", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "landlord") {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const [appointments] = await db.query(
      "SELECT id AS AppointmentID, date AS Date, time AS Time, notes AS Notes FROM tblAppointments WHERE ticketId = ?",
      [req.params.ticketId]
    );

    res.json({ ticketId: req.params.ticketId, appointments });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

export default router;
