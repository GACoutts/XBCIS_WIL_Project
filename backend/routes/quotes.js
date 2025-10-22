// backend/routes/quotes.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import db from "../db.js";
import { requireAuth, permitRoles } from "../middleware/authMiddleware.js";
import { notifyUser } from "../utils/notify.js";

const router = express.Router();

const quotesDir = path.resolve("uploads/quotes");
fs.mkdirSync(quotesDir, { recursive: true });

// -------------------------------------------------------------------------------------
// Multer (PDF-only) for quote document uploads
// -------------------------------------------------------------------------------------
const pdfStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, "uploads/quotes"),
  filename: (_req, file, cb) => {
    const base = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/\s+/g, "_");
    const sanitizedBase = base.replace(/[^a-zA-Z0-9._-]/g, "");
    cb(null, Date.now() + "_" + sanitizedBase + ".pdf");
  },
});

const quotesUpload = multer({
  storage: pdfStorage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 }, // 10MB each, max 5 files
  fileFilter: (_req, file, cb) => {
    const isPdf = file.mimetype === "application/pdf";
    const hasPdfExt = path.extname(file.originalname).toLowerCase() === ".pdf";
    if (isPdf && hasPdfExt) return cb(null, true);
    return cb(new Error("Only .pdf files up to 10MB are allowed."));
  },
});

