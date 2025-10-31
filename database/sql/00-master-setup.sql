CREATE TABLE IF NOT EXISTS tblPasswordResetTokens (
  TokenID INT AUTO_INCREMENT PRIMARY KEY,
  UserID INT NOT NULL,
  TokenHash VARCHAR(64) NOT NULL,     -- sha256 hex
  ExpiresAt DATETIME NOT NULL,
  UsedAt DATETIME NULL,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (UserID),
  INDEX (TokenHash),
  CONSTRAINT fk_reset_user FOREIGN KEY (UserID) REFERENCES tblUsers(UserID) ON DELETE CASCADE
);

-- Change to the correct DB name if needed

--USE Rawson;

CREATE TABLE IF NOT EXISTS tblRoleRequests (
  RequestID     INT AUTO_INCREMENT PRIMARY KEY,
  UserID        INT NOT NULL,
  RequestedRole ENUM('Client','Landlord','Contractor','Staff') NOT NULL,
  Status        ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
  Notes         VARCHAR(500) NULL,
  CreatedAt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ReviewedBy    INT NULL,
  ReviewedAt    DATETIME NULL,
  CONSTRAINT fk_rr_user     FOREIGN KEY (UserID)     REFERENCES tblUsers(UserID) ON DELETE CASCADE,
  CONSTRAINT fk_rr_reviewer FOREIGN KEY (ReviewedBy)  REFERENCES tblUsers(UserID) ON DELETE SET NULL,
  INDEX idx_status (Status),
  INDEX idx_user (UserID)
);

UPDATE tblUsers SET Role='Staff' WHERE Email='bob@test.com';
SELECT * FROM tblUsers;
DESCRIBE tblUsers;

SHOW TABLES LIKE 'tblRefreshTokens';
SHOW TABLES LIKE 'tblAuditLogs';

CREATE TABLE IF NOT EXISTS tblProperties (
  PropertyID    INT AUTO_INCREMENT PRIMARY KEY,
  PropertyRef   VARCHAR(100) NOT NULL UNIQUE,
  AddressLine1  VARCHAR(255) NOT NULL,
  City          VARCHAR(100),
  Province      VARCHAR(100),
  CreatedAt     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

SET @idx_lp_landlord := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tblLandlordProperties' AND INDEX_NAME = 'idx_lp_landlord'
);
SET @sql := IF(@idx_lp_landlord = 0,
  'CREATE INDEX idx_lp_landlord ON tblLandlordProperties (LandlordUserID)',
  'SELECT "idx_lp_landlord exists"'
);
PREPARE s1 FROM @sql; EXECUTE s1; DEALLOCATE PREPARE s1;

SET @idx_lp_property := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tblLandlordProperties' AND INDEX_NAME = 'idx_lp_property'
);
SET @sql := IF(@idx_lp_property = 0,
  'CREATE INDEX idx_lp_property ON tblLandlordProperties (PropertyID)',
  'SELECT "idx_lp_property exists"'
);
PREPARE s2 FROM @sql; EXECUTE s2; DEALLOCATE PREPARE s2;

SET @idx_lp_active := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tblLandlordProperties' AND INDEX_NAME = 'idx_lp_active'
);
SET @sql := IF(@idx_lp_active = 0,
  'CREATE INDEX idx_lp_active ON tblLandlordProperties (ActiveFrom, ActiveTo)',
  'SELECT "idx_lp_active exists"'
);
PREPARE s3 FROM @sql; EXECUTE s3; DEALLOCATE PREPARE s3;

-- Add PropertyID to tblTickets conditionally
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tblTickets' AND COLUMN_NAME = 'PropertyID'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE tblTickets ADD COLUMN PropertyID INT NULL AFTER CurrentStatus',
  'SELECT "tblTickets.PropertyID already exists"'
);
PREPARE s4 FROM @sql; EXECUTE s4; DEALLOCATE PREPARE s4;

-- FK creation
SET @fk_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tblTickets'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY' AND CONSTRAINT_NAME = 'fk_tickets_property'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE tblTickets ADD CONSTRAINT fk_tickets_property
     FOREIGN KEY (PropertyID) REFERENCES tblProperties(PropertyID)
     ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT "fk_tickets_property exists"'
);
PREPARE s6 FROM @sql; EXECUTE s6; DEALLOCATE PREPARE s6;

