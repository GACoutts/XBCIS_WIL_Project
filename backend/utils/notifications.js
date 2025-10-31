// backend/utils/notifications.js
// Notification service for landlord lifecycle events

import pool from '../db.js';

/**
 * Notification service for emitting system notifications
 * Currently logs to database - future: WebSocket, email, push notifications
 */

// Notification types
export const NOTIFICATION_TYPES = {
  QUOTE_APPROVED: 'quote_approved',
  QUOTE_REJECTED: 'quote_rejected',
  TICKET_ASSIGNED: 'ticket_assigned',
  TICKET_COMPLETED: 'ticket_completed',
  PAYMENT_DUE: 'payment_due'
};

// Notification targets
export const NOTIFICATION_TARGETS = {
  CONTRACTOR: 'contractor',
  LANDLORD: 'landlord', 
  CLIENT: 'client',
  STAFF: 'staff'
};

/**
 * Emit a notification to specified targets
 * @param {Object} options - Notification options
 * @param {string} options.type - Notification type from NOTIFICATION_TYPES
 * @param {string} options.title - Notification title
 * @param {string} options.message - Notification message
 * @param {Array} options.targets - Array of target user objects {userId, role}
 * @param {Object} options.metadata - Additional data (ticketId, quoteId, etc.)
 * @param {number} options.actorUserId - User who triggered the notification
 */
export async function emitNotification({
  type,
  title,
  message,
  targets = [],
  metadata = {},
  actorUserId
}) {
  try {
    // Log notification for debugging
    console.log(`📧 Notification [${type}]: ${title}`, {
      targets: targets.map(t => `${t.role}:${t.userId}`),
      metadata,
      actor: actorUserId
    });

    // Store notifications in database for future retrieval
    if (targets.length > 0) {
      const notificationData = targets.map(target => [
        target.userId,
        type,
        title,
        message,
        JSON.stringify(metadata),
        actorUserId,
        'unread'
      ]);

      // Create notifications table if it doesn't exist (future enhancement)
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS tblNotifications (
          NotificationID INT PRIMARY KEY AUTO_INCREMENT,
          UserID INT NOT NULL,
          Type VARCHAR(50) NOT NULL,
          Title VARCHAR(255) NOT NULL,
          Message TEXT,
          Metadata JSON,
          ActorUserID INT,
          Status ENUM('unread', 'read', 'dismissed') DEFAULT 'unread',
          CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          ReadAt TIMESTAMP NULL,
          INDEX idx_user_status (UserID, Status),
          INDEX idx_created (CreatedAt),
          FOREIGN KEY (UserID) REFERENCES tblusers(UserID),
          FOREIGN KEY (ActorUserID) REFERENCES tblusers(UserID)
        )
      `);

      // Insert notifications
      await pool.execute(`
        INSERT INTO tblNotifications (UserID, Type, Title, Message, Metadata, ActorUserID, Status)
        VALUES ?
      `, [notificationData]);

      console.log(`✅ Stored ${targets.length} notifications in database`);
    }

    // Future enhancements:
    // - WebSocket real-time notifications
    // - Email notifications
    // - Push notifications
    // - SMS notifications
    // - Slack/Teams integration

    return true;
  } catch (error) {
    console.error('❌ Notification emission failed:', error);
    // Don't throw - notifications should not break main functionality
    return false;
  }
}

/**
 * Notify about quote approval
 */
export async function notifyQuoteApproved({ 
  quoteId, 
  ticketId, 
  landlordUserId, 
  contractorUserId 
}) {
  return await emitNotification({
    type: NOTIFICATION_TYPES.QUOTE_APPROVED,
    title: 'Quote Approved',
    message: `Your quote #${quoteId} has been approved by the landlord`,
    targets: [
      { userId: contractorUserId, role: 'contractor' }
    ],
    metadata: { 
      quoteId, 
      ticketId,
      action: 'approved'
    },
    actorUserId: landlordUserId
  });
}

/**
 * Notify about quote rejection
 */
export async function notifyQuoteRejected({
  quoteId,
  ticketId, 
  landlordUserId,
  contractorUserId
}) {
  return await emitNotification({
    type: NOTIFICATION_TYPES.QUOTE_REJECTED,
    title: 'Quote Rejected',
    message: `Your quote #${quoteId} has been rejected. Please review and submit a new quote if needed.`,
    targets: [
      { userId: contractorUserId, role: 'contractor' }
    ],
    metadata: {
      quoteId,
      ticketId,
      action: 'rejected'
    },
    actorUserId: landlordUserId
  });
}

/**
 * Get notifications for a user (for future frontend integration)
 */
export async function getUserNotifications(userId, limit = 50, offset = 0) {
  try {
    const [notifications] = await pool.execute(`
      SELECT 
        n.NotificationID,
        n.Type,
        n.Title, 
        n.Message,
        n.Metadata,
        n.Status,
        n.CreatedAt,
        n.ReadAt,
        actor.FullName as ActorName
      FROM tblNotifications n
      LEFT JOIN tblusers actor ON n.ActorUserID = actor.UserID
      WHERE n.UserID = ?
      ORDER BY n.CreatedAt DESC
      LIMIT ? OFFSET ?
    `, [userId, limit, offset]);

    return notifications.map(n => ({
      ...n,
      metadata: n.Metadata ? JSON.parse(n.Metadata) : {}
    }));
  } catch (error) {
    console.error('Error fetching user notifications:', error);
    return [];
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(notificationId, userId) {
  try {
    await pool.execute(`
      UPDATE tblNotifications 
      SET Status = 'read', ReadAt = NOW()
      WHERE NotificationID = ? AND UserID = ?
    `, [notificationId, userId]);
    
    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
}