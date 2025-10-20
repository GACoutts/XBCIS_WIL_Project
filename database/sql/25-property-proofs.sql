-- -----------------------------------------------------------------------------
-- 25-property-proofs.sql
--
-- Migration to create a table that stores proof documents for landlord
-- properties.  When a landlord adds a new property to their account, they
-- must upload a proof of ownership (e.g. title deed or lease agreement).  The
-- file path is stored here and linked to the corresponding property.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tblPropertyProofs (
  ProofID INT AUTO_INCREMENT PRIMARY KEY,
  PropertyID INT NOT NULL,
  FilePath VARCHAR(255) NOT NULL,
  UploadedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_propertyproofs_property FOREIGN KEY (PropertyID) REFERENCES tblProperties(PropertyID)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;