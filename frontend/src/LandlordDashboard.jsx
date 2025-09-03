import React, { useMemo, useState } from "react";
import { Link } from 'react-router-dom';
import {ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend} from "recharts";

function LandlordDashboard(){

const [items, setItems] = useState([
    {
      ticketId: "#02495",
      property: "23 Apple Road",
      issue: "Leaky Tap",
      submitted1: "2025-06-09",
      submitted: "1 Day/s Ago",
      status: "Pending",
      cost: 280,
    },
    {
      ticketId: "#134256",
      property: "41 James Lane",
      issue: "Clogged Drain",
      submitted1: "2025-06-05",
      submitted: "2 Day/s Ago",
      status: "Pending",
      cost: 820,
    },
    {
      ticketId: "#374829",
      property: "04 Augusta Jane...",
      issue: "AC System Down",
      submitted1: "2025-06-18",
      submitted: "2 Day/s Ago",
      status: "Pending",
      cost: 760,
    },
    {
      ticketId: "#102957",
      property: "12 Winchester A...",
      issue: "Broken Toilet",
      submitted1: "2025-07-02",
      submitted: "3 Day/s Ago",
      status: "Pending",
      cost: 500,
    }
  ]);

  function handleAction(ticketId, action) {
    setItems((prev) =>
      prev.map((it) =>
        it.ticketId !== ticketId
          ? it
          : { ...it, status: action === "approve" ? "Approved" : "Rejected" }
      )
    );
  }

  const [rangeMonths, setRangeMonths] = useState(3);

  const filteredForOverview = useMemo(() => {
    const now = new Date();
    return items.filter((t) => {
      
      if (!t.submitted1) return false;
      const d = new Date(t.submitted1);
      if (isNaN(d)) return false;
      
      const monthsDiff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      return monthsDiff < rangeMonths; // 
    });
  }, [items, rangeMonths]);

  const chartData = useMemo(() => {
    const map = new Map();
    filteredForOverview.forEach((t) => {
      const d = new Date(t.submitted1);
      if (isNaN(d)) return;
      const label = d.toLocaleString("default", { month: "long" }); // 
      map.set(label, (map.get(label) || 0) + (Number(t.cost) || 0));
    });
    
    const monthsOrdered = Array.from(
      new Set(
        filteredForOverview
          .map((t) => {
            const d = new Date(t.submitted1);
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
      cost: Math.round(((map.get(label) || 0) / 1000) * 10) / 10, 
    }));
  }, [filteredForOverview]);

  
  const summary = useMemo(() => {
    const totals = { logged: filteredForOverview.length, approved: 0, rejected: 0, pending: 0, cost: 0 };
    filteredForOverview.forEach((t) => {
      totals.cost += Number(t.cost) || 0;
      if (t.status === "Approved") totals.approved += 1;
      else if (t.status === "Rejected") totals.rejected += 1;
      else totals.pending += 1;
    });
    return totals;
  }, [filteredForOverview]);

  const fmtCurrency = (v) =>
    new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
      maximumFractionDigits: 0,
    }).format(v);

     const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0].payload;
    const raw = (item.raw ?? item.cost * 1000) || 0;
    return (
      <div
        style={{
          background: "white",
          border: "1px solid #ddd",
          padding: 8,
          fontSize: 12,
        }}
      >
        <div style={{ fontWeight: 600 }}>{label}</div>
        <div>{fmtCurrency(raw)}</div>
      </div>
    );
  };

