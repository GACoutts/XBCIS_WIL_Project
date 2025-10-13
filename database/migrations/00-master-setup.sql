-- =====================================================================================
-- MASTER DATABASE SETUP SCRIPT
-- Red Rabbit Replacement - Rawson Property Management System
-- =====================================================================================
-- This script creates the complete database structure in the correct dependency order
-- Run as MySQL root user
-- =====================================================================================

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS Rawson 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE Rawson;

-- =====================================================================================
-- CORE TABLES (No dependencies)
-- =====================================================================================

-- 1. Users table (foundation for all other tables)
CREATE TABLE IF NOT EXISTS tblusers (
  UserID          INT AUTO_INCREMENT PRIMARY KEY,
  FullName        VARCHAR(100) NOT NULL,
  Email           VARCHAR(100) NOT NULL UNIQUE,
  PasswordHash    VARCHAR(255) NOT NULL,
  Phone           VARCHAR(20) NULL,
  Role            ENUM('Client','Landlord','Contractor','Staff') NOT NULL DEFAULT 'Client',
  Status          ENUM('Active','Inactive','Suspended','Pending','Rejected') NOT NULL DEFAULT 'Active',
  DateRegistered  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  LastLogin       DATETIME NULL,
  INDEX idx_email (Email),
  INDEX idx_role (Role),
  INDEX idx_status (Status)
);

-- =====================================================================================
-- AUTHENTICATION & SECURITY TABLES
-- =====================================================================================

-- 2. Refresh Tokens (depends on users)
CREATE TABLE IF NOT EXISTS tblrefreshtokens (
  TokenID       INT AUTO_INCREMENT PRIMARY KEY,
  UserID        INT NOT NULL,
  TokenHash     VARCHAR(64) NOT NULL,
  ExpiresAt     DATETIME NOT NULL,
  CreatedAt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  RevokedAt     DATETIME NULL,
  UserAgent     VARCHAR(500) NULL,
  IPAddress     VARCHAR(45) NULL,
  CONSTRAINT fk_rt_user FOREIGN KEY (UserID) REFERENCES tblusers(UserID) ON DELETE CASCADE,
  UNIQUE KEY uk_token_hash (TokenHash),
  INDEX idx_user_id (UserID),
  INDEX idx_expires (ExpiresAt)
);

-- 3. Revoked Access JTIs (security)
CREATE TABLE IF NOT EXISTS tblrevokedaccessjti (
  ID          INT AUTO_INCREMENT PRIMARY KEY,
  JTI         VARCHAR(36) NOT NULL,
  RevokedAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ExpiresAt   DATETIME NOT NULL,
  UNIQUE KEY uk_jti (JTI),
  INDEX idx_expires (ExpiresAt)
);

-- 4. Password Reset Tokens
CREATE TABLE IF NOT EXISTS tblpasswordresets (
  ResetID     INT AUTO_INCREMENT PRIMARY KEY,
  UserID      INT NOT NULL,
  TokenHash   VARCHAR(64) NOT NULL,
  ExpiresAt   DATETIME NOT NULL,
  CreatedAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UsedAt      DATETIME NULL,
  CONSTRAINT fk_pr_user FOREIGN KEY (UserID) REFERENCES tblusers(UserID) ON DELETE CASCADE,
  UNIQUE KEY uk_token_hash (TokenHash),
  INDEX idx_user_id (UserID),
  INDEX idx_expires (ExpiresAt)
);

-- 5. Legacy Password Reset Tokens (for backward compatibility)
CREATE TABLE IF NOT EXISTS tblpasswordresettokens (
  TokenID     INT AUTO_INCREMENT PRIMARY KEY,
  UserID      INT NOT NULL,
  Token       VARCHAR(255) NOT NULL,
  CreatedAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ExpiresAt   DATETIME NOT NULL,
  IsUsed      BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_prt_user FOREIGN KEY (UserID) REFERENCES tblusers(UserID) ON DELETE CASCADE,
  INDEX idx_token (Token),
  INDEX idx_user (UserID),
  INDEX idx_expires (ExpiresAt)
);

