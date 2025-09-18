-- =====================================================================================
-- DATABASE RESET SCRIPT
-- Red Rabbit Replacement - Rawson Property Management System
-- =====================================================================================
-- This script drops all tables in REVERSE dependency order (safest approach)
-- WARNING: This will DELETE ALL DATA! Use with extreme caution.
-- =====================================================================================

USE Rawson;

-- Disable foreign key checks temporarily for clean teardown
SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================================================
-- DROP TABLES IN REVERSE ORDER (Most dependent first)
-- =====================================================================================

-- 16. Audit & History Tables (highest dependency)
DROP TABLE IF EXISTS tblauditlogs;
DROP TABLE IF EXISTS tblticketstatushistory;

-- 15-13. Communication & Media Tables
DROP TABLE IF EXISTS tblnotifications;
DROP TABLE IF EXISTS tblcommunications;
DROP TABLE IF EXISTS tblquotedocuments;
DROP TABLE IF EXISTS tblticketmedia;

-- 12-11. Scheduling & Updates Tables
DROP TABLE IF EXISTS tblcontractorupdates;
DROP TABLE IF EXISTS tblcontractorschedules;

-- 10. Landlord Approvals (depends on quotes)
DROP TABLE IF EXISTS tbllandlordapprovals;

-- 9. Quotes (depends on tickets and users)
DROP TABLE IF EXISTS tblquotes;

-- 8. Tickets (core business entity)
DROP TABLE IF EXISTS tbltickets;

-- 7-3. Authentication & Security Tables
DROP TABLE IF EXISTS tblpasswordresettokens;
DROP TABLE IF EXISTS tblpasswordresets;
DROP TABLE IF EXISTS tblrevokedaccessjti;
DROP TABLE IF EXISTS tblrefreshtokens;

-- 2. Users Table (foundation - dropped last)
DROP TABLE IF EXISTS tblusers;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================================
-- CLEANUP APPLICATION USER
-- =====================================================================================

-- Remove application database user
DROP USER IF EXISTS 'rawson_app'@'localhost';
FLUSH PRIVILEGES;

-- =====================================================================================
-- VERIFICATION
-- =====================================================================================

-- Show remaining tables (should be empty or only system tables)
SHOW TABLES;

-- Count remaining tables
SELECT 
  COUNT(*) as remaining_tables,
  'Expected: 0 (or only system tables)' as expected
FROM information_schema.tables 
WHERE table_schema = 'Rawson'
  AND table_type = 'BASE TABLE';

-- =====================================================================================
-- COMPLETION MESSAGE
-- =====================================================================================

SELECT 'Database reset complete! All tables dropped successfully.' as status;
SELECT 'WARNING: All data has been permanently deleted!' as warning;
SELECT 'Next step: Run migrations/00-master-setup.sql to recreate structure' as next_action;