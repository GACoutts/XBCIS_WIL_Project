// backend/routes/quotes.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from 'fs';
import db from "../db.js";
import { requireAuth, permitRoles } from "../middleware/authMiddleware.js";
import { notifyUser } from "../utils/notify.js"; // <-- added

const router = express.Router();

// ensure uploads/quotes exists
const quotesDir = path.resolve('uploads/quotes');
fs.mkdirSync(quotesDir, { recursive: true });

// ------------------ PDF-only Multer setup ------------------
const pdfStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/quotes"); // PDF quotes directory
  },
  filename: (req, file, cb) => {
    const base = path.basename(file.originalname, path.extname(file.originalname)).replace(/\s+/g, '_');
    const sanitizedBase = base.replace(/[^a-zA-Z0-9._-]/g, '');
    cb(null, Date.now() + '_' + sanitizedBase + '.pdf');
  },
});

const quotesUpload = multer({
  storage: pdfStorage,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5 // Max 5 files per quote
  },
  fileFilter: (req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf';
    const hasPdfExt = path.extname(file.originalname).toLowerCase() === '.pdf';
    
    if (isPdf && hasPdfExt) {
      return cb(null, true);
    }
    return cb(new Error('Only .pdf files up to 10MB are allowed.'));
  },
});

// ------------------ Routes ------------------