-- =====================================================================================
-- CORE BUSINESS TABLES
-- =====================================================================================

-- 6. Tickets (main business entity, depends on users)
CREATE TABLE IF NOT EXISTS tbltickets (
  TicketID         INT AUTO_INCREMENT PRIMARY KEY,
  ClientUserID     INT NOT NULL,
  TicketRefNumber  VARCHAR(50) NOT NULL UNIQUE,
  Description      TEXT NOT NULL,
  UrgencyLevel     ENUM('Low','Medium','High','Critical') NOT NULL,
  CreatedAt        DATETIME DEFAULT CURRENT_TIMESTAMP,
  CurrentStatus    ENUM('New','In Review','Quoting','Awaiting Landlord Approval','Approved','Scheduled','Completed') DEFAULT 'New',
  CONSTRAINT fk_ticket_client FOREIGN KEY (ClientUserID) REFERENCES tblusers(UserID) ON DELETE CASCADE,
  INDEX idx_client (ClientUserID),
  INDEX idx_status (CurrentStatus),
  INDEX idx_urgency (UrgencyLevel),
  INDEX idx_created (CreatedAt)
);

-- 7. Quotes (depends on tickets and users)
CREATE TABLE IF NOT EXISTS tblquotes (
  QuoteID           INT AUTO_INCREMENT PRIMARY KEY,
  TicketID          INT NOT NULL,
  ContractorUserID  INT NOT NULL,
  QuoteAmount       DECIMAL(10,2) NOT NULL,
  QuoteStatus       ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
  SubmittedAt       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_quote_ticket FOREIGN KEY (TicketID) REFERENCES tbltickets(TicketID) ON DELETE CASCADE,
  CONSTRAINT fk_quote_contractor FOREIGN KEY (ContractorUserID) REFERENCES tblusers(UserID) ON DELETE CASCADE,
  INDEX idx_ticket (TicketID),
  INDEX idx_contractor (ContractorUserID),
  INDEX idx_status (QuoteStatus),
  INDEX idx_submitted (SubmittedAt)
);

-- 8. Landlord Approvals (depends on quotes and users)
CREATE TABLE IF NOT EXISTS tbllandlordapprovals (
  ApprovalID       INT AUTO_INCREMENT PRIMARY KEY,
  QuoteID          INT NOT NULL,
  LandlordUserID   INT NOT NULL,
  ApprovalStatus   ENUM('Approved','Rejected') NOT NULL,
  ApprovedAt       DATETIME DEFAULT CURRENT_TIMESTAMP,
  DigitalSignature VARCHAR(255) NULL,
  CONSTRAINT fk_la_quote FOREIGN KEY (QuoteID) REFERENCES tblquotes(QuoteID) ON DELETE CASCADE,
  CONSTRAINT fk_la_landlord FOREIGN KEY (LandlordUserID) REFERENCES tblusers(UserID) ON DELETE CASCADE,
  INDEX idx_quote (QuoteID),
  INDEX idx_landlord (LandlordUserID),
  INDEX idx_status (ApprovalStatus)
);

-- =====================================================================================
-- SCHEDULING & WORKFLOW TABLES
-- =====================================================================================

-- 9. Contractor Schedules (depends on tickets and users)
CREATE TABLE IF NOT EXISTS tblcontractorschedules (
  ScheduleID       INT AUTO_INCREMENT PRIMARY KEY,
  TicketID         INT NOT NULL,
  ContractorUserID INT NOT NULL,
  ProposedDate     DATETIME NOT NULL,
  ClientConfirmed  BOOLEAN DEFAULT FALSE,
  CreatedAt        DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cs_ticket FOREIGN KEY (TicketID) REFERENCES tbltickets(TicketID) ON DELETE CASCADE,
  CONSTRAINT fk_cs_contractor FOREIGN KEY (ContractorUserID) REFERENCES tblusers(UserID) ON DELETE CASCADE,
  INDEX idx_ticket (TicketID),
  INDEX idx_contractor (ContractorUserID),
  INDEX idx_date (ProposedDate)
);

