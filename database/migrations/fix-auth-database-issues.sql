-- =====================================================================================
-- FIX AUTHENTICATION DATABASE ISSUES
-- =====================================================================================
-- This script fixes the database schema mismatch issues causing auth failures
-- Run this script to fix missing columns and update password hashes
-- =====================================================================================

USE rawson;

-- =====================================================================================
-- 1. FIX tblRefreshTokens TABLE SCHEMA
-- =====================================================================================
-- The auth system expects these columns but they may be missing

-- Add IssuedAt column if it doesn't exist
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'tblRefreshTokens'
             AND COLUMN_NAME = 'IssuedAt');
SET @sql := IF(@c=0,
  'ALTER TABLE tblRefreshTokens ADD COLUMN IssuedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER TokenHash;',
  'SELECT "IssuedAt column already exists" as status;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add FamilyID column if it doesn't exist
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'tblRefreshTokens'
             AND COLUMN_NAME = 'FamilyID');
SET @sql := IF(@c=0,
  'ALTER TABLE tblRefreshTokens ADD COLUMN FamilyID CHAR(36) NULL AFTER TokenHash;',
  'SELECT "FamilyID column already exists" as status;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Backfill FamilyID where NULL (if any existing records)
UPDATE tblRefreshTokens SET FamilyID = UUID() WHERE FamilyID IS NULL;

-- Make FamilyID NOT NULL (safe now that it's backfilled)
SET @sql := 'ALTER TABLE tblRefreshTokens MODIFY FamilyID CHAR(36) NOT NULL;';
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add ReplacedByTokenID column if it doesn't exist
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'tblRefreshTokens'
             AND COLUMN_NAME = 'ReplacedByTokenID');
SET @sql := IF(@c=0,
  'ALTER TABLE tblRefreshTokens ADD COLUMN ReplacedByTokenID BIGINT NULL AFTER RevokedAt;',
  'SELECT "ReplacedByTokenID column already exists" as status;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add UserAgent column if it doesn't exist
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'tblRefreshTokens'
             AND COLUMN_NAME = 'UserAgent');
SET @sql := IF(@c=0,
  'ALTER TABLE tblRefreshTokens ADD COLUMN UserAgent VARCHAR(255) NULL;',
  'SELECT "UserAgent column already exists" as status;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add IP column if it doesn't exist
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'tblRefreshTokens'
             AND COLUMN_NAME = 'IP');
SET @sql := IF(@c=0,
  'ALTER TABLE tblRefreshTokens ADD COLUMN IP VARCHAR(45) NULL;',
  'SELECT "IP column already exists" as status;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================================================================
-- 2. CREATE tblRevokedAccessJti TABLE IF MISSING
-- =====================================================================================

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

-- =====================================================================================
-- 3. ADD REQUIRED INDEXES FOR PERFORMANCE
-- =====================================================================================

-- Unique TokenHash (prevents duplicate tokens)
SET @idx := (SELECT COUNT(*) FROM information_schema.statistics
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'tblRefreshTokens'
               AND INDEX_NAME = 'uq_refresh_tokenhash');
SET @sql := IF(@idx=0,
  'CREATE UNIQUE INDEX uq_refresh_tokenhash ON tblRefreshTokens (TokenHash);',
  'SELECT "uq_refresh_tokenhash index already exists" as status;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index by UserID (for user session management)
SET @idx := (SELECT COUNT(*) FROM information_schema.statistics
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'tblRefreshTokens'
               AND INDEX_NAME = 'idx_refresh_user');
SET @sql := IF(@idx=0,
  'CREATE INDEX idx_refresh_user ON tblRefreshTokens (UserID);',
  'SELECT "idx_refresh_user index already exists" as status;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index by FamilyID (for token family management)
SET @idx := (SELECT COUNT(*) FROM information_schema.statistics
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'tblRefreshTokens'
               AND INDEX_NAME = 'idx_refresh_family');
SET @sql := IF(@idx=0,
  'CREATE INDEX idx_refresh_family ON tblRefreshTokens (FamilyID);',
  'SELECT "idx_refresh_family index already exists" as status;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index by ExpiresAt (for cleanup operations)
SET @idx := (SELECT COUNT(*) FROM information_schema.statistics
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'tblRefreshTokens'
               AND INDEX_NAME = 'idx_refresh_expires');
SET @sql := IF(@idx=0,
  'CREATE INDEX idx_refresh_expires ON tblRefreshTokens (ExpiresAt);',
  'SELECT "idx_refresh_expires index already exists" as status;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================================================================
-- 4. FIX EXISTING TEST USER PASSWORD HASHES
-- =====================================================================================
-- Replace fake password hashes with real bcrypt hashes for Password123!
-- This hash was verified to work with the actual system

-- First, try to update fake hashes if they exist
UPDATE tblusers 
SET PasswordHash = '$2b$12$ATqUdV1KstR1UyxIB6cN9ubp2FpvPmkcVirjj.WmfZ6mGSul/pMze'
WHERE PasswordHash LIKE '$2b$10$example.hash.for.Password123!' 
   OR PasswordHash = '$2b$10$example.hash.for.Password123!';

-- Then, ensure all test users have the correct working hash for Password123!
-- This hash is copied from a working test user and verified to work
UPDATE tblusers 
SET PasswordHash = '$2b$12$ATqUdV1KstR1UyxIB6cN9ubp2FpvPmkcVirjj.WmfZ6mGSul/pMze'
WHERE Email IN (
  'staff@demo.com', 
  'landlord@demo.com', 
  'contractor@demo.com', 
  'client@demo.com',
  'landlord@test.com', 
  'contractor@test.com', 
  'client@test.com'
);

-- =====================================================================================
-- 5. VERIFICATION AND CLEANUP
-- =====================================================================================

-- Show the updated table structure
SELECT 'tblRefreshTokens structure after fixes:' as info;
DESCRIBE tblRefreshTokens;

-- Show updated users with real password hashes
SELECT 'Updated users with real password hashes:' as info;
SELECT UserID, FullName, Email, Role, Status,
       CASE 
         WHEN PasswordHash = '$2b$12$ATqUdV1KstR1UyxIB6cN9ubp2FpvPmkcVirjj.WmfZ6mGSul/pMze' THEN '✅ CORRECT Password123! HASH'
         WHEN PasswordHash LIKE '$2b$12$%' THEN '⚠️  DIFFERENT bcrypt HASH'
         WHEN PasswordHash LIKE '$2b$10$example%' THEN '❌ FAKE HASH (BROKEN)'
         ELSE '❓ UNKNOWN HASH'
       END as PasswordStatus
FROM tblusers 
WHERE Email LIKE '%@demo.com' OR Email LIKE '%@test.com'
ORDER BY Role, FullName;

-- Clean up any old/invalid refresh tokens
DELETE FROM tblRefreshTokens WHERE ExpiresAt < NOW();

-- Show final status
SELECT 'DATABASE FIX COMPLETE!' as status;
SELECT 'You can now login with any test user using password: Password123!' as info;
SELECT 'Example: staff@demo.com / Password123!' as example;

-- =====================================================================================
-- SUCCESS MESSAGE
-- =====================================================================================
SELECT 'All authentication database issues have been fixed!' as final_status;