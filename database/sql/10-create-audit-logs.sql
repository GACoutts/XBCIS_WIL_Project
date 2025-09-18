-- Create audit logs table for security tracking
-- Run this script as MySQL root user

USE Rawson;

CREATE TABLE IF NOT EXISTS tblAuditLogs (
  AuditID BIGINT AUTO_INCREMENT PRIMARY KEY,
  ActorUserID INT NULL,
  TargetUserID INT NULL,
  Action VARCHAR(100) NOT NULL,
  Metadata JSON NULL,
  IP VARCHAR(45) NULL,
  UserAgent VARCHAR(255) NULL,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX IdxAuditAction (Action),
  INDEX IdxAuditActor (ActorUserID),
  INDEX IdxAuditTarget (TargetUserID),
  INDEX IdxAuditCreated (CreatedAt),
  CONSTRAINT FkAuditActor FOREIGN KEY (ActorUserID) REFERENCES tblusers(UserID) ON DELETE SET NULL,
  CONSTRAINT FkAuditTarget FOREIGN KEY (TargetUserID) REFERENCES tblusers(UserID) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Verify table structure
DESCRIBE tblAuditLogs;
