-- =====================================================================================
-- TEAM SYNC USER SEED SCRIPT
-- Red Rabbit Replacement - Rawson Property Management System
-- =====================================================================================
-- This script creates essential test users for development team synchronization
-- Run after setting up the database structure
-- =====================================================================================

USE rawson;

-- Clear any existing test users (optional - remove if you want to preserve)
DELETE FROM tblusers WHERE Email LIKE '%@test.com' OR Email LIKE '%@demo.com';

-- =====================================================================================
-- ESSENTIAL TEST USERS FOR DEVELOPMENT
-- =====================================================================================

-- Staff/Admin User (for system administration)
-- Password: Password123! (real bcrypt hash with 12 rounds)
INSERT IGNORE INTO tblusers (UserID, FullName, Email, PasswordHash, Role, Status, Phone) VALUES
(21, 'Sarah Staff', 'staff@demo.com', '$2b$12$LrQYOqJ3jZq3/XPKjxGBiup2mQyDl0sMUOODgKwfN2eGVZNQXV1yq', 'Staff', 'Active', '+27821234567');

-- Landlord Users (for property management)
-- Password: Password123! (real bcrypt hash with 12 rounds)
INSERT IGNORE INTO tblusers (UserID, FullName, Email, PasswordHash, Role, Status, Phone) VALUES
(23, 'Lisa Landlord', 'landlord@demo.com', '$2b$12$LrQYOqJ3jZq3/XPKjxGBiup2mQyDl0sMUOODgKwfN2eGVZNQXV1yq', 'Landlord', 'Active', '+27821234568'),
(33, 'Test Landlord', 'landlord@test.com', '$2b$12$LrQYOqJ3jZq3/XPKjxGBiup2mQyDl0sMUOODgKwfN2eGVZNQXV1yq', 'Landlord', 'Active', '+27821234569');

-- Contractor Users (for service providers)
-- Password: Password123! (real bcrypt hash with 12 rounds)
INSERT IGNORE INTO tblusers (UserID, FullName, Email, PasswordHash, Role, Status, Phone) VALUES
(22, 'Mike Contractor', 'contractor@demo.com', '$2b$12$LrQYOqJ3jZq3/XPKjxGBiup2mQyDl0sMUOODgKwfN2eGVZNQXV1yq', 'Contractor', 'Active', '+27821234570'),
(34, 'Test Contractor', 'contractor@test.com', '$2b$12$LrQYOqJ3jZq3/XPKjxGBiup2mQyDl0sMUOODgKwfN2eGVZNQXV1yq', 'Contractor', 'Active', '+27821234571');

-- Client Users (for tenants/property clients)
-- Password: Password123! (real bcrypt hash with 12 rounds)
INSERT IGNORE INTO tblusers (UserID, FullName, Email, PasswordHash, Role, Status, Phone) VALUES
(20, 'John Client', 'client@demo.com', '$2b$12$LrQYOqJ3jZq3/XPKjxGBiup2mQyDl0sMUOODgKwfN2eGVZNQXV1yq', 'Client', 'Active', '+27821234572'),
(35, 'Test Client', 'client@test.com', '$2b$12$LrQYOqJ3jZq3/XPKjxGBiup2mQyDl0sMUOODgKwfN2eGVZNQXV1yq', 'Client', 'Active', '+27821234573');

-- =====================================================================================
-- VERIFICATION QUERIES
-- =====================================================================================

-- Show user count by role
SELECT 
    Role,
    COUNT(*) as user_count
FROM tblusers 
WHERE Email IN ('staff@demo.com', 'landlord@demo.com', 'landlord@test.com', 
               'contractor@demo.com', 'contractor@test.com', 'client@demo.com', 'client@test.com')
GROUP BY Role
ORDER BY Role;

-- Show all essential test users
SELECT UserID, FullName, Email, Role, Status 
FROM tblusers 
WHERE Email IN ('staff@demo.com', 'landlord@demo.com', 'landlord@test.com', 
               'contractor@demo.com', 'contractor@test.com', 'client@demo.com', 'client@test.com')
ORDER BY Role, FullName;

-- =====================================================================================
-- LOGIN CREDENTIALS (for team reference)
-- =====================================================================================

SELECT 'TEAM LOGIN CREDENTIALS (Password: Password123! for all users)' as info;
SELECT '=================================================' as line;
SELECT 'Staff Login: staff@demo.com' as staff_login;
SELECT 'Landlord Login: landlord@demo.com OR landlord@test.com' as landlord_login;
SELECT 'Contractor Login: contractor@demo.com OR contractor@test.com' as contractor_login;
SELECT 'Client Login: client@demo.com OR client@test.com' as client_login;
SELECT 'Password for ALL: Password123!' as password_info;