-- Create tblNotifications table for system notifications
-- Run this script after creating tblTickets and tblUsers tables
-- Stores push notifications, emails, and WhatsApp messages sent to users

USE Rawson;

CREATE TABLE IF NOT EXISTS tblNotifications (
  NotificationID INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique notification ID',
  UserID INT NOT NULL COMMENT 'User who received the notification',
  TicketID INT NULL COMMENT 'Related ticket, if applicable',
  NotificationType ENUM('Push','Email','WhatsApp') NOT NULL COMMENT 'Notification channel',
  NotificationContent TEXT NOT NULL COMMENT 'Content of the notification',
  SentAt DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'When notification was sent',
  Status ENUM('Sent','Failed') DEFAULT 'Sent' COMMENT 'Status of notification delivery',
  
  -- Foreign key constraints
  FOREIGN KEY (UserID) REFERENCES tblusers(UserID) 
    ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (TicketID) REFERENCES tblTickets(TicketID) 
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='System notifications to users';

-- Create indexes for better performance
CREATE INDEX idx_notifications_user ON tblNotifications (UserID);
CREATE INDEX idx_notifications_ticket ON tblNotifications (TicketID);
CREATE INDEX idx_notifications_type ON tblNotifications (NotificationType);
CREATE INDEX idx_notifications_status ON tblNotifications (Status);
CREATE INDEX idx_notifications_sent ON tblNotifications (SentAt);

-- Verify table structure
DESCRIBE tblNotifications;
