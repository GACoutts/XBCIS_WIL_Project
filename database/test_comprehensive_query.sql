USE Rawson;

-- Test the comprehensive query exactly as it appears in the code
SELECT
  t.TicketID,
  t.TicketRefNumber,
  t.Description,
  t.UrgencyLevel,
  t.CreatedAt,
  t.CurrentStatus,

  client.FullName as ClientName,
  client.Email as ClientEmail,
  client.Phone as ClientPhone,

  q.QuoteID,
  q.QuoteAmount,
  q.QuoteStatus,
  q.SubmittedAt as QuoteSubmittedAt,
  contractor.FullName as ContractorName,
  contractor.Email as ContractorEmail,

  cs.ScheduleID,
  cs.ProposedDate as AppointmentDate,
  cs.ClientConfirmed as AppointmentConfirmed,

  la.ApprovalStatus as LandlordApprovalStatus,
  la.ApprovedAt as LandlordApprovedAt

FROM tblTickets t

LEFT JOIN tblusers client ON t.ClientUserID = client.UserID

LEFT JOIN tblQuotes q ON t.TicketID = q.TicketID
  AND q.QuoteID = (
    SELECT q2.QuoteID FROM tblQuotes q2
    WHERE q2.TicketID = t.TicketID
    ORDER BY
      CASE WHEN q2.QuoteStatus = 'Approved' THEN 1 ELSE 2 END,
      q2.SubmittedAt DESC
    LIMIT 1
  )

LEFT JOIN tblusers contractor ON q.ContractorUserID = contractor.UserID

LEFT JOIN tblContractorSchedules cs ON t.TicketID = cs.TicketID
  AND cs.ScheduleID = (
    SELECT cs2.ScheduleID FROM tblContractorSchedules cs2
    WHERE cs2.TicketID = t.TicketID
    AND cs2.ProposedDate >= NOW()
    ORDER BY cs2.ProposedDate ASC
    LIMIT 1
  )

LEFT JOIN tblLandlordApprovals la ON q.QuoteID = la.QuoteID

WHERE EXISTS (
   SELECT 1
   FROM tblQuotes qx
   JOIN tblLandlordApprovals lax ON lax.QuoteID = qx.QuoteID
   WHERE qx.TicketID = t.TicketID AND lax.LandlordUserID = 33
 )
ORDER BY t.CreatedAt DESC
LIMIT 50 OFFSET 0;
