const express = require("express");
const router = express.Router();
const db = require("../db"); // adjust if necessary
const authMiddleware = require("../middleware/authMiddleware");

// GET /api/landlord/tickets
router.get("/tickets", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "landlord") {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const [tickets] = await db.query(
      "SELECT id AS TicketID, propertyAddress AS PropertyAddress, description AS Description, submittedAt AS SubmittedAt FROM tblTickets WHERE landlordId = ?",
      [req.user.userId]
    );

    res.json({ tickets });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
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

module.exports = router;