DROP VIEW IF EXISTS vwLandlordTickets;
CREATE VIEW vwLandlordTickets AS
SELECT 
  t.TicketID,
  t.TicketRefNumber,
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

CREATE TABLE IF NOT EXISTS tblPropertyProofs (
  ProofID INT AUTO_INCREMENT PRIMARY KEY,
  PropertyID INT NOT NULL,
  FilePath VARCHAR(255) NOT NULL,
  UploadedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_propertyproofs_property FOREIGN KEY (PropertyID) REFERENCES tblProperties(PropertyID)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tblTenancies (
  TenancyID     INT AUTO_INCREMENT PRIMARY KEY,
  PropertyID    INT NOT NULL,
  TenantUserID  INT NOT NULL,
  StartDate     DATE,
  EndDate       DATE,
  IsActive      TINYINT(1) NOT NULL DEFAULT 1,
  CreatedAt     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tenancy_property FOREIGN KEY (PropertyID) REFERENCES tblProperties(PropertyID),
  CONSTRAINT fk_tenancy_tenant   FOREIGN KEY (TenantUserID) REFERENCES tblUsers(UserID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tblAuditLogs (
  AuditID BIGINT AUTO_INCREMENT PRIMARY KEY,
  ActorUserID INT NULL,
  TargetUserID INT NULL,
  Action VARCHAR(100) NOT NULL,
  Metadata JSON NULL,
  IP VARCHAR(45) NULL,
  UserAgent VARCHAR(255) NULL,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_action (Action),
  INDEX idx_audit_actor (ActorUserID),
  INDEX idx_audit_target (TargetUserID),
  INDEX idx_audit_created (CreatedAt),
  CONSTRAINT fk_audit_actor  FOREIGN KEY (ActorUserID)  REFERENCES tblUsers(UserID) ON DELETE SET NULL,
  CONSTRAINT fk_audit_target FOREIGN KEY (TargetUserID) REFERENCES tblUsers(UserID) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS tblRefreshTokens (
  TokenID BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  UserID INT NOT NULL,
  TokenHash CHAR(64) NOT NULL,
  UserAgent VARCHAR(255) NULL,
  IPAddress VARCHAR(45) NULL,
  IssuedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ExpiresAt DATETIME NOT NULL,
  RevokedAt DATETIME NULL,
  ReplacedByTokenID BIGINT UNSIGNED NULL,
  PRIMARY KEY (TokenID),
  INDEX idx_user_active (UserID, RevokedAt, ExpiresAt),
  CONSTRAINT fk_refresh_user
    FOREIGN KEY (UserID) REFERENCES tblUsers(UserID)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tblRevokedAccessJti (
  Jti CHAR(36) PRIMARY KEY,
  UserID INT NOT NULL,
  ExpiresAt DATETIME NOT NULL,
  Reason VARCHAR(100) NULL,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_revoked_user (UserID),
  INDEX idx_revoked_exp (ExpiresAt),
  INDEX idx_revoked_reason (Reason),
  CONSTRAINT fk_revoked_user FOREIGN KEY (UserID) REFERENCES tblUsers(UserID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS tblNotifications (
  NotificationID INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique notification ID',
  UserID INT NOT NULL COMMENT 'User who received the notification',
  TicketID INT NULL COMMENT 'Related ticket, if applicable',
  NotificationType ENUM('Push','Email','WhatsApp') NOT NULL COMMENT 'Notification channel',
  NotificationContent TEXT NOT NULL COMMENT 'Content of the notification',
  SentAt DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'When notification was sent',
  Status ENUM('Sent','Failed') DEFAULT 'Sent' COMMENT 'Status of notification delivery',
  FOREIGN KEY (UserID) REFERENCES tblUsers(UserID)
    ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (TicketID) REFERENCES tblTickets(TicketID)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='System notifications to users';

-- Create starting staff user (to approve other test accounts)
INSERT INTO tblusers (
  FullName,
  Email,
  PasswordHash,
  Phone,
  Role,
  Status
)
VALUES (
  'Admin User',
  'admin@wil.com',
  -- bcrypt hash for "Password123!"
  '$2b$12$QnGDoqXmp5pNvu6jhGaPoOqz1MfZP7pArlTcidH833Mu38xpv8u9i',
  '0123456789',
  'Staff',
  'Active'
)
ON DUPLICATE KEY UPDATE
  Role = 'Staff',
  Status = 'Active',
  PasswordHash = VALUES(PasswordHash);