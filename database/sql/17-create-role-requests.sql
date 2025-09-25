USE Rawson;

CREATE TABLE IF NOT EXISTS tblRoleRequests (
  RequestID     INT AUTO_INCREMENT PRIMARY KEY,
  UserID        INT NOT NULL,
  RequestedRole ENUM('Client','Landlord','Contractor','Staff') NOT NULL,
  Status        ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
  Notes         VARCHAR(500) NULL,
  CreatedAt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ReviewedBy    INT NULL,
  ReviewedAt    DATETIME NULL,
  CONSTRAINT FkRrUser     FOREIGN KEY (UserID)     REFERENCES tblusers(UserID) ON DELETE CASCADE,
  CONSTRAINT FkRrReviewer FOREIGN KEY (ReviewedBy)  REFERENCES tblusers(UserID) ON DELETE SET NULL,
  INDEX IdxStatus (Status),
  INDEX IdxUser (UserID)
);
