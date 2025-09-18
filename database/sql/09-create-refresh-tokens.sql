-- Create refresh tokens table for dual-token authentication
-- Run this script as MySQL root user

USE Rawson;

CREATE TABLE IF NOT EXISTS tblRefreshTokens (
  TokenID BIGINT AUTO_INCREMENT PRIMARY KEY,
  UserID INT NOT NULL,
  TokenHash CHAR(64) NOT NULL,
  FamilyID CHAR(36) NOT NULL,
  IssuedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ExpiresAt DATETIME NOT NULL,
  RevokedAt DATETIME NULL,
  ReplacedByTokenID BIGINT NULL,
  UserAgent VARCHAR(255) NULL,
  IP VARCHAR(45) NULL,
  INDEX idx_refresh_user (UserID),
  UNIQUE INDEX uq_refresh_tokenhash (TokenHash),
  INDEX idx_refresh_family (FamilyID),
  INDEX idx_refresh_expires (ExpiresAt),
  CONSTRAINT fk_refresh_user FOREIGN KEY (UserID) REFERENCES tblusers(UserID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Verify table structure
DESCRIBE tblRefreshTokens;
