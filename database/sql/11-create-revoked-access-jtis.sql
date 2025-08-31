-- Create revoked access JTI table for token blacklisting
-- Run this script as MySQL root user

USE Rawson;

CREATE TABLE IF NOT EXISTS tblRevokedAccessJti (
  Jti CHAR(36) PRIMARY KEY,
  UserID INT NOT NULL,
  ExpiresAt DATETIME NOT NULL,
  Reason VARCHAR(100) NULL,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_revoked_user (UserID),
  INDEX idx_revoked_exp (ExpiresAt),
  INDEX idx_revoked_reason (Reason),
  CONSTRAINT fk_revoked_user FOREIGN KEY (UserID) REFERENCES tblusers(UserID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Verify table structure
DESCRIBE tblRevokedAccessJti;
