
 DROP DATABASE IF EXISTS Rawson;
CREATE DATABASE IF NOT EXISTS Rawson CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE Rawson;

SET SQL_SAFE_UPDATES=0;

SET NAMES utf8mb4;
SET SESSION sql_require_primary_key = 0;

-- =========================================================
-- 1) Users
-- =========================================================
CREATE TABLE IF NOT EXISTS tblUsers (
  UserID          INT AUTO_INCREMENT PRIMARY KEY,
  FullName        VARCHAR(150) NOT NULL,
  Email           VARCHAR(255) NOT NULL UNIQUE,
  PasswordHash    VARCHAR(255) NULL,
  Phone           VARCHAR(32)  NULL,
  Role            ENUM('Client','Landlord','Contractor','Staff') NOT NULL DEFAULT 'Client',
  Status          ENUM('Pending','Active','Inactive','Rejected') NOT NULL DEFAULT 'Pending',
  DateRegistered  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Messaging / geodata
  WhatsAppOptIn   TINYINT(1) NOT NULL DEFAULT 0,
  PlaceId         VARCHAR(64) NULL,
  Latitude        DECIMAL(9,6) NULL,
  Longitude       DECIMAL(9,6) NULL,
  INDEX Idx_users_phone (Phone),
  INDEX idx_users_placeid (PlaceId),
  INDEX idx_users_latlng (Latitude, Longitude)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 2) Properties & Property Proofs
