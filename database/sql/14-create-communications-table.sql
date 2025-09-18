-- Create tblCommunications table for message history
-- Run this script after creating tblTickets and tblUsers tables
-- Stores WhatsApp and email communications between users

USE Rawson;

CREATE TABLE IF NOT EXISTS tblCommunications (
  CommunicationID INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique communication record ID',
  TicketID INT NULL COMMENT 'Ticket the message relates to',
  SenderUserID INT NOT NULL COMMENT 'User who sent the message',
  ReceiverUserID INT NOT NULL COMMENT 'User who received the message',
  MessageContent TEXT NOT NULL COMMENT 'Content of the message',
  MessageType ENUM('WhatsApp','Email') NOT NULL COMMENT 'Communication channel',
  SentAt DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'When message was sent',

  -- Foreign key constraints
  FOREIGN KEY (TicketID) REFERENCES tblTickets(TicketID)
    ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (SenderUserID) REFERENCES tblusers(UserID)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (ReceiverUserID) REFERENCES tblusers(UserID)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Communication history between users';

-- Create indexes for better performance
CREATE INDEX IdxCommunicationsTicket ON tblCommunications (TicketID);
CREATE INDEX IdxCommunicationsSender ON tblCommunications (SenderUserID);
CREATE INDEX IdxCommunicationsReceiver ON tblCommunications (ReceiverUserID);
CREATE INDEX IdxCommunicationsType ON tblCommunications (MessageType);
CREATE INDEX IdxCommunicationsSent ON tblCommunications (SentAt);

-- Verify table structure
DESCRIBE tblCommunications;
