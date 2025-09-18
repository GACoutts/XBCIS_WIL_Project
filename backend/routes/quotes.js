// backend/routes/quotes.js
import express from "express";
import multer from "multer";
import db from "../db.js";
import { requireAuth, permitRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// ------------------ Multer setup ------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // ensure this folder exists
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "_" + file.originalname);
  },
});
const upload = multer({ storage });

// ------------------ Routes ------------------

// Contractor submits a new quote
router.post(
  "/:ticketId",
  requireAuth,
  permitRoles("Contractor"),
  upload.array("files"),
  async (req, res) => {
    try {
      const { ticketId } = req.params;
      const { quoteAmount, quoteDescription } = req.body;
      const contractorId = req.user.userId;

      // Check ticket exists and status
      const [ticketRows] = await db.query(
        "SELECT CurrentStatus FROM tblTickets WHERE TicketID = ?",
        [ticketId]
      );
      if (!ticketRows.length) return res.status(404).json({ message: "Ticket not found" });
      if (ticketRows[0].CurrentStatus !== "In Review")
        return res.status(400).json({ message: "Ticket not in review stage" });

      // Insert quote
      const [result] = await db.query(
        "INSERT INTO tblQuotes (TicketID, ContractorUserID, QuoteAmount, QuoteDescription) VALUES (?, ?, ?, ?)",
        [ticketId, contractorId, quoteAmount, quoteDescription]
      );
      const quoteId = result.insertId;

      // Handle uploaded files
      if (req.files.length > 0) {
        const filesData = req.files.map((file) => [
          quoteId,
          file.mimetype.startsWith("image/") ? "Image" : "PDF",
          file.path,
        ]);
        await db.query(
          "INSERT INTO tblQuoteDocuments (QuoteID, DocumentType, DocumentURL) VALUES ?",
          [filesData]
        );
      }

      // Update ticket status to "Quoting"
      await db.query("UPDATE tblTickets SET CurrentStatus = 'Quoting' WHERE TicketID = ?", [ticketId]);

      // Add audit log
      await db.query(
        "INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID) VALUES (?, ?, ?)",
        [ticketId, "Quoting", contractorId]
      );

      res.json({ message: "Quote submitted successfully", quoteId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
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
