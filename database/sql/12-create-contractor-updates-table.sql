-- Create tblContractorUpdates table for job progress updates
-- Run this script after creating tblTickets and tblUsers tables
-- Stores progress updates, photos, and notes from contractors during work

USE Rawson;

CREATE TABLE IF NOT EXISTS tblContractorUpdates (
  UpdateID INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique update record ID',
  TicketID INT NOT NULL COMMENT 'Ticket/job updated',
  ContractorUserID INT NOT NULL COMMENT 'Contractor submitting update',
  UpdateType ENUM('Photo','Note','Other') NOT NULL COMMENT 'Type of update',
  UpdateContent TEXT NULL COMMENT 'Notes or description',
  UpdateURL VARCHAR(255) NULL COMMENT 'URL to photo/video if applicable',
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'When update was submitted',
  
  -- Foreign key constraints
  FOREIGN KEY (TicketID) REFERENCES tblTickets(TicketID) 
    ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (ContractorUserID) REFERENCES tblusers(UserID) 
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Contractor job progress updates';

-- Create indexes for better performance
CREATE INDEX idx_contractor_updates_ticket ON tblContractorUpdates (TicketID);
CREATE INDEX idx_contractor_updates_contractor ON tblContractorUpdates (ContractorUserID);
CREATE INDEX idx_contractor_updates_type ON tblContractorUpdates (UpdateType);
CREATE INDEX idx_contractor_updates_created ON tblContractorUpdates (CreatedAt);

-- Verify table structure
DESCRIBE tblContractorUpdates;
