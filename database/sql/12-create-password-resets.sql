-- Create password resets table for reset token management
-- Run this script as MySQL root user

USE Rawson;

CREATE TABLE IF NOT EXISTS tblPasswordResets (
  UserID INT NOT NULL,
  TokenHash CHAR(64) NOT NULL,
  ExpiresAt DATETIME NOT NULL,
  UsedAt DATETIME NULL,
  IP VARCHAR(45) NULL,
  UserAgent VARCHAR(255) NULL,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (UserID),
  INDEX IdxPasswordResetToken (TokenHash),
  INDEX IdxPasswordResetExpires (ExpiresAt),
  INDEX IdxPasswordResetUsed (UsedAt),
  CONSTRAINT FkPasswordResetUser FOREIGN KEY (UserID) REFERENCES tblusers(UserID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Verify table structure
DESCRIBE tblPasswordResets;
