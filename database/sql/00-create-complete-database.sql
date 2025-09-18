-- ============================================================================
-- RAWSON BUILDING MANAGEMENT SYSTEM - COMPLETE DATABASE SETUP
-- ============================================================================
-- This is the MASTER script that creates the entire database system from scratch
-- Run this single script as MySQL root user to set up everything
--
-- What this script does:
-- 1. Creates Rawson database with proper charset
-- 2. Creates tblusers table with indexes
-- 3. Creates application user with limited privileges
-- 4. Seeds admin user for testing
-- 5. Creates all 10 ticket management tables
-- 6. Creates all performance indexes
-- 7. Runs verification queries
--
-- Usage: mysql -u root -p < database/sql/00-create-complete-database.sql
-- ============================================================================

-- Start with clean slate
SET FOREIGN_KEY_CHECKS = 0;
SET AUTOCOMMIT = 0;
START TRANSACTION;

-- ============================================================================
-- STEP 1: CREATE DATABASE
-- ============================================================================
-- Create Rawson database with proper character set

CREATE DATABASE IF NOT EXISTS Rawson
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE Rawson;

SELECT 'âœ… Step 1: Database created' as Status;

-- ============================================================================
-- STEP 2: CREATE USERS TABLE
-- ============================================================================
-- Create tblusers table with specified schema

