USE Rawson;

-- Update the test user to be a Landlord
UPDATE tblusers 
SET Role = 'Landlord' 
WHERE Email = 'landlord@test.com';

-- Create some test data for landlord testing
-- First, let's create a contractor
INSERT IGNORE INTO tblusers (FullName, Email, PasswordHash, Role, Status) 
VALUES ('Test Contractor', 'contractor@test.com', '$2b$12$GwD4ledPuqrDI3CVijXScurralqh1VedX/I9alVhrno16xk5rLGWq', 'Contractor', 'Active');

-- Create a client
INSERT IGNORE INTO tblusers (FullName, Email, PasswordHash, Role, Status) 
VALUES ('Test Client', 'client@test.com', '$2b$12$GwD4ledPuqrDI3CVijXScurralqh1VedX/I9alVhrno16xk5rLGWq', 'Client', 'Active');

-- Get the user IDs (we'll need to run subsequent queries based on these)
SELECT 'User IDs created:' as Info;
SELECT UserID, FullName, Role FROM tblusers WHERE Email IN ('landlord@test.com', 'contractor@test.com', 'client@test.com');