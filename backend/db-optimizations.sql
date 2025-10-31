-- Database Optimizations for Landlord Lifecycle Performance
-- Run these commands in your MySQL database to add missing indexes

-- Index for tblLandlordProperties (most critical for landlord data scoping)
CREATE INDEX IF NOT EXISTS idx_landlord_properties_lookup 
ON tblLandlordProperties (LandlordUserID, PropertyID, ActiveTo);

-- Index for property-based ticket lookups
CREATE INDEX IF NOT EXISTS idx_tickets_property 
ON tblTickets (PropertyID, CurrentStatus, CreatedAt);

-- Index for quote lookups by ticket
CREATE INDEX IF NOT EXISTS idx_quotes_ticket_status 
ON tblQuotes (TicketID, QuoteStatus, SubmittedAt);

-- Index for landlord approvals lookup
CREATE INDEX IF NOT EXISTS idx_landlord_approvals_quote 
ON tblLandlordApprovals (QuoteID, LandlordUserID, ApprovalStatus);

-- Index for contractor schedules by ticket
CREATE INDEX IF NOT EXISTS idx_contractor_schedules_ticket 
ON tblContractorSchedules (TicketID, ProposedDate);

-- Index for ticket status history
CREATE INDEX IF NOT EXISTS idx_ticket_history_lookup 
ON tblTicketStatusHistory (TicketID, ChangedAt);

-- Index for client user lookups
CREATE INDEX IF NOT EXISTS idx_users_role_status 
ON tblUsers (Role, Status, UserID);

-- Performance analysis queries (run these to check query performance)
-- Replace ? with actual landlordId for testing

/*
-- Test main tickets query performance:
EXPLAIN SELECT COUNT(*) AS total
FROM tblTickets t
WHERE EXISTS (
   SELECT 1
   FROM tblLandlordProperties lp
   WHERE lp.PropertyID = t.PropertyID
     AND lp.LandlordUserID = 1  -- Replace with actual landlordId
     AND (lp.ActiveTo IS NULL OR lp.ActiveTo >= CURDATE())
);

-- Test quote ownership query performance:
EXPLAIN SELECT 1
FROM tblQuotes q
JOIN tblTickets t ON t.TicketID = q.TicketID
JOIN tblLandlordProperties lp
     ON lp.PropertyID = t.PropertyID
    AND lp.LandlordUserID = 1  -- Replace with actual landlordId
    AND (lp.ActiveTo IS NULL OR lp.ActiveTo >= CURDATE())
WHERE q.QuoteID = 1  -- Replace with actual quoteId
LIMIT 1;
*/

-- Notes:
-- 1. These indexes should significantly improve landlord query performance
-- 2. The compound indexes are ordered by selectivity (most selective first)
-- 3. ActiveTo is included to support the date range filtering
-- 4. Consider running ANALYZE TABLE after adding indexes to update statistics