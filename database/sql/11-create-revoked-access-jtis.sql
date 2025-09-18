-- Create revoked access JTI table for token blacklisting
-- Run this script as MySQL root user

USE Rawson;

CREATE TABLE IF NOT EXISTS tblRevokedAccessJti (
  Jti CHAR(36) PRIMARY KEY,
  UserID INT NOT NULL,
  ExpiresAt DATETIME NOT NULL,
  Reason VARCHAR(100) NULL,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX IdxRevokedUser (UserID),
  INDEX IdxRevokedExp (ExpiresAt),
  INDEX IdxRevokedReason (Reason),
  CONSTRAINT FkRevokedUser FOREIGN KEY (UserID) REFERENCES tblusers(UserID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Verify table structure
DESCRIBE tblRevokedAccessJti;
