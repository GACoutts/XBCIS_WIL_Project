-- Create tblusers table with specified schema
-- Run this script as MySQL root user after creating the database

USE Rawson;

CREATE TABLE IF NOT EXISTS tblusers (
  UserID INT AUTO_INCREMENT PRIMARY KEY,
  FullName VARCHAR(100) NOT NULL,
  Email VARCHAR(150) NOT NULL UNIQUE,
  PasswordHash VARCHAR(255) NOT NULL,
  Phone VARCHAR(20) NULL,
  Role ENUM('Client','Landlord','Contractor','Staff') NOT NULL,
  DateRegistered DATETIME DEFAULT CURRENT_TIMESTAMP,
  Status ENUM('Active','Inactive','Suspended', 'Rejected') DEFAULT 'Active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Add indexes for better performance
CREATE INDEX idx_tblusers_status ON tblusers (Status);
CREATE INDEX idx_tblusers_role ON tblusers (Role);

-- Verify table structure
DESCRIBE tblusers;
