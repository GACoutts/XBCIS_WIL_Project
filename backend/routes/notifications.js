import express from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * GET /api/notifications
 * Fetch recent notifications for the authenticated user (max 100).
 * Ordered by SentAt (or LastAttemptAt) descending.
 */
router.get('/', requireAuth, async (req, res) => {
  const { userId } = req.user;
  try {
    const [rows] = await pool.query(
      `SELECT NotificationID, TicketID, NotificationType, NotificationContent, EventKey,
              Status, MarkAsSent, SentAt, LastAttemptAt, ErrorMessage, CreatedAt, ProviderMessageID
         FROM tblNotifications
        WHERE UserID = ?
        ORDER BY COALESCE(SentAt, LastAttemptAt, CreatedAt) DESC
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