const maxValue = Math.max(...chartData.map(d => d.cost));
const maxRounded = Math.ceil(maxValue / 2) * 2;  
const ticks = Array.from({ length: (maxRounded / 2) + 1 }, (_, i) => i * 2);

    return(
        <>
        <nav className="navbar">
        <div className="navbar-logo">
            <img src="https://placehold.co/120x40" alt="logo" />
        </div>
        <div className="navbar-right">
            <ul className="navbar-menu">
                <li>
                    <Link to="/">Dashboard</Link>
                </li>
                <li>
                    <Link to="/tickets">Tickets</Link>
                </li>
                <li>
                    <Link to="/reports">Reports</Link>
                </li>
                <li>
                    <Link to="/properties">Properties</Link>
                </li>
                <li>
                    <Link to="/settings">Settings</Link>
                </li>
            </ul>
        </div>
      <div className="navbar-profile">
        <img src="https://placehold.co/40" alt="profile" />
      </div>
    </nav>

    <div className = "dashboard-title">
        <h1>Dashboard</h1>
    </div>
    <div className = "sub-title">
        <h2>Pending Approvals</h2>
    </div>

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
      {items.map((row) => (
        <div key={row.ticketId} className="pendingapprovals-row">
          <div className="cell ticket">{row.ticketId}</div>
          <div className="cell property">{row.property}</div>
          <div className="cell issue">{row.issue}</div>
          <div className="cell submitted">{row.submitted}</div>
          <div className="cell status">
            <span
              className={`status-pill ${
                row.status === "Pending"
                  ? "pending"
                  : row.status === "Approved"
                  ? "approved"
                  : "rejected"
              }`}
            >
              {row.status}
            </span>
          </div>
          <div className="cell actions">
            <button
              onClick={() => handleAction(row.ticketId, "approve")}
              disabled={row.status !== "Pending"}
              className={`btn btn-approve ${
                row.status !== "Pending" ? "disabled" : ""
              }`}
            >
              Approve
            </button>
            <button
              onClick={() => handleAction(row.ticketId, "reject")}
              disabled={row.status !== "Pending"}
              className={`btn btn-reject ${
                row.status !== "Pending" ? "disabled" : ""
              }`}
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
</div>

<div className="maintenance-overview">
        <div className="maintenance-chart-card">
          <div className="maintenance-chart-header">
            <div>
              <h3 style={{ margin: 0 }}>Maintenance Costs Review</h3>
              <div style={{ fontSize: 12, color: "#666" }}>
                Last {rangeMonths} months
              </div>
            </div>

            <div style={{ marginLeft: "auto" }}>
              <label style={{ fontSize: 12, marginRight: 8 }}>Range:</label>
              <select
                value={rangeMonths}
                onChange={(e) => setRangeMonths(Number(e.target.value))}
              >
                <option value={1}>1 month</option>
                <option value={3}>3 months</option>
                <option value={6}>6 months</option>
                <option value={12}>12 months</option>
              </select>
            </div>
          </div>

          <div className="maintenance-chart">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                data={chartData}
                margin={{ top: 12, right: 24, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis
                domain={[0, maxRounded]} 
                ticks={ticks}
                interval={0}
                label={{
                value: "",
                angle: -90,
                position: "insideLeft",
                dy: -6,
                dx: 12,
                style: { fontSize: 12 },
                }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                verticalAlign="bottom"
                align="center"
                content={() => (
            <div style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                fontSize: "13px",
                marginTop: "8px"
                        }}>
            <span style={{
                display: "inline-block",
                width: 12,
                height: 12,
                backgroundColor: "#FBD402",
                marginRight: 6,
                borderRadius: 2, 
                        }}>
            </span>
            <span style={{ color: "black" }}>Cost (thousands)</span>
        </div>
        )}/>
                <Bar dataKey="cost" name="Cost (thousands)" fill="#FBD402" barSize={250} radius={[5, 5, 0, 0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <aside className="maintenance-summary">
          <div className="summary-card">
            <h4 style={{ marginTop: 0 }}>Summary</h4>

            <div className="summary-row">
              <div className="summary-label">Logged</div>
              <div className="summary-value">{summary.logged}</div>
            </div>

            <div className="summary-row">
              <div className="summary-label">Approved</div>
              <div className="summary-value">{summary.approved}</div>
            </div>

            <div className="summary-row">
              <div className="summary-label">Rejected</div>
              <div className="summary-value">{summary.rejected}</div>
            </div>

            <div className="summary-row">
              <div className="summary-label">Pending</div>
              <div className="summary-value">{summary.pending}</div>
            </div>

            <div style={{ height: 1, background: "#f1e6cc", margin: "12px 0" }} />

            <div className="summary-row total-row">
              <div className="summary-label">Total Cost</div>
              <div className="summary-value">{fmtCurrency(summary.cost)}</div>
            </div>
          </div>
        </aside>
      </div>

        </>
    );
}

export default LandlordDashboard