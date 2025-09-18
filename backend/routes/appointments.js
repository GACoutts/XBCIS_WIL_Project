// backend/routes/landlord.js
import express from "express";
import pool from "../db.js";
import { requireAuth, permitRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// Landlord ticket history (with quotes + appointments summary)
router.get("/tickets", requireAuth, permitRoles("Landlord"), async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        t.TicketID, t.Subject, t.Status AS TicketStatus,
        (SELECT COUNT(*) FROM tblQuotes q WHERE q.TicketID = t.TicketID) AS QuoteCount,
        (SELECT COUNT(*) FROM tblAppointments a WHERE a.TicketID = t.TicketID) AS AppointmentCount
      FROM tblTickets t
      WHERE t.LandlordUserID = ?
      ORDER BY t.CreatedAt DESC
    `, [req.user.userId]);

    res.json(rows);
  } catch (error) {
    console.error("Landlord tickets history error:", error);
    res.status(500).json({ message: "Failed to fetch landlord tickets" });
  }
});

export default router;
