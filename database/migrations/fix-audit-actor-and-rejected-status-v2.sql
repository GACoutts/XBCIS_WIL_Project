-- =====================================================================================
-- DATABASE FIX v2: Add ActorID to Audit Logs & Rejected Status to Users
-- =====================================================================================
-- Handles existing foreign key constraints and table structures
-- Addresses team feedback:
-- 1. "master-setup does not have ActorID for the tblAuditLogs"
-- 2. "Make sure to alter tblUsers to have 'Rejected' as a status option"
-- 3. "use the Audit table in the 00-create-complete-database-with-sessions"
-- =====================================================================================

USE Rawson;

-- =====================================================================================
-- STEP 1: Add 'Rejected' status to tblUsers Status ENUM (if not already done)
-- =====================================================================================

-- Check current status enum and add Rejected if missing
SET @current_enum = (
    SELECT COLUMN_TYPE 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'Rawson' 
    AND TABLE_NAME = 'tblusers' 
    AND COLUMN_NAME = 'Status'
);

-- Only add Rejected if it's not already there
SET @has_rejected = CASE 
    WHEN @current_enum LIKE '%Rejected%' THEN 1 
    ELSE 0 
END;

-- Add Rejected status if missing
SET @sql_add_rejected = CASE 
    WHEN @has_rejected = 0 THEN 
        'ALTER TABLE tblusers MODIFY COLUMN Status ENUM(''Active'',''Inactive'',''Suspended'',''Pending'',''Rejected'') NOT NULL DEFAULT ''Active'''
    ELSE 
        'SELECT ''Rejected status already exists in tblusers'' as status'
END;

PREPARE stmt FROM @sql_add_rejected;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Step 1: tblUsers Status ENUM checked/updated with Rejected option' as status;

-- =====================================================================================
-- STEP 2: Check existing audit logs structure
-- =====================================================================================

-- Check if tblauditlogs exists and what columns it has
SET @audit_table_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = 'Rawson' 
    AND TABLE_NAME = 'tblauditlogs'
);

-- Get existing columns
SET @existing_columns = '';
SET @existing_columns = (
    SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY ORDINAL_POSITION)
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'Rawson' 
    AND TABLE_NAME = 'tblauditlogs'
);

-- Check if ActorUserID already exists
SET @has_actor_userid = CASE 
    WHEN @existing_columns LIKE '%ActorUserID%' THEN 1 
    ELSE 0 
END;

-- Check if TargetUserID already exists
SET @has_target_userid = CASE 
    WHEN @existing_columns LIKE '%TargetUserID%' THEN 1 
    ELSE 0 
END;

SELECT 'Step 2: Audit table analysis complete' as status;
SELECT @audit_table_exists as audit_table_exists;
SELECT @existing_columns as existing_columns;
SELECT @has_actor_userid as has_actor_userid;
SELECT @has_target_userid as has_target_userid;

-- =====================================================================================
-- STEP 3: Add missing columns to existing audit logs table
-- =====================================================================================

-- Add ActorUserID if missing
SET @sql_add_actor = CASE 
    WHEN @audit_table_exists > 0 AND @has_actor_userid = 0 THEN 
        'ALTER TABLE tblauditlogs ADD COLUMN ActorUserID INT NULL COMMENT ''User who performed the action'' AFTER AuditID'
    ELSE 
        'SELECT ''ActorUserID column already exists or table not found'' as status'
END;

PREPARE stmt FROM @sql_add_actor;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add TargetUserID if missing
SET @sql_add_target = CASE 
    WHEN @audit_table_exists > 0 AND @has_target_userid = 0 THEN 
        'ALTER TABLE tblauditlogs ADD COLUMN TargetUserID INT NULL COMMENT ''User who was the target of the action'' AFTER ActorUserID'
    ELSE 
        'SELECT ''TargetUserID column already exists or table not found'' as status'
END;

PREPARE stmt FROM @sql_add_target;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Step 3: Added missing ActorUserID and TargetUserID columns' as status;

-- =====================================================================================
-- STEP 4: Add indexes if they don't exist
-- =====================================================================================

-- Check if indexes exist
SET @has_actor_index = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = 'Rawson' 
    AND TABLE_NAME = 'tblauditlogs' 
    AND INDEX_NAME = 'idx_audit_actor'
);

SET @has_target_index = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = 'Rawson' 
    AND TABLE_NAME = 'tblauditlogs' 
    AND INDEX_NAME = 'idx_audit_target'
);

