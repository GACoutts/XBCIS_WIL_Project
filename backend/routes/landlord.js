// backend/routes/landlord.js  (ESM, fixed & consistent)
import express from 'express';
import pool from '../db.js';
import { requireAuth, permitRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/tickets', requireAuth, permitRoles('Landlord'), async (req, res) => {
  try {
    const landlordId = req.user.userId;
    const { status, dateFrom, dateTo, limit = '50', offset = '0' } = req.query;

    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);

    // Build WHERE (mapping-based auth)
    const where = [
      `EXISTS (
         SELECT 1
         FROM tblLandlordProperties lp
         WHERE lp.PropertyID = t.PropertyID
           AND lp.LandlordUserID = ?
           AND (lp.ActiveTo IS NULL OR lp.ActiveTo >= CURDATE())
       )`,
    ];
    const whereParams = [landlordId];

    if (status) { where.push('t.CurrentStatus = ?'); whereParams.push(status); }
    if (dateFrom) { where.push('t.CreatedAt   >= ?'); whereParams.push(dateFrom); }
    if (dateTo) { where.push('t.CreatedAt   <= ?'); whereParams.push(dateTo); }

    const whereClause = where.join(' AND ');

    const countSql = `
      SELECT COUNT(*) AS total
      FROM tblTickets t
      WHERE ${whereClause};
    `;

    const ticketsSql = `
      SELECT 
        t.TicketID,
        t.TicketRefNumber,
        t.Description,
        t.UrgencyLevel,
        t.CreatedAt,
        t.CurrentStatus,
        t.PropertyID,

        -- Client information
        client.FullName AS ClientName,
        client.Email    AS ClientEmail,
        client.Phone    AS ClientPhone,

        -- Preferred "latest approved" quote (approved first, else latest)
        q.QuoteID,
        q.QuoteAmount,
        q.QuoteStatus,
        q.SubmittedAt as QuoteSubmittedAt,

        contractor.FullName as ContractorName,
        contractor.Email    as ContractorEmail,

        -- Next scheduled appointment 
        cs.ScheduleID,
        cs.ProposedDate as AppointmentDate,
        cs.ClientConfirmed as AppointmentConfirmed,

        -- Landlord approval on that quote 
        la.ApprovalStatus as LandlordApprovalStatus,
        la.ApprovedAt     as LandlordApprovedAt

      FROM tblTickets t
      LEFT JOIN tblusers client on client.UserID = t.ClientUserID

      LEFT JOIN tblQuotes q on q.TicketID = t.TicketID
        AND q.QuoteID = (
          SELECT q2.QuoteID
          FROM tblQuotes q2
          WHERE q2.TicketID = t.TicketID
          ORDER BY
            CASE WHEN q2.QuoteStatus = 'Approved' THEN 1 ELSE 2 END,
            q2.SubmittedAt DESC
          LIMIT 1
        )

      LEFT JOIN tblusers contractor ON contractor.UserID = q.ContractorUserID

      LEFT JOIN tblContractorSchedules cs ON cs.TicketID = t.TicketID
        AND cs.ScheduleID = (
          SELECT cs2.ScheduleID
          FROM tblContractorSchedules cs2
          WHERE cs2.TicketID = t.TicketID
            AND cs2.ProposedDate >= NOW()
          ORDER BY cs2.ProposedDate ASC
          LIMIT 1
        )

      LEFT JOIN tblLandlordApprovals la ON la.QuoteID = q.QuoteID
      WHERE ${whereClause}
      ORDER BY t.CreatedAt DESC
      LIMIT ? OFFSET ?
    `;

    const [[countRow]] = await pool.execute(countSql, whereParams);
    const totalCount = countRow?.total || 0;

    const dataParams = [...whereParams, limitNum, offsetNum];
    const [rows] = await pool.execute(ticketsSql, dataParams);

    const tickets = rows.map(r => ({
      ticketId: r.TicketID,
      referenceNumber: r.TicketRefNumber,
      description: r.Description,
      urgencyLevel: r.UrgencyLevel,
      status: r.CurrentStatus,
      createdAt: r.CreatedAt,
      propertyId: r.PropertyID,

      client: {
        name: r.ClientName,
        email: r.ClientEmail,
        phone: r.ClientPhone
      },

      quote: r.QuoteID ? {
        id: r.QuoteID,
        amount: Number.parseFloat(r.QuoteAmount || 0),
        status: r.QuoteStatus,
        submittedAt: r.QuoteSubmittedAt,
        contractor: {
          name: r.ContractorName,
          email: r.ContractorEmail
        },
        landlordApproval: {
          status: r.LandlordApprovalStatus,
          approvedAt: r.LandlordApprovedAt
        }
      } : null,

      nextAppointment: r.ScheduleID ? {
        id: r.ScheduleID,
        scheduledDate: r.AppointmentDate,
        clientConfirmed: r.AppointmentConfirmed
      } : null
    }));

    res.json({
      success: true,
      data: {
        tickets,
        pagination: {
          total: totalCount,
          limit: limitNum,
          offset: offsetNum,
          hasMore: offsetNum + limitNum < totalCount
        }
      }
    });

  } catch (err) {
    console.error('Landlord /tickets error:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching tickets',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

/** helper: landlord owns ticket via mapping */
async function landlordOwnsTicket(landlordId, ticketId) {
  const [rows] = await pool.execute(
    `
    SELECT 1
    FROM tblTickets t
    JOIN tblLandlordProperties lp
      ON lp.PropertyID = t.PropertyID
     AND lp.LandlordUserID = ?
     AND (lp.ActiveTo IS NULL OR lp.ActiveTo >= CURDATE())
    WHERE t.TicketID = ?
    LIMIT 1;
    `,
    [landlordId, ticketId]
  );
  return rows.length > 0;
}

/** helper: landlord owns quote (via the quote's ticket → property mapping) */
async function landlordOwnsQuote(landlordId, quoteId) {
  const [rows] = await pool.execute(
    `
    SELECT 1
    FROM tblquotes q
    JOIN tbltickets t ON t.TicketID = q.TicketID
    JOIN tbllandlordproperties lp
         ON lp.PropertyID = t.PropertyID
        AND lp.LandlordUserID = ?
        AND (lp.ActiveTo IS NULL OR lp.ActiveTo >= CURDATE())
    WHERE q.QuoteID = ?
    LIMIT 1;
    `,
    [landlordId, quoteId]
  );
  return rows.length > 0;
}


/**
 * GET /api/landlord/quotes/:ticketId
 * Returns all quotes for a ticket after ownership check.
 */
router.get('/quotes/:ticketId', requireAuth, permitRoles('Landlord'), async (req, res) => {
  try {
    const landlordId = req.user.userId;
    const ticketId = Number.parseInt(req.params.ticketId, 10);
    if (Number.isNaN(ticketId)) return res.status(400).json({ message: 'Invalid ticketId' });

    const owns = await landlordOwnsTicket(landlordId, ticketId);
    if (!owns) return res.status(403).json({ message: 'Not allowed to access this ticket' });

    const [quotes] = await pool.execute(
      `
      SELECT
        q.QuoteID,
        q.TicketID,
        q.ContractorUserID,
        q.QuoteAmount,
        q.QuoteStatus,
        q.SubmittedAt,
        q.FilePath
      FROM tblQuotes q
      WHERE q.TicketID = ?
      ORDER BY q.SubmittedAt DESC;
      `,
      [ticketId]
    );

    res.json({ success: true, data: quotes });
  } catch (err) {
    console.error('Landlord /quotes error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * (Optional) appointments list
 */
router.get('/tickets/:ticketId/appointments', requireAuth, permitRoles('Landlord'), async (req, res) => {
  try {
    const landlordId = req.user.userId;
    const ticketId = Number.parseInt(req.params.ticketId, 10);
    if (Number.isNaN(ticketId)) return res.status(400).json({ message: 'Invalid ticketId' });

    const owns = await landlordOwnsTicket(landlordId, ticketId);
    if (!owns) return res.status(403).json({ message: 'Not allowed to access this ticket' });

    const [appointments] = await pool.execute(
      `
      SELECT
        a.ScheduleID AS AppointmentID,
      a.TicketID,
      a.ProposedDate AS Date,
      a.Notes,
      a.ClientConfirmed AS Status
      FROM tblContractorSchedules a
      WHERE a.TicketID = ?
      ORDER BY a.ProposedDate ASC;
      `,
      [ticketId]
    );

    res.json({ success: true, data: { ticketId, appointments } });
  } catch (err) {
    console.error('Landlord /appointments error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/landlord/tickets/:ticketId/history
 * Returns status timeline for a ticket (ownership enforced)
 */
router.get('/tickets/:ticketId/history', requireAuth, permitRoles('Landlord'), async (req, res) => {
  try {
    const landlordId = req.user.userId;
    const ticketId = Number.parseInt(req.params.ticketId, 10);
    if (Number.isNaN(ticketId)) return res.status(400).json({ message: 'Invalid ticketId' });

    const owns = await landlordOwnsTicket(landlordId, ticketId);
    if (!owns) return res.status(403).json({ message: 'Not allowed to access this ticket' });

    // Try a flexible SELECT (works with common column names); returns [] if table missing
    let rows = [];
    try {
      const [hist] = await pool.execute(
        `
        SELECT
          COALESCE(h.HistoryID, h.ID)                            AS HistoryID,
          h.Status                                               AS Status,
          COALESCE(h.ChangedAt, h.UpdatedAt, h.CreatedAt, NOW()) AS ChangedAt,
          COALESCE(h.ChangedBy, h.UpdatedByUserID)               AS ChangedBy
        FROM tblticketstatushistory h
        WHERE h.TicketID = ?
        ORDER BY ChangedAt ASC;
        `,
        [ticketId]
      );
      rows = hist;
    } catch (_ignore) {
      rows = [];
    }

    return res.json({ success: true, data: { ticketId, timeline: rows } });
  } catch (err) {
    console.error('Landlord /tickets/:ticketId/history error:', err);
    return res.json({ success: true, data: { ticketId: Number(req.params.ticketId), timeline: [] } });
  }
});

/**
 * POST /api/landlord/quotes/:quoteId/approve
 * Marks a quote as Approved and records landlord approval (ownership enforced)
 */
router.post('/quotes/:quoteId/approve', requireAuth, permitRoles('Landlord'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const landlordId = req.user.userId;
    const quoteId = Number.parseInt(req.params.quoteId, 10);
    if (Number.isNaN(quoteId)) return res.status(400).json({ message: 'Invalid quoteId' });

    const owns = await landlordOwnsQuote(landlordId, quoteId);
    if (!owns) return res.status(403).json({ message: 'Not allowed to approve this quote' });

    await connection.beginTransaction();

    const [[qrow]] = await connection.execute(
      'SELECT TicketID FROM tblquotes WHERE QuoteID = ? LIMIT 1',
      [quoteId]
    );
    if (!qrow) {
      await connection.rollback();
      return res.status(404).json({ message: 'Quote not found' });
    }
    const ticketId = qrow.TicketID;

    await connection.execute(
      'UPDATE tblquotes SET QuoteStatus = ? WHERE QuoteID = ?',
      ['Approved', quoteId]
    );

    // Insert-or-update landlord approval
    try {
      await connection.execute(
        `INSERT INTO tbllandlordapprovals (QuoteID, LandlordUserID, ApprovalStatus, ApprovedAt)
         VALUES (?, ?, 'Approved', NOW())`,
        [quoteId, landlordId]
      );
    } catch {
      await connection.execute(
        `UPDATE tbllandlordapprovals
           SET ApprovalStatus = 'Approved', ApprovedAt = NOW()
         WHERE QuoteID = ? AND LandlordUserID = ?`,
        [quoteId, landlordId]
      );
    }

    // Best-effort: append ticket history
    try {
      await connection.execute(
        `INSERT INTO tblticketstatushistory (TicketID, Status, UpdatedByUserID, ChangedAt)
         VALUES (?, 'Approved', ?, NOW())`,
        [ticketId, landlordId]
      );
    } catch { /* ignore */ }

    await connection.commit();
    return res.json({ success: true, message: 'Quote approved successfully' });
  } catch (err) {
    try { await connection.rollback(); } catch { }
    console.error('Landlord approve quote error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    connection.release();
  }
});

/**
 * POST /api/landlord/quotes/:quoteId/reject
 * Marks a quote as Rejected and records landlord decision (ownership enforced)
 */
router.post('/quotes/:quoteId/reject', requireAuth, permitRoles('Landlord'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const landlordId = req.user.userId;
    const quoteId = Number.parseInt(req.params.quoteId, 10);
    if (Number.isNaN(quoteId)) return res.status(400).json({ message: 'Invalid quoteId' });

    const owns = await landlordOwnsQuote(landlordId, quoteId);
    if (!owns) return res.status(403).json({ message: 'Not allowed to reject this quote' });

    await connection.beginTransaction();

    const [[qrow]] = await connection.execute(
      'SELECT TicketID FROM tblquotes WHERE QuoteID = ? LIMIT 1',
      [quoteId]
    );
    if (!qrow) {
      await connection.rollback();
      return res.status(404).json({ message: 'Quote not found' });
    }
    const ticketId = qrow.TicketID;

    await connection.execute(
      'UPDATE tblquotes SET QuoteStatus = ? WHERE QuoteID = ?',
      ['Rejected', quoteId]
    );

    // Insert-or-update landlord decision
    try {
      await connection.execute(
        `INSERT INTO tbllandlordapprovals (QuoteID, LandlordUserID, ApprovalStatus, ApprovedAt)
         VALUES (?, ?, 'Rejected', NOW())`,
        [quoteId, landlordId]
      );
    } catch {
      await connection.execute(
        `UPDATE tbllandlordapprovals
           SET ApprovalStatus = 'Rejected', ApprovedAt = NOW()
         WHERE QuoteID = ? AND LandlordUserID = ?`,
        [quoteId, landlordId]
      );
    }

    // Best-effort: append ticket history
    try {
      await connection.execute(
        `INSERT INTO tblticketstatushistory (TicketID, Status, UpdatedByUserID, ChangedAt)
         VALUES (?, 'In Review', ?, NOW())`,
        [ticketId, landlordId]
      );
    } catch { /* ignore */ }

    await connection.commit();
    return res.json({ success: true, message: 'Quote rejected successfully' });
  } catch (err) {
    try { await connection.rollback(); } catch { }
    console.error('Landlord reject quote error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    connection.release();
  }
});


export default router;
