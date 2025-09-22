// backend/routes/quotes.js
import express from "express";
import multer from "multer";
import path from "path";
import db from "../db.js";
import { requireAuth, permitRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

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
      if (ticketRows[0].CurrentStatus !== "In Review") {
        return res.status(400).json({ 
          success: false, 
          message: "Ticket not in review stage" 
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

    // Update quote status
    await db.query("UPDATE tblQuotes SET QuoteStatus = 'Approved' WHERE QuoteID = ?", [quoteId]);

    // Log approval
    await db.query(
      "INSERT INTO tblLandlordApprovals (QuoteID, LandlordUserID, ApprovalStatus) VALUES (?, ?, 'Approved')",
      [quoteId, userId]
    );

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
