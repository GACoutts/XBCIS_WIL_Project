-- ========================================================
-- Seed Data for Landlord API testing
-- ========================================================

USE Rawson;  -- change to your DB name if different

INSERT INTO tblproperties (PropertyID, PropertyRef, AddressLine1, City, Province)
VALUES (5001, 'PROP-5001', '123 Demo Street', 'Cape Town', 'Western Cape')
ON DUPLICATE KEY UPDATE AddressLine1=VALUES(AddressLine1);

INSERT INTO tblusers (UserID, FullName, Email, Role, PasswordHash)
VALUES (9001, 'Test Landlord', 'landlord@example.com', 'Landlord',
        '$2b$10$kVzi0Oskw5qgJkI9j7OqQeP8c4x8V7qz9Jf1n8pVx1V2l6u1H1Nhe')
ON DUPLICATE KEY UPDATE Role='Landlord';

INSERT INTO tbllandlordproperties (LandlordUserID, PropertyID, ActiveFrom, IsPrimary)
VALUES (9001, 5001, CURDATE(), 1)
ON DUPLICATE KEY UPDATE ActiveTo=NULL;

INSERT INTO tblusers (UserID, FullName, Email, Role, PasswordHash)
VALUES (9101, 'Test Contractor', 'contractor@example.com', 'Contractor',
        '$2b$10$kVzi0Oskw5qgJkI9j7OqQeP8c4x8V7qz9Jf1n8pVx1V2l6u1H1Nhe')
ON DUPLICATE KEY UPDATE Role='Contractor';

-- 2) Create a CLIENT user (the missing piece)
INSERT INTO tblusers (UserID, FullName, Email, Role, PasswordHash)
VALUES (9201, 'Test Client', 'client@example.com', 'Client',
        '$2b$10$kVzi0Oskw5qgJkI9j7OqQeP8c4x8V7qz9Jf1n8pVx1V2l6u1H1Nhe')
ON DUPLICATE KEY UPDATE Role='Client';

-- 3) Create the ticket linked to the property and the client
-- NOTE: CurrentStatus must be one of:
--   'New','In Review','Quoting','Awaiting Landlord Approval','Approved','Scheduled','Completed'
INSERT INTO tbltickets
  (TicketID, TicketRefNumber, Description, UrgencyLevel, CreatedAt, CurrentStatus, PropertyID, ClientUserID)
VALUES
  (7001, 'REF-7001', 'Leaking tap in kitchen', 'Medium', NOW(), 'New', 5001, 9201)
ON DUPLICATE KEY UPDATE
  PropertyID=VALUES(PropertyID),
  ClientUserID=VALUES(ClientUserID),
  CurrentStatus='New';

-- 4) Add a quote for that ticket (so /quotes/:ticketId returns something)
INSERT INTO tblquotes 
  (QuoteID, TicketID, ContractorUserID, QuoteAmount, QuoteStatus, SubmittedAt)
VALUES 
  (8001, 7001, 9101, 1250.00, 'Pending', NOW())
ON DUPLICATE KEY UPDATE 
  QuoteAmount = VALUES(QuoteAmount),
  QuoteStatus = VALUES(QuoteStatus);