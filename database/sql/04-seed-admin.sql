-- Seed admin user for testing
-- Run this script as MySQL root user after creating the table
-- Demo password: "Password123!" (do not use in production)

USE Rawson;

INSERT INTO tblusers
  (FullName, Email, PasswordHash, Phone, Role, Status)
VALUES
  ('Admin User', 'admin@rawson.local', '$2b$12$GwD4ledPuqrDI3CVijXScurralqh1VedX/I9alVhrno16xk5rLGWq', NULL, 'Staff', 'Active')
ON DUPLICATE KEY UPDATE
  FullName = VALUES(FullName),
  PasswordHash = VALUES(PasswordHash),
  Role = VALUES(Role),
  Status = VALUES(Status);

-- Verify the user was created
SELECT UserID, FullName, Email, Role, Status, DateRegistered FROM tblusers WHERE Email = 'admin@rawson.local';
