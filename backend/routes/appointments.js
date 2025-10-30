import express from "express";
import pool from "../db.js";
import { requireAuth, permitRoles } from "../middleware/authMiddleware.js";
import { notifyUser } from "../utils/notify.js";

const router = express.Router();

// -----------------------------------------------------
// 1) EXISTING: Landlord ticket history
// Route stays the same: GET /api/appointments/tickets
// -----------------------------------------------------
router.get("/tickets", requireAuth, permitRoles("Landlord"), async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `
      SELECT 
        t.TicketID,
        t.Subject,
        t.CurrentStatus AS TicketStatus,
        (SELECT COUNT(*) FROM tblQuotes q WHERE q.TicketID = t.TicketID) AS QuoteCount,
        (SELECT COUNT(*) FROM tblAppointments a WHERE a.TicketID = t.TicketID) AS AppointmentCount
      FROM tblTickets t
      WHERE t.LandlordUserID = ?
      ORDER BY t.CreatedAt DESC
    `,
      [req.user.userId]
    );

    res.json(rows);
  } catch (error) {
    console.error("Landlord tickets history error:", error);
    res.status(500).json({ message: "Failed to fetch landlord tickets" });
  }
});

// ======================================================================
//
//    These paths are defined WITHOUT a /tickets prefix so that when you
//    mount at /api/tickets, they become:
//      GET    /api/tickets/:id/schedule
//      POST   /api/tickets/:id/appointments
//      POST   /api/tickets/:id/appointments/confirm
// ======================================================================

// All tenant routes require auth; role checks applied per-route below.
router.use(requireAuth);

/**
 * GET /api/tickets/:id/schedule
 * Returns the latest contractor/tenant proposal snapshot for a ticket.
 * Roles: Client, Contractor, Staff
 */
router.get("/:id/schedule", permitRoles("Client", "Contractor", "Staff"), async (req, res) => {
  try {
    const ticketId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(ticketId)) {
      return res.status(400).json({ success: false, message: "Invalid ticket ID" });
    }

    const userId = req.user.userId;
    const userRole = req.user.role;

    const [[tkt]] = await pool.query(
      `
      SELECT TicketID, ClientUserID, AssignedContractorID
      FROM tblTickets
      WHERE TicketID = ?
      LIMIT 1
      `,
      [ticketId]
    );
    if (!tkt) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    // Client must own the ticket
    if (userRole === "Client" && tkt.ClientUserID !== userId) {
      return res.status(403).json({ success: false, message: "Not authorized for this ticket" });
    }

    // Contractor must be assigned or have an approved quote
    if (userRole === "Contractor") {
      if (tkt.AssignedContractorID !== userId) {
        const [[qok]] = await pool.query(
          `
          SELECT 1
          FROM tblQuotes
          WHERE TicketID = ? AND ContractorUserID = ? AND QuoteStatus = 'Approved'
          LIMIT 1
          `,
          [ticketId, userId]
        );
        if (!qok) {
          return res.status(403).json({ success: false, message: "Not authorized for this ticket" });
        }
      }
    }

    const [[row]] = await pool.query(
      `
      SELECT
        s.ScheduleID,
        s.TicketID,
        s.ContractorUserID,
        s.ProposedDate,
        s.ClientConfirmed,
        s.ContractorConfirmed,
        s.ProposedBy,
        s.Notes
      FROM tblContractorSchedules s
      WHERE s.TicketID = ?
      ORDER BY (s.ClientConfirmed + s.ContractorConfirmed) DESC,
               s.ProposedDate DESC, s.ScheduleID DESC
      LIMIT 1
      `,
      [ticketId]
    );

    if (!row) {
      return res.json({ success: true, data: null, message: "No schedule found" });
    }

    return res.json({
      success: true,
      data: {
        ScheduleID: row.ScheduleID,
        TicketID: row.TicketID,
        ContractorUserID: row.ContractorUserID,
        ProposedDate: row.ProposedDate,
        ClientConfirmed: !!row.ClientConfirmed,
        ContractorConfirmed: !!row.ContractorConfirmed,
        ProposedBy: row.ProposedBy,
        Notes: row.Notes ?? null,
      },
    });
  } catch (error) {
    console.error("[appointments:schedule:get] error", error);
    res.status(500).json({ success: false, message: "Unable to fetch schedule" });
  }
});


