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
CREATE INDEX IdxNotificationsUser ON tblNotifications (UserID);
CREATE INDEX IdxNotificationsTicket ON tblNotifications (TicketID);
CREATE INDEX IdxNotificationsType ON tblNotifications (NotificationType);
CREATE INDEX IdxNotificationsStatus ON tblNotifications (Status);
CREATE INDEX IdxNotificationsSent ON tblNotifications (SentAt);

USE Rawson;

-- 1) Add CreatedAt (only if missing)
SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'tblNotifications'
    AND COLUMN_NAME  = 'CreatedAt'
);

SET @ddl := IF(
  @col_exists = 0,
  'ALTER TABLE tblNotifications
     ADD COLUMN CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
     AFTER NotificationContent',
  'DO 0'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) Ensure Status enum includes 'Queued' and default is 'Queued'
--    (only modifies if 'Queued' not present)
SET @needs_enum := (
  SELECT CASE
           WHEN COLUMN_TYPE LIKE '%''Queued''%' THEN 0
           ELSE 1
         END
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'tblNotifications'
    AND COLUMN_NAME  = 'Status'
  LIMIT 1
);

SET @ddl := IF(
  @needs_enum = 1,
  'ALTER TABLE tblNotifications
       MODIFY COLUMN Status ENUM(''Queued'',''Sent'',''Failed'')
       NOT NULL DEFAULT ''Queued''',
  'DO 0'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) (Optional) widen ProviderMessageID / ErrorMessage for safety
--    These MODIFYs are safe to run even if already at/above these sizes.
ALTER TABLE tblNotifications
  MODIFY COLUMN ProviderMessageID VARCHAR(128) NULL,
  MODIFY COLUMN ErrorMessage      VARCHAR(512) NULL;

-- 4) Create composite time index used by API/worker (if missing)
SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'tblNotifications'
    AND INDEX_NAME   = 'idx_user_time'
);

SET @ddl := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_user_time ON tblNotifications (UserID, SentAt, LastAttemptAt)',
  'DO 0'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Verify table structure
DESCRIBE tblNotifications;
