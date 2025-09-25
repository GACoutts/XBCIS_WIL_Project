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

-- 2) Ensure tblRefreshTokens columns exist
-- IssuedAt (used for session pruning order)
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'tblRefreshTokens'
             AND COLUMN_NAME = 'IssuedAt');
SET @sql := IF(@c=0,
  'ALTER TABLE tblRefreshTokens ADD COLUMN IssuedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER TokenHash;',
  'SELECT 1;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FamilyID (add NULLable first, backfill, then make NOT NULL)
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'tblRefreshTokens'
             AND COLUMN_NAME = 'FamilyID');
SET @sql := IF(@c=0,
  'ALTER TABLE tblRefreshTokens ADD COLUMN FamilyID CHAR(36) NULL AFTER TokenHash;',
  'SELECT 1;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Backfill FamilyID where NULL
UPDATE tblRefreshTokens SET FamilyID = UUID() WHERE FamilyID IS NULL;

-- Enforce NOT NULL (safe now that it’s backfilled)
SET @sql := 'ALTER TABLE tblRefreshTokens MODIFY FamilyID CHAR(36) NOT NULL;';
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ReplacedByTokenID (for rotation chains)
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'tblRefreshTokens'
             AND COLUMN_NAME = 'ReplacedByTokenID');
SET @sql := IF(@c=0,
  'ALTER TABLE tblRefreshTokens ADD COLUMN ReplacedByTokenID BIGINT NULL AFTER RevokedAt;',
  'SELECT 1;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- UserAgent
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'tblRefreshTokens'
             AND COLUMN_NAME = 'UserAgent');
SET @sql := IF(@c=0,
  'ALTER TABLE tblRefreshTokens ADD COLUMN UserAgent VARCHAR(255) NULL;',
  'SELECT 1;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- IP
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'tblRefreshTokens'
             AND COLUMN_NAME = 'IP');
SET @sql := IF(@c=0,
  'ALTER TABLE tblRefreshTokens ADD COLUMN IP VARCHAR(45) NULL;',
  'SELECT 1;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) Indexes (guarded)
-- Unique TokenHash
SET @idx := (SELECT COUNT(*) FROM information_schema.statistics
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'tblRefreshTokens'
               AND INDEX_NAME = 'uq_refresh_tokenhash');
SET @sql := IF(@idx=0,
  'CREATE UNIQUE INDEX uq_refresh_tokenhash ON tblRefreshTokens (TokenHash);',
  'SELECT 1;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- By UserID
SET @idx := (SELECT COUNT(*) FROM information_schema.statistics
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'tblRefreshTokens'
               AND INDEX_NAME = 'idx_refresh_user');
SET @sql := IF(@idx=0,
  'CREATE INDEX idx_refresh_user ON tblRefreshTokens (UserID);',
  'SELECT 1;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- By FamilyID
SET @idx := (SELECT COUNT(*) FROM information_schema.statistics
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'tblRefreshTokens'
               AND INDEX_NAME = 'idx_refresh_family');
SET @sql := IF(@idx=0,
  'CREATE INDEX idx_refresh_family ON tblRefreshTokens (FamilyID);',
  'SELECT 1;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- By ExpiresAt
SET @idx := (SELECT COUNT(*) FROM information_schema.statistics
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'tblRefreshTokens'
               AND INDEX_NAME = 'idx_refresh_expires');
SET @sql := IF(@idx=0,
  'CREATE INDEX idx_refresh_expires ON tblRefreshTokens (ExpiresAt);',
  'SELECT 1;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Verify table structure
DESCRIBE tblRevokedAccessJti;