/**
 * POST /api/tickets/:id/appointments
 * Tenant proposes a time. Body: { scheduledAt: ISOString }
 * Roles: Client, Staff
 */
router.post("/:id/appointments", permitRoles("Client", "Staff"), async (req, res) => {
  try {
    const ticketId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(ticketId)) {
      return res.status(400).json({ success: false, message: "Invalid ticket ID" });
    }

    const { scheduledAt } = req.body || {};
    if (!scheduledAt) {
      return res.status(400).json({ success: false, message: "scheduledAt is required" });
    }

    const startTime = new Date(scheduledAt);
    if (isNaN(startTime.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid scheduledAt datetime" });
    }
    if (startTime <= new Date()) {
      return res.status(400).json({ success: false, message: "Proposed time must be in the future" });
    }

    // Authorize: ensure ticket belongs to the client (unless Staff)
    const userId = req.user.userId;
    const userRole = req.user.role;

    const [[auth]] = await pool.query(
      `
      SELECT TicketID, ClientUserID, AssignedContractorID, TicketRefNumber, CurrentStatus
      FROM tblTickets
      WHERE TicketID = ?
      LIMIT 1
    `,
      [ticketId]
    );

    if (!auth) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }
    if (userRole !== "Staff" && auth.ClientUserID !== userId) {
      return res.status(403).json({ success: false, message: "Not authorized for this ticket" });
    }

    // Determine contractor (assigned or from last approved quote)
    let contractorUserId = auth.AssignedContractorID || null;
    if (!contractorUserId) {
      const [[q]] = await pool.query(
        `
        SELECT ContractorUserID
        FROM tblQuotes
        WHERE TicketID = ? AND QuoteStatus = 'Approved'
        ORDER BY QuoteID DESC
        LIMIT 1
      `,
        [ticketId]
      );
      contractorUserId = q?.ContractorUserID || null;
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Insert proposal (tenant initiated) - client is confirming their own proposal
      const [schedRes] = await conn.execute(
        `INSERT INTO tblContractorSchedules
  (TicketID, ContractorUserID, ProposedDate, ClientConfirmed, ContractorConfirmed, ProposedBy)
VALUES
  (?, ?, ?, TRUE, FALSE, 'Client');
        `,
        [ticketId, contractorUserId, startTime]
      );

      // Add status history
      await conn.execute(
        `
        INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID)
        VALUES (?, 'Appointment Proposed (Client)', ?)
      `,
        [ticketId, userId]
      );

      // Keep ticket in 'Awaiting Appointment' until both sides confirm
      await conn.execute(
   `
   UPDATE tblTickets
      SET CurrentStatus = 'Awaiting Appointment'
    WHERE TicketID = ?
      AND CurrentStatus NOT IN ('Scheduled','In Progress','Completed','Closed','Cancelled')
   `,
   [ticketId]
 );
      await conn.commit();

      // Notify contractor (best-effort)
      if (contractorUserId && typeof notifyUser === "function") {
        try {
          await notifyUser({
            userId: contractorUserId,
            ticketId,
            template: "appointment_proposed",
            params: {
              ticketRef: auth.TicketRefNumber || String(ticketId),
              date: startTime.toISOString().split("T")[0],
              time: startTime.toISOString().split("T")[1]?.substring(0, 5) || "",
            },
            eventKey: `appointment_proposed_by_client:${ticketId}:${schedRes.insertId}`,
            fallbackToEmail: true,
          });
        } catch (e) {
          console.error("[tenant propose] notify contractor error:", e);
        }
      }

      return res.json({
        success: true,
        data: {
          scheduleId: schedRes.insertId,
          ticketId,
          proposedDate: startTime.toISOString(),
          clientConfirmed: true,
        },
        message: "Appointment proposal sent",
      });
    } catch (e) {
      try {
        await conn.rollback();
      } catch { }
      throw e;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error("[appointments:tenant:post] error", error);
    res.status(500).json({ success: false, message: "Unable to propose appointment" });
  }
});

