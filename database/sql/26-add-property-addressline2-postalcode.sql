-- -----------------------------------------------------------------------------
-- 26-add-property-addressline2-postalcode.sql
--
-- Migration to extend the tblProperties table with AddressLine2 and PostalCode
-- columns.  In earlier iterations the schema lacked these fields, which led
-- to overloading the Province column.  This migration adds dedicated
-- columns so that properties can store full addresses including province and
-- postal code separately.
-- -----------------------------------------------------------------------------

ALTER TABLE tblProperties
  ADD COLUMN AddressLine2 VARCHAR(255) NULL AFTER AddressLine1,
  ADD COLUMN PostalCode VARCHAR(20) NULL AFTER Province;
