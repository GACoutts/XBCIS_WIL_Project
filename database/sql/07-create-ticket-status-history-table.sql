-- Create tblTicketStatusHistory table for audit trail
-- Run this script after creating tblTickets and tblUsers tables
-- Tracks all status changes made to tickets over time

USE Rawson;

CREATE TABLE IF NOT EXISTS tblTicketStatusHistory (
  StatusHistoryID INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique record ID',
  TicketID INT NOT NULL COMMENT 'Ticket being updated',
  Status ENUM('New','In Review','Quoting','Awaiting Landlord Approval','Approved','Scheduled','Completed') NOT NULL COMMENT 'Status after update',
  UpdatedByUserID INT NOT NULL COMMENT 'User who updated status',
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'When status was updated',
  
  -- Foreign key constraints
  FOREIGN KEY (TicketID) REFERENCES tblTickets(TicketID) 
    ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (UpdatedByUserID) REFERENCES tblusers(UserID) 
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Audit trail of ticket status changes';

-- Create indexes for better performance
CREATE INDEX idx_status_history_ticket ON tblTicketStatusHistory (TicketID);
CREATE INDEX idx_status_history_user ON tblTicketStatusHistory (UpdatedByUserID);
CREATE INDEX idx_status_history_status ON tblTicketStatusHistory (Status);
CREATE INDEX idx_status_history_updated ON tblTicketStatusHistory (UpdatedAt);

-- Verify table structure
DESCRIBE tblTicketStatusHistory;
