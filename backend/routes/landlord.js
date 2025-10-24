// backend/routes/landlord.js  (ESM)
import express from 'express';
import multer from 'multer';
import path from 'path';
import pool from '../db.js';
import { requireAuth, permitRoles } from '../middleware/authMiddleware.js';
import fs from 'fs';

const router = express.Router();

const proofsDir = path.join('uploads', 'property-proofs');
fs.mkdirSync(proofsDir, { recursive: true });

// -------------------------------------------------------------------------------------
// Multer for property proofs (PDF + images)
// -------------------------------------------------------------------------------------
const propertyProofStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, proofsDir),
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]+/g, '_');
    cb(null, `${timestamp}_${base}${ext}`);
  }
});
const propertyProofUpload = multer({
  storage: propertyProofStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype.toLowerCase())) return cb(null, true);
    return cb(new Error('Only PDF and image files are allowed for property proofs'));
  }
});

// -------------------------------------------------------------------------------------
// Tickets list for landlord (with filters/pagination)
// Shows per-landlord quote-approval status when quotes exist,
// and ALSO allows ticket-level actions when there are ZERO quotes.
// -------------------------------------------------------------------------------------
router.get('/tickets', requireAuth, permitRoles('Landlord'), async (req, res) => {
  try {
    const landlordId = req.user.userId;
    const { status, dateFrom, dateTo, limit = '50', offset = '0', propertyId } = req.query;

    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);

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

    if (status)   { where.push('t.CurrentStatus = ?'); whereParams.push(status); }
    if (dateFrom) { where.push('t.CreatedAt   >= ?');  whereParams.push(dateFrom); }
    if (dateTo)   { where.push('t.CreatedAt   <= ?');  whereParams.push(dateTo); }
    if (propertyId) { where.push('t.PropertyID = ?');  whereParams.push(propertyId); }

    const whereClause = where.join(' AND ');

    const countSql = `
      SELECT COUNT(*) AS total
        FROM tblTickets t
       WHERE ${whereClause};
    `;
    const [[countRow]] = await pool.execute(countSql, whereParams);
    const totalCount = countRow?.total || 0;

    const ticketsSql = `
      SELECT 
        t.TicketID,
        t.TicketRefNumber,
        t.Title,
        t.Description,
        t.UrgencyLevel,
        t.CreatedAt,
        t.CurrentStatus,
        t.PropertyID,

        p.AddressLine1 AS PropertyAddressLine1,
        p.AddressLine2 AS PropertyAddressLine2,
        p.City         AS PropertyCity,
        p.Province     AS PropertyProvince,
        p.PostalCode   AS PropertyPostalCode,

        client.FullName AS ClientName,
        client.Email    AS ClientEmail,
        client.Phone    AS ClientPhone,

        q.QuoteID,
        q.QuoteAmount,
        q.QuoteStatus,
        q.SubmittedAt as QuoteSubmittedAt,

        contractor.FullName as ContractorName,
        contractor.Email    as ContractorEmail,

        cs.ScheduleID,
        cs.ProposedDate as AppointmentDate,
        cs.ClientConfirmed as AppointmentConfirmed,

        -- Per-landlord approval state on the selected (latest/approved-first) quote
        la.ApprovalStatus as LandlordApprovalStatus,
        la.ApprovedAt     as LandlordApprovedAt,

        -- How many quotes exist for the ticket?
        (SELECT COUNT(*) FROM tblQuotes qq WHERE qq.TicketID = t.TicketID) AS TotalQuotes,

        /* === Flags for UI (scoped to THIS landlord), separated cleanly === */

        -- 1) Ticket-level approval: only when there are NO quotes
        (
          (t.CurrentStatus IN ('Awaiting Landlord Approval','In Review'))
          AND NOT EXISTS (SELECT 1 FROM tblQuotes q0 WHERE q0.TicketID = t.TicketID)
        ) AS TicketNeedsLandlordApproval,

        -- 2) Quote-level approval: there ARE quotes, and this landlord has a pending approval on any quote
        (
          (t.CurrentStatus IN ('Awaiting Landlord Approval','In Review'))
          AND EXISTS (
              SELECT 1
              FROM tblQuotes qx
              LEFT JOIN tblLandlordApprovals lax
                ON lax.QuoteID = qx.QuoteID
               AND lax.LandlordUserID = ?
              WHERE qx.TicketID = t.TicketID
                AND (lax.ApprovalStatus IS NULL OR lax.ApprovalStatus = 'Pending')
          )
          AND EXISTS (SELECT 1 FROM tblQuotes qhas WHERE qhas.TicketID = t.TicketID)
        ) AS QuoteNeedsLandlordApproval,

        -- 3) Overall act flag: either of the above
        (
          (
            (t.CurrentStatus IN ('Awaiting Landlord Approval','In Review'))
            AND NOT EXISTS (SELECT 1 FROM tblQuotes q0 WHERE q0.TicketID = t.TicketID)
          )
          OR
          (
            (t.CurrentStatus IN ('Awaiting Landlord Approval','In Review'))
            AND EXISTS (
                SELECT 1
                FROM tblQuotes qx2
                LEFT JOIN tblLandlordApprovals lax2
                  ON lax2.QuoteID = qx2.QuoteID
                 AND lax2.LandlordUserID = ?
                WHERE qx2.TicketID = t.TicketID
                  AND (lax2.ApprovalStatus IS NULL OR lax2.ApprovalStatus = 'Pending')
            )
            AND EXISTS (SELECT 1 FROM tblQuotes qhas2 WHERE qhas2.TicketID = t.TicketID)
          )
        ) AS CanLandlordAct

      FROM tblTickets t
      LEFT JOIN tblProperties p ON p.PropertyID = t.PropertyID
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

      LEFT JOIN tblLandlordApprovals la
        ON la.QuoteID = q.QuoteID
       AND la.LandlordUserID = ?

      WHERE ${whereClause}
      ORDER BY t.CreatedAt DESC
      LIMIT ${limitNum} OFFSET ${offsetNum}
    `;

    // params: 2 (flags) + 1 (join) + WHERE params
    const [rows] = await pool.execute(ticketsSql, [landlordId, landlordId, landlordId, ...whereParams]);

    const tickets = rows.map(r => ({
      ticketId: r.TicketID,
      referenceNumber: r.TicketRefNumber,
      title: r.Title || null,
      description: r.Description,
      urgencyLevel: r.UrgencyLevel,
      status: r.CurrentStatus,
      createdAt: r.CreatedAt,
      propertyId: r.PropertyID,
      propertyAddress: [
        r.PropertyAddressLine1,
        r.PropertyAddressLine2,
        r.PropertyCity,
        r.PropertyProvince,
        r.PropertyPostalCode
      ].filter(v => v && v.toString().trim()).join(', '),

      client: { name: r.ClientName, email: r.ClientEmail, phone: r.ClientPhone },

      quote: r.QuoteID ? {
        id: r.QuoteID,
        amount: Number.parseFloat(r.QuoteAmount || 0),
        status: r.QuoteStatus,
        submittedAt: r.QuoteSubmittedAt,
        contractor: { name: r.ContractorName, email: r.ContractorEmail },
        landlordApproval: { status: r.LandlordApprovalStatus, approvedAt: r.LandlordApprovedAt }
      } : null,

      nextAppointment: r.ScheduleID ? {
        id: r.ScheduleID,
        scheduledDate: r.AppointmentDate,
        clientConfirmed: r.AppointmentConfirmed
      } : null,

      totalQuotes: Number(r.TotalQuotes || 0),
      ticketNeedsLandlordApproval: !!r.TicketNeedsLandlordApproval,
      quoteNeedsLandlordApproval: !!r.QuoteNeedsLandlordApproval,
      canLandlordAct: !!r.CanLandlordAct
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

// -------------------------------------------------------------------------------------
// Ownership helpers
// -------------------------------------------------------------------------------------
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

async function landlordOwnsQuote(landlordId, quoteId) {
  const [rows] = await pool.execute(
    `
    SELECT 1
      FROM tblQuotes q
      JOIN tblTickets t ON t.TicketID = q.TicketID
      JOIN tblLandlordProperties lp
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

// -------------------------------------------------------------------------------------
// Quotes list for a ticket
// -------------------------------------------------------------------------------------
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
        q.QuoteStatus AS QuoteStatus,
        q.SubmittedAt
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

// -------------------------------------------------------------------------------------
// Quote media for a specific quote (uses tblQuoteDocuments; PDF/DOCX both fine)
// -------------------------------------------------------------------------------------
router.get("/quotes/:quoteId/media", requireAuth, permitRoles("Landlord", "Staff"), async (req, res) => {
  try {
    const quoteId = Number.parseInt(req.params.quoteId, 10);
    if (!Number.isInteger(quoteId)) {
      return res.status(400).json({ success: false, message: "Invalid quoteId" });
    }

    // If landlord, ensure they belong to this ticket's property
    if (req.user?.role === "Landlord") {
      const [[owns]] = await pool.execute(
        `
          SELECT 1
            FROM tblQuotes q
            JOIN tblTickets t ON t.TicketID = q.TicketID
            JOIN tblLandlordProperties lp
              ON lp.PropertyID = t.PropertyID
             AND lp.LandlordUserID = ?
             AND (lp.ActiveTo IS NULL OR lp.ActiveTo >= CURDATE())
           WHERE q.QuoteID = ?
           LIMIT 1
        `,
        [req.user.userId, quoteId]
      );
      if (!owns) {
        return res.status(403).json({ success: false, message: "Not allowed to access this quote" });
      }
    }

    // Use only columns that definitely exist; order by newest id first
    const [rows] = await pool.execute(
      `
        SELECT
          d.DocumentID,
          d.QuoteID,
          d.DocumentURL,
          d.DocumentType
        FROM tblQuoteDocuments d
        WHERE d.QuoteID = ?
        ORDER BY d.DocumentID DESC
      `,
      [quoteId]
    );

    const host = `${req.protocol}://${req.get("host")}`;
    const data = rows.map((r) => {
      const url = r.DocumentURL || "";
      const absolute = url.startsWith("http")
        ? url
        : `${host}${url.startsWith("/") ? "" : "/"}${url}`;
      return {
        MediaID: r.DocumentID,
        QuoteID: r.QuoteID,
        MediaURL: absolute,
        OriginalName: null,
        MimeType: r.DocumentType || null,
        UploadedAt: null,
      };
    });

    return res.json({ success: true, data });
  } catch (err) {
    console.error("[BE] Landlord /quotes/:quoteId/media error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// -------------------------------------------------------------------------------------
// Appointments list for a ticket
// -------------------------------------------------------------------------------------
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
        a.ClientConfirmed AS ClientConfirmed
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

// -------------------------------------------------------------------------------------
// Ticket history (schema-safe)
// -------------------------------------------------------------------------------------
router.get('/tickets/:ticketId/history', requireAuth, permitRoles('Landlord'), async (req, res) => {
  try {
    const landlordId = req.user.userId;
    const ticketId = Number.parseInt(req.params.ticketId, 10);
    if (Number.isNaN(ticketId)) return res.status(400).json({ message: 'Invalid ticketId' });

    const owns = await landlordOwnsTicket(landlordId, ticketId);
    if (!owns) return res.status(403).json({ message: 'Not allowed to access this ticket' });

    let rows = [];
    try {
      const [hist] = await pool.execute(
        `
        SELECT
          h.Status                       AS Status,
          COALESCE(h.UpdatedAt, NOW())   AS ChangedAt,
          COALESCE(h.UpdatedByUserID, 0) AS ChangedBy
          FROM tblTicketStatusHistory h
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

// -------------------------------------------------------------------------------------
// TICKET APPROVE (works with OR without quotes)
// -------------------------------------------------------------------------------------
router.post('/tickets/:ticketId/approve', requireAuth, permitRoles('Landlord'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const landlordId = req.user.userId;
    const ticketId = Number.parseInt(req.params.ticketId, 10);
    const bodyQuoteId = req.body?.quoteId ? Number.parseInt(req.body.quoteId, 10) : null;
    if (Number.isNaN(ticketId)) return res.status(400).json({ message: 'Invalid ticketId' });

    const owns = await landlordOwnsTicket(landlordId, ticketId);
    if (!owns) return res.status(403).json({ message: 'Not allowed to approve this ticket' });

    await connection.beginTransaction();

    // Resolve quoteId if provided / available
    let quoteId = bodyQuoteId;
    if (!quoteId) {
      const [[latest]] = await connection.execute(
        `SELECT QuoteID
           FROM tblQuotes
          WHERE TicketID = ?
          ORDER BY
            CASE WHEN QuoteStatus = 'Approved' THEN 1
                 WHEN QuoteStatus = 'Pending' THEN 2
                 ELSE 3 END,
            SubmittedAt DESC
          LIMIT 1`,
        [ticketId]
      );
      if (latest) quoteId = latest.QuoteID;
    }

    if (quoteId) {
      // Upsert per-landlord approval row
      const [[existing]] = await connection.execute(
        `SELECT ApprovalID
           FROM tblLandlordApprovals
          WHERE QuoteID = ? AND LandlordUserID = ?
          LIMIT 1`,
        [quoteId, landlordId]
      );
      if (existing) {
        await connection.execute(
          `UPDATE tblLandlordApprovals
              SET ApprovalStatus = 'Approved',
                  ApprovedAt     = NOW()
            WHERE ApprovalID = ?`,
          [existing.ApprovalID]
        );
      } else {
        await connection.execute(
          `INSERT INTO tblLandlordApprovals (QuoteID, LandlordUserID, ApprovalStatus, ApprovedAt)
           VALUES (?, ?, 'Approved', NOW())`,
          [quoteId, landlordId]
        );
      }
    }

    await connection.execute(
      `UPDATE tblTickets SET CurrentStatus = 'Awaiting Staff Assignment' WHERE TicketID = ?`,
      [ticketId]
    );

    try {
      await connection.execute(
        `INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID)
         VALUES (?, 'Awaiting Staff Assignment', ?)`,
        [ticketId, landlordId]
      );
    } catch (_err) {}

    await connection.commit();
    return res.json({ success: true, message: 'Ticket approved successfully', data: { quoteId: quoteId || null } });
  } catch (err) {
    try { await connection.rollback(); } catch {}
    console.error('Landlord approve ticket error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    connection.release();
  }
});

// -------------------------------------------------------------------------------------
// TICKET REJECT (works with OR without quotes)
// -------------------------------------------------------------------------------------
router.post('/tickets/:ticketId/reject', requireAuth, permitRoles('Landlord'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const landlordId = req.user.userId;
    const ticketId = Number.parseInt(req.params.ticketId, 10);
    const bodyQuoteId = req.body?.quoteId ? Number.parseInt(req.body.quoteId, 10) : null;
    if (Number.isNaN(ticketId)) return res.status(400).json({ message: 'Invalid ticketId' });

    const owns = await landlordOwnsTicket(landlordId, ticketId);
    if (!owns) return res.status(403).json({ message: 'Not allowed to reject this ticket' });

    await connection.beginTransaction();

    // Resolve quoteId if provided / available
    let quoteId = bodyQuoteId;
    if (!quoteId) {
      const [[latest]] = await connection.execute(
        `SELECT QuoteID
           FROM tblQuotes
          WHERE TicketID = ?
          ORDER BY
            CASE WHEN QuoteStatus = 'Approved' THEN 1
                 WHEN QuoteStatus = 'Pending' THEN 2
                 ELSE 3 END,
            SubmittedAt DESC
          LIMIT 1`,
        [ticketId]
      );
      if (latest) quoteId = latest.QuoteID;
    }

    if (quoteId) {
      const [[existing]] = await connection.execute(
        `SELECT ApprovalID
           FROM tblLandlordApprovals
          WHERE QuoteID = ? AND LandlordUserID = ?
          LIMIT 1`,
        [quoteId, landlordId]
      );
      if (existing) {
        await connection.execute(
          `UPDATE tblLandlordApprovals
              SET ApprovalStatus = 'Rejected',
                  ApprovedAt     = NOW()
            WHERE ApprovalID = ?`,
          [existing.ApprovalID]
        );
      } else {
        await connection.execute(
          `INSERT INTO tblLandlordApprovals (QuoteID, LandlordUserID, ApprovalStatus, ApprovedAt)
           VALUES (?, ?, 'Rejected', NOW())`,
          [quoteId, landlordId]
        );
      }
    }

    await connection.execute(
      `UPDATE tblTickets SET CurrentStatus = 'Rejected' WHERE TicketID = ?`,
      [ticketId]
    );

    try {
      await connection.execute(
        `INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID)
         VALUES (?, 'Rejected', ?)`,
        [ticketId, landlordId]
      );
    } catch {}

    await connection.commit();
    return res.json({ success: true, message: 'Ticket rejected successfully', data: { quoteId: quoteId || null } });
  } catch (err) {
    try { await connection.rollback(); } catch {}
    console.error('Landlord reject ticket error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    connection.release();
  }
});

// -------------------------------------------------------------------------------------
// Properties (list + create)
// -------------------------------------------------------------------------------------
router.get('/properties', requireAuth, permitRoles('Landlord'), async (req, res) => {
  try {
    const landlordId = req.user.userId;
    const [rows] = await pool.execute(
      `SELECT
         p.PropertyID,
         p.AddressLine1,
         p.AddressLine2,
         p.City,
         p.Province,
         p.PostalCode,
         t.TenantUserID,
         tenant.FullName AS TenantName,
         tenant.Email    AS TenantEmail
        FROM tblLandlordProperties lp
        JOIN tblProperties p ON p.PropertyID = lp.PropertyID
   LEFT JOIN tblTenancies t ON t.PropertyID = p.PropertyID AND t.IsActive = 1
   LEFT JOIN tblusers tenant ON tenant.UserID = t.TenantUserID
       WHERE lp.LandlordUserID = ?
         AND (lp.ActiveTo IS NULL OR lp.ActiveTo >= CURDATE())
       ORDER BY p.PropertyID ASC`,
      [landlordId]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Landlord /properties error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/properties', requireAuth, permitRoles('Landlord'), propertyProofUpload.single('proof'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const landlordId = req.user.userId;
    const { addressLine1, addressLine2, city, province, postalCode } = req.body;
    const proof = req.file;
    if (!addressLine1 || !city || !province || !postalCode || !proof) {
      return res.status(400).json({ success: false, message: 'Address fields, province and proof are required' });
    }

    await connection.beginTransaction();

    const placeId = (req.body?.placeId || req.body?.PlaceId || null);
    const safePlaceId = placeId ? String(placeId).replace(/^places\//, '').slice(0, 64) : null;
    const latitude = req.body?.latitude != null && `${req.body.latitude}`.trim() !== '' ? Number(req.body.latitude) : null;
    const longitude = req.body?.longitude != null && `${req.body.longitude}`.trim() !== '' ? Number(req.body.longitude) : null;

    let propertyId = null;
    if (safePlaceId) {
      const [exists] = await connection.execute(
        `SELECT PropertyID FROM tblProperties WHERE PlaceId = ? LIMIT 1`,
        [safePlaceId]
      );
      if (exists.length) propertyId = exists[0].PropertyID;
    }

    if (!propertyId) {
      const [propRes] = await connection.execute(
        `INSERT INTO tblProperties
         (AddressLine1, AddressLine2, City, Province, PostalCode, PlaceId, Latitude, Longitude)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          addressLine1,
          addressLine2 || null,
          city,
          province,
          postalCode,
          safePlaceId,
          Number.isFinite(latitude) ? latitude : null,
          Number.isFinite(longitude) ? longitude : null,
        ]
      );
      propertyId = propRes.insertId;
    }

    await connection.execute(
      `INSERT INTO tblLandlordProperties (PropertyID, LandlordUserID, ActiveFrom, IsPrimary)
       VALUES (?, ?, CURDATE(), 1)`,
      [propertyId, landlordId]
    );

    const filePath = path.join('uploads', 'property-proofs', req.file.filename);
    await connection.execute(
      `INSERT INTO tblPropertyProofs (PropertyID, FilePath) VALUES (?, ?)`,
      [propertyId, filePath]
    );

    await connection.commit();
    return res.status(201).json({ success: true, data: { propertyId } });
  } catch (err) {
    try { await connection.rollback(); } catch {}
    console.error('Landlord /properties POST error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    connection.release();
  }
});

export default router;
