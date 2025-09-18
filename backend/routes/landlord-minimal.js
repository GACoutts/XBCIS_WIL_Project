import express from 'express';
import pool from '../db.js';
import { requireAuth, permitRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /api/landlord/tickets - PRODUCTION READY minimal version for Red Rabbit replacement
router.get('/tickets-minimal', requireAuth, permitRoles('Landlord'), async (req, res) => {
  try {
    const { userId } = req.user;
    const { limit = 50, offset = 0 } = req.query;

    const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
    const offsetNum = Math.max(parseInt(offset) || 0, 0);

    // Simple, bulletproof query
    const query = `
      SELECT 
        t.TicketID as ticketId,
        t.TicketRefNumber as referenceNumber,
        t.Description as description,
        t.UrgencyLevel as urgencyLevel,
        t.CurrentStatus as status,
        t.CreatedAt as createdAt,
        client.FullName as clientName,
        client.Email as clientEmail,
        client.Phone as clientPhone
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

    const [tickets] = await pool.execute(query, [userId, limitNum, offsetNum]);

    // Count query
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

    // Format for frontend consumption
    const formattedTickets = tickets.map(ticket => ({
      ticketId: ticket.ticketId,
      referenceNumber: ticket.referenceNumber,
      description: ticket.description,
      urgencyLevel: ticket.urgencyLevel,
      status: ticket.status,
      createdAt: ticket.createdAt,
      client: {
        name: ticket.clientName,
        email: ticket.clientEmail,
        phone: ticket.clientPhone
      }
    }));

    res.json({
      success: true,
      data: {
        tickets: formattedTickets,
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
        version: '1.0.0-production',
        landlordId: userId
      }
    });
    
  } catch (err) {
    console.error('Landlord tickets error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Unable to retrieve tickets',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

export default router;