/**
 * POST /api/tickets/:id/appointments/confirm
 * Tenant confirms the contractors (or latest) proposal.
 * Body: { scheduleId }
 * Roles: Client, Staff
 */
router.post("/:id/appointments/confirm", permitRoles("Client", "Contractor", "Staff"), async (req, res) => {
  try {
    const ticketId = Number.parseInt(req.params.id, 10);
    const { scheduleId } = req.body || {};
    if (!Number.isFinite(ticketId) || !Number.isFinite(Number(scheduleId))) {
      return res.status(400).json({ success: false, message: "Valid ticket ID and scheduleId are required" });
    }

    const userId = req.user.userId;
    const userRole = req.user.role;

    // Load ticket & authorize
    const [[ticket]] = await pool.query(
      `
      SELECT TicketID, ClientUserID, AssignedContractorID, TicketRefNumber
      FROM tblTickets
      WHERE TicketID = ?
      LIMIT 1
      `,
      [ticketId]
    );
    if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });
    if (userRole !== "Staff" && !["Client", "Contractor"].includes(userRole)) {
      return res.status(403).json({ success: false, message: "Not authorized for this ticket" });
    }
    if (userRole === "Client" && ticket.ClientUserID !== userId) {
      return res.status(403).json({ success: false, message: "Not authorized for this ticket" });
    }

    // NEW: Contractor must be assigned or have an approved quote
    if (userRole === "Contractor") {
      if (ticket.AssignedContractorID !== userId) {
        const [[qok]] = await pool.query(
          `
          SELECT 1
          FROM tblQuotes
          WHERE TicketID = ? AND ContractorUserID = ? AND QuoteStatus = 'Approved'
          LIMIT 1
          `,
          [ticketId, userId]
        );
        if (!qok) {
          return res.status(403).json({ success: false, message: "Not authorized for this ticket" });
        }
      }
    }

    // Validate schedule belongs to the ticket
    const [[sched]] = await pool.query(
      `
      SELECT ScheduleID, TicketID, ContractorUserID, ProposedDate, ClientConfirmed, ContractorConfirmed
      FROM tblContractorSchedules
      WHERE ScheduleID = ? AND TicketID = ?
      LIMIT 1
      `,
      [scheduleId, ticketId]
    );
    if (!sched) return res.status(404).json({ success: false, message: "Schedule not found" });

    // Enforce "latest only" confirmation to avoid stale accepts
    const [[latest]] = await pool.query(
      `
      SELECT ScheduleID
      FROM tblContractorSchedules
      WHERE TicketID = ?
      ORDER BY ProposedDate DESC, ScheduleID DESC
      LIMIT 1
      `,
      [ticketId]
    );
    if (!latest || latest.ScheduleID !== sched.ScheduleID) {
      return res.status(409).json({ success: false, message: "This proposal is no longer the latest. Please review the newest proposal." });
    }

    const isClient = userRole === "Client";
    const isContractor = userRole === "Contractor" || userRole === "Staff";

    // If already confirmed on this side, short-circuit
    if ((isClient && sched.ClientConfirmed) || (isContractor && sched.ContractorConfirmed)) {
      return res.status(409).json({ success: false, message: "Already confirmed by this party" });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // NEW: If contractor is confirming and schedule lacks contractor, lock it to this contractor now
      if (isContractor && userRole === "Contractor") {
        const [[schedNow]] = await conn.query(
          `SELECT ContractorUserID FROM tblContractorSchedules WHERE ScheduleID = ? FOR UPDATE`,
          [scheduleId]
        );
        if (!schedNow) throw new Error("Schedule vanished");
        if (schedNow.ContractorUserID == null) {
          await conn.execute(
            `UPDATE tblContractorSchedules SET ContractorUserID = ? WHERE ScheduleID = ?`,
            [userId, scheduleId]
          );
        }
      }

      // Set the right flag for the confirming party
      if (isClient) {
        await conn.execute(
          `UPDATE tblContractorSchedules SET ClientConfirmed = TRUE WHERE ScheduleID = ?`,
          [scheduleId]
        );
      } else {
        await conn.execute(
          `UPDATE tblContractorSchedules SET ContractorConfirmed = TRUE WHERE ScheduleID = ?`,
          [scheduleId]
        );
      }

      // Re-read to see if both sides are now confirmed
      const [[after]] = await conn.query(
        `
        SELECT ClientConfirmed, ContractorConfirmed, ProposedDate, ContractorUserID
        FROM tblContractorSchedules
        WHERE ScheduleID = ?
        LIMIT 1
        `,
        [scheduleId]
      );

      const bothConfirmed = !!after.ClientConfirmed && !!after.ContractorConfirmed;

      if (bothConfirmed) {
        await conn.execute(
          `UPDATE tblTickets SET CurrentStatus = 'Scheduled' WHERE TicketID = ?`,
          [ticketId]
        );
        await conn.execute(
          `
          INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID)
          VALUES (?, 'Appointment Confirmed', ?)
          `,
          [ticketId, userId]
        );
      } else {
        // keep as Awaiting Appointment
        await conn.execute(
          `
          UPDATE tblTickets
             SET CurrentStatus = 'Awaiting Appointment'
           WHERE TicketID = ?
             AND CurrentStatus NOT IN ('Scheduled','In Progress','Completed','Closed','Cancelled')
          `,
          [ticketId]
        );
        await conn.execute(
          `
          INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID)
          VALUES (?, ?, ?)
          `,
          [ticketId, isClient ? 'Appointment Acknowledged (Client)' : 'Appointment Acknowledged (Contractor)', userId]
        );
      }

      await conn.commit();

      // Notifications (best effort)
      try {
        if (bothConfirmed) {
          // notify contractor (and optionally client)
          const d = new Date(after.ProposedDate);
          const params = {
            ticketRef: ticket.TicketRefNumber || String(ticketId),
            date: d.toISOString().split("T")[0],
            time: d.toISOString().split("T")[1]?.substring(0, 5) || "",
          };
          if (after.ContractorUserID) {
            await notifyUser({
              userId: after.ContractorUserID,
              ticketId,
              template: "appointment_confirmed",
              params,
              eventKey: `appointment_confirmed:${ticketId}:${scheduleId}`,
              fallbackToEmail: true,
            });
          }
        } else {
          // notify the other party that their confirmation is needed
          const otherPartyUserId = isClient ? after.ContractorUserID : ticket.ClientUserID;
          if (otherPartyUserId) {
            const d = new Date(after.ProposedDate);
            await notifyUser({
              userId: otherPartyUserId,
              ticketId,
              template: "appointment_needs_confirmation",
              params: {
                ticketRef: ticket.TicketRefNumber || String(ticketId),
                date: d.toISOString().split("T")[0],
                time: d.toISOString().split("T")[1]?.substring(0, 5) || "",
              },
              eventKey: `appointment_needs_confirmation:${ticketId}:${scheduleId}`,
              fallbackToEmail: true,
            });
          }
        }
      } catch (e) {
        console.error("[appointments:confirm] notify error:", e);
      }

      return res.json({
        success: true,
        data: { ticketId, scheduleId, confirmedBy: isClient ? "Client" : "Contractor", bothConfirmed },
        message: bothConfirmed ? "Appointment fully confirmed" : "Confirmation recorded; awaiting the other party",
      });
    } catch (e) {
      try { await conn.rollback(); } catch {}
      throw e;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error("[appointments:confirm] error", error);
    res.status(500).json({ success: false, message: "Unable to confirm appointment" });
  }
});


export default router;
