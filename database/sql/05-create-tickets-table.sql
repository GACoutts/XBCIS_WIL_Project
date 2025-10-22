-- Create tblTickets table for maintenance ticket management
-- Run this script after creating tblUsers table
-- This is the core table for the ticket management system

USE Rawson;

CREATE TABLE IF NOT EXISTS tblTickets (
  TicketID INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique ticket identifier',
  ClientUserID INT NOT NULL COMMENT 'Client who created the ticket',
  TicketRefNumber VARCHAR(50) NOT NULL UNIQUE COMMENT 'Auto-generated ticket reference',
  Description TEXT NOT NULL COMMENT 'Description of the maintenance issue',
  UrgencyLevel ENUM('Low','Medium','High','Critical') NOT NULL COMMENT 'Urgency/severity level',
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'When ticket was created',
  CurrentStatus ENUM('New','In Review','Quoting','Awaiting Landlord Approval','Approved','Scheduled','Completed') DEFAULT 'New' COMMENT 'Current status of the ticket',

  -- Foreign key constraints
  FOREIGN KEY (ClientUserID) REFERENCES tblusers(UserID)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Maintenance tickets submitted by clients';

-- Create indexes for better performance
CREATE INDEX idx_tickets_client ON tblTickets (ClientUserID);
CREATE INDEX idx_tickets_status ON tblTickets (CurrentStatus);
CREATE INDEX idx_tickets_urgency ON tblTickets (UrgencyLevel);
CREATE INDEX idx_tickets_created ON tblTickets (CreatedAt);
CREATE INDEX idx_tickets_ref_number ON tblTickets (TicketRefNumber);

ALTER TABLE tblTickets
  ADD COLUMN AssignedContractorID INT NULL AFTER CurrentStatus,
  ADD INDEX idx_tickets_assigned_contractor (AssignedContractorID);

ALTER TABLE tblTickets
  MODIFY CurrentStatus ENUM(
    'New',
    'In Review',
    'Quoting',
    'Awaiting Landlord Approval',
    'Approved',
    'Scheduled',
    'Completed',
    'Rejected',
    'Cancelled'
  ) NOT NULL DEFAULT 'In Review';

-- Verify table structure
DESCRIBE tblTickets;
