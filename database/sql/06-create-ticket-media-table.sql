-- Create tblTicketMedia table for ticket media attachments
-- Run this script after creating tblTickets table
-- Stores images and videos uploaded with maintenance tickets

USE Rawson;

CREATE TABLE IF NOT EXISTS tblTicketMedia (
  MediaID INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique media identifier',
  TicketID INT NOT NULL COMMENT 'Associated ticket',
  MediaType ENUM('Image','Video') NOT NULL COMMENT 'Type of media',
  MediaURL VARCHAR(255) NOT NULL COMMENT 'URL or path to media file',
  UploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'When media was uploaded',
  
  -- Foreign key constraints
  FOREIGN KEY (TicketID) REFERENCES tblTickets(TicketID) 
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Media attachments for maintenance tickets';

-- Create indexes for better performance
CREATE INDEX idx_ticket_media_ticket ON tblTicketMedia (TicketID);
CREATE INDEX idx_ticket_media_type ON tblTicketMedia (MediaType);
CREATE INDEX idx_ticket_media_uploaded ON tblTicketMedia (UploadedAt);

-- Verify table structure
DESCRIBE tblTicketMedia;