CREATE TABLE IF NOT EXISTS tblusers (
  UserID INT AUTO_INCREMENT PRIMARY KEY,
  FullName VARCHAR(100) NOT NULL,
  Email VARCHAR(150) NOT NULL UNIQUE,
  PasswordHash VARCHAR(255) NOT NULL,
  Phone VARCHAR(20) NULL,
  Role ENUM('Client','Landlord','Contractor','Staff') NOT NULL,
  DateRegistered DATETIME DEFAULT CURRENT_TIMESTAMP,
  Status ENUM('Active','Inactive','Suspended', 'Rejected') DEFAULT 'Active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Add indexes for better performance
CREATE INDEX idx_tblusers_status ON tblusers (Status);
CREATE INDEX idx_tblusers_role ON tblusers (Role);

SELECT 'âœ… Step 2: Users table created' as Status;

-- ============================================================================
-- STEP 3: SEED ADMIN USER
-- ============================================================================
-- Create admin user for testing (Password: "Password123!")

INSERT INTO tblusers
  (FullName, Email, PasswordHash, Phone, Role, Status)
VALUES
  ('Admin User', 'admin@rawson.local', '$2b$12$GwD4ledPuqrDI3CVijXScurralqh1VedX/I9alVhrno16xk5rLGWq', NULL, 'Staff', 'Active')
ON DUPLICATE KEY UPDATE
  FullName = VALUES(FullName),
  PasswordHash = VALUES(PasswordHash),
  Role = VALUES(Role),
  Status = VALUES(Status);

SELECT 'âœ… Step 3: Admin user seeded' as Status;

-- ============================================================================
-- STEP 4: CREATE ALL TICKET MANAGEMENT TABLES
-- ============================================================================

-- 4.1: Main tickets table (depends on tblusers)
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

-- 4.2: Ticket media attachments (depends on tblTickets)
CREATE TABLE IF NOT EXISTS tblTicketMedia (
  MediaID INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique media identifier',
  TicketID INT NOT NULL COMMENT 'Associated ticket',
  MediaType ENUM('Image','Video') NOT NULL COMMENT 'Type of media',
  MediaURL VARCHAR(255) NOT NULL COMMENT 'URL or path to media file',
  UploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'When media was uploaded',

  FOREIGN KEY (TicketID) REFERENCES tblTickets(TicketID)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Media attachments for maintenance tickets';

-- 4.3: Ticket status history (depends on tblTickets and tblusers)
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

-- 4.4: Contractor quotes (depends on tblTickets and tblusers)
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

-- 4.5: Quote document attachments (depends on tblQuotes)
CREATE TABLE IF NOT EXISTS tblQuoteDocuments (
  DocumentID INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique document identifier',
  QuoteID INT NOT NULL COMMENT 'Associated quote',
  DocumentType ENUM('PDF','Image') NOT NULL COMMENT 'Type of document',
  DocumentURL VARCHAR(255) NOT NULL COMMENT 'URL or path to document file',
  UploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'When document was uploaded',

  FOREIGN KEY (QuoteID) REFERENCES tblQuotes(QuoteID)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Document attachments for contractor quotes';

-- 4.6: Landlord approval decisions (depends on tblQuotes and tblusers)
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

-- 4.7: Contractor schedules (depends on tblTickets and tblusers)
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

-- 4.8: Contractor job updates (depends on tblTickets and tblusers)
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

-- 4.9: System notifications (depends on tblusers and tblTickets)
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

-- 4.10: User communications (depends on tblusers and tblTickets)
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

SELECT 'âœ… Step 4: All ticket management tables created' as Status;

-- ============================================================================
-- STEP 5: CREATE PERFORMANCE INDEXES
-- ============================================================================

-- Tickets table indexes
CREATE INDEX idx_tickets_client ON tblTickets (ClientUserID);
CREATE INDEX idx_tickets_status ON tblTickets (CurrentStatus);
CREATE INDEX idx_tickets_urgency ON tblTickets (UrgencyLevel);
CREATE INDEX idx_tickets_created ON tblTickets (CreatedAt);
CREATE INDEX idx_tickets_ref_number ON tblTickets (TicketRefNumber);

-- Media table indexes
CREATE INDEX idx_ticket_media_ticket ON tblTicketMedia (TicketID);
CREATE INDEX idx_ticket_media_type ON tblTicketMedia (MediaType);

-- Status history indexes
CREATE INDEX idx_status_history_ticket ON tblTicketStatusHistory (TicketID);
CREATE INDEX idx_status_history_user ON tblTicketStatusHistory (UpdatedByUserID);
CREATE INDEX idx_status_history_status ON tblTicketStatusHistory (Status);

-- Quotes table indexes
CREATE INDEX idx_quotes_ticket ON tblQuotes (TicketID);
CREATE INDEX idx_quotes_contractor ON tblQuotes (ContractorUserID);
CREATE INDEX idx_quotes_status ON tblQuotes (QuoteStatus);
CREATE INDEX idx_quotes_amount ON tblQuotes (QuoteAmount);

-- Quote documents indexes
CREATE INDEX idx_quote_documents_quote ON tblQuoteDocuments (QuoteID);
CREATE INDEX idx_quote_documents_type ON tblQuoteDocuments (DocumentType);

-- Landlord approvals indexes
CREATE INDEX idx_landlord_approvals_quote ON tblLandlordApprovals (QuoteID);
CREATE INDEX idx_landlord_approvals_landlord ON tblLandlordApprovals (LandlordUserID);
CREATE INDEX idx_landlord_approvals_status ON tblLandlordApprovals (ApprovalStatus);

-- Contractor schedules indexes
CREATE INDEX idx_contractor_schedules_ticket ON tblContractorSchedules (TicketID);
CREATE INDEX idx_contractor_schedules_contractor ON tblContractorSchedules (ContractorUserID);
CREATE INDEX idx_contractor_schedules_date ON tblContractorSchedules (ProposedDate);

-- Contractor updates indexes
CREATE INDEX idx_contractor_updates_ticket ON tblContractorUpdates (TicketID);
CREATE INDEX idx_contractor_updates_contractor ON tblContractorUpdates (ContractorUserID);
CREATE INDEX idx_contractor_updates_type ON tblContractorUpdates (UpdateType);

-- Notifications indexes
CREATE INDEX idx_notifications_user ON tblNotifications (UserID);
CREATE INDEX idx_notifications_ticket ON tblNotifications (TicketID);
CREATE INDEX idx_notifications_type ON tblNotifications (NotificationType);

-- Communications indexes
CREATE INDEX idx_communications_ticket ON tblCommunications (TicketID);
CREATE INDEX idx_communications_sender ON tblCommunications (SenderUserID);
CREATE INDEX idx_communications_receiver ON tblCommunications (ReceiverUserID);
CREATE INDEX idx_communications_type ON tblCommunications (MessageType);

SELECT 'âœ… Step 5: All performance indexes created' as Status;

-- ============================================================================
-- STEP 6: CREATE APPLICATION USER (OPTIONAL)
-- ============================================================================
-- Uncomment and modify the password before running in production

/*
-- Create the application user (localhost only for security)
CREATE USER IF NOT EXISTS 'rawson_local'@'localhost' IDENTIFIED BY 'REPLACE_WITH_STRONG_PASSWORD';

-- Grant only necessary privileges (no DROP, ALTER for security)
GRANT SELECT, INSERT, UPDATE ON Rawson.* TO 'rawson_local'@'localhost';

-- Apply changes
FLUSH PRIVILEGES;

SELECT 'âœ… Step 6: Application user created' as Status;
*/

-- ============================================================================
-- STEP 7: FINALIZE AND VERIFY
-- ============================================================================

-- Re-enable foreign key checks and commit
SET FOREIGN_KEY_CHECKS = 1;
COMMIT;

-- Show all created tables
SELECT 'ðŸ” VERIFICATION: All Tables Created' as Section;
SHOW TABLES;

-- Display table record counts
SELECT 'ðŸ“Š TABLE RECORD COUNTS' as Section;
SELECT
  'tblusers' as TableName, COUNT(*) as RecordCount FROM tblusers
UNION ALL
SELECT 'tblTickets', COUNT(*) FROM tblTickets
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

-- Show database information
SELECT 'ðŸ“‹ DATABASE INFO' as Section;
SELECT
  DATABASE() as CurrentDatabase,
  @@character_set_database as Charset,
  @@collation_database as Collation;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
SELECT 'ðŸŽ‰ COMPLETE SUCCESS! ðŸŽ‰' as Status;
SELECT 'Rawson Building Management System database created successfully!' as Message;
SELECT 'Next steps:' as NextSteps;
SELECT '1. Update backend/.env with database credentials' as Step1;
SELECT '2. Test with: http://localhost:5000/api/health' as Step2;
SELECT '3. Login with: admin@rawson.local / Password123!' as Step3;
