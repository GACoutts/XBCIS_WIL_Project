-- ========================================================
-- Migration: Add Landlord to Property mapping
-- ========================================================

USE Rawson;

-- 1) Properties table (if it doesn’t exist yet)
CREATE TABLE IF NOT EXISTS tblProperties (
  PropertyID    INT AUTO_INCREMENT PRIMARY KEY,
  PropertyRef   VARCHAR(100) NOT NULL UNIQUE,
  AddressLine1  VARCHAR(255) NOT NULL,
  City          VARCHAR(100),
  Province      VARCHAR(100),
  CreatedAt     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2) Mapping table between landlords and properties

CREATE TABLE IF NOT EXISTS tblLandlordProperties (
  LandlordPropertyID INT AUTO_INCREMENT PRIMARY KEY,
  LandlordUserID     INT NOT NULL,
  PropertyID         INT NOT NULL,
  ActiveFrom         DATE NOT NULL,
  ActiveTo           DATE DEFAULT NULL,
  IsPrimary          TINYINT(1) DEFAULT 0,
  CreatedAt          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_landlordproperties_user
    FOREIGN KEY (LandlordUserID) REFERENCES tblusers(UserID)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_landlordproperties_property
    FOREIGN KEY (PropertyID) REFERENCES tblProperties(PropertyID)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add helpful indexes (use conditional guards; MySQL lacks IF NOT EXISTS for CREATE INDEX)
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

-- 3) Add PropertyID to tblTickets (column + index + FK), all conditionally

-- 3a) Column
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tblTickets' AND COLUMN_NAME = 'PropertyID'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE tblTickets ADD COLUMN PropertyID INT NULL AFTER CurrentStatus',
  'SELECT "tblTickets.PropertyID already exists"'
);
PREPARE s4 FROM @sql; EXECUTE s4; DEALLOCATE PREPARE s4;

-- 3b) Index
SET @idx_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tblTickets' AND INDEX_NAME = 'idx_tickets_property'
);
SET @sql := IF(@idx_exists = 0,
  'CREATE INDEX idx_tickets_property ON tblTickets (PropertyID)',
  'SELECT "idx_tickets_property exists"'
);
PREPARE s5 FROM @sql; EXECUTE s5; DEALLOCATE PREPARE s5;

-- 3c) Foreign key
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

-- 4) Helpful view: landlord’s tickets (mapping-based)
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
