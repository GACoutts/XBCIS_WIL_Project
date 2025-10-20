import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
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

import "./styles/landlorddash.css";

import {
  getTicketsFiltered,
  approveTicket,
  rejectTicket,
  approveQuote,
  rejectQuote,
  getProperties
} from "./landlordApi";

function LandlordDashboard() {
  // NOTE: useNavigate is not used in this component. The call was removed to
  // prevent reference errors when navigating. Navigation is handled via
  // <Link> components in the JSX below.

  const [tickets, setTickets] = useState([]);
  const [properties, setProperties] = useState([]);
  const [rangeMonths, setRangeMonths] = useState(3);
  const [filterPropertyId, setFilterPropertyId] = useState("");
  const { logout } = useAuth();
  const [showLogout, setShowLogout] = useState(false);

    const handleLogout = async () => {
    await logout();
    window.location.reload(); // redirect to login or refresh
  };


  // Load properties for filter on mount
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

  // Load tickets whenever filter changes
  useEffect(() => {
    async function loadTickets() {
      try {
        const params = {};
        if (filterPropertyId) params.propertyId = filterPropertyId;
        params.limit = 200; // fetch enough tickets
        const data = await getTicketsFiltered(params);
        const list = Array.isArray(data?.data?.tickets)
          ? data.data.tickets
          : Array.isArray(data?.tickets)
            ? data.tickets
            : [];
        setTickets(list);
      } catch (err) {
        console.error("Error fetching tickets:", err);
        setTickets([]);
      }
    }
    loadTickets();
  }, [filterPropertyId]);


  // Filter tickets for chart and summary: only include tickets within the
  // selected range and (optionally) belonging to the chosen property.  A
  // ticket will be included if its createdAt date is within the past
  // rangeMonths months and it matches the property filter.
  const filteredTickets = useMemo(() => {
    const now = new Date();
    return tickets.filter((t) => {
      // property filter
      if (filterPropertyId && String(t.propertyId) !== String(filterPropertyId)) return false;
      const created = t.createdAt;
      if (!created) return false;
      const d = new Date(created);
      if (isNaN(d)) return false;
      const monthsDiff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      return monthsDiff < rangeMonths;
    });
  }, [tickets, rangeMonths, filterPropertyId]);

  // Chart data
  const chartData = useMemo(() => {
    const map = new Map();
    filteredTickets.forEach((t) => {
      const created = t.createdAt;
      const d = new Date(created);
      if (isNaN(d)) return;
      const label = d.toLocaleString('default', { month: 'long' });
      const quoteSum = t.quote ? Number(t.quote.amount || 0) : 0;
      map.set(label, (map.get(label) || 0) + quoteSum);
    });
    // Determine the order of months to show (most recent first)
    const monthsOrdered = Array.from(
      new Set(
        filteredTickets
          .map((t) => {
            const created = t.createdAt;
            const d = new Date(created);
            if (isNaN(d)) return null;
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          })
          .filter(Boolean)
      )
    ).sort();
    const labels = monthsOrdered.map((ym) => {
      const [y, m] = ym.split('-');
      const d = new Date(Number(y), Number(m) - 1, 1);
      return d.toLocaleString('default', { month: 'long' });
    });
    const finalLabels = labels.length ? labels : Array.from(map.keys());
    return finalLabels.map((label) => ({
      name: label,
      cost: Math.round(((map.get(label) || 0) / 1000) * 10) / 10
    }));
  }, [filteredTickets]);

  // Summary stats
  const summary = useMemo(() => {
    const totals = { logged: filteredTickets.length, approved: 0, rejected: 0, pending: 0, cost: 0 };
    filteredTickets.forEach((t) => {
      if (t.quote) {
        const q = t.quote;
        totals.cost += Number(q.amount || 0);
        if (q.status === 'Approved') totals.approved += 1;
        else if (q.status === 'Rejected') totals.rejected += 1;
        else if (q.status === 'Pending') totals.pending += 1;
      }
    });
    return totals;
  }, [filteredTickets]);

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

  const maxValue = Math.max(...chartData.map((d) => d.cost), 0);
  const maxRounded = Math.ceil(maxValue / 2) * 2;
  const ticks = Array.from({ length: maxRounded / 2 + 1 }, (_, i) => i * 2);

  // Partition tickets into awaiting ticket approvals and pending quote approvals
  const awaitingTickets = tickets.filter(
    (t) => t.status === 'Awaiting Landlord Approval' && (!filterPropertyId || String(t.propertyId) === String(filterPropertyId))
  );
  const pendingQuoteTickets = tickets.filter((t) => {
    return (
      t.quote &&
      t.quote.status === 'Pending' &&
      (!t.quote.landlordApproval || !t.quote.landlordApproval.status) &&
      (!filterPropertyId || String(t.propertyId) === String(filterPropertyId))
    );
  });

  return (
    <>
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-logo">
          <div className="logo-placeholder">GoodLiving</div>
        </div>
        <div className="navbar-right">
          <ul className="navbar-menu">
            <li><Link to="/landlord">Dashboard</Link></li>
            <li><Link to="/landlord/tickets">Tickets</Link></li>
            <li><Link to="/landlord/properties">Properties</Link></li>
            <li><Link to="/landlord/settings">Settings</Link></li>
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

      {/* Dashboard Title */}
      <div className="dashboard-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '20px 0' }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
      </div>

      {/* Awaiting Ticket Approvals */}
      <div className="sub-title"><h2>Awaiting Ticket Approvals</h2></div>
      <div className="pendingapprovals-wrapper">
        <div className="pendingapprovals-card">
          <div className="pendingapprovals-header" style={{ gridTemplateColumns: '120px 1fr 1fr 140px 200px' }}>
            <div className="column column-ticket">Ticket ID</div>
            <div className="column column-property">Property</div>
            <div className="column column-issue">Issue</div>
            <div className="column column-submitted">Submitted</div>
            <div className="column column-actions">Actions</div>
          </div>
          <div className="pendingapprovals-body">
            {awaitingTickets.length ? (
              awaitingTickets.map((t) => (
                <div key={t.ticketId} className="pendingapprovals-row" style={{ gridTemplateColumns: '120px 1fr 1fr 140px 200px' }}>
                  <div className="cell ticket">{t.referenceNumber || t.ticketId}</div>
                  <div className="cell property">{t.propertyAddress || '—'}</div>
                  <div className="cell issue">{t.description || '—'}</div>
                  <div className="cell submitted">{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}</div>
                  <div className="cell actions" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn btn-approve" onClick={() => approveTicket(t.ticketId).then(() => setTickets((prev) => prev.map((tk) => tk.ticketId === t.ticketId ? { ...tk, status: 'New' } : tk)))}>Approve</button>
                    <button className="btn btn-reject" onClick={() => {
                      const reason = prompt('Reason for rejection (optional):', '');
                      rejectTicket(t.ticketId, reason).then(() => setTickets((prev) => prev.map((tk) => tk.ticketId === t.ticketId ? { ...tk, status: 'Rejected' } : tk)));
                    }}>Reject</button>
                  </div>
                </div>
              ))
            ) : (
              <div className="pendingapprovals-row" style={{ justifyContent: 'center', gridTemplateColumns: '1fr' }}>
                No tickets awaiting approval.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quote Approvals */}
      <div className="sub-title" style={{ marginTop: '40px' }}><h2>Quote Approvals</h2></div>
      <div className="pendingapprovals-wrapper">
        <div className="pendingapprovals-card">
          <div className="pendingapprovals-header" style={{ gridTemplateColumns: '120px 1fr 1fr 140px 200px' }}>
            <div className="column column-ticket">Ticket ID</div>
            <div className="column column-property">Property</div>
            <div className="column column-issue">Issue</div>
            <div className="column column-quote">Quote</div>
            <div className="column column-actions">Actions</div>
          </div>
          <div className="pendingapprovals-body">
            {pendingQuoteTickets.length ? (
              pendingQuoteTickets.map((t) => (
                <div key={t.ticketId} className="pendingapprovals-row" style={{ gridTemplateColumns: '120px 1fr 1fr 140px 200px' }}>
                  <div className="cell ticket">{t.referenceNumber || t.ticketId}</div>
                  <div className="cell property">{t.propertyAddress || '—'}</div>
                  <div className="cell issue">{t.description || '—'}</div>
                  <div className="cell submitted">R {Number(t.quote?.amount).toFixed(0)}</div>
                  <div className="cell actions" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn btn-approve" onClick={() => approveQuote(t.quote.id).then(() => setTickets((prev) => prev.map((tk) => tk.ticketId === t.ticketId ? { ...tk, quote: { ...tk.quote, status: 'Approved', landlordApproval: { status: 'Approved' } }, status: 'Approved' } : tk)))}>Approve</button>
                    <button className="btn btn-reject" onClick={() => {
                      const reason = prompt('Reason for rejection (optional):', '');
                      rejectQuote(t.quote.id).then(() => setTickets((prev) => prev.map((tk) => tk.ticketId === t.ticketId ? { ...tk, quote: { ...tk.quote, status: 'Rejected', landlordApproval: { status: 'Rejected' } }, status: 'In Review' } : tk)));
                    }}>Reject</button>
                  </div>
                </div>
              ))
            ) : (
              <div className="pendingapprovals-row" style={{ justifyContent: 'center', gridTemplateColumns: '1fr' }}>
                No quotes awaiting approval.
              </div>
            )}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, marginRight: 4 }}>Range:</label>
                <select
                  value={rangeMonths}
                  onChange={(e) => setRangeMonths(Number(e.target.value))}
                  style={{ padding: '3px 6px', border: '1px solid #FBD402', borderRadius: 4, fontSize: 13 }}
                >
                  <option value={1}>1 month</option>
                  <option value={3}>3 months</option>
                  <option value={6}>6 months</option>
                  <option value={12}>12 months</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, marginRight: 4 }}>Property:</label>
                <select
                  value={filterPropertyId}
                  onChange={(e) => setFilterPropertyId(e.target.value)}
                  style={{ padding: '3px 6px', border: '1px solid #FBD402', borderRadius: 4, fontSize: 13 }}
                >
                  <option value="">All</option>
                  {properties.map((p) => {
                    const addr = [
                      p.AddressLine1,
                      p.AddressLine2,
                      p.City,
                      p.Province,
                      p.PostalCode
                    ]
                      .filter((x) => x && x.toString().trim())
                      .join(', ');
                    return (
                      <option key={p.PropertyID} value={p.PropertyID}>
                        {addr || p.PropertyID}
                      </option>
                    );
                  })}
                </select>
              </div>
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