-- 10. Contractor Updates (depends on tickets and users)
CREATE TABLE IF NOT EXISTS tblcontractorupdates (
  UpdateID         INT AUTO_INCREMENT PRIMARY KEY,
  TicketID         INT NOT NULL,
  ContractorUserID INT NOT NULL,
  UpdateText       TEXT NOT NULL,
  CreatedAt        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cu_ticket FOREIGN KEY (TicketID) REFERENCES tbltickets(TicketID) ON DELETE CASCADE,
  CONSTRAINT fk_cu_contractor FOREIGN KEY (ContractorUserID) REFERENCES tblusers(UserID) ON DELETE CASCADE,
  INDEX idx_ticket (TicketID),
  INDEX idx_contractor (ContractorUserID),
  INDEX idx_created (CreatedAt)
);

-- =====================================================================================
-- MEDIA & DOCUMENTATION TABLES
-- =====================================================================================

-- 11. Ticket Media (depends on tickets and users)
CREATE TABLE IF NOT EXISTS tblticketmedia (
  MediaID     INT AUTO_INCREMENT PRIMARY KEY,
  TicketID    INT NOT NULL,
  UploadedBy  INT NOT NULL,
  FileName    VARCHAR(255) NOT NULL,
  FilePath    VARCHAR(500) NOT NULL,
  FileSize    INT NOT NULL,
  MimeType    VARCHAR(100) NOT NULL,
  UploadedAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tm_ticket FOREIGN KEY (TicketID) REFERENCES tbltickets(TicketID) ON DELETE CASCADE,
  CONSTRAINT fk_tm_user FOREIGN KEY (UploadedBy) REFERENCES tblusers(UserID) ON DELETE CASCADE,
  INDEX idx_ticket (TicketID),
  INDEX idx_uploaded_by (UploadedBy)
);

-- 12. Quote Documents (depends on quotes and users)  
CREATE TABLE IF NOT EXISTS tblquotedocuments (
  DocumentID  INT AUTO_INCREMENT PRIMARY KEY,
  QuoteID     INT NOT NULL,
  UploadedBy  INT NOT NULL,
  FileName    VARCHAR(255) NOT NULL,
  FilePath    VARCHAR(500) NOT NULL,
  FileSize    INT NOT NULL,
  MimeType    VARCHAR(100) NOT NULL,
  UploadedAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_qd_quote FOREIGN KEY (QuoteID) REFERENCES tblquotes(QuoteID) ON DELETE CASCADE,
  CONSTRAINT fk_qd_user FOREIGN KEY (UploadedBy) REFERENCES tblusers(UserID) ON DELETE CASCADE,
  INDEX idx_quote (QuoteID),
  INDEX idx_uploaded_by (UploadedBy)
);

-- =====================================================================================
-- COMMUNICATION & NOTIFICATION TABLES
-- =====================================================================================

-- 13. Communications (depends on tickets and users)
CREATE TABLE IF NOT EXISTS tblcommunications (
  CommunicationID INT AUTO_INCREMENT PRIMARY KEY,
  TicketID        INT NOT NULL,
  SenderUserID    INT NOT NULL,
  MessageText     TEXT NOT NULL,
  SentAt          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  IsRead          BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_comm_ticket FOREIGN KEY (TicketID) REFERENCES tbltickets(TicketID) ON DELETE CASCADE,
  CONSTRAINT fk_comm_sender FOREIGN KEY (SenderUserID) REFERENCES tblusers(UserID) ON DELETE CASCADE,
  INDEX idx_ticket (TicketID),
  INDEX idx_sender (SenderUserID),
  INDEX idx_sent (SentAt)
);

