-- Create tblLandlordApprovals table for quote approval decisions
-- Run this script after creating tblQuotes and tblUsers tables
-- Stores landlord approval/rejection decisions for contractor quotes

USE Rawson;

CREATE TABLE IF NOT EXISTS tblLandlordApprovals (
  ApprovalID INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique approval record ID',
  QuoteID INT NOT NULL COMMENT 'Quote being approved/rejected',
  LandlordUserID INT NOT NULL COMMENT 'Landlord who approved/rejected',
  ApprovalStatus ENUM('Approved','Rejected') NOT NULL COMMENT 'Approval decision',
  ApprovedAt DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'When decision was made',
  DigitalSignature VARCHAR(255) NULL COMMENT 'Optional digital signature image/path',

  -- Foreign key constraints
  FOREIGN KEY (QuoteID) REFERENCES tblQuotes(QuoteID)
    ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (LandlordUserID) REFERENCES tblusers(UserID)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Landlord approval decisions for quotes';

-- Create indexes for better performance
CREATE INDEX IdxLandlordApprovalsQuote ON tblLandlordApprovals (QuoteID);
CREATE INDEX IdxLandlordApprovalsLandlord ON tblLandlordApprovals (LandlordUserID);
CREATE INDEX IdxLandlordApprovalsStatus ON tblLandlordApprovals (ApprovalStatus);
CREATE INDEX IdxLandlordApprovalsApproved ON tblLandlordApprovals (ApprovedAt);

-- Verify table structure
DESCRIBE tblLandlordApprovals;
