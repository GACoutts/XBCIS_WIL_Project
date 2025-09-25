-- Create Rawson database with proper character set
-- Run this script as MySQL root user

CREATE DATABASE IF NOT EXISTS Rawson
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

-- Verify database was created
SHOW DATABASES LIKE 'Rawson';
