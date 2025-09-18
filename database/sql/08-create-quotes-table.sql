-- Create tblQuotes table for contractor quotes
-- Run this script after creating tblTickets and tblUsers tables
-- Stores quotes submitted by contractors for maintenance work

USE Rawson;

CREATE TABLE IF NOT EXISTS tblQuotes (
  QuoteID INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique quote identifier',
  TicketID INT NOT NULL COMMENT 'Ticket the quote is for',
  ContractorUserID INT NOT NULL COMMENT 'Contractor who submitted quote',
  QuoteAmount DECIMAL(15,2) NOT NULL COMMENT 'Amount quoted in currency',
  QuoteDescription TEXT NULL COMMENT 'Additional quote details',
  SubmittedAt DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'When quote was submitted',
  QuoteStatus ENUM('Pending','Approved','Rejected') DEFAULT 'Pending' COMMENT 'Current quote status',

  -- Foreign key constraints
  FOREIGN KEY (TicketID) REFERENCES tblTickets(TicketID)
    ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (ContractorUserID) REFERENCES tblusers(UserID)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Contractor quotes for maintenance tickets';

-- Create indexes for better performance
CREATE INDEX idx_quotes_ticket ON tblQuotes (TicketID);
CREATE INDEX idx_quotes_contractor ON tblQuotes (ContractorUserID);
CREATE INDEX idx_quotes_status ON tblQuotes (QuoteStatus);
CREATE INDEX idx_quotes_amount ON tblQuotes (QuoteAmount);
CREATE INDEX idx_quotes_submitted ON tblQuotes (SubmittedAt);

-- Verify table structure
DESCRIBE tblQuotes;