// -------------------------------------------------------------------------------------
// Contractor submits a new quote
//   - Allowed when ticket is in 'Quoting' OR already 'Awaiting Landlord Quote Approval'
//   - After first submission from 'Quoting', advance to 'Awaiting Landlord Quote Approval'
// -------------------------------------------------------------------------------------
router.post(
  "/:ticketId",
  requireAuth,
  permitRoles("Contractor"),
  quotesUpload.array("files"),
  async (req, res) => {
    try {
      const { ticketId } = req.params;
      const { quoteAmount, quoteDescription } = req.body;
      const amount = Number.parseFloat(quoteAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Quote amount must be a positive number"
        });
      }

      const contractorId = req.user.userId;
      const uploadedFiles = req.files || [];

      if (!quoteAmount || !quoteDescription) {
        return res
          .status(400)
          .json({ success: false, message: "Quote amount and description are required" });
      }

      // Fetch ticket & validate stage
      const [[ticketRow]] = await db.query(
        "SELECT CurrentStatus, AssignedContractorID FROM tblTickets WHERE TicketID = ? LIMIT 1",
        [ticketId]
      );
      if (!ticketRow) {
        return res.status(404).json({ success: false, message: "Ticket not found" });
      }

      const allowed = ["Quoting", "Awaiting Landlord Approval"];
      if (!allowed.includes(ticketRow.CurrentStatus)) {
        return res.status(400).json({
          success: false,
          message: "Ticket is not in a stage that allows new quotes",
        });
      }

      // Enforce that this contractor is the assigned contractor
      if (!ticketRow.AssignedContractorID || ticketRow.AssignedContractorID !== contractorId) {
        return res
          .status(403)
          .json({ success: false, message: "You are not the assigned contractor for this ticket" });
      }

      const shouldAdvance =
        ticketRow.CurrentStatus && ticketRow.CurrentStatus === "Quoting";

      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();

        // Create quote (Pending)
        const [result] = await connection.query(
          `INSERT INTO tblQuotes
             (TicketID, ContractorUserID, QuoteAmount, QuoteDescription, QuoteStatus, SubmittedAt)
           VALUES (?, ?, ?, ?, 'Pending', NOW())`,
          [ticketId, contractorId, amount, quoteDescription]
        );
        const quoteId = result.insertId;

        // Attach documents (optional)
        if (uploadedFiles.length > 0) {
          const filesData = uploadedFiles.map((file) => {
            const webPath = `/uploads/quotes/${path.basename(file.path)}`;
            return [quoteId, "PDF", webPath];
          });
          await connection.query(
            "INSERT INTO tblQuoteDocuments (QuoteID, DocumentType, DocumentURL) VALUES ?",
            [filesData]
          );
        }

        // Advance ticket to landlord review (only when previously in 'Quoting')
        if (shouldAdvance) {
          await connection.query(
            "UPDATE tblTickets SET CurrentStatus = 'Awaiting Landlord Approval' WHERE TicketID = ?",
            [ticketId]
          );
          await connection.query(
            "INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID) VALUES (?, 'Awaiting Landlord Approval', ?)",
            [ticketId, contractorId]
          );
        } else {
          // Ticket was already in landlord review; optionally log a safe status
          await connection.query(
            "INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID) VALUES (?, 'Awaiting Landlord Approval', ?)",
            [ticketId, contractorId]
          );
        }

        await connection.commit();

        // Notify landlord(s) for quote review
        try {
          const [[ctx]] = await db.query(
            `
            SELECT t.TicketRefNumber, t.PropertyID
              FROM tblTickets t
             WHERE t.TicketID = ? LIMIT 1
          `,
            [ticketId]
          );

          if (ctx) {
            const [landlords] = await db.query(
              `SELECT LandlordUserID
                 FROM tblLandlordProperties
                WHERE PropertyID = ?
                  AND (ActiveTo IS NULL OR ActiveTo >= CURDATE())`,
              [ctx.PropertyID]
            );

            await Promise.allSettled(
              landlords.map((l) =>
                notifyUser({
                  userId: l.LandlordUserID,
                  ticketId,
                  template: "quote_submitted",
                  params: { ticketRef: ctx.TicketRefNumber, quoteId },
                  eventKey: `quote_submitted:${ticketId}:${quoteId}`,
                  fallbackToEmail: true,
                })
              )
            );
          }
        } catch (e) {
          console.error("[quotes/submit] notify landlord error:", e);
        }

        res.json({
          success: true,
          message: "Quote submitted successfully",
          data: { quoteId },
        });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (err) {
      console.error("Quote submission error:", err);
      if (err instanceof multer.MulterError) {
        return res
          .status(400)
          .json({ success: false, message: err.message, code: "FILE_UPLOAD_ERROR" });
      }
      if (err.message?.includes("Only .pdf files")) {
        return res
          .status(400)
          .json({ success: false, message: err.message, code: "INVALID_FILE_TYPE" });
      }
      res.status(500).json({
        success: false,
        message: "Server error",
        error: process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    }
  }
);

// -------------------------------------------------------------------------------------
// Landlord approves a quote
//   - Reject other quotes for this ticket
//   - Set approved to 'Approved'
//   - Ticket -> 'Approved' AND set AssignedContractorID to the quote's contractor
//   - Add history & notifications
// -------------------------------------------------------------------------------------
router.post("/:quoteId/approve", requireAuth, permitRoles("Landlord"), async (req, res) => {
  try {
    const { quoteId } = req.params;
    const landlordId = req.user.userId;

    const [[quoteRow]] = await db.query(
      `SELECT TicketID, ContractorUserID FROM tblQuotes WHERE QuoteID = ? LIMIT 1`,
      [quoteId]
    );
    if (!quoteRow) return res.status(404).json({ message: "Quote not found" });

    // Ensure this landlord is tied to the ticket's property
    const [[auth]] = await db.query(
      `
  SELECT 1
    FROM tblLandlordProperties lp
    JOIN tblTickets t  ON t.PropertyID = lp.PropertyID
    JOIN tblQuotes  q  ON q.TicketID = t.TicketID
   WHERE q.QuoteID = ?
     AND lp.LandlordUserID = ?
     AND (lp.ActiveTo IS NULL OR lp.ActiveTo >= CURDATE())
   LIMIT 1
  `,
      [quoteId, landlordId]
    );

    if (!auth) {
      return res.status(403).json({
        message:
          "You are not authorized to approve quotes for this ticket. (No active landlord link to this property.)",
      });
    }


    const ticketId = quoteRow.TicketID;
    const contractorId = quoteRow.ContractorUserID;

    const [[alreadyApproved]] = await db.query(
      `SELECT QuoteID FROM tblQuotes WHERE TicketID = ? AND QuoteStatus = 'Approved' LIMIT 1`,
      [ticketId]
    );
    if (alreadyApproved && alreadyApproved.QuoteID !== parseInt(quoteId, 10)) {
      return res
        .status(400)
        .json({ message: "Another quote has already been approved for this ticket" });
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Reject all other quotes for this ticket
      await connection.query(
        `UPDATE tblQuotes 
      SET QuoteStatus = 'Rejected'
    WHERE TicketID = ?
      AND QuoteID <> ?`,
        [ticketId, quoteId]
      );

      // Approve selected quote
      await connection.query(
        `UPDATE tblQuotes SET QuoteStatus = 'Approved' WHERE QuoteID = ?`,
        [quoteId]
      );

      try {
        await connection.query(
          `INSERT INTO tblLandlordApprovals (QuoteID, LandlordUserID, ApprovalStatus, ApprovedAt)
   VALUES (?, ?, 'Approved', NOW())
   ON DUPLICATE KEY UPDATE ApprovalStatus='Approved', ApprovedAt=NOW()`,
          [quoteId, landlordId]
        );

      } catch (apprErr) {
        // Log and continue; this table varies across installs
        console.error('[quotes/approve] landlord approvals write skipped:', apprErr?.message || apprErr);
      }

      // Continue with ticket updates
      await connection.query(
        `UPDATE tblTickets
     SET CurrentStatus = 'Approved',
         AssignedContractorID = ?
   WHERE TicketID = ?`,
        [contractorId, ticketId]
      );

      await connection.query(
        "INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID) VALUES (?, 'Approved', ?)",
        [ticketId, landlordId]
      );


      await connection.commit();

    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }

    // Notifications
    try {
      const [[ctx]] = await db.query(
        `
        SELECT q.QuoteID, q.ContractorUserID, t.TicketID, t.TicketRefNumber, t.ClientUserID
          FROM tblQuotes q
          JOIN tblTickets t ON t.TicketID = q.TicketID
         WHERE q.QuoteID = ? LIMIT 1
      `,
        [quoteId]
      );

      if (ctx) {
        const status = "Approved";
        const eventKey = `quote_status:${ctx.QuoteID}:${status}`;

        await notifyUser({
          userId: ctx.ContractorUserID,
          ticketId: ctx.TicketID,
          template: "quote_status",
          params: { quoteId, ticketRef: ctx.TicketRefNumber, status },
          eventKey,
          fallbackToEmail: true,
        });

        await notifyUser({
          userId: landlordId,
          ticketId: ctx.TicketID,
          template: "quote_status",
          params: { quoteId, ticketRef: ctx.TicketRefNumber, status },
          eventKey,
          fallbackToEmail: true,
        });

        await notifyUser({
          userId: ctx.ClientUserID,
          ticketId: ctx.TicketID,
          template: "quote_status",
          params: { quoteId, ticketRef: ctx.TicketRefNumber, status },
          eventKey,
          fallbackToEmail: true,
        });
      }
    } catch (e) {
      console.error("[quotes/approve] notify error:", e);
    }

    res.json({ message: "Quote approved" });
  } catch (err) {
    console.error('[quotes/approve] error:', err);
    return res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? (err.sqlMessage || err.message) : undefined
    });
  }
});