-- Add ActorUserID index if missing
SET @sql_add_actor_index = CASE 
    WHEN @audit_table_exists > 0 AND @has_actor_index = 0 THEN 
        'ALTER TABLE tblauditlogs ADD INDEX idx_audit_actor (ActorUserID)'
    ELSE 
        'SELECT ''ActorUserID index already exists or table not found'' as status'
END;

PREPARE stmt FROM @sql_add_actor_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add TargetUserID index if missing
SET @sql_add_target_index = CASE 
    WHEN @audit_table_exists > 0 AND @has_target_index = 0 THEN 
        'ALTER TABLE tblauditlogs ADD INDEX idx_audit_target (TargetUserID)'
    ELSE 
        'SELECT ''TargetUserID index already exists or table not found'' as status'
END;

PREPARE stmt FROM @sql_add_target_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Step 4: Added missing indexes' as status;

-- =====================================================================================
-- STEP 5: Add foreign keys if they don't exist
-- =====================================================================================

-- Check if foreign keys exist
SET @has_actor_fk = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE TABLE_SCHEMA = 'Rawson' 
    AND TABLE_NAME = 'tblauditlogs' 
    AND CONSTRAINT_NAME = 'fk_audit_actor'
);

SET @has_target_fk = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE TABLE_SCHEMA = 'Rawson' 
    AND TABLE_NAME = 'tblauditlogs' 
    AND CONSTRAINT_NAME = 'fk_audit_target'
);

-- Add ActorUserID foreign key if missing
SET @sql_add_actor_fk = CASE 
    WHEN @audit_table_exists > 0 AND @has_actor_fk = 0 AND @has_actor_userid = 1 THEN 
        'ALTER TABLE tblauditlogs ADD CONSTRAINT fk_audit_actor_v2 FOREIGN KEY (ActorUserID) REFERENCES tblusers(UserID) ON DELETE SET NULL'
    ELSE 
        'SELECT ''ActorUserID foreign key already exists or conditions not met'' as status'
END;

PREPARE stmt FROM @sql_add_actor_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add TargetUserID foreign key if missing
SET @sql_add_target_fk = CASE 
    WHEN @audit_table_exists > 0 AND @has_target_fk = 0 AND @has_target_userid = 1 THEN 
        'ALTER TABLE tblauditlogs ADD CONSTRAINT fk_audit_target_v2 FOREIGN KEY (TargetUserID) REFERENCES tblusers(UserID) ON DELETE SET NULL'
    ELSE 
        'SELECT ''TargetUserID foreign key already exists or conditions not met'' as status'
END;

PREPARE stmt FROM @sql_add_target_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Step 5: Added missing foreign keys' as status;

-- =====================================================================================
-- STEP 6: Verification
-- =====================================================================================

-- Show updated structure
SELECT 'VERIFICATION - Updated tblauditlogs structure:' as info;
DESCRIBE tblauditlogs;

-- Verify Status enum includes Rejected
SELECT 'VERIFICATION - tblUsers Status ENUM:' as info;
SELECT COLUMN_TYPE as users_status_enum 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'Rawson' 
AND TABLE_NAME = 'tblusers' 
AND COLUMN_NAME = 'Status';

-- Show data counts
SELECT 'VERIFICATION - Record counts:' as info;
SELECT 'tblauditlogs' as table_name, COUNT(*) as record_count FROM tblauditlogs;
SELECT 'tblusers' as table_name, COUNT(*) as record_count FROM tblusers;

-- Show foreign keys
SELECT 'VERIFICATION - Foreign keys on tblauditlogs:' as info;
SELECT 
    CONSTRAINT_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = 'Rawson' 
AND TABLE_NAME = 'tblauditlogs' 
AND REFERENCED_TABLE_NAME IS NOT NULL;

SELECT 'DATABASE FIX COMPLETE!' as status;
SELECT 'ActorUserID and TargetUserID columns added to tblauditlogs for accept/reject functionality' as fix1;
SELECT 'Rejected status confirmed in tblusers Status enum' as fix2;
SELECT 'Audit table structure updated to support proper session tracking' as fix3;

-- =====================================================================================
-- USAGE NOTES
-- =====================================================================================
SELECT 'USAGE NOTES:' as notes;
SELECT '1. ActorUserID should be populated with the UserID of the staff member performing accept/reject actions' as note1;
SELECT '2. TargetUserID should be populated with the UserID of the user being accepted/rejected' as note2;
SELECT '3. Use Status = "Rejected" for users whose registration requests are rejected' as note3;
SELECT '4. The accept/reject functionality should now work correctly with proper audit tracking' as note4;