-- =========================================================
CREATE TABLE IF NOT EXISTS tblProperties (
  PropertyID     INT AUTO_INCREMENT PRIMARY KEY,
  PropertyRef    VARCHAR(100) NOT NULL UNIQUE,
  AddressLine1   VARCHAR(255) NOT NULL,
  AddressLine2   VARCHAR(255) NULL,
  City           VARCHAR(100) NULL,
  Province       VARCHAR(100) NULL,
  PostalCode     VARCHAR(20)  NULL,
  PlaceId        VARCHAR(64)  NULL,
  Latitude       DECIMAL(9,6) NULL,
  Longitude      DECIMAL(9,6) NULL,
  CreatedAt      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_properties_placeid (PlaceId),
  INDEX idx_properties_latlng (Latitude, Longitude)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tblPropertyProofs (
  ProofID     INT AUTO_INCREMENT PRIMARY KEY,
  PropertyID  INT NOT NULL,
  FilePath    VARCHAR(255) NOT NULL,
  UploadedAt  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_propertyproofs_property
    FOREIGN KEY (PropertyID) REFERENCES tblProperties(PropertyID)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 3) Landlord to Property mapping & Tenancies
-- =========================================================
CREATE TABLE IF NOT EXISTS tblLandlordProperties (
  LandlordPropertyID INT AUTO_INCREMENT PRIMARY KEY,
  LandlordUserID     INT NOT NULL,
  PropertyID         INT NOT NULL,
  ActiveFrom         DATE NOT NULL,
  ActiveTo           DATE DEFAULT NULL,
  IsPrimary          TINYINT(1) DEFAULT 0,
  CreatedAt          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_landlordproperties_user
    FOREIGN KEY (LandlordUserID) REFERENCES tblUsers(UserID)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_landlordproperties_property
    FOREIGN KEY (PropertyID) REFERENCES tblProperties(PropertyID)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Helpful indexes (idempotent)
SET @x := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tblLandlordProperties' AND INDEX_NAME='idx_lp_landlord');
SET @sql := IF(@x=0,'CREATE INDEX idx_lp_landlord ON tblLandlordProperties (LandlordUserID)','SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @x := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tblLandlordProperties' AND INDEX_NAME='idx_lp_property');
SET @sql := IF(@x=0,'CREATE INDEX idx_lp_property ON tblLandlordProperties (PropertyID)','SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @x := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tblLandlordProperties' AND INDEX_NAME='idx_lp_active');
SET @sql := IF(@x=0,'CREATE INDEX idx_lp_active ON tblLandlordProperties (ActiveFrom, ActiveTo)','SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

CREATE TABLE IF NOT EXISTS tblTenancies (
  TenancyID     INT AUTO_INCREMENT PRIMARY KEY,
  PropertyID    INT NOT NULL,
  TenantUserID  INT NOT NULL,
  StartDate     DATE NOT NULL,
  EndDate       DATE DEFAULT NULL,
  IsActive      TINYINT(1) NOT NULL DEFAULT 1,
  CreatedAt     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tenancy_property FOREIGN KEY (PropertyID)   REFERENCES tblProperties(PropertyID),
  CONSTRAINT fk_tenancy_tenant   FOREIGN KEY (TenantUserID) REFERENCES tblUsers(UserID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tenancy indexes (idempotent)
SET @x := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tblTenancies' AND INDEX_NAME='idx_tenancy_property');
SET @sql := IF(@x=0,'CREATE INDEX idx_tenancy_property ON tblTenancies (PropertyID)','SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @x := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tblTenancies' AND INDEX_NAME='idx_tenancy_tenant');
SET @sql := IF(@x=0,'CREATE INDEX idx_tenancy_tenant ON tblTenancies (TenantUserID)','SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @x := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tblTenancies' AND INDEX_NAME='idx_tenancy_active');
SET @sql := IF(@x=0,'CREATE INDEX idx_tenancy_active ON tblTenancies (IsActive, EndDate)','SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- =========================================================
-- 4) Tickets & Status History
-- =========================================================
CREATE TABLE IF NOT EXISTS tblTickets (
  TicketID             INT AUTO_INCREMENT PRIMARY KEY,
  TicketRefNumber      VARCHAR(50) NOT NULL UNIQUE,
  ClientUserID         INT NULL,
  PropertyID           INT NULL,
  Title                VARCHAR(200) NULL,         -- short title
  Description          TEXT NOT NULL,
  UrgencyLevel         VARCHAR(20) NULL,          -- 'Low'|'Medium'|'High' (free text)
  CurrentStatus        VARCHAR(50) NOT NULL DEFAULT 'In Review',
  AssignedContractorID INT NULL,
  CreatedAt            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt            DATETIME NULL,
  CONSTRAINT fk_tickets_client      FOREIGN KEY (ClientUserID)         REFERENCES tblUsers(UserID)      ON DELETE SET NULL,
  CONSTRAINT fk_tickets_property    FOREIGN KEY (PropertyID)           REFERENCES tblProperties(PropertyID) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_tickets_contractor  FOREIGN KEY (AssignedContractorID) REFERENCES tblUsers(UserID)      ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Ticket indexes (idempotent)
SET @x := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tblTickets' AND INDEX_NAME='idx_tickets_property');
SET @sql := IF(@x=0,'CREATE INDEX idx_tickets_property ON tblTickets (PropertyID)','SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @x := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tblTickets' AND INDEX_NAME='idx_tickets_assigned_contractor');
SET @sql := IF(@x=0,'CREATE INDEX idx_tickets_assigned_contractor ON tblTickets (AssignedContractorID)','SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- History (includes "Updated*" aliases and sync triggers)
CREATE TABLE IF NOT EXISTS tblTicketStatusHistory (
  HistoryID        INT AUTO_INCREMENT PRIMARY KEY,
  TicketID         INT NOT NULL,
  Status           VARCHAR(50) NOT NULL,
  Notes            TEXT NULL,
  ChangedByUserID  INT NULL,
  ChangedAt        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedByUserID  INT NULL,
  UpdatedAt        DATETIME NULL,
  CONSTRAINT fk_tsh_ticket FOREIGN KEY (TicketID)         REFERENCES tblTickets(TicketID) ON DELETE CASCADE,
  CONSTRAINT fk_tsh_user1  FOREIGN KEY (ChangedByUserID)  REFERENCES tblUsers(UserID)    ON DELETE SET NULL,
  CONSTRAINT fk_tsh_user2  FOREIGN KEY (UpdatedByUserID)  REFERENCES tblUsers(UserID)    ON DELETE SET NULL,
  INDEX idx_tsh_ticket (TicketID),
  INDEX idx_tsh_status (Status),
  INDEX idx_tsh_changed (ChangedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Backfill Updated* once
UPDATE tblTicketStatusHistory
SET UpdatedAt = COALESCE(UpdatedAt, ChangedAt),
    UpdatedByUserID = COALESCE(UpdatedByUserID, ChangedByUserID);

-- Keep pairs in sync
DROP TRIGGER IF EXISTS trg_tsh_bi_sync;
DELIMITER //
CREATE TRIGGER trg_tsh_bi_sync
BEFORE INSERT ON tblTicketStatusHistory
FOR EACH ROW
BEGIN
  IF NEW.UpdatedAt IS NULL THEN SET NEW.UpdatedAt = COALESCE(NEW.ChangedAt, CURRENT_TIMESTAMP); END IF;
  IF NEW.ChangedAt IS NULL THEN SET NEW.ChangedAt = COALESCE(NEW.UpdatedAt, CURRENT_TIMESTAMP); END IF;
  IF NEW.UpdatedByUserID IS NULL THEN SET NEW.UpdatedByUserID = NEW.ChangedByUserID; END IF;
  IF NEW.ChangedByUserID IS NULL THEN SET NEW.ChangedByUserID = NEW.UpdatedByUserID; END IF;
END//
DELIMITER ;

DROP TRIGGER IF EXISTS trg_tsh_bu_sync;
DELIMITER //
CREATE TRIGGER trg_tsh_bu_sync
BEFORE UPDATE ON tblTicketStatusHistory
FOR EACH ROW
BEGIN
  IF COALESCE(NEW.ChangedAt,'0000-00-00 00:00:00') <> COALESCE(OLD.ChangedAt,'0000-00-00 00:00:00')
  THEN SET NEW.UpdatedAt = NEW.ChangedAt; END IF;

  IF COALESCE(NEW.UpdatedAt,'0000-00-00 00:00:00') <> COALESCE(OLD.UpdatedAt,'0000-00-00 00:00:00')
  THEN SET NEW.ChangedAt = NEW.UpdatedAt; END IF;

  IF COALESCE(NEW.ChangedByUserID,-1) <> COALESCE(OLD.ChangedByUserID,-1)
  THEN SET NEW.UpdatedByUserID = NEW.ChangedByUserID; END IF;

  IF COALESCE(NEW.UpdatedByUserID,-1) <> COALESCE(OLD.UpdatedByUserID,-1)
  THEN SET NEW.ChangedByUserID = NEW.UpdatedByUserID; END IF;
END//
DELIMITER ;

-- Helpful MAX(UpdatedAt) index
SET @x := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tblTicketStatusHistory' AND INDEX_NAME='idx_tsh_ticket_updated');
SET @sql := IF(@x=0,'CREATE INDEX idx_tsh_ticket_updated ON tblTicketStatusHistory (TicketID, UpdatedAt)','SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- =========================================================
-- 5) Ticket Media (uploads)
-- =========================================================
CREATE TABLE IF NOT EXISTS tblTicketMedia (
  MediaID           INT AUTO_INCREMENT PRIMARY KEY,
  TicketID          INT NOT NULL,
  MediaType         ENUM('image','video','audio','document','other') NOT NULL DEFAULT 'image',
  MediaURL          VARCHAR(500) NOT NULL,
  UploadedAt        DATETIME NULL,
  OriginalFilename  VARCHAR(255) NULL,
  MimeType          VARCHAR(100) NULL,
  FileSizeBytes     BIGINT NULL,
  UploadedByUserID  INT NULL,
  CreatedAt         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tm_ticket  FOREIGN KEY (TicketID)         REFERENCES tblTickets(TicketID) ON DELETE CASCADE,
  CONSTRAINT fk_tm_user    FOREIGN KEY (UploadedByUserID) REFERENCES tblUsers(UserID)    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Ensure UploadedAt exists & is backfilled
UPDATE tblTicketMedia SET UploadedAt = COALESCE(UploadedAt, CreatedAt);

-- Indexes
SET @x := (SELECT COUNT(*) FROM information_schema.statistics
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tblTicketMedia' AND INDEX_NAME='idx_tm_ticket');
SET @sql := IF(@x=0,'CREATE INDEX idx_tm_ticket ON tblTicketMedia (TicketID)','SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @x := (SELECT COUNT(*) FROM information_schema.statistics
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tblTicketMedia' AND INDEX_NAME='idx_tm_uploaded');
SET @sql := IF(@x=0,'CREATE INDEX idx_tm_uploaded ON tblTicketMedia (UploadedAt)','SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- =========================================================
-- 6) Quotes (+ Status mirror + QuoteDescription + Documents)
-- =========================================================
CREATE TABLE IF NOT EXISTS tblQuotes (
  QuoteID           INT AUTO_INCREMENT PRIMARY KEY,
  TicketID          INT NOT NULL,
  ContractorUserID  INT NOT NULL,
  QuoteAmount       DECIMAL(10,2) NOT NULL,
  QuoteDescription  TEXT NULL,
  Currency          VARCHAR(8) NULL DEFAULT 'ZAR',
  QuoteStatus       VARCHAR(20) NOT NULL,     -- 'Pending' | 'Approved' | 'Rejected'
  Status            VARCHAR(50) NULL,         -- mirror of QuoteStatus
  SubmittedAt       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_quotes_ticket     FOREIGN KEY (TicketID)         REFERENCES tblTickets(TicketID) ON DELETE CASCADE,
  CONSTRAINT fk_quotes_contractor FOREIGN KEY (ContractorUserID) REFERENCES tblUsers(UserID)   ON DELETE CASCADE,
  INDEX idx_quotes_ticket (TicketID),
  INDEX idx_quotes_contractor (ContractorUserID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Mirror initialization
UPDATE tblQuotes SET Status = QuoteStatus WHERE Status IS NULL;

-- Triggers to keep Status <-> QuoteStatus in sync
DROP TRIGGER IF EXISTS trg_tblquotes_bi_sync;
DELIMITER //
CREATE TRIGGER trg_tblquotes_bi_sync
BEFORE INSERT ON tblQuotes
FOR EACH ROW
BEGIN
  IF NEW.Status IS NULL AND NEW.QuoteStatus IS NOT NULL THEN
    SET NEW.Status = NEW.QuoteStatus;
  ELSEIF NEW.Status IS NOT NULL AND NEW.QuoteStatus IS NULL THEN
    SET NEW.QuoteStatus = NEW.Status;
  END IF;
END//
DELIMITER ;

DROP TRIGGER IF EXISTS trg_tblquotes_bu_sync;
DELIMITER //
CREATE TRIGGER trg_tblquotes_bu_sync
BEFORE UPDATE ON tblQuotes
FOR EACH ROW
BEGIN
  IF COALESCE(NEW.Status,'') <> COALESCE(OLD.Status,'') THEN
    SET NEW.QuoteStatus = NEW.Status;
  ELSEIF COALESCE(NEW.QuoteStatus,'') <> COALESCE(OLD.QuoteStatus,'') THEN
    SET NEW.Status = NEW.QuoteStatus;
  END IF;
END//
DELIMITER ;

-- **** Quote Documents (supports both legacy FilePath and new DocumentURL) ****
CREATE TABLE IF NOT EXISTS tblQuoteDocuments (
  QuoteDocumentID INT AUTO_INCREMENT PRIMARY KEY,
  QuoteID         INT NOT NULL,
  -- New canonical columns used by your route:
  DocumentType    VARCHAR(20) NOT NULL,            -- e.g. 'PDF'
  DocumentURL     VARCHAR(255) NOT NULL,           -- '/uploads/quotes/…pdf'
  -- Legacy alias to avoid ER_NO_DEFAULT_FOR_FIELD when old code expects FilePath:
  FilePath        VARCHAR(255) NULL,               -- kept NULLable; auto-filled by trigger
  UploadedAt      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_qd_quote FOREIGN KEY (QuoteID) REFERENCES tblQuotes(QuoteID) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_qd_quote (QuoteID),
  INDEX idx_qd_uploaded (UploadedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- If table existed with only FilePath, add the new columns (idempotent)
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tblQuoteDocuments' AND COLUMN_NAME='DocumentType');
SET @sql := IF(@c=0,'ALTER TABLE tblQuoteDocuments ADD COLUMN DocumentType VARCHAR(20) NOT NULL AFTER QuoteID','SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tblQuoteDocuments' AND COLUMN_NAME='DocumentURL');
SET @sql := IF(@c=0,'ALTER TABLE tblQuoteDocuments ADD COLUMN DocumentURL VARCHAR(255) NOT NULL AFTER DocumentType','SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Ensure FilePath exists and is NULLable (so old inserts that omit it won't fail)
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tblQuoteDocuments' AND COLUMN_NAME='FilePath');
SET @sql := IF(@c=0,'ALTER TABLE tblQuoteDocuments ADD COLUMN FilePath VARCHAR(255) NULL AFTER DocumentURL','SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Normalize column types/lengths
ALTER TABLE tblQuoteDocuments
  MODIFY COLUMN DocumentType VARCHAR(20) NOT NULL,
  MODIFY COLUMN DocumentURL  VARCHAR(255) NOT NULL,
  MODIFY COLUMN FilePath     VARCHAR(255) NULL;

-- Triggers to keep FilePath in step with DocumentURL (for legacy reads/writes)
DROP TRIGGER IF EXISTS trg_qd_bi_fill_filepath;
DELIMITER //
CREATE TRIGGER trg_qd_bi_fill_filepath
BEFORE INSERT ON tblQuoteDocuments
FOR EACH ROW
BEGIN
  IF NEW.FilePath IS NULL OR NEW.FilePath = '' THEN
    SET NEW.FilePath = NEW.DocumentURL;
  END IF;
END//
DELIMITER ;

DROP TRIGGER IF EXISTS trg_qd_bu_fill_filepath;
DELIMITER //
CREATE TRIGGER trg_qd_bu_fill_filepath
BEFORE UPDATE ON tblQuoteDocuments
FOR EACH ROW
BEGIN
  IF (NEW.FilePath IS NULL OR NEW.FilePath = '') AND COALESCE(NEW.DocumentURL,'') <> COALESCE(OLD.DocumentURL,'') THEN
    SET NEW.FilePath = NEW.DocumentURL;
  END IF;
END//
DELIMITER ;

-- =========================================================
-- 7) Contractor Schedules
-- =========================================================
CREATE TABLE IF NOT EXISTS tblContractorSchedules (
  ScheduleID          INT AUTO_INCREMENT PRIMARY KEY,
  TicketID            INT NOT NULL,
  ContractorUserID    INT NOT NULL,
  ProposedDate        DATETIME NOT NULL,
  ProposedEndDate     DATETIME NULL,
  Notes               TEXT NULL,
  ClientConfirmed     TINYINT(1) NOT NULL DEFAULT 0,
  ContractorConfirmed TINYINT(1) NOT NULL DEFAULT 0,
  ProposedBy          ENUM('Client','Contractor') NOT NULL DEFAULT 'Contractor',
  CreatedAt           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sch_ticket     FOREIGN KEY (TicketID)         REFERENCES tblTickets(TicketID) ON DELETE CASCADE,
  CONSTRAINT fk_sch_contractor FOREIGN KEY (ContractorUserID) REFERENCES tblUsers(UserID)   ON DELETE CASCADE,
  INDEX IdxContractorSchedulesEndDate (ProposedEndDate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 8) Landlord Approvals
-- =========================================================
CREATE TABLE IF NOT EXISTS tblLandlordApprovals (
  LandlordApprovalID INT AUTO_INCREMENT PRIMARY KEY,
  QuoteID            INT NOT NULL,
  LandlordUserID     INT NOT NULL,
  ApprovalStatus     VARCHAR(20) NOT NULL,   -- 'Approved' | 'Rejected'
  ApprovedAt         DATETIME NULL DEFAULT NULL,
  CONSTRAINT fk_la_quote   FOREIGN KEY (QuoteID)        REFERENCES tblQuotes(QuoteID) ON DELETE CASCADE,
  CONSTRAINT fk_la_user    FOREIGN KEY (LandlordUserID) REFERENCES tblUsers(UserID)  ON DELETE CASCADE,
  UNIQUE KEY uq_quote_landlord (QuoteID, LandlordUserID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 9) Notifications (Push/Email/WhatsApp)
-- =========================================================
CREATE TABLE IF NOT EXISTS tblNotifications (
  NotificationID      INT AUTO_INCREMENT PRIMARY KEY,
  UserID              INT NOT NULL,
  TicketID            INT NULL,
  NotificationType    ENUM('Push','Email','WhatsApp') NOT NULL,
  NotificationContent TEXT NOT NULL,
  Status              ENUM('Queued','Sent','Failed') NOT NULL DEFAULT 'Queued',
  MarkAsSent          TINYINT(1) NOT NULL DEFAULT 0,
  EventKey            VARCHAR(120) NULL,
  ProviderMessageID   VARCHAR(128) NULL,
  ErrorMessage        VARCHAR(512) NULL,
  AttemptCount        INT NOT NULL DEFAULT 0,
  SentAt              DATETIME NULL,
  LastAttemptAt       DATETIME NULL,
  CreatedAt           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notify_user   FOREIGN KEY (UserID)  REFERENCES tblUsers(UserID)   ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_notify_ticket FOREIGN KEY (TicketID) REFERENCES tblTickets(TicketID) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX IdxNotificationsUser   (UserID),
  INDEX IdxNotificationsTicket (TicketID),
  INDEX IdxNotificationsType   (NotificationType),
  INDEX IdxNotificationsStatus (Status),
  INDEX IdxNotificationsSent   (SentAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Composite time index (idempotent)
SET @x := (SELECT COUNT(*) FROM information_schema.statistics
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tblNotifications' AND INDEX_NAME='idx_user_time');
SET @sql := IF(@x=0,'CREATE INDEX idx_user_time ON tblNotifications (UserID, SentAt, LastAttemptAt)','SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- =========================================================
-- 10) Auth / Security
-- =========================================================
CREATE TABLE IF NOT EXISTS tblRefreshTokens (
  TokenID            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  UserID             INT NOT NULL,
  TokenHash          CHAR(64) NOT NULL,     -- sha256 hex
  FamilyID           CHAR(36) NOT NULL,
  UserAgent          VARCHAR(255) NULL,
  IP                 VARCHAR(45) NULL,      -- textual IPv4/IPv6 (new)
  IPAddress          VARCHAR(45) NULL,      -- legacy alias (old code paths)
  IssuedAt           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ExpiresAt          DATETIME NOT NULL,
  RevokedAt          DATETIME NULL,
  ReplacedByTokenID  BIGINT NULL,
  PRIMARY KEY (TokenID),
  CONSTRAINT fk_refresh_user FOREIGN KEY (UserID) REFERENCES tblUsers(UserID) ON DELETE CASCADE,
  UNIQUE KEY uq_refresh_tokenhash (TokenHash),
  INDEX idx_refresh_user   (UserID),
  INDEX idx_refresh_family (FamilyID),
  INDEX idx_refresh_expires(ExpiresAt),
  INDEX idx_user_active (UserID, RevokedAt, ExpiresAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Password resets (canonical)
CREATE TABLE IF NOT EXISTS tblPasswordResets (
  UserID     INT NOT NULL,
  TokenHash  CHAR(64) NOT NULL,        -- sha256(token) hex
  ExpiresAt  DATETIME NOT NULL,
  UsedAt     DATETIME NULL,
  IP         VARCHAR(45) NULL,
  UserAgent  VARCHAR(255) NULL,
  CreatedAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (UserID),
  INDEX IdxPasswordResetToken   (TokenHash),
  INDEX IdxPasswordResetExpires (ExpiresAt),
  INDEX IdxPasswordResetUsed    (UsedAt),
  CONSTRAINT FkPasswordResetUser FOREIGN KEY (UserID) REFERENCES tblUsers(UserID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Legacy variant (if any old script still reads it)
CREATE TABLE IF NOT EXISTS tblPasswordResetTokens (
  TokenID   INT AUTO_INCREMENT PRIMARY KEY,
  UserID    INT NOT NULL,
  TokenHash VARCHAR(64) NOT NULL,
  ExpiresAt DATETIME NOT NULL,
  UsedAt    DATETIME NULL,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (UserID),
  INDEX (TokenHash),
  CONSTRAINT fk_reset_user FOREIGN KEY (UserID) REFERENCES tblUsers(UserID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Audit logs
CREATE TABLE IF NOT EXISTS tblAuditLogs (
  AuditID     BIGINT AUTO_INCREMENT PRIMARY KEY,
  ActorUserID INT NULL,
  TargetUserID INT NULL,
  Action      VARCHAR(100) NOT NULL,
  Metadata    JSON NULL,
  IP          VARCHAR(45) NULL,
  UserAgent   VARCHAR(255) NULL,
  CreatedAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_action (Action),
  INDEX idx_audit_actor  (ActorUserID),
  INDEX idx_audit_target (TargetUserID),
  INDEX idx_audit_created(CreatedAt),
  CONSTRAINT fk_audit_actor  FOREIGN KEY (ActorUserID)  REFERENCES tblUsers(UserID) ON DELETE SET NULL,
  CONSTRAINT fk_audit_target FOREIGN KEY (TargetUserID) REFERENCES tblUsers(UserID) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Revoked access JTI (access-token jtis that are invalidated)
CREATE TABLE IF NOT EXISTS tblRevokedAccessJti (
  Jti        CHAR(36) PRIMARY KEY,
  UserID     INT NOT NULL,
  ExpiresAt  DATETIME NOT NULL,
  Reason     VARCHAR(100) NULL,
  CreatedAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_revoked_user (UserID),
  INDEX idx_revoked_exp  (ExpiresAt),
  INDEX idx_revoked_reason (Reason),
  CONSTRAINT fk_revoked_user FOREIGN KEY (UserID) REFERENCES tblUsers(UserID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 11) Role Requests (admin workflow)
-- =========================================================
CREATE TABLE IF NOT EXISTS tblRoleRequests (
  RequestID     INT AUTO_INCREMENT PRIMARY KEY,
  UserID        INT NOT NULL,
  RequestedRole ENUM('Client','Landlord','Contractor','Staff') NOT NULL,
  Status        ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
  Notes         VARCHAR(500) NULL,
  CreatedAt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ReviewedBy    INT NULL,
  ReviewedAt    DATETIME NULL,
  CONSTRAINT fk_rr_user     FOREIGN KEY (UserID)    REFERENCES tblUsers(UserID) ON DELETE CASCADE,
  CONSTRAINT fk_rr_reviewer FOREIGN KEY (ReviewedBy) REFERENCES tblUsers(UserID) ON DELETE SET NULL,
  INDEX idx_status (Status),
  INDEX idx_user (UserID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 12) View: Landlord-visible tickets
-- =========================================================
DROP VIEW IF EXISTS vwLandlordTickets;
CREATE VIEW vwLandlordTickets AS
SELECT 
  t.TicketID,
  t.TicketRefNumber,
  t.Title,
  t.Description,
  t.UrgencyLevel,
  t.CurrentStatus,
  t.CreatedAt,
  t.PropertyID,
  lp.LandlordUserID
FROM tblTickets t
JOIN tblLandlordProperties lp
  ON lp.PropertyID = t.PropertyID
WHERE lp.ActiveTo IS NULL OR lp.ActiveTo >= CURDATE();

-- Create the table in the exact shape the API expects if it doesn't exist
CREATE TABLE IF NOT EXISTS tblQuoteDocuments (
  DocumentID     INT AUTO_INCREMENT PRIMARY KEY,
  QuoteID        INT NOT NULL,
  DocumentType   VARCHAR(20) NOT NULL,
  DocumentURL    VARCHAR(255) NOT NULL,
  UploadedAt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_qd_quote FOREIGN KEY (QuoteID) REFERENCES tblQuotes(QuoteID) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 1) If the legacy PK is "QuoteDocumentID", rename it to "DocumentID" (keeps PK/AI)
SET @have_docid := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'tblQuoteDocuments'
    AND COLUMN_NAME  = 'DocumentID'
);
SET @have_qdid := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'tblQuoteDocuments'
    AND COLUMN_NAME  = 'QuoteDocumentID'
);

SET @ddl := IF(@have_docid = 0 AND @have_qdid = 1,
  'ALTER TABLE tblQuoteDocuments CHANGE COLUMN QuoteDocumentID DocumentID INT NOT NULL AUTO_INCREMENT',
  'SELECT 1'
);
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- 2) Ensure DocumentType exists (add if missing; coerce to VARCHAR(20) NOT NULL)
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tblQuoteDocuments' AND COLUMN_NAME='DocumentType'
);
SET @ddl := IF(@col=0,
  'ALTER TABLE tblQuoteDocuments ADD COLUMN DocumentType VARCHAR(20) NULL AFTER QuoteID',
  'SELECT 1'
);
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- 3) Ensure DocumentURL exists (add if missing; temporarily NULL so we can backfill)
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tblQuoteDocuments' AND COLUMN_NAME='DocumentURL'
);
SET @ddl := IF(@col=0,
  'ALTER TABLE tblQuoteDocuments ADD COLUMN DocumentURL VARCHAR(255) NULL AFTER DocumentType',
  'SELECT 1'
);
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- 4) If a legacy "FilePath" column exists, backfill DocumentURL from it where needed
SET @have_filepath := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tblQuoteDocuments' AND COLUMN_NAME='FilePath'
);
SET @ddl := IF(@have_filepath=1,
  'UPDATE tblQuoteDocuments SET DocumentURL = COALESCE(DocumentURL, FilePath)',
  'SELECT 1'
);
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- 5) Ensure DocumentURL is NOT NULL (after backfill)
ALTER TABLE tblQuoteDocuments MODIFY COLUMN DocumentURL VARCHAR(255) NOT NULL;

-- 6) Ensure DocumentType is NOT NULL and capped at VARCHAR(20)
ALTER TABLE tblQuoteDocuments MODIFY COLUMN DocumentType VARCHAR(20) NOT NULL;

-- 7) Ensure UploadedAt exists; add if missing
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tblQuoteDocuments' AND COLUMN_NAME='UploadedAt'
);
SET @ddl := IF(@col=0,
  'ALTER TABLE tblQuoteDocuments ADD COLUMN UploadedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER DocumentURL',
  'SELECT 1'
);
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- 8) Helpful indexes
SET @idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tblQuoteDocuments' AND INDEX_NAME='idx_qd_quote'
);
SET @ddl := IF(@idx=0, 'CREATE INDEX idx_qd_quote ON tblQuoteDocuments (QuoteID)', 'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tblQuoteDocuments' AND INDEX_NAME='idx_qd_uploaded'
);
SET @ddl := IF(@idx=0, 'CREATE INDEX idx_qd_uploaded ON tblQuoteDocuments (UploadedAt)', 'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SELECT 'Schema created/verified successfully' AS status;
