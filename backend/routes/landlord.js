// backend/routes/landlord.js
import express from "express";
import db from "../db.js";
import { permitRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * GET /api/landlord/tickets
 * List tickets for the logged-in landlord
 */
router.get("/tickets", permitRoles("Landlord"), async (req, res) => {
  try {
    const [tickets] = await db.query(
      "SELECT id AS TicketID, propertyAddress AS PropertyAddress, description AS Description, submittedAt AS SubmittedAt FROM tblTickets WHERE landlordId = ?",
      [req.user.userId]
    );

    res.json({ tickets });
  } catch (err) {
    console.error("Fetch tickets error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * GET /api/landlord/tickets/:ticketId/history
 * Timeline of status changes for a ticket
 */
router.get("/tickets/:ticketId/history", permitRoles("Landlord"), async (req, res) => {
  try {
    const { ticketId } = req.params;

    const [history] = await db.query(
      "SELECT id AS HistoryID, status AS Status, changedAt AS ChangedAt, changedBy AS ChangedBy FROM tblTicketStatusHistory WHERE ticketId = ? ORDER BY changedAt ASC",
      [ticketId]
    );

    res.json({ ticketId, timeline: history });
  } catch (err) {
    console.error("Fetch ticket history error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * GET /api/landlord/tickets/:ticketId/quotes
 * List all quotes for a ticket
 */
router.get("/tickets/:ticketId/quotes", permitRoles("Landlord"), async (req, res) => {
  try {
    const { ticketId } = req.params;

    const [quotes] = await db.query(
      `SELECT q.id AS QuoteID, q.contractorId AS ContractorID, q.amount AS QuoteAmount, q.status AS QuoteStatus, q.createdAt AS CreatedAt, q.filePath AS Documents
       FROM tblQuotes q
       JOIN tblTickets t ON q.ticketId = t.id
       WHERE q.ticketId = ? AND t.landlordId = ?`,
      [ticketId, req.user.userId]
    );

    res.json(quotes);
  } catch (err) {
    console.error("Fetch quotes error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * POST /api/landlord/quotes/:quoteId/approve
 */
router.post("/quotes/:quoteId/approve", permitRoles("Landlord"), async (req, res) => {
  try {
    const { quoteId } = req.params;

    const [quoteRows] = await db.query("SELECT TicketID FROM tblQuotes WHERE QuoteID = ?", [quoteId]);
    if (!quoteRows.length) return res.status(404).json({ message: "Quote not found" });

    const ticketId = quoteRows[0].TicketID;

    await db.query("UPDATE tblQuotes SET QuoteStatus = 'Approved' WHERE QuoteID = ?", [quoteId]);
    await db.query(
      "INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID) VALUES (?, ?, ?)",
      [ticketId, "Quote Approved", req.user.userId]
    );

    res.json({ message: "Quote approved successfully" });
  } catch (err) {
    console.error("Approve quote error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * POST /api/landlord/quotes/:quoteId/reject
 */
router.post("/quotes/:quoteId/reject", permitRoles("Landlord"), async (req, res) => {
  try {
    const { quoteId } = req.params;

    const [quoteRows] = await db.query("SELECT TicketID FROM tblQuotes WHERE QuoteID = ?", [quoteId]);
    if (!quoteRows.length) return res.status(404).json({ message: "Quote not found" });

    const ticketId = quoteRows[0].TicketID;

    await db.query("UPDATE tblQuotes SET QuoteStatus = 'Rejected' WHERE QuoteID = ?", [quoteId]);
    await db.query(
      "INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID) VALUES (?, ?, ?)",
      [ticketId, "Quote Rejected", req.user.userId]
    );

    res.json({ message: "Quote rejected successfully" });
  } catch (err) {
    console.error("Reject quote error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * GET /api/landlord/tickets/:ticketId/appointments
 * List all appointments for a ticket
 */
router.get("/tickets/:ticketId/appointments", permitRoles("Landlord"), async (req, res) => {
  try {
    const { ticketId } = req.params;

    const [appointments] = await db.query(
      "SELECT id AS AppointmentID, date AS Date, time AS Time, notes AS Notes, status AS Status FROM tblAppointments WHERE ticketId = ?",
      [ticketId]
    );

    res.json({ ticketId, appointments });
  } catch (err) {
    console.error("Fetch appointments error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * POST /api/landlord/appointments/:appointmentId/approve
 */
router.post("/appointments/:appointmentId/approve", permitRoles("Landlord"), async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const [apptRows] = await db.query("SELECT TicketID FROM tblAppointments WHERE AppointmentID = ?", [appointmentId]);
    if (!apptRows.length) return res.status(404).json({ message: "Appointment not found" });

    const ticketId = apptRows[0].TicketID;

    await db.query("UPDATE tblAppointments SET Status = 'Approved' WHERE AppointmentID = ?", [appointmentId]);
    await db.query(
      "INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID) VALUES (?, ?, ?)",
      [ticketId, "Appointment Approved", req.user.userId]
    );

    res.json({ message: "Appointment approved successfully" });
  } catch (err) {
    console.error("Approve appointment error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * POST /api/landlord/appointments/:appointmentId/reject
 */
router.post("/appointments/:appointmentId/reject", permitRoles("Landlord"), async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const [apptRows] = await db.query("SELECT TicketID FROM tblAppointments WHERE AppointmentID = ?", [appointmentId]);
    if (!apptRows.length) return res.status(404).json({ message: "Appointment not found" });

    const ticketId = apptRows[0].TicketID;

    await db.query("UPDATE tblAppointments SET Status = 'Rejected' WHERE AppointmentID = ?", [appointmentId]);
    await db.query(
      "INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID) VALUES (?, ?, ?)",
      [ticketId, "Appointment Rejected", req.user.userId]
    );

    res.json({ message: "Appointment rejected successfully" });
  } catch (err) {
    console.error("Reject appointment error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
