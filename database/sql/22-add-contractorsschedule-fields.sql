-- Migration: Add ProposedEndDate and Notes columns to tblContractorSchedules
-- Adds support for extended scheduling windows and appointment notes
ALTER TABLE tblContractorSchedules
  ADD COLUMN ProposedEndDate DATETIME NULL AFTER ProposedDate,
  ADD COLUMN Notes TEXT NULL AFTER ProposedEndDate;

-- Create index on ProposedEndDate for queries ordering by end time if needed
-- Create index on the new end date column.  Note: MySQL does not support IF NOT EXISTS for indexes until 8.0.13.
CREATE INDEX IdxContractorSchedulesEndDate ON tblContractorSchedules (ProposedEndDate);