import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import {
  getTicketsFiltered,
  approveTicket,
  rejectTicket,
  approveQuote,
  rejectQuote,
  getProperties
} from "./landlordApi";

import "./styles/landlorddash.css";

/**
 * LandlordTickets
 *
 * This page lists all tickets related to the landlord's properties.  It
 * separates tickets into "Current" (open/in-progress) and "History"
 * (completed or rejected) sections.  Landlords can filter tickets by
 * status and property, approve or reject newly logged tickets
 * ("Awaiting Landlord Approval"), and approve or reject contractor
 * quotes that are pending their decision.  Basic details such as the
 * ticket reference, property address, issue, submission date, current
 * status and quote information are shown.
 */
export default function LandlordTickets() {
  const { logout } = useAuth();
  const [showLogout, setShowLogout] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [properties, setProperties] = useState([]);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPropertyId, setFilterPropertyId] = useState("");

  // Fetch properties (for filter) on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await getProperties();
        if (res.success) setProperties(res.data || []);
        else setProperties([]);
      } catch (err) {
        console.error("Error loading landlord properties", err);
        setProperties([]);
      }
    })();
  }, []);

  // Fetch tickets whenever the filters change
  useEffect(() => {
    (async () => {
      try {
        const params = {};
        if (filterStatus) params.status = filterStatus;
        if (filterPropertyId) params.propertyId = filterPropertyId;
        // Limit to 100 for now; pagination could be added later
        params.limit = 100;
        const res = await getTicketsFiltered(params);
        const list = Array.isArray(res?.data?.tickets)
          ? res.data.tickets
          : Array.isArray(res?.tickets)
            ? res.tickets
            : [];
        setTickets(list);
      } catch (err) {
        console.error("Error loading tickets", err);
        setTickets([]);
      }
    })();
  }, [filterStatus, filterPropertyId]);

  const handleLogout = async () => {
    await logout();
    window.location.reload();
  };

  // Event handlers for ticket approval and rejection
  const handleApproveTicket = async (ticketId) => {
    try {
      const res = await approveTicket(ticketId);
      if (!res.success) alert(res.message || "Failed to approve ticket");
      // Remove the ticket from awaiting list by reloading tickets
      setTickets((prev) => prev.map((t) => (t.ticketId === ticketId ? { ...t, status: 'New' } : t)));
    } catch (err) {
      console.error("Approve ticket error", err);
      alert("Error approving ticket");
    }
  };

  const handleRejectTicket = async (ticketId) => {
    const reason = prompt("Please provide a reason for rejection (optional):", "");
    try {
      const res = await rejectTicket(ticketId, reason);
      if (!res.success) alert(res.message || "Failed to reject ticket");
      setTickets((prev) => prev.map((t) => (t.ticketId === ticketId ? { ...t, status: 'Rejected' } : t)));
    } catch (err) {
      console.error("Reject ticket error", err);
      alert("Error rejecting ticket");
    }
  };

  // Event handlers for quote approval and rejection
  const handleApproveQuote = async (ticketId, quoteId) => {
    try {
      const res = await approveQuote(quoteId);
      if (!res.success) alert(res.message || "Failed to approve quote");
      setTickets((prev) =>
        prev.map((t) =>
          t.ticketId === ticketId
            ? {
                ...t,
                quote: t.quote
                  ? { ...t.quote, status: 'Approved', landlordApproval: { status: 'Approved' } }
                  : null,
                status: 'Approved'
              }
            : t
        )
      );
    } catch (err) {
      console.error("Approve quote error", err);
      alert("Error approving quote");
    }
  };

  const handleRejectQuote = async (ticketId, quoteId) => {
    const reason = prompt("Please provide a reason for rejection (optional):", "");
    try {
      const res = await rejectQuote(quoteId);
      if (!res.success) alert(res.message || "Failed to reject quote");
      setTickets((prev) =>
        prev.map((t) =>
          t.ticketId === ticketId
            ? {
                ...t,
                quote: t.quote
                  ? { ...t.quote, status: 'Rejected', landlordApproval: { status: 'Rejected' } }
                  : null,
                status: 'In Review'
              }
            : t
        )
      );
    } catch (err) {
      console.error("Reject quote error", err);
      alert("Error rejecting quote");
    }
  };

  // Partition tickets into current and history categories
  const currentTickets = tickets.filter(
    (t) => t.status !== 'Completed' && t.status !== 'Rejected'
  );
  const historyTickets = tickets.filter(
    (t) => t.status === 'Completed' || t.status === 'Rejected'
  );

  // Compose property options for filtering
  const propertyOptions = [
    { value: '', label: 'All Properties' },
    ...properties.map((p) => ({
      value: p.PropertyID.toString(),
      label: [p.AddressLine1, p.AddressLine2, p.City, p.Province, p.PostalCode]
        .filter((x) => x && x.toString().trim())
        .join(', ')
    }))
  ];

  return (
    <>
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-logo">
          <div className="logo-placeholder">GoodLiving</div>
        </div>
        <div className="navbar-right">
          <ul className="navbar-menu">
            <li>
              <Link to="/landlord">Dashboard</Link>
            </li>
            <li>
              <Link to="/landlord/tickets" className="active">
                Tickets
              </Link>
            </li>
            <li>
              <Link to="/landlord/properties">Properties</Link>
            </li>
            <li>
              <Link to="/notifications">Notifications</Link>
            </li>
            <li>
              <Link to="/landlord/settings">Settings</Link>
            </li>
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
              <button onClick={async () => { await logout(); window.location.reload(); }}>Log Out</button>
            </div>
          )}
        </div>
      </nav>

      <div style={{ padding: '20px 90px 40px' }}>
        <h1 style={{ marginBottom: 20 }}>My Tickets</h1>
        {/* Filters */}
        <div className="ticket-filters-ltickets" style={{ display: 'flex', gap: 20, marginBottom: 20, alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Status:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ marginTop: 5, padding: '6px 10px', borderRadius: 5, border: '1px solid #FBD402', fontSize: 14 }}
            >
              <option value="">All</option>
              <option value="Awaiting Landlord Approval">Awaiting Approval</option>
              <option value="New">New</option>
              <option value="In Review">In Review</option>
              <option value="Quoting">Quoting</option>
              <option value="Approved">Approved</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Completed">Completed</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Property:</label>
            <select
              value={filterPropertyId}
              onChange={(e) => setFilterPropertyId(e.target.value)}
              style={{ marginTop: 5, padding: '6px 10px', borderRadius: 5, border: '1px solid #FBD402', fontSize: 14 }}
            >
              {propertyOptions.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Current Tickets */}
        <div className="pendingapprovals-wrapper-landlord" style={{ marginTop: 0 }}>
          <h2 style={{ margin: '0 0 10px 0' }}>Current Tickets</h2>
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
              {currentTickets.length ? (
                currentTickets.map((t) => {
                  const awaitingApproval = t.status === 'Awaiting Landlord Approval';
                  const pendingQuote = t.quote && t.quote.status === 'Pending' && (!t.quote.landlordApproval || !t.quote.landlordApproval.status);
                  return (
                    <div key={t.ticketId} className="pendingapprovals-row">
                      <div className="cell ticket">{t.referenceNumber || t.ticketId}</div>
                      <div className="cell property">{t.propertyAddress || '—'}</div>
                      <div className="cell issue">{t.description || '—'}</div>
                      <div className="cell submitted">{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}</div>
                      <div className="cell status">
                        <span className={`status-pill ${awaitingApproval ? 'pending' : t.status === 'Approved' ? 'approved' : t.status === 'Rejected' ? 'rejected' : 'pending'}`}>{awaitingApproval ? 'Awaiting Approval' : t.status}</span>
                      </div>
                      <div className="cell actions">
                        {awaitingApproval ? (
                          <>
                            <button className="btn btn-approve" onClick={() => handleApproveTicket(t.ticketId)}>Approve</button>
                            <button className="btn btn-reject" onClick={() => handleRejectTicket(t.ticketId)}>Reject</button>
                          </>
                        ) : pendingQuote ? (
                          <>
                            <button className="btn btn-approve" onClick={() => handleApproveQuote(t.ticketId, t.quote.id)}>Approve Quote</button>
                            <button className="btn btn-reject" onClick={() => handleRejectQuote(t.ticketId, t.quote.id)}>Reject Quote</button>
                          </>
                        ) : (
                          <span style={{ color: '#666' }}>—</span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="pendingapprovals-row" style={{ justifyContent: 'center', gridTemplateColumns: '1fr' }}>
                  No current tickets.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* History Tickets */}
        <div className="pendingapprovals-wrapper-landlord" style={{ marginTop: 40 }}>
          <h2 style={{ margin: '0 0 10px 0' }}>Ticket & Quote History</h2>
          <div className="pendingapprovals-card">
            <div className="pendingapprovals-header" style={{ gridTemplateColumns: '1fr 3fr 2fr 2fr 2fr' }}>
              <div className="column column-ticket">Ticket ID</div>
              <div className="column column-property">Property</div>
              <div className="column column-issue">Issue</div>
              <div className="column column-status">Status</div>
              <div className="column column-status">Quote</div>
            </div>
            <div className="pendingapprovals-body">
              {historyTickets.length ? (
                historyTickets.map((t) => (
                  <div key={t.ticketId} className="pendingapprovals-row" style={{ gridTemplateColumns: '1fr 3fr 2fr 2fr 2fr' }}>
                    <div className="cell ticket">{t.referenceNumber || t.ticketId}</div>
                    <div className="cell property">{t.propertyAddress || '—'}</div>
                    <div className="cell issue">{t.description || '—'}</div>
                    <div className="cell status">
                      <span className={`status-pill ${t.status === 'Completed' ? 'approved' : 'rejected'}`}>{t.status}</span>
                    </div>
                    <div className="cell">
                      {t.quote
                        ? `${t.quote.status} (R ${Number(t.quote.amount).toFixed(0)})`
                        : '—'}
                    </div>
                  </div>
                ))
              ) : (
                <div className="pendingapprovals-row" style={{ justifyContent: 'center', gridTemplateColumns: '1fr' }}>
                  No history tickets.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}