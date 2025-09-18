USE Rawson;

-- Test the main landlord tickets query from the API
SELECT 
  t.TicketID,
  t.TicketRefNumber,
  t.Description,
  t.UrgencyLevel,
  t.CreatedAt,
  t.CurrentStatus,
  
  -- Client information
  client.FullName as ClientName,
  client.Email as ClientEmail,
  client.Phone as ClientPhone,
  
  -- Quote summary (latest approved quote)
  q.QuoteID,
  q.QuoteAmount,
  q.QuoteStatus,
  q.SubmittedAt as QuoteSubmittedAt,
  contractor.FullName as ContractorName,
  contractor.Email as ContractorEmail,
  
  -- Appointment summary (next scheduled appointment)
  cs.ScheduleID,
  cs.ProposedDate as AppointmentDate,
  cs.ClientConfirmed as AppointmentConfirmed,
  
  -- Landlord approval status
  la.ApprovalStatus as LandlordApprovalStatus,
  la.ApprovedAt as LandlordApprovedAt
  
FROM tblTickets t

-- Join client information
LEFT JOIN tblusers client ON t.ClientUserID = client.UserID

-- Join latest approved quote (prioritize approved, then latest)
LEFT JOIN tblQuotes q ON t.TicketID = q.TicketID 
  AND q.QuoteID = (
    SELECT q2.QuoteID FROM tblQuotes q2 
    WHERE q2.TicketID = t.TicketID 
    ORDER BY 
      CASE WHEN q2.QuoteStatus = 'Approved' THEN 1 ELSE 2 END,
      q2.SubmittedAt DESC
    LIMIT 1
  )

-- Join contractor info for the quote
LEFT JOIN tblusers contractor ON q.ContractorUserID = contractor.UserID

-- Join next appointment
LEFT JOIN tblContractorSchedules cs ON t.TicketID = cs.TicketID
  AND cs.ScheduleID = (
    SELECT cs2.ScheduleID FROM tblContractorSchedules cs2
    WHERE cs2.TicketID = t.TicketID
    AND cs2.ProposedDate >= NOW()
    ORDER BY cs2.ProposedDate ASC
    LIMIT 1
  )

-- Join landlord approval
LEFT JOIN tblLandlordApprovals la ON q.QuoteID = la.QuoteID

WHERE EXISTS (
   SELECT 1
   FROM tblQuotes qx
   JOIN tblLandlordApprovals lax ON lax.QuoteID = qx.QuoteID
   WHERE qx.TicketID = t.TicketID AND lax.LandlordUserID = 33
 )
ORDER BY t.CreatedAt DESC
LIMIT 50 OFFSET 0;