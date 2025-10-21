USE Rawson;

ALTER TABLE tblusers
  ADD COLUMN WhatsAppOptIn TINYINT(1) NOT NULL DEFAULT 0 AFTER Phone;

CREATE INDEX Idx_users_phone ON tblusers (Phone);

/*For test users set WhatsAppOptIn=1 and ensure Phone is E.164 (eg. +2782…). */