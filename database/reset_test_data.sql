USE Rawson;

-- Clean up existing test data
DELETE FROM tblContractorSchedules WHERE TicketID IN (SELECT TicketID FROM tblTickets WHERE TicketRefNumber LIKE 'TCKT-%');
DELETE FROM tblLandlordApprovals WHERE QuoteID IN (SELECT QuoteID FROM tblQuotes WHERE TicketID IN (SELECT TicketID FROM tblTickets WHERE TicketRefNumber LIKE 'TCKT-%'));
DELETE FROM tblQuotes WHERE TicketID IN (SELECT TicketID FROM tblTickets WHERE TicketRefNumber LIKE 'TCKT-%');
DELETE FROM tblTickets WHERE TicketRefNumber LIKE 'TCKT-%';

-- Create fresh test tickets
INSERT INTO tblTickets (ClientUserID, TicketRefNumber, Description, UrgencyLevel, CurrentStatus) 
VALUES 
(35, 'TCKT-001', 'Leaky faucet in kitchen - urgent repair needed', 'High', 'Quoting'),
(35, 'TCKT-002', 'Minor electrical outlet repair', 'Low', 'New'),
(35, 'TCKT-003', 'Bathroom tiles replacement', 'Medium', 'Approved');

-- Get the ticket IDs
SET @ticket1 = (SELECT TicketID FROM tblTickets WHERE TicketRefNumber = 'TCKT-001');
SET @ticket2 = (SELECT TicketID FROM tblTickets WHERE TicketRefNumber = 'TCKT-002');
SET @ticket3 = (SELECT TicketID FROM tblTickets WHERE TicketRefNumber = 'TCKT-003');

-- Create quotes for these tickets
INSERT INTO tblQuotes (TicketID, ContractorUserID, QuoteAmount, QuoteStatus, SubmittedAt)
VALUES 
(@ticket1, 34, 150.00, 'Approved', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(@ticket2, 34, 75.00, 'Pending', DATE_SUB(NOW(), INTERVAL 2 HOUR)),
(@ticket3, 34, 300.00, 'Pending', DATE_SUB(NOW(), INTERVAL 3 DAY));

-- Get the quote IDs
SET @quote1 = (SELECT QuoteID FROM tblQuotes WHERE TicketID = @ticket1);
SET @quote2 = (SELECT QuoteID FROM tblQuotes WHERE TicketID = @ticket2);
SET @quote3 = (SELECT QuoteID FROM tblQuotes WHERE TicketID = @ticket3);

-- Create landlord approvals (this links the landlord to the quotes)
-- All quotes need landlord approval entries to be visible to the landlord in our API
INSERT INTO tblLandlordApprovals (QuoteID, LandlordUserID, ApprovalStatus, ApprovedAt)
VALUES 
(@quote1, 33, 'Approved', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(@quote2, 33, 'Approved', DATE_SUB(NOW(), INTERVAL 2 HOUR)),
(@quote3, 33, 'Rejected', DATE_SUB(NOW(), INTERVAL 1 HOUR));

-- Create some contractor schedules (appointments)
INSERT INTO tblContractorSchedules (TicketID, ContractorUserID, ProposedDate, ClientConfirmed)
VALUES 
(@ticket1, 34, DATE_ADD(NOW(), INTERVAL 2 DAY), TRUE),
(@ticket3, 34, DATE_ADD(NOW(), INTERVAL 5 DAY), FALSE);

-- Show summary of created data
SELECT 'Fresh test data created successfully!' as Status;
SELECT TicketID, TicketRefNumber, Description, UrgencyLevel, CurrentStatus FROM tblTickets WHERE TicketRefNumber LIKE 'TCKT-%';