// -------------------------------------------------------------------------------------
// Landlord rejects a quote
// -------------------------------------------------------------------------------------
router.post("/:quoteId/reject", requireAuth, permitRoles("Landlord"), async (req, res) => {
  try {
    const { quoteId } = req.params;

    // Ensure this landlord is tied to the ticket's property
    const [[auth]] = await db.query(
      `
  SELECT 1
    FROM tblLandlordProperties lp
    JOIN tblTickets t  ON t.PropertyID = lp.PropertyID
    JOIN tblQuotes  q  ON q.TicketID = t.TicketID
   WHERE q.QuoteID = ?
     AND lp.LandlordUserID = ?
     AND (lp.ActiveTo IS NULL OR lp.ActiveTo >= CURDATE())
   LIMIT 1
  `,
      [quoteId, landlordId]
    );

    if (!auth) {
      return res.status(403).json({
        message:
          "You are not authorized to reject quotes for this ticket. (No active landlord link to this property.)",
      });
    }


    const landlordId = req.user.userId;

    await db.query("UPDATE tblQuotes SET QuoteStatus = 'Rejected' WHERE QuoteID = ?", [quoteId]);

    try {
      await db.query(
        `INSERT INTO tblLandlordApprovals (QuoteID, LandlordUserID, ApprovalStatus)
     VALUES (?, ?, 'Rejected')
     ON DUPLICATE KEY UPDATE ApprovalStatus='Rejected'`,
        [quoteId, landlordId]
      );
    } catch (apprErr) {
      console.error('[quotes/reject] landlord approvals write skipped:', apprErr?.sqlMessage || apprErr?.message || apprErr);
    }

    try {
      const [[ctx]] = await db.query(
        `
        SELECT q.QuoteID, q.ContractorUserID, t.TicketID, t.TicketRefNumber, t.ClientUserID
          FROM tblQuotes q
          JOIN tblTickets t ON t.TicketID = q.TicketID
         WHERE q.QuoteID = ? LIMIT 1
      `,
        [quoteId]
      );

      if (ctx) {
        const status = "Rejected";
        const eventKey = `quote_status:${ctx.QuoteID}:${status}`;
        const ticketId = ctx.TicketID;

        await db.query(
          "INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID) VALUES (?, 'Rejected', ?)",
          [ticketId, landlordId]
        );

        await notifyUser({
          userId: ctx.ContractorUserID,
          ticketId: ctx.TicketID,
          template: "quote_status",
          params: { quoteId, ticketRef: ctx.TicketRefNumber, status },
          eventKey,
          fallbackToEmail: true,
        });

        await notifyUser({
          userId: landlordId,
          ticketId: ctx.TicketID,
          template: "quote_status",
          params: { quoteId, ticketRef: ctx.TicketRefNumber, status },
          eventKey,
          fallbackToEmail: true,
        });

        await notifyUser({
          userId: ctx.ClientUserID,
          ticketId: ctx.TicketID,
          template: "quote_status",
          params: { quoteId, ticketRef: ctx.TicketRefNumber, status },
          eventKey,
          fallbackToEmail: true,
        });
      }
    } catch (e) {
      console.error("[quotes/reject] notify error:", e);
    }

    res.json({ message: "Quote rejected" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------------------------------------------------------------------------------------
// Staff view of quotes for a ticket
// -------------------------------------------------------------------------------------
router.get("/ticket/:ticketId", requireAuth, permitRoles("Staff"), async (req, res) => {
  try {
    const { ticketId } = req.params;

    const [quotes] = await db.query(
      `SELECT q.QuoteID, q.QuoteAmount, q.QuoteDescription, q.QuoteStatus, q.SubmittedAt,
              u.FullName as ContractorName,
              GROUP_CONCAT(d.DocumentURL) as Documents
         FROM tblQuotes q
         JOIN tblusers u ON q.ContractorUserID = u.UserID
         LEFT JOIN tblQuoteDocuments d ON q.QuoteID = d.QuoteID
        WHERE q.TicketID = ?
        GROUP BY q.QuoteID`,
      [ticketId]
    );

    res.json(quotes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------------------------------------------------------------------------------------
// Landlord view (absolute URLs for documents)
// -------------------------------------------------------------------------------------
router.get("/ticket/:ticketId/landlord", requireAuth, permitRoles("Landlord"), async (req, res) => {
  try {
    const { ticketId } = req.params;
    const landlordId = req.user.userId;

    const [ticketRows] = await db.query(
      
      "SELECT TicketID FROM tblTickets WHERE TicketID = ? LIMIT 1",
      [ticketId]
    );
    if (!ticketRows.length) return res.status(404).json({ message: "Ticket not found" });

    
    const [[viewAuth]] = await db.query(
      `
  SELECT 1
    FROM tblLandlordProperties lp
    JOIN tblTickets t ON t.PropertyID = lp.PropertyID
   WHERE t.TicketID = ?
     AND lp.LandlordUserID = ?
     AND (lp.ActiveTo IS NULL OR lp.ActiveTo >= CURDATE())
   LIMIT 1
  `,
      [ticketId, landlordId]
    );

    if (!viewAuth) {
      return res.status(403).json({ message: "Forbidden: not a landlord on this property." });
    }


    const [quotes] = await db.query(
      `SELECT q.QuoteID, q.QuoteAmount, q.QuoteDescription, q.QuoteStatus, q.SubmittedAt,
              u.FullName as ContractorName,
              GROUP_CONCAT(d.DocumentURL) as Documents
         FROM tblQuotes q
         JOIN tblusers u ON q.ContractorUserID = u.UserID
         LEFT JOIN tblQuoteDocuments d ON q.QuoteID = d.QuoteID
        WHERE q.TicketID = ?
        GROUP BY q.QuoteID
        ORDER BY q.SubmittedAt DESC`,
      [ticketId]
    );

    const host = `${req.protocol}://${req.get("host")}`;
    const normalized = quotes.map((q) => {
      const docs = q.Documents ? q.Documents.split(",").map((x) => x.trim()) : [];
      const absoluteDocs = docs.map((d) =>
        d.startsWith("http") ? d : `${host}${d.startsWith("/") ? "" : "/"}${d}`
      );
      return { ...q, Documents: absoluteDocs };
    });

    res.json(normalized);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
