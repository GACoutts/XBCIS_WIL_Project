import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import './styles/landlordDashboard.css'; // reuse your dashboard styles

function LandlordQuoteView() {
  const navigate = useNavigate();

  // Mock data for testing
  const [quotes, setQuotes] = useState([
    {
      QuoteID: 1,
      TicketID: "#02495",
      ContractorUserID: 101,
      QuoteAmount: 280,
      QuoteDescription: "Fix leaky tap",
      QuoteStatus: "Pending",
      Documents: [
        { DocumentID: 1, DocumentType: "PDF", DocumentURL: "https://example.com/quote1.pdf" }
      ]
    },
    {
      QuoteID: 2,
      TicketID: "#134256",
      ContractorUserID: 102,
      QuoteAmount: 820,
      QuoteDescription: "Clogged drain repair",
      QuoteStatus: "Pending",
      Documents: []
    }
  ]);

  const handleAction = (quoteId, action) => {
    // When approving a quote, mark it as approved and leave others unchanged. When rejecting, mark as rejected.
    setQuotes(prev => {
      // Find the ticket ID of the quote being acted on
      const target = prev.find(q => q.QuoteID === quoteId);
      if (!target) return prev;
      const ticketId = target.TicketID;
      return prev.map(q => {
        if (q.QuoteID !== quoteId) return q;
        // Update the status based on action
        return { ...q, QuoteStatus: action === 'approve' ? 'Approved' : 'Rejected' };
      });
    });
  };

  // Compute which tickets already have an approved quote. Used to disable approval on others.
  const approvedTickets = new Set(quotes.filter(q => q.QuoteStatus === 'Approved').map(q => q.TicketID));


  return (
    <div style={{ padding: "30px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "20px" }}>Contractor Quotes</h1>

      <button
        onClick={() => navigate("/landlord-dashboard")}
        className="btn btn-quotes"
        style={{ marginBottom: "30px" }}
      >
        Back to Dashboard
      </button>

      <div style={{ display: "grid", gap: "20px" }}>
        {quotes.map(q => (
          <div
            key={q.QuoteID}
            className="pendingapprovals-card"
            style={{
              padding: "20px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              transition: "transform 0.2s",
              borderRadius: "5px"
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.02)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
          >
            {/* Header: Ticket and Amount/Status */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div>
                <strong>Ticket:</strong> {q.TicketID} <br/>
                <strong>Description:</strong> {q.QuoteDescription}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "18px", fontWeight: "700", color: "black" }}>R {q.QuoteAmount}</div>
                <span className={`status-pill ${q.QuoteStatus === "Pending" ? "pending" : q.QuoteStatus === "Approved" ? "approved" : "rejected"}`}>
                  {q.QuoteStatus}
                </span>
              </div>
            </div>

            {/* Documents */}
            {q.Documents.length > 0 && (
              <div style={{ marginBottom: "12px" }}>
                {q.Documents.map(d => (
                  <a
                    key={d.DocumentID}
                    href={d.DocumentURL}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-quotes"
                    style={{ marginRight: "10px", padding: "5px 12px", fontSize: "13px" }}
                  >
                    View {d.DocumentType}
                  </a>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                className="btn btn-approve"
                disabled={q.QuoteStatus !== "Pending" || approvedTickets.has(q.TicketID)}
                onClick={() => handleAction(q.QuoteID, "approve")}
              >
                Approve
              </button>
              <button
                className="btn btn-reject"
                disabled={q.QuoteStatus !== "Pending" || approvedTickets.has(q.TicketID)}
                onClick={() => handleAction(q.QuoteID, "reject")}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default LandlordQuoteView;

/*
useEffect(() => {
  // This would normally fetch quotes from the backend API
  // "/api/landlord/quotes" is the endpoint that returns the landlord's quotes
  // The response is converted to JSON and then used to update the state with setQuotes
  // Any errors during fetch are logged to the console
  // Right now this is commented out because we don't have real quote data yet
  fetch("/api/landlord/quotes")
    .then(res => res.json())
    .then(data => setQuotes(data))
    .catch(err => console.error(err));
}, []);
*/
