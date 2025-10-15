USE Rawson;

CREATE TABLE IF NOT EXISTS tblTenancies (
  TenancyID     INT AUTO_INCREMENT PRIMARY KEY,
  PropertyID    INT NOT NULL,
  TenantUserID  INT NOT NULL,
  StartDate     DATE,
  EndDate       DATE,
  IsActive      TINYINT(1) NOT NULL DEFAULT 1,
  CreatedAt     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tenancy_property FOREIGN KEY (PropertyID) REFERENCES tblProperties(PropertyID),
  CONSTRAINT fk_tenancy_tenant   FOREIGN KEY (TenantUserID) REFERENCES tblusers(UserID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Helpful indexes (idempotent-ish)
SET @idx1 := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tblTenancies' AND INDEX_NAME = 'idx_tenancy_property'
);
SET @sql := IF(@idx1 = 0, 'CREATE INDEX idx_tenancy_property ON tblTenancies (PropertyID)', 'SELECT 1');
PREPARE s1 FROM @sql; EXECUTE s1; DEALLOCATE PREPARE s1;

SET @idx2 := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tblTenancies' AND INDEX_NAME = 'idx_tenancy_tenant'
);
SET @sql := IF(@idx2 = 0, 'CREATE INDEX idx_tenancy_tenant ON tblTenancies (TenantUserID)', 'SELECT 1');
PREPARE s2 FROM @sql; EXECUTE s2; DEALLOCATE PREPARE s2;

SET @idx3 := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tblTenancies' AND INDEX_NAME = 'idx_tenancy_active'
);
SET @sql := IF(@idx3 = 0, 'CREATE INDEX idx_tenancy_active ON tblTenancies (IsActive, EndDate)', 'SELECT 1');
PREPARE s3 FROM @sql; EXECUTE s3; DEALLOCATE PREPARE s3;
