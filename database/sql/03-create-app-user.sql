-- Create application user with limited privileges for security
-- Run this script as MySQL root user
-- IMPORTANT: Replace 'REPLACE_WITH_STRONG_PASSWORD' with a secure password before running

-- Create the application user (localhost only for security)
CREATE USER IF NOT EXISTS 'rawson_local'@'localhost' IDENTIFIED BY 'REPLACE_WITH_STRONG_PASSWORD';

-- Grant only necessary privileges (no DROP, ALTER, DELETE for now)
GRANT SELECT, INSERT, UPDATE ON Rawson.* TO 'rawson_local'@'localhost';

-- Apply changes
FLUSH PRIVILEGES;

-- Verify user was created and has correct privileges
SELECT User, Host FROM mysql.user WHERE User = 'rawson_local';
SHOW GRANTS FOR 'rawson_local'@'localhost';
