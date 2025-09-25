-- Master script to create all ticket management system tables
-- Run this script as MySQL root user after creating database and tblusers table
-- Creates all tables in the correct order to handle foreign key dependencies

USE Rawson;

-- Disable foreign key checks temporarily for clean creation
SET FOREIGN_KEY_CHECKS = 0;

-- Start transaction for rollback capability
START TRANSACTION;

-- ==================================================
-- CORE TICKET MANAGEMENT TABLES
-- ==================================================

-- 1. Main tickets table (depends on tblusers)
CREATE TABLE IF NOT EXISTS tblTickets (
  TicketID INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique ticket identifier',
  ClientUserID INT NOT NULL COMMENT 'Client who created the ticket',
  TicketRefNumber VARCHAR(50) NOT NULL UNIQUE COMMENT 'Auto-generated ticket reference',
  Description TEXT NOT NULL COMMENT 'Description of the maintenance issue',
  UrgencyLevel ENUM('Low','Medium','High','Critical') NOT NULL COMMENT 'Urgency/severity level',
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'When ticket was created',
  CurrentStatus ENUM('New','In Review','Quoting','Awaiting Landlord Approval','Approved','Scheduled','Completed') DEFAULT 'New' COMMENT 'Current status of the ticket',

  FOREIGN KEY (ClientUserID) REFERENCES tblusers(UserID)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Maintenance tickets submitted by clients';

-- 2. Ticket media attachments (depends on tblTickets)
CREATE TABLE IF NOT EXISTS tblTicketMedia (
  MediaID INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique media identifier',
  TicketID INT NOT NULL COMMENT 'Associated ticket',
  MediaType ENUM('Image','Video') NOT NULL COMMENT 'Type of media',
  MediaURL VARCHAR(255) NOT NULL COMMENT 'URL or path to media file',
  UploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'When media was uploaded',

  FOREIGN KEY (TicketID) REFERENCES tblTickets(TicketID)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Media attachments for maintenance tickets';

-- 3. Ticket status history (depends on tblTickets and tblusers)
CREATE TABLE IF NOT EXISTS tblTicketStatusHistory (
  StatusHistoryID INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique record ID',
  TicketID INT NOT NULL COMMENT 'Ticket being updated',
  Status ENUM('New','In Review','Quoting','Awaiting Landlord Approval','Approved','Scheduled','Completed') NOT NULL COMMENT 'Status after update',
  UpdatedByUserID INT NOT NULL COMMENT 'User who updated status',
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'When status was updated',

  FOREIGN KEY (TicketID) REFERENCES tblTickets(TicketID)
    ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (UpdatedByUserID) REFERENCES tblusers(UserID)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Audit trail of ticket status changes';

-- ==================================================
-- QUOTE MANAGEMENT TABLES
-- ==================================================

-- 4. Contractor quotes (depends on tblTickets and tblusers)
CREATE TABLE IF NOT EXISTS tblQuotes (
  QuoteID INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique quote identifier',
  TicketID INT NOT NULL COMMENT 'Ticket the quote is for',
  ContractorUserID INT NOT NULL COMMENT 'Contractor who submitted quote',
  QuoteAmount DECIMAL(15,2) NOT NULL COMMENT 'Amount quoted in currency',
  QuoteDescription TEXT NULL COMMENT 'Additional quote details',
  SubmittedAt DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'When quote was submitted',
  QuoteStatus ENUM('Pending','Approved','Rejected') DEFAULT 'Pending' COMMENT 'Current quote status',

  FOREIGN KEY (TicketID) REFERENCES tblTickets(TicketID)
    ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (ContractorUserID) REFERENCES tblusers(UserID)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Contractor quotes for maintenance tickets';

-- 5. Quote document attachments (depends on tblQuotes)
CREATE TABLE IF NOT EXISTS tblQuoteDocuments (
  DocumentID INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique document identifier',
  QuoteID INT NOT NULL COMMENT 'Associated quote',
  DocumentType ENUM('PDF','Image') NOT NULL COMMENT 'Type of document',
  DocumentURL VARCHAR(255) NOT NULL COMMENT 'URL or path to document file',
  UploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'When document was uploaded',

  FOREIGN KEY (QuoteID) REFERENCES tblQuotes(QuoteID)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Document attachments for contractor quotes';

-- 6. Landlord approval decisions (depends on tblQuotes and tblusers)
CREATE TABLE IF NOT EXISTS tblLandlordApprovals (
  ApprovalID INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique approval record ID',
  QuoteID INT NOT NULL COMMENT 'Quote being approved/rejected',
  LandlordUserID INT NOT NULL COMMENT 'Landlord who approved/rejected',
  ApprovalStatus ENUM('Approved','Rejected') NOT NULL COMMENT 'Approval decision',
  ApprovedAt DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'When decision was made',
  DigitalSignature VARCHAR(255) NULL COMMENT 'Optional digital signature image/path',

  FOREIGN KEY (QuoteID) REFERENCES tblQuotes(QuoteID)
    ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (LandlordUserID) REFERENCES tblusers(UserID)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Landlord approval decisions for quotes';

-- ==================================================
-- JOB EXECUTION TABLES
-- ==================================================

-- 7. Contractor schedules (depends on tblTickets and tblusers)
CREATE TABLE IF NOT EXISTS tblContractorSchedules (
  ScheduleID INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique schedule record ID',
  TicketID INT NOT NULL COMMENT 'Ticket for the job',
  ContractorUserID INT NOT NULL COMMENT 'Contractor proposing the schedule',
  ProposedDate DATETIME NOT NULL COMMENT 'Proposed appointment date/time',
  ClientConfirmed BOOLEAN DEFAULT FALSE COMMENT 'Has the client confirmed access?',
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'When schedule was created',

  FOREIGN KEY (TicketID) REFERENCES tblTickets(TicketID)
    ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (ContractorUserID) REFERENCES tblusers(UserID)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Contractor appointment scheduling';

-- 8. Contractor job updates (depends on tblTickets and tblusers)
CREATE TABLE IF NOT EXISTS tblContractorUpdates (
  UpdateID INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique update record ID',
  TicketID INT NOT NULL COMMENT 'Ticket/job updated',
  ContractorUserID INT NOT NULL COMMENT 'Contractor submitting update',
  UpdateType ENUM('Photo','Note','Other') NOT NULL COMMENT 'Type of update',
  UpdateContent TEXT NULL COMMENT 'Notes or description',
  UpdateURL VARCHAR(255) NULL COMMENT 'URL to photo/video if applicable',
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'When update was submitted',

  FOREIGN KEY (TicketID) REFERENCES tblTickets(TicketID)
    ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (ContractorUserID) REFERENCES tblusers(UserID)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Contractor job progress updates';

-- ==================================================
-- COMMUNICATION TABLES
-- ==================================================

-- 9. System notifications (depends on tblusers and tblTickets)
CREATE TABLE IF NOT EXISTS tblNotifications (
  NotificationID INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique notification ID',
  UserID INT NOT NULL COMMENT 'User who received the notification',
  TicketID INT NULL COMMENT 'Related ticket, if applicable',
  NotificationType ENUM('Push','Email','WhatsApp') NOT NULL COMMENT 'Notification channel',
  NotificationContent TEXT NOT NULL COMMENT 'Content of the notification',
  SentAt DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'When notification was sent',
  Status ENUM('Sent','Failed') DEFAULT 'Sent' COMMENT 'Status of notification delivery',

  FOREIGN KEY (UserID) REFERENCES tblusers(UserID)
    ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (TicketID) REFERENCES tblTickets(TicketID)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='System notifications to users';

-- 10. User communications (depends on tblusers and tblTickets)
CREATE TABLE IF NOT EXISTS tblCommunications (
  CommunicationID INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique communication record ID',
  TicketID INT NULL COMMENT 'Ticket the message relates to',
  SenderUserID INT NOT NULL COMMENT 'User who sent the message',
  ReceiverUserID INT NOT NULL COMMENT 'User who received the message',
  MessageContent TEXT NOT NULL COMMENT 'Content of the message',
  MessageType ENUM('WhatsApp','Email') NOT NULL COMMENT 'Communication channel',
  SentAt DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'When message was sent',

  FOREIGN KEY (TicketID) REFERENCES tblTickets(TicketID)
    ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (SenderUserID) REFERENCES tblusers(UserID)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (ReceiverUserID) REFERENCES tblusers(UserID)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Communication history between users';

-- ==================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ==================================================

-- Tickets table indexes
CREATE INDEX IdxTicketsClient ON tblTickets (ClientUserID);
CREATE INDEX IdxTicketsStatus ON tblTickets (CurrentStatus);
CREATE INDEX IdxTicketsUrgency ON tblTickets (UrgencyLevel);
CREATE INDEX IdxTicketsCreated ON tblTickets (CreatedAt);
CREATE INDEX IdxTicketsRefNumber ON tblTickets (TicketRefNumber);

-- Media table indexes
CREATE INDEX IdxTicketMediaTicket ON tblTicketMedia (TicketID);
CREATE INDEX IdxTicketMediaType ON tblTicketMedia (MediaType);

-- Status history indexes
CREATE INDEX IdxStatusHistoryTicket ON tblTicketStatusHistory (TicketID);
CREATE INDEX IdxStatusHistoryUser ON tblTicketStatusHistory (UpdatedByUserID);
CREATE INDEX IdxStatusHistoryStatus ON tblTicketStatusHistory (Status);

-- Quotes table indexes
CREATE INDEX IdxQuotesTicket ON tblQuotes (TicketID);
CREATE INDEX IdxQuotesContractor ON tblQuotes (ContractorUserID);
CREATE INDEX IdxQuotesStatus ON tblQuotes (QuoteStatus);
CREATE INDEX IdxQuotesAmount ON tblQuotes (QuoteAmount);

-- Quote documents indexes
CREATE INDEX IdxQuoteDocumentsQuote ON tblQuoteDocuments (QuoteID);
CREATE INDEX IdxQuoteDocumentsType ON tblQuoteDocuments (DocumentType);

-- Landlord approvals indexes
CREATE INDEX IdxLandlordApprovalsQuote ON tblLandlordApprovals (QuoteID);
CREATE INDEX IdxLandlordApprovalsLandlord ON tblLandlordApprovals (LandlordUserID);
CREATE INDEX IdxLandlordApprovalsStatus ON tblLandlordApprovals (ApprovalStatus);

-- Contractor schedules indexes
CREATE INDEX IdxContractorSchedulesTicket ON tblContractorSchedules (TicketID);
CREATE INDEX IdxContractorSchedulesContractor ON tblContractorSchedules (ContractorUserID);
CREATE INDEX IdxContractorSchedulesDate ON tblContractorSchedules (ProposedDate);

-- Contractor updates indexes
CREATE INDEX IdxContractorUpdatesTicket ON tblContractorUpdates (TicketID);
CREATE INDEX IdxContractorUpdatesContractor ON tblContractorUpdates (ContractorUserID);
CREATE INDEX IdxContractorUpdatesType ON tblContractorUpdates (UpdateType);

-- Notifications indexes
CREATE INDEX IdxNotificationsUser ON tblNotifications (UserID);
CREATE INDEX IdxNotificationsTicket ON tblNotifications (TicketID);
CREATE INDEX IdxNotificationsType ON tblNotifications (NotificationType);

-- Communications indexes
CREATE INDEX IdxCommunicationsTicket ON tblCommunications (TicketID);
CREATE INDEX IdxCommunicationsSender ON tblCommunications (SenderUserID);
CREATE INDEX IdxCommunicationsReceiver ON tblCommunications (ReceiverUserID);
CREATE INDEX IdxCommunicationsType ON tblCommunications (MessageType);

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Commit the transaction
COMMIT;

-- ==================================================
-- VERIFICATION QUERIES
-- ==================================================

-- Show all created tables
SHOW TABLES LIKE 'tbl%';

-- Display table counts
SELECT
  'tblTickets' as TableName, COUNT(*) as RecordCount FROM tblTickets
UNION ALL
SELECT 'tblTicketMedia', COUNT(*) FROM tblTicketMedia
UNION ALL
SELECT 'tblTicketStatusHistory', COUNT(*) FROM tblTicketStatusHistory
UNION ALL
SELECT 'tblQuotes', COUNT(*) FROM tblQuotes
UNION ALL
SELECT 'tblQuoteDocuments', COUNT(*) FROM tblQuoteDocuments
UNION ALL
SELECT 'tblLandlordApprovals', COUNT(*) FROM tblLandlordApprovals
UNION ALL
SELECT 'tblContractorSchedules', COUNT(*) FROM tblContractorSchedules
UNION ALL
SELECT 'tblContractorUpdates', COUNT(*) FROM tblContractorUpdates
UNION ALL
SELECT 'tblNotifications', COUNT(*) FROM tblNotifications
UNION ALL
SELECT 'tblCommunications', COUNT(*) FROM tblCommunications;

SELECT 'âœ… All ticket management system tables created successfully!' as Status;
