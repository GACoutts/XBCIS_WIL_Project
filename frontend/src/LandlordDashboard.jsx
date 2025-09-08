import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";
import { useAuth } from "./context/AuthContext.jsx";

import {
  getTickets,
  getQuotesForTicketLandlord,
  approveQuote,
  rejectQuote
} from "./landlordApi"; // adjust path

function LandlordDashboard() {
  const navigate = useNavigate();

  const [tickets, setTickets] = useState([]);
  const [quotes, setQuotes] = useState({}); // { ticketId: [quotes...] }
  const [rangeMonths, setRangeMonths] = useState(3);
  const { logout } = useAuth();
  const [showLogout, setShowLogout] = useState(false);

    const handleLogout = async () => {
    await logout();
    window.location.reload(); // redirect to login or refresh
  };


  // Fetch tickets
  useEffect(() => {
    async function loadTickets() {
      try {
        const data = await getTickets();
        setTickets(data.tickets);
      } catch (err) {
        console.error("Error fetching tickets:", err);
      }
    }
    loadTickets();
  }, []);

  // Fetch quotes per ticket
  useEffect(() => {
    async function loadQuotes() {
      try {
        const allQuotes = {};
        for (const t of tickets) {
          const ticketQuotes = await getQuotesForTicketLandlord(t.TicketID);
          allQuotes[t.TicketID] = ticketQuotes;
        }
        setQuotes(allQuotes);
      } catch (err) {
        console.error("Error fetching quotes:", err);
      }
    }
    if (tickets.length) loadQuotes();
  }, [tickets]);

  // Approve/reject quote
  async function handleAction(ticketId, quoteId, action) {
    try {
      if (action === "approve") await approveQuote(quoteId);
      else await rejectQuote(quoteId);

      setQuotes((prev) => ({
        ...prev,
        [ticketId]: prev[ticketId].map((q) =>
          q.QuoteID !== quoteId
            ? q
            : { ...q, QuoteStatus: action === "approve" ? "Approved" : "Rejected" }
        )
      }));
    } catch (err) {
      console.error("Error updating quote:", err);
    }
  }

  // Filter tickets for chart
  const filteredTickets = useMemo(() => {
    const now = new Date();
    return tickets.filter((t) => {
      if (!t.SubmittedAt) return false;
      const d = new Date(t.SubmittedAt);
      if (isNaN(d)) return false;
      const monthsDiff =
        (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      return monthsDiff < rangeMonths;
    });
  }, [tickets, rangeMonths]);

  // Chart data
  const chartData = useMemo(() => {
    const map = new Map();
    filteredTickets.forEach((t) => {
      const d = new Date(t.SubmittedAt);
      if (isNaN(d)) return;
      const label = d.toLocaleString("default", { month: "long" });
      const quoteSum = quotes[t.TicketID]
        ? quotes[t.TicketID].reduce((acc, q) => acc + Number(q.QuoteAmount || 0), 0)
        : 0;
      map.set(label, (map.get(label) || 0) + quoteSum);
    });

    const monthsOrdered = Array.from(
      new Set(
        filteredTickets
          .map((t) => {
            const d = new Date(t.SubmittedAt);
            if (isNaN(d)) return null;
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          })
          .filter(Boolean)
      )
    ).sort();

    const labels = monthsOrdered.map((ym) => {
      const [y, m] = ym.split("-");
      const d = new Date(Number(y), Number(m) - 1, 1);
      return d.toLocaleString("default", { month: "long" });
    });

    const finalLabels = labels.length ? labels : Array.from(map.keys());

    return finalLabels.map((label) => ({
      name: label,
      cost: Math.round(((map.get(label) || 0) / 1000) * 10) / 10
    }));
  }, [filteredTickets, quotes]);

  // Summary stats
  const summary = useMemo(() => {
    const totals = { logged: filteredTickets.length, approved: 0, rejected: 0, pending: 0, cost: 0 };
    filteredTickets.forEach((t) => {
      const ticketQuotes = quotes[t.TicketID] || [];
      const ticketCost = ticketQuotes.reduce((acc, q) => acc + Number(q.QuoteAmount || 0), 0);
      totals.cost += ticketCost;
      ticketQuotes.forEach((q) => {
        if (q.QuoteStatus === "Approved") totals.approved += 1;
        else if (q.QuoteStatus === "Rejected") totals.rejected += 1;
        else totals.pending += 1;
      });
    });
    return totals;
  }, [filteredTickets, quotes]);

  const fmtCurrency = (v) =>
    new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(v);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0].payload;
    const raw = (item.raw ?? item.cost * 1000) || 0;
    return (
      <div style={{ background: "white", border: "1px solid #ddd", padding: 8, fontSize: 12 }}>
        <div style={{ fontWeight: 600 }}>{label}</div>
        <div>{fmtCurrency(raw)}</div>
      </div>
    );
  };

  const maxValue = Math.max(...chartData.map((d) => d.cost));
  const maxRounded = Math.ceil(maxValue / 2) * 2;
  const ticks = Array.from({ length: maxRounded / 2 + 1 }, (_, i) => i * 2);

  return (
    <>
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-logo">
          <img src="https://placehold.co/120x40" alt="logo" />
        </div>
        <div className="navbar-right">
          <ul className="navbar-menu">
            <li><Link to="/">Dashboard</Link></li>
            <li><Link to="/tickets">Tickets</Link></li>
            <li><Link to="/reports">Reports</Link></li>
            <li><Link to="/properties">Properties</Link></li>
            <li><Link to="/settings">Settings</Link></li>
          </ul>
        </div>
        <div className="navbar-profile">
          <button
            className="profile-btn"
            onClick={() => setShowLogout(!showLogout)}
          >
            <img src="https://placehold.co/40" alt="profile" />
          </button>
          {showLogout && (
            <div className="logout-popup">
              <button onClick={handleLogout}>Log Out</button>
            </div>
          )}
        </div>
      </nav>

      {/* Dashboard Title + Independent Button */}
      <div
        className="dashboard-title"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          margin: "20px 0"
        }}
      >
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <button
          style={{
            padding: "8px 16px",
            fontSize: 14,
            backgroundColor: "#FBD402",
            color: "black",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            fontWeight: 600
          }}
          onClick={() => navigate("/landlord-quotes")}
        >
          View Contractor Quotes
        </button>
      </div>

      {/* Pending Approvals */}
      <div className="sub-title"><h2>Pending Approvals</h2></div>
      <div className="pendingapprovals-wrapper">
        <div className="pendingapprovals-card">
          <div className="pendingapprovals-header">
            <div className="column column-ticket">Ticket ID</div>
            <div className="column column-property">Property</div>
            <div className="column column-issue">Issue</div>
            <div className="column column-submitted">Submitted</div>
            <div className="column column-status">Status</div>
            <div className="column column-actions">Actions</div>
          </div>
          <div className="pendingapprovals-body">
            {tickets.map((ticket) => {
              const ticketQuotes = quotes[ticket.TicketID] || [];
              const pendingQuote = ticketQuotes.find((q) => q.QuoteStatus === "Pending");

              return (
                <div key={ticket.TicketID} className="pendingapprovals-row">
                  <div className="cell ticket">{ticket.TicketID}</div>
                  <div className="cell property">{ticket.PropertyAddress}</div>
                  <div className="cell issue">{ticket.Description}</div>
                  <div className="cell submitted">{new Date(ticket.SubmittedAt).toLocaleDateString()}</div>
                  <div className="cell status">
                    <span className={`status-pill ${pendingQuote ? "pending" : "approved"}`}>
                      {pendingQuote ? "Pending" : "Approved"}
                    </span>
                  </div>
                  <div className="cell actions">
                    {pendingQuote && (
                      <>
                        <button
                          onClick={() => handleAction(ticket.TicketID, pendingQuote.QuoteID, "approve")}
                          className="btn btn-approve"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleAction(ticket.TicketID, pendingQuote.QuoteID, "reject")}
                          className="btn btn-reject"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Maintenance Overview Chart */}
      <div className="maintenance-overview">
        <div className="maintenance-chart-card">
          <div className="maintenance-chart-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0 }}>Maintenance Costs Review</h3>
              <div style={{ fontSize: 12, color: "#666" }}>Last {rangeMonths} months</div>
            </div>
            <div>
              <label style={{ fontSize: 12, marginRight: 8 }}>Range:</label>
              <select value={rangeMonths} onChange={(e) => setRangeMonths(Number(e.target.value))}>
                <option value={1}>1 month</option>
                <option value={3}>3 months</option>
                <option value={6}>6 months</option>
                <option value={12}>12 months</option>
              </select>
            </div>
          </div>

          <div className="maintenance-chart">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} margin={{ top: 12, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, maxRounded]} ticks={ticks} interval={0} />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  align="center"
                  content={() => (
                    <div style={{ display: "flex", justifyContent: "center", fontSize: "13px", marginTop: "8px" }}>
                      <span style={{ width: 12, height: 12, backgroundColor: "#FBD402", marginRight: 6, borderRadius: 2 }} />
                      <span style={{ color: "black" }}>Cost (thousands)</span>
                    </div>
                  )}
                />
                <Bar dataKey="cost" name="Cost (thousands)" fill="#FBD402" barSize={250} radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Summary */}
        <aside className="maintenance-summary">
          <div className="summary-card">
            <h4 style={{ marginTop: 0 }}>Summary</h4>
            <div className="summary-row"><div className="summary-label">Logged</div><div className="summary-value">{summary.logged}</div></div>
            <div className="summary-row"><div className="summary-label">Approved</div><div className="summary-value">{summary.approved}</div></div>
            <div className="summary-row"><div className="summary-label">Rejected</div><div className="summary-value">{summary.rejected}</div></div>
            <div className="summary-row"><div className="summary-label">Pending</div><div className="summary-value">{summary.pending}</div></div>
            <div style={{ height: 1, background: "#f1e6cc", margin: "12px 0" }} />
            <div className="summary-row total-row"><div className="summary-label">Total Cost</div><div className="summary-value">{fmtCurrency(summary.cost)}</div></div>
          </div>
        </aside>
      </div>
    </>
  );
}

export default LandlordDashboard;