-- 14. Notifications (depends on users)
CREATE TABLE IF NOT EXISTS tblnotifications (
  NotificationID INT AUTO_INCREMENT PRIMARY KEY,
  UserID         INT NOT NULL,
  Title          VARCHAR(255) NOT NULL,
  Message        TEXT NOT NULL,
  Type           ENUM('Info','Warning','Error','Success') NOT NULL DEFAULT 'Info',
  IsRead         BOOLEAN NOT NULL DEFAULT FALSE,
  CreatedAt      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_user FOREIGN KEY (UserID) REFERENCES tblusers(UserID) ON DELETE CASCADE,
  INDEX idx_user (UserID),
  INDEX idx_read (IsRead),
  INDEX idx_created (CreatedAt)
);

-- =====================================================================================
-- AUDIT & HISTORY TABLES
-- =====================================================================================

-- 15. Ticket Status History (depends on tickets and users)
CREATE TABLE IF NOT EXISTS tblticketstatushistory (
  HistoryID  INT AUTO_INCREMENT PRIMARY KEY,
  TicketID   INT NOT NULL,
  Status     VARCHAR(50) NOT NULL,
  ChangedAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ChangedBy  INT NULL,
  Notes      TEXT NULL,
  CONSTRAINT fk_tsh_ticket FOREIGN KEY (TicketID) REFERENCES tbltickets(TicketID) ON DELETE CASCADE,
  CONSTRAINT fk_tsh_user FOREIGN KEY (ChangedBy) REFERENCES tblusers(UserID) ON DELETE SET NULL,
  INDEX idx_ticket (TicketID),
  INDEX idx_changed_at (ChangedAt),
  INDEX idx_changed_by (ChangedBy)
);

-- 16. Audit Logs (depends on users)
CREATE TABLE IF NOT EXISTS tblauditlogs (
  AuditID     BIGINT AUTO_INCREMENT PRIMARY KEY,
  ActorUserID INT NULL COMMENT 'User who performed the action',
  TargetUserID INT NULL COMMENT 'User who was the target of the action',
  Action      VARCHAR(100) NOT NULL COMMENT 'Action that was performed',
  Metadata    JSON NULL COMMENT 'Additional context about the action',
  IP          VARCHAR(45) NULL COMMENT 'IP address of the actor',
  UserAgent   VARCHAR(255) NULL COMMENT 'User agent of the actor',
  CreatedAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'When the action occurred',
  INDEX idx_audit_action (Action),
  INDEX idx_audit_actor (ActorUserID),
  INDEX idx_audit_target (TargetUserID),
  INDEX idx_audit_created (CreatedAt),
  CONSTRAINT fk_audit_actor FOREIGN KEY (ActorUserID) REFERENCES tblusers(UserID) ON DELETE SET NULL,
  CONSTRAINT fk_audit_target FOREIGN KEY (TargetUserID) REFERENCES tblusers(UserID) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Audit log with proper ActorID structure for accept/reject functionality';

-- =====================================================================================
-- POST-CREATION OPTIMIZATIONS
-- =====================================================================================

-- Create database-specific user for application
CREATE USER IF NOT EXISTS 'rawson_app'@'localhost' 
  IDENTIFIED BY 'R@ws0n2024!Secure';

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON Rawson.* TO 'rawson_app'@'localhost';
FLUSH PRIVILEGES;

-- =====================================================================================
-- VERIFICATION QUERIES
-- =====================================================================================

-- Verify all tables were created
SELECT 
  COUNT(*) as total_tables,
  'Expected: 16' as expected
FROM information_schema.tables 
WHERE table_schema = 'Rawson';

-- Show all tables
SHOW TABLES;

-- =====================================================================================
-- COMPLETION MESSAGE
-- =====================================================================================

SELECT 'Database setup complete! All 16 tables created successfully.' as status;
SELECT 'Next step: Run seeds/test-users.sql to create test data' as next_action;