-- 1) PlaceId length across tables that store Places
ALTER TABLE tblusers       MODIFY COLUMN PlaceId VARCHAR(64) NULL;
ALTER TABLE tblproperties  MODIFY COLUMN PlaceId VARCHAR(64) NULL;

-- 2) Ticket history Notes column (if you want to persist Notes moving forward)
ALTER TABLE tblTicketStatusHistory
  ADD COLUMN Notes TEXT NULL;

-- 3) Notifications created timestamp (so ORDER BY can use it if you want)
ALTER TABLE tblNotifications
  ADD COLUMN CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 4) Friendly defaults for paging values in case procedures use them

