import express from "express";
import db from "../db.js";
import multer from "multer";
import jwt from "jsonwebtoken";


const router = express.Router();

// Setup multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // make sure this folder exists
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "_" + file.originalname);
  }
});
const upload = multer({ storage });

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret"

function auth(req, res, next) {
  try {
    const token = req.cookies?.token || req.headers["authorization"]?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      userId: decoded.userId,
      role: decoded.role,
    };
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

router.use(auth);

// Upload a new quote for a ticket
router.post("/:ticketId", upload.array("files"), async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { quoteAmount, quoteDescription } = req.body;
    const contractorId = req.user.userId;

    // Validate ticket exists and status is correct
    const [ticketRows] = await db.query(
      "SELECT CurrentStatus FROM tblTickets WHERE TicketID = ?",
      [ticketId]
    );
    if (!ticketRows.length) return res.status(404).json({ message: "Ticket not found" });
    if (ticketRows[0].CurrentStatus !== "In Review")
      return res.status(400).json({ message: "Ticket not in review stage" });

    // Insert into tblQuotes
    const [result] = await db.query(
      "INSERT INTO tblQuotes (TicketID, ContractorUserID, QuoteAmount, QuoteDescription) VALUES (?, ?, ?, ?)",
      [ticketId, contractorId, quoteAmount, quoteDescription]
    );
    const quoteId = result.insertId;

    // Handle files if uploaded
    if (req.files.length > 0) {
      const filesData = req.files.map(file => [
        quoteId,
        file.mimetype.startsWith("image/") ? "Image" : "PDF",
        file.path
      ]);
      await db.query(
        "INSERT INTO tblQuoteDocuments (QuoteID, DocumentType, DocumentURL) VALUES ?",
        [filesData]
      );
    }

    // Update ticket status to "Quoting"
    await db.query("UPDATE tblTickets SET CurrentStatus = 'Quoting' WHERE TicketID = ?", [ticketId]);

    // Insert audit log
    await db.query(
      "INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID) VALUES (?, ?, ?)",
      [ticketId, "Quoting", contractorId]
    );

    res.json({ message: "Quote submitted successfully", quoteId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Approve a quote
router.post("/:quoteId/approve", async (req, res) => {
  try {
    const { quoteId } = req.params;
    const userId = req.user.userId;

    if (req.user.role !== "Landlord") return res.status(403).json({ message: "Unauthorized" });

    // Update quote status
    await db.query("UPDATE tblQuotes SET QuoteStatus = 'Approved' WHERE QuoteID = ?", [quoteId]);

    // Insert into landlord approvals
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

// Reject a quote
router.post("/:quoteId/reject", async (req, res) => {
  try {
    const { quoteId } = req.params;
    const userId = req.user.userId;

    if (req.user.role !== "Landlord") return res.status(403).json({ message: "Unauthorized" });

    // Update quote status
    await db.query("UPDATE tblQuotes SET QuoteStatus = 'Rejected' WHERE QuoteID = ?", [quoteId]);

    // Insert into landlord approvals
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

// Get all quotes for a ticket (Staff view)
router.get("/ticket/:ticketId", async (req, res) => {
  try {
    if (req.user.role !== "Staff") return res.status(403).json({ message: "Unauthorized" });

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

// Get all quotes for a ticket (Landlord view)
router.get("/ticket/:ticketId/landlord", async (req, res) => {
  try {
    if (req.user.role !== "Landlord") return res.status(403).json({ message: "Unauthorized" });

    const { ticketId } = req.params;

    // Basic check that the ticket exists
    const [ticketRows] = await db.query(
      "SELECT TicketID /*, LandlordUserID */ FROM tblTickets WHERE TicketID = ? LIMIT 1",
      [ticketId]
    );
    if (!ticketRows.length) return res.status(404).json({ message: "Ticket not found" });

    // TODO: If you track ownership, enforce it here:
    // if (ticketRows[0].LandlordUserID !== req.user.userId) return res.status(403).json({ message: "Forbidden" });

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

    // Normalize documents into arrays and make them absolute URLs
    const host = `${req.protocol}://${req.get('host')}`;
    const normalized = quotes.map(q => {
      const docs = q.Documents ? q.Documents.split(',').map(x => x.trim()) : [];
      const absoluteDocs = docs.map(d => d.startsWith('http') ? d : `${host}${d.startsWith('/') ? '' : '/'}${d}`);
      return { ...q, Documents: absoluteDocs };
    });

    res.json(normalized);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
