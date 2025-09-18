import express from 'express';
import pool from '../db.js';
import { requireAuth, permitRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /api/landlord/tickets - Production-ready endpoint for Red Rabbit replacement
router.get('/tickets', requireAuth, permitRoles('Landlord'), async (req, res) => {
  try {
    const { userId } = req.user;
    const { limit = 50, offset = 0 } = req.query;

    // Validate query parameters
    const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
    const offsetNum = Math.max(parseInt(offset) || 0, 0);

    // Step 1: Get basic tickets that belong to this landlord
    const basicTicketsQuery = `
      SELECT 
        t.TicketID, t.TicketRefNumber, t.Description, 
        t.UrgencyLevel, t.CreatedAt, t.CurrentStatus,
        client.FullName as ClientName,
        client.Email as ClientEmail,
        client.Phone as ClientPhone
      FROM tblTickets t
      LEFT JOIN tblusers client ON t.ClientUserID = client.UserID
      WHERE EXISTS (
         SELECT 1 FROM tblQuotes qx
         JOIN tblLandlordApprovals lax ON lax.QuoteID = qx.QuoteID
         WHERE qx.TicketID = t.TicketID AND lax.LandlordUserID = ?
       )
      ORDER BY t.CreatedAt DESC
      LIMIT ? OFFSET ?
    `;

    const [basicTickets] = await pool.execute(basicTicketsQuery, [userId, limitNum, offsetNum]);

    // Step 2: Get comprehensive data for each ticket
    const comprehensiveTickets = [];
    
    for (const ticket of basicTickets) {
      try {
        // Get quote information
        const [quotes] = await pool.execute(`
          SELECT 
            q.QuoteID, q.QuoteAmount, q.QuoteStatus, q.SubmittedAt,
            contractor.FullName as ContractorName, 
            contractor.Email as ContractorEmail,
            la.ApprovalStatus, la.ApprovedAt
          FROM tblQuotes q
          LEFT JOIN tblusers contractor ON q.ContractorUserID = contractor.UserID
          LEFT JOIN tblLandlordApprovals la ON q.QuoteID = la.QuoteID AND la.LandlordUserID = ?
          WHERE q.TicketID = ?
          ORDER BY 
            CASE WHEN q.QuoteStatus = 'Approved' THEN 1 ELSE 2 END,
            q.SubmittedAt DESC
          LIMIT 1
        `, [userId, ticket.TicketID]);

        // Get appointment information  
        const [appointments] = await pool.execute(`
          SELECT ScheduleID, ProposedDate, ClientConfirmed
          FROM tblContractorSchedules
          WHERE TicketID = ? AND ProposedDate >= NOW()
          ORDER BY ProposedDate ASC
          LIMIT 1
        `, [ticket.TicketID]);

        // Build comprehensive ticket object
        comprehensiveTickets.push({
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
          
          quote: quotes[0] ? {
            id: quotes[0].QuoteID,
            amount: parseFloat(quotes[0].QuoteAmount || 0),
            status: quotes[0].QuoteStatus,
            submittedAt: quotes[0].SubmittedAt,
            contractor: {
              name: quotes[0].ContractorName,
              email: quotes[0].ContractorEmail
            },
            landlordApproval: {
              status: quotes[0].ApprovalStatus,
              approvedAt: quotes[0].ApprovedAt
            }
          } : null,
          
          nextAppointment: appointments[0] ? {
            id: appointments[0].ScheduleID,
            scheduledDate: appointments[0].ProposedDate,
            clientConfirmed: Boolean(appointments[0].ClientConfirmed)
          } : null
        });
      } catch (ticketErr) {
        // Log error but continue with other tickets
        console.error(`Error enriching ticket ${ticket.TicketID}:`, ticketErr);
        // Add basic ticket info even if enrichment fails
        comprehensiveTickets.push({
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
          quote: null,
          nextAppointment: null,
          _enrichmentError: true
        });
      }
    }

    // Step 3: Get total count for pagination
    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total
      FROM tblTickets t
      WHERE EXISTS (
         SELECT 1 FROM tblQuotes qx
         JOIN tblLandlordApprovals lax ON lax.QuoteID = qx.QuoteID
         WHERE qx.TicketID = t.TicketID AND lax.LandlordUserID = ?
       )
    `, [userId]);
    
    const totalCount = countResult[0].total;

    // Return production-ready response
    res.json({
      success: true,
      data: {
        tickets: comprehensiveTickets,
        pagination: {
          total: totalCount,
          limit: limitNum,
          offset: offsetNum,
          hasMore: offsetNum + limitNum < totalCount,
          currentPage: Math.floor(offsetNum / limitNum) + 1,
          totalPages: Math.ceil(totalCount / limitNum)
        }
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestedBy: userId,
        processingTime: Date.now() - req.startTime || 0
      }
    });
    
  } catch (err) {
    console.error('Critical error in landlord tickets endpoint:', err);
    res.status(500).json({ 
      success: false,
      message: 'Unable to fetch tickets at this time', 
      error: process.env.NODE_ENV === 'development' ? {
        message: err.message,
        stack: err.stack
      } : undefined,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.id || 'unknown'
      }
    });
  }
});

// GET /api/landlord/tickets/:ticketId/history
router.get("/tickets/:ticketId/history", requireAuth, permitRoles('Landlord'), async (req, res) => {
  try {
    const { userId } = req.user;

    const [history] = await pool.execute(
      "SELECT id AS HistoryID, status AS Status, changedAt AS ChangedAt, changedBy AS ChangedBy FROM tblTicketStatusHistory WHERE ticketId = ? ORDER BY changedAt ASC",
      [req.params.ticketId]
    );

    res.json({ ticketId: req.params.ticketId, timeline: history });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

// GET /api/landlord/tickets/:ticketId/quotes
router.get("/tickets/:ticketId/quotes", requireAuth, permitRoles('Landlord'), async (req, res) => {
  try {
    const { userId } = req.user;

    const [quotes] = await pool.execute(
      `SELECT q.QuoteID, q.ContractorUserID AS ContractorID, q.QuoteAmount, q.QuoteStatus, q.SubmittedAt AS CreatedAt
       FROM tblQuotes q
       JOIN tblLandlordApprovals la ON q.QuoteID = la.QuoteID
       WHERE q.TicketID = ? AND la.LandlordUserID = ?`,
      [req.params.ticketId, userId]
    );

    res.json(quotes);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

// POST /api/landlord/quotes/:quoteId/approve
router.post("/quotes/:quoteId/approve", requireAuth, permitRoles('Landlord'), async (req, res) => {
  try {
    const { userId } = req.user;

    // Update quote status
    await pool.execute("UPDATE tblQuotes SET QuoteStatus = 'Approved' WHERE QuoteID = ?", [req.params.quoteId]);

    // Update landlord approval
    await pool.execute(
      "UPDATE tblLandlordApprovals SET ApprovalStatus = 'Approved', ApprovedAt = NOW() WHERE QuoteID = ? AND LandlordUserID = ?",
      [req.params.quoteId, userId]
    );

    res.json({ message: "Quote approved successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

// POST /api/landlord/quotes/:quoteId/reject
router.post("/quotes/:quoteId/reject", requireAuth, permitRoles('Landlord'), async (req, res) => {
  try {
    const { userId } = req.user;

    // Update quote status
    await pool.execute("UPDATE tblQuotes SET QuoteStatus = 'Rejected' WHERE QuoteID = ?", [req.params.quoteId]);

    // Update landlord approval
    await pool.execute(
      "UPDATE tblLandlordApprovals SET ApprovalStatus = 'Rejected', ApprovedAt = NOW() WHERE QuoteID = ? AND LandlordUserID = ?",
      [req.params.quoteId, userId]
    );

    res.json({ message: "Quote rejected successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

// GET /api/landlord/tickets/:ticketId/appointments
router.get("/tickets/:ticketId/appointments", requireAuth, permitRoles('Landlord'), async (req, res) => {
  try {
    const { userId } = req.user;

    const [appointments] = await pool.execute(
      `SELECT cs.ScheduleID AS AppointmentID, cs.ProposedDate AS Date, cs.ClientConfirmed 
       FROM tblContractorSchedules cs
       JOIN tblTickets t ON cs.TicketID = t.TicketID
       JOIN tblQuotes q ON t.TicketID = q.TicketID
       JOIN tblLandlordApprovals la ON q.QuoteID = la.QuoteID
       WHERE cs.TicketID = ? AND la.LandlordUserID = ?
       ORDER BY cs.ProposedDate DESC`,
      [req.params.ticketId, userId]
    );

    res.json({ ticketId: req.params.ticketId, appointments });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

// Debug endpoint to test comprehensive query step by step
router.get('/debug', requireAuth, permitRoles('Landlord'), async (req, res) => {
  try {
    const { userId } = req.user;
    
    // Test the exact comprehensive query from the tickets endpoint
    const whereConditions = [
      `EXISTS (
         SELECT 1
         FROM tblQuotes qx
         JOIN tblLandlordApprovals lax ON lax.QuoteID = qx.QuoteID
         WHERE qx.TicketID = t.TicketID AND lax.LandlordUserID = ?
       )`
    ];
    const whereClause = whereConditions.join(' AND ');
    
    const comprehensiveQuery = `
      SELECT 
        t.TicketID,
        t.TicketRefNumber,
        t.Description,
        t.UrgencyLevel,
        t.CreatedAt,
        t.CurrentStatus,
        
        client.FullName as ClientName,
        client.Email as ClientEmail,
        client.Phone as ClientPhone,
        
        q.QuoteID,
        q.QuoteAmount,
        q.QuoteStatus,
        q.SubmittedAt as QuoteSubmittedAt,
        contractor.FullName as ContractorName,
        contractor.Email as ContractorEmail,
        
        cs.ScheduleID,
        cs.ProposedDate as AppointmentDate,
        cs.ClientConfirmed as AppointmentConfirmed,
        
        la.ApprovalStatus as LandlordApprovalStatus,
        la.ApprovedAt as LandlordApprovedAt
        
      FROM tblTickets t
      
      LEFT JOIN tblusers client ON t.ClientUserID = client.UserID
      
      LEFT JOIN tblQuotes q ON t.TicketID = q.TicketID 
        AND q.QuoteID = (
          SELECT q2.QuoteID FROM tblQuotes q2 
          WHERE q2.TicketID = t.TicketID 
          ORDER BY 
            CASE WHEN q2.QuoteStatus = 'Approved' THEN 1 ELSE 2 END,
            q2.SubmittedAt DESC
          LIMIT 1
        )
      
      LEFT JOIN tblusers contractor ON q.ContractorUserID = contractor.UserID
      
      LEFT JOIN tblContractorSchedules cs ON t.TicketID = cs.TicketID
        AND cs.ScheduleID = (
          SELECT cs2.ScheduleID FROM tblContractorSchedules cs2
          WHERE cs2.TicketID = t.TicketID
          AND cs2.ProposedDate >= NOW()
          ORDER BY cs2.ProposedDate ASC
          LIMIT 1
        )
      
      LEFT JOIN tblLandlordApprovals la ON q.QuoteID = la.QuoteID
      
      WHERE ${whereClause}
      ORDER BY t.CreatedAt DESC
      LIMIT 2
    `;
    
    const [testResults] = await pool.execute(comprehensiveQuery, [userId]);
    
    res.json({
      success: true,
      userId: userId,
      resultCount: testResults.length,
      testResults: testResults.slice(0, 1), // Just first result to avoid huge response
      message: 'Comprehensive debug query working'
    });
  } catch (err) {
    console.error('Debug endpoint error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Debug endpoint failed', 
      error: err.message
    });
  }
});

// Parameter binding debug endpoint
router.get('/debug-params', requireAuth, permitRoles('Landlord'), async (req, res) => {
  try {
    const { userId } = req.user;
    const { limit = 50, offset = 0, status, dateFrom, dateTo } = req.query;

    // Same exact parameter building as main endpoint
    const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
    const offsetNum = Math.max(parseInt(offset) || 0, 0);

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
    
    queryParams.push(limitNum, offsetNum);
    
    // Count how many ? placeholders we have
    const placeholderCount = (whereClause + ' LIMIT ? OFFSET ?').match(/\?/g)?.length || 0;
    
    res.json({
      success: true,
      userId: userId,
      queryParams: queryParams,
      queryParamsLength: queryParams.length,
      placeholderCount: placeholderCount,
      whereClause: whereClause,
      paramMatch: placeholderCount === queryParams.length,
      limit: limitNum,
      offset: offsetNum
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message
    });
  }
});

export default router;
