import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /api/notifications - Fetch recent notifications for the authenticated user
// Returns up to 100 of the most recent notifications, ordered by SentAt descending.
router.get('/', authMiddleware, async (req, res) => {
  const { userId } = req.user;
  try {
    const [rows] = await pool.query(
      `SELECT NotificationID, TicketID, NotificationType, NotificationContent, EventKey,
              Status, MarkAsSent, SentAt, LastAttemptAt, ErrorMessage
         FROM tblNotifications
        WHERE UserID = ?
        ORDER BY COALESCE(SentAt, LastAttemptAt) DESC
        LIMIT 100`,
      [userId]
    );
    return res.json({ notifications: rows });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    return res.status(500).json({ message: 'Error fetching notifications' });
  }
});

export default router;