// Contractor submits a new quote
router.post(
  "/:ticketId",
  requireAuth,
  permitRoles("Contractor"),
  quotesUpload.array("files"),
  async (req, res) => {
    try {
      const { ticketId } = req.params;
      const { quoteAmount, quoteDescription } = req.body;
      const contractorId = req.user.userId;
      const uploadedFiles = req.files || [];

      // Validate required fields
      if (!quoteAmount || !quoteDescription) {
        return res.status(400).json({ 
          success: false, 
          message: "Quote amount and description are required" 
        });
      }

      // Check ticket exists and status
      const [ticketRows] = await db.query(
        "SELECT CurrentStatus FROM tblTickets WHERE TicketID = ?",
        [ticketId]
      );
      if (!ticketRows.length) {
        return res.status(404).json({ 
          success: false, 
          message: "Ticket not found" 
        });
      }
      
      const allowedStatuses = ['In Review', 'Quoting', 'Awaiting Landlord Approval'];
      if (!allowedStatuses.includes(ticketRows[0].CurrentStatus)) {
        return res.status(400).json({
          success: false,
          message: 'Ticket is not in a stage that allows new quotes'
        });
      }

      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();

        // Insert quote
        const [result] = await connection.query(
          "INSERT INTO tblQuotes (TicketID, ContractorUserID, QuoteAmount, QuoteDescription) VALUES (?, ?, ?, ?)",
          [ticketId, contractorId, quoteAmount, quoteDescription]
        );
        const quoteId = result.insertId;

        // Handle uploaded PDF files
        const documents = [];
        if (uploadedFiles.length > 0) {
          const filesData = uploadedFiles.map((file) => {
            const webPath = `/uploads/quotes/${path.basename(file.path)}`;
            documents.push({
              filename: file.originalname,
              url: webPath,
              type: 'PDF'
            });
            return [
              quoteId,
              "PDF",
              webPath, // Store web-accessible path
            ];
          });
          
          await connection.query(
            "INSERT INTO tblQuoteDocuments (QuoteID, DocumentType, DocumentURL) VALUES ?",
            [filesData]
          );
        }

        // Update ticket status to "Quoting"
        await connection.query(
          "UPDATE tblTickets SET CurrentStatus = 'Quoting' WHERE TicketID = ?", 
          [ticketId]
        );

        // Add audit log
        await connection.query(
          "INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID) VALUES (?, ?, ?)",
          [ticketId, "Quoting", contractorId]
        );

        await connection.commit();

        res.json({ 
          success: true,
          message: "Quote submitted successfully", 
          data: {
            quoteId: quoteId,
            documents: documents
          }
        });
        
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

    } catch (err) {
      console.error('Quote submission error:', err);
      
      // Handle multer file upload errors
      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          success: false,
          message: err.message,
          code: 'FILE_UPLOAD_ERROR'
        });
      }
      
      // Handle file filter errors (PDF validation)
      if (err.message.includes('Only .pdf files')) {
        return res.status(400).json({
          success: false,
          message: err.message,
          code: 'INVALID_FILE_TYPE'
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: "Server error",
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  }
);

// Landlord approves a quote
router.post("/:quoteId/approve", requireAuth, permitRoles("Landlord"), async (req, res) => {
  try {
    const { quoteId } = req.params;
    const userId = req.user.userId;

    // Ensure only one quote can be approved per ticket
    // First find the ticket for this quote and check if another quote is already approved
    const [[ticketInfo]] = await db.query(
      `SELECT TicketID FROM tblQuotes WHERE QuoteID = ? LIMIT 1`,
      [quoteId]
    );
    if (!ticketInfo) {
      return res.status(404).json({ message: "Quote not found" });
    }
    const ticketId = ticketInfo.TicketID;
    const [[alreadyApproved]] = await db.query(
      `SELECT QuoteID FROM tblQuotes WHERE TicketID = ? AND QuoteStatus = 'Approved' LIMIT 1`,
      [ticketId]
    );
    if (alreadyApproved && alreadyApproved.QuoteID !== parseInt(quoteId, 10)) {
      return res.status(400).json({ message: "Another quote has already been approved for this ticket" });
    }
    // Reject all other quotes for this ticket
    await db.query(
      `UPDATE tblQuotes SET QuoteStatus = 'Rejected' WHERE TicketID = ? AND QuoteID <> ?`,
      [ticketId, quoteId]
    );
    // Approve the selected quote
    await db.query(
      "UPDATE tblQuotes SET QuoteStatus = 'Approved' WHERE QuoteID = ?",
      [quoteId]
    );

    // Log approval
    await db.query(
      "INSERT INTO tblLandlordApprovals (QuoteID, LandlordUserID, ApprovalStatus) VALUES (?, ?, 'Approved')",
      [quoteId, userId]
    );

    // Ticket status + history for UI timeline
    await db.query(
      "UPDATE tblTickets SET CurrentStatus = 'Approved' WHERE TicketID = ?",
      [ticketId]
    );
    await db.query(
      "INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID) VALUES (?, 'Quote Approved', ?)",
      [ticketId, userId]
    );

    // ---- Notify Contractor + Landlord -----------------------------------------
    try {
      const [[ctx]] = await db.query(`
        SELECT q.QuoteID, q.ContractorUserID, t.TicketID, t.TicketRefNumber
        FROM tblQuotes q
        JOIN tblTickets t ON t.TicketID = q.TicketID
        WHERE q.QuoteID = ? LIMIT 1
      `, [quoteId]);

      if (ctx) {
        const status = 'Approved';
        const eventKey = `quote_status:${ctx.QuoteID}:${status}`;

        // Contractor
        await notifyUser({
          userId: ctx.ContractorUserID,
          ticketId: ctx.TicketID,
          template: 'quote_status',
          params: { quoteId, ticketRef: ctx.TicketRefNumber, status },
          eventKey,
          fallbackToEmail: true
        });

        // Landlord (the approver)
        await notifyUser({
          userId,
          ticketId: ctx.TicketID,
          template: 'quote_status',
          params: { quoteId, ticketRef: ctx.TicketRefNumber, status },
          eventKey,
          fallbackToEmail: true
        });

        // Also notify the client who created the ticket
        // Fetch client user ID from ticket table
        const [[ticketRow]] = await db.query(
          `SELECT ClientUserID FROM tblTickets WHERE TicketID = ? LIMIT 1`,
          [ctx.TicketID]
        );
        if (ticketRow) {
          await notifyUser({
            userId: ticketRow.ClientUserID,
            ticketId: ctx.TicketID,
            template: 'quote_status',
            params: { quoteId, ticketRef: ctx.TicketRefNumber, status },
            eventKey,
            fallbackToEmail: true
          });
        }
      }
    } catch (e) {
      console.error('[quotes/approve] notify error:', e);
    }
    // ---------------------------------------------------------------------------

    res.json({ message: "Quote approved" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Landlord rejects a quote
router.post("/:quoteId/reject", requireAuth, permitRoles("Landlord"), async (req, res) => {
  try {
    const { quoteId } = req.params;
    const userId = req.user.userId;

    await db.query("UPDATE tblQuotes SET QuoteStatus = 'Rejected' WHERE QuoteID = ?", [quoteId]);

    await db.query(
      "INSERT INTO tblLandlordApprovals (QuoteID, LandlordUserID, ApprovalStatus) VALUES (?, ?, 'Rejected')",
      [quoteId, userId]
    );

    // ---- Notify Contractor + Landlord ----------------
    try {
      const [[ctx]] = await db.query(`
        SELECT q.QuoteID, q.ContractorUserID, t.TicketID, t.TicketRefNumber
        FROM tblQuotes q
        JOIN tblTickets t ON t.TicketID = q.TicketID
        WHERE q.QuoteID = ? LIMIT 1
      `, [quoteId]);

      if (ctx) {
        const status = 'Rejected';
        const eventKey = `quote_status:${ctx.QuoteID}:${status}`;
        const ticketId = ctx.TicketID;

        // History entry so the status timeline reflects rejection
        await db.query(
          "INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID) VALUES (?, 'Quote Rejected', ?)",
          [ticketId, userId]
        );

        // Contractor
        await notifyUser({
          userId: ctx.ContractorUserID,
          ticketId: ctx.TicketID,
          template: 'quote_status',
          params: { quoteId, ticketRef: ctx.TicketRefNumber, status },
          eventKey,
          fallbackToEmail: true
        });

        // Landlord (the rejector here)
        await notifyUser({
          userId,
          ticketId: ctx.TicketID,
          template: 'quote_status',
          params: { quoteId, ticketRef: ctx.TicketRefNumber, status },
          eventKey,
          fallbackToEmail: true
        });

        // Notify the client as well
        const [[ticketRow2]] = await db.query(
          `SELECT ClientUserID FROM tblTickets WHERE TicketID = ? LIMIT 1`,
          [ctx.TicketID]
        );
        if (ticketRow2) {
          await notifyUser({
            userId: ticketRow2.ClientUserID,
            ticketId: ctx.TicketID,
            template: 'quote_status',
            params: { quoteId, ticketRef: ctx.TicketRefNumber, status },
            eventKey,
            fallbackToEmail: true
          });
        }
      }
    } catch (e) {
      console.error('[quotes/reject] notify error:', e);
    }

    res.json({ message: "Quote rejected" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Staff view: all quotes for a ticket
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

// Landlord view: all quotes for a ticket
router.get("/ticket/:ticketId/landlord", requireAuth, permitRoles("Landlord"), async (req, res) => {
  try {
    const { ticketId } = req.params;

    const [ticketRows] = await db.query(
      "SELECT TicketID FROM tblTickets WHERE TicketID = ? LIMIT 1",
      [ticketId]
    );
    if (!ticketRows.length) return res.status(404).json({ message: "Ticket not found" });

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
      const absoluteDocs = docs.map((d) => (d.startsWith("http") ? d : `${host}${d.startsWith("/") ? "" : "/"}${d}`));
      return { ...q, Documents: absoluteDocs };
    });

    res.json(normalized);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
