-- Create tblContractorSchedules table for appointment scheduling
-- Run this script after creating tblTickets and tblUsers tables
-- Stores proposed appointment dates and client confirmations

USE Rawson;

CREATE TABLE IF NOT EXISTS tblContractorSchedules (
  ScheduleID INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique schedule record ID',
  TicketID INT NOT NULL COMMENT 'Ticket for the job',
  ContractorUserID INT NOT NULL COMMENT 'Contractor proposing the schedule',
  ProposedDate DATETIME NOT NULL COMMENT 'Proposed appointment date/time',
  ClientConfirmed BOOLEAN DEFAULT FALSE COMMENT 'Has the client confirmed access?',
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'When schedule was created',

  -- Foreign key constraints
  FOREIGN KEY (TicketID) REFERENCES tblTickets(TicketID)
    ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (ContractorUserID) REFERENCES tblusers(UserID)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Contractor appointment scheduling';

-- Create indexes for better performance
CREATE INDEX IdxContractorSchedulesTicket ON tblContractorSchedules (TicketID);
CREATE INDEX IdxContractorSchedulesContractor ON tblContractorSchedules (ContractorUserID);
CREATE INDEX IdxContractorSchedulesDate ON tblContractorSchedules (ProposedDate);
CREATE INDEX IdxContractorSchedulesConfirmed ON tblContractorSchedules (ClientConfirmed);
CREATE INDEX IdxContractorSchedulesCreated ON tblContractorSchedules (CreatedAt);

ALTER TABLE tblContractorSchedules
  ADD COLUMN ContractorConfirmed TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN ProposedBy ENUM('Client','Contractor') NOT NULL DEFAULT 'Contractor';

-- Verify table structure
DESCRIBE tblContractorSchedules;
