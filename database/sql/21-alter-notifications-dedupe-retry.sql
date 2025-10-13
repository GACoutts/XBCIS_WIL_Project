USE Rawson;

ALTER TABLE tblNotifications
  ADD COLUMN MarkAsSent TINYINT(1) NOT NULL DEFAULT 0 AFTER Status,
  ADD COLUMN EventKey VARCHAR(120) NULL AFTER TicketID,
  ADD COLUMN ProviderMessageID VARCHAR(100) NULL AFTER NotificationContent,
  ADD COLUMN ErrorMessage VARCHAR(255) NULL AFTER ProviderMessageID,
  ADD COLUMN AttemptCount INT NOT NULL DEFAULT 0 AFTER ErrorMessage,
  ADD COLUMN LastAttemptAt DATETIME NULL AFTER AttemptCount;

CREATE INDEX Idx_Notifications_EventKey ON tblNotifications (UserID, NotificationType, EventKey);
