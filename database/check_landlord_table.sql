USE Rawson;

DESCRIBE tblLandlordApprovals;

-- Also check the allowed values for ApprovalStatus
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'Rawson' AND TABLE_NAME = 'tblLandlordApprovals' AND COLUMN_NAME = 'ApprovalStatus';