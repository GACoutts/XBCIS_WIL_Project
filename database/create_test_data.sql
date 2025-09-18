USE Rawson;

-- Create test tickets
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
INSERT INTO tblLandlordApprovals (QuoteID, LandlordUserID, ApprovalStatus, ApprovedAt)
VALUES 
(@quote1, 33, 'Approved', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(@quote2, 33, 'Pending', NULL),
(@quote3, 33, 'Pending', NULL);

-- Create some contractor schedules (appointments)
INSERT INTO tblContractorSchedules (TicketID, ContractorUserID, ProposedDate, ClientConfirmed, Notes)
VALUES 
(@ticket1, 34, DATE_ADD(NOW(), INTERVAL 2 DAY), TRUE, 'Initial inspection and repair'),
(@ticket3, 34, DATE_ADD(NOW(), INTERVAL 5 DAY), FALSE, 'Tile measurement and quote discussion');

-- Show summary of created data
SELECT 'Test data created successfully!' as Status;
SELECT 'Tickets created:' as Info;
SELECT TicketID, TicketRefNumber, Description, UrgencyLevel, CurrentStatus FROM tblTickets WHERE TicketRefNumber LIKE 'TCKT-%';

SELECT 'Quotes created:' as Info;
SELECT q.QuoteID, q.TicketID, t.TicketRefNumber, q.QuoteAmount, q.QuoteStatus 
FROM tblQuotes q 
JOIN tblTickets t ON q.TicketID = t.TicketID 
WHERE t.TicketRefNumber LIKE 'TCKT-%';

SELECT 'Landlord approvals created:' as Info;
SELECT la.*, t.TicketRefNumber 
FROM tblLandlordApprovals la
JOIN tblQuotes q ON la.QuoteID = q.QuoteID
JOIN tblTickets t ON q.TicketID = t.TicketID
WHERE t.TicketRefNumber LIKE 'TCKT-%';