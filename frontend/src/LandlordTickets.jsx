import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getTickets, getQuotesForTicketLandlord, getTicketHistory } from "./landlordApi";

/**
 * LandlordTickets page
 *
 * This component lists all tickets that belong to the current landlord.
 * Each row can be expanded to reveal the associated quotes and a simple
 * status history timeline. Quotes include the contractor and quote status
 * with buttons to approve or reject if still pending. The status history
 * shows the changes recorded for the ticket.
 */
export default function LandlordTickets() {
  const navigate = useNavigate();

  const [tickets, setTickets] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});
  const [quotes, setQuotes] = useState({});
  const [histories, setHistories] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch all landlord tickets on mount
    async function fetchData() {
      try {
        const result = await getTickets();
        const list = Array.isArray(result?.tickets)
          ? result.tickets
          : Array.isArray(result?.data?.tickets)
          ? result.data.tickets
          : [];
        setTickets(list);
      } catch (err) {
        console.error("Error loading tickets", err);
        setTickets([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Toggle expansion for a given ticket row
  const toggleRow = (ticketId) => {
    setExpandedRows((prev) => ({
      ...prev,
      [ticketId]: !prev[ticketId],
    }));
    // Lazy load quotes and history when expanding for the first time
    if (!quotes[ticketId]) loadQuotes(ticketId);
    if (!histories[ticketId]) loadHistory(ticketId);
  };

  const loadQuotes = async (ticketId) => {
    try {
      const q = await getQuotesForTicketLandlord(ticketId);
      setQuotes((prev) => ({ ...prev, [ticketId]: q || [] }));
    } catch (err) {
      console.error("Error loading quotes", err);
      setQuotes((prev) => ({ ...prev, [ticketId]: [] }));
    }
  };

  const loadHistory = async (ticketId) => {
    try {
      const h = await getTicketHistory(ticketId);
      setHistories((prev) => ({ ...prev, [ticketId]: h || [] }));
    } catch (err) {
      console.error("Error loading history", err);
      setHistories((prev) => ({ ...prev, [ticketId]: [] }));
    }
  };

  if (loading) return <div>Loading tickets…</div>;

  return (
    <div className="landlord-tickets-page" style={{ padding: "1rem" }}>
      <h2>All Tickets</h2>
      <table className="tickets-table" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "4px" }}>Ticket ID</th>
            <th style={{ textAlign: "left", padding: "4px" }}>Issue</th>
            <th style={{ textAlign: "left", padding: "4px" }}>Submitted</th>
            <th style={{ textAlign: "left", padding: "4px" }}>Status</th>
            <th style={{ textAlign: "left", padding: "4px" }}>Quote Status</th>
            <th style={{ textAlign: "left", padding: "4px" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => {
            const ticketId = t.TicketID;
            const createdAt = t.createdAt || t.CreatedAt || t.SubmittedAt;
            const dateStr = createdAt ? new Date(createdAt).toLocaleString() : "";
            // determine quote summary: first quote's status or aggregated status
            const tq = quotes[ticketId] || [];
            let quoteStatus = "N/A";
            if (tq.length) {
              const hasApproved = tq.some((q) => q.QuoteStatus === "Approved");
              const hasRejected = tq.every((q) => q.QuoteStatus === "Rejected");
              if (hasApproved) quoteStatus = "Approved";
              else if (hasRejected) quoteStatus = "Rejected";
              else quoteStatus = "Pending";
            }
            return (
              <React.Fragment key={ticketId}>
                <tr
                  style={{ cursor: "pointer", borderBottom: "1px solid #ddd" }}
                  onClick={() => toggleRow(ticketId)}
                >
                  <td style={{ padding: "4px" }}>{ticketId}</td>
                  <td style={{ padding: "4px" }}>{t.Description || t.description}</td>
                  <td style={{ padding: "4px" }}>{dateStr}</td>
                  <td style={{ padding: "4px" }}>{t.CurrentStatus || t.status}</td>
                  <td style={{ padding: "4px" }}>{quoteStatus}</td>
                  <td style={{ padding: "4px" }}>{expandedRows[ticketId] ? "Hide" : "View"} Details</td>
                </tr>
                {expandedRows[ticketId] && (
                  <tr>
                    <td colSpan="6" style={{ padding: "8px", background: "#f9f9f9" }}>
                      {/* Quote details */}
                      <h4>Quotes</h4>
                      {tq.length ? (
                        <table style={{ width: "100%", marginBottom: "1rem", borderCollapse: "collapse" }}>
                          <thead>
                            <tr>
                              <th>Quote ID</th>
                              <th>Amount</th>
                              <th>Status</th>
                              <th>Contractor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tq.map((q) => (
                              <tr key={q.QuoteID}>
                                <td>{q.QuoteID}</td>
                                <td>{q.QuoteAmount}</td>
                                <td>{q.QuoteStatus}</td>
                                <td>{q.ContractorUserID || q.ContractorName}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p>No quotes available.</p>
                      )}

                      {/* History timeline */}
                      <h4>Status History</h4>
                      {histories[ticketId] && histories[ticketId].length ? (
                        <ul style={{ listStyle: "none", paddingLeft: 0 }}>
                          {histories[ticketId].map((h) => (
                            <li key={h.HistoryID || Math.random()}>
                              {new Date(h.ChangedAt).toLocaleString()} – {h.Status}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>No history available.</p>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}