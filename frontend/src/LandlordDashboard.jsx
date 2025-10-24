import React, { useEffect, useState, useMemo } from "react";
import RoleNavbar from "./components/RoleNavbar.jsx";
import { useAuth } from "./context/AuthContext.jsx";
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

import "./styles/userdash.css";       // sticky header layout + spacing (also provides modal/gallery styles)
import "./styles/landlorddash.css";   // landlord-specific + jobs-* add-ons

import {
  getTicketsFiltered,
  approveTicket,
  rejectTicket,
  approveQuote,
  rejectQuote,
  getProperties,
  getQuoteMedia
} from "./landlordApi";

function LandlordDashboard() {
  const [tickets, setTickets] = useState([]);
  const [properties, setProperties] = useState([]);
  const [rangeMonths, setRangeMonths] = useState(3);
  const [filterPropertyId, setFilterPropertyId] = useState("");

  // Details modal state
  const [detailsTicket, setDetailsTicket] = useState(null);
  const [ticketMedia, setTicketMedia] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);

  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    window.location.reload();
  };

  const handleViewQuote = async (quoteId) => {
    try {
      const files = await getQuoteMedia(quoteId);
      const first = Array.isArray(files) ? files[0] : null;
      if (first?.MediaURL) window.open(first.MediaURL, "_blank", "noopener,noreferrer");
      else alert("No quote document found for this quote yet.");
    } catch (e) {
      console.error("view quote error", e);
      alert("Couldn't load the quote document.");
    }
  };

  // -------- Details modal open/close (fetch media like tenant) --------
  const openDetails = async (ticket) => {
    setDetailsTicket(ticket);
    setTicketMedia([]);
    setModalLoading(true);
    try {
      const id = ticket.TicketID ?? ticket.ticketId;
      const res = await fetch(`/api/tickets/${id}`, { credentials: "include" });
      const data = await res.json();
      if (res.ok && Array.isArray(data?.media)) {
        setTicketMedia(data.media);
      } else {
        setTicketMedia([]);
      }
    } catch (e) {
      console.error("Failed to load ticket media:", e);
      setTicketMedia([]);
    } finally {
      setModalLoading(false);
    }
  };

  const closeDetails = () => {
    setDetailsTicket(null);
    setTicketMedia([]);
    setModalLoading(false);
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await getProperties();
        setProperties(res.success ? res.data || [] : []);
      } catch (err) {
        console.error("Error loading landlord properties", err);
        setProperties([]);
      }
    })();
  }, []);

  useEffect(() => {
    async function loadTickets() {
      try {
        const params = {};
        if (filterPropertyId) params.propertyId = filterPropertyId;
        params.limit = 200;
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

  const getStatus = (t) => t?.status ?? t?.CurrentStatus ?? '';
  const getPropertyId = (t) => {
    const id = t?.propertyId ?? t?.PropertyID;
    return id !== undefined && id !== null ? String(id) : '';
  };
  const getCreatedAt = (t) => t?.createdAt ?? t?.CreatedAt;
  const getTicketId = (t) => t?.ticketId ?? t?.TicketID;
  const getReference = (t) => t?.referenceNumber ?? t?.TicketRefNumber;
  const getTitle = (t) => {
  const x = t ?? {};
  return (
    x.ticketTitle ??
    x.name ??
    x.issueTitle ??
    x.Title ??
    x.TicketTitle ??
    x.Name ??
    x.IssueTitle ??
    x.title ??
    x.ticketTitle ??
    x.name ??
    x.issueTitle ??
    x.description ??
    x.Description ?? // final fallback
    ""
  );
};
  const getDescription = (t) => t?.description ?? t?.Description ?? '';


  // ===== Chart + Summary  =====
  const filteredTickets = useMemo(() => {
    const now = new Date();
    return tickets.filter((t) => {
      if (filterPropertyId && getPropertyId(t) !== String(filterPropertyId)) return false;
      const created = getCreatedAt(t);
      if (!created) return false;
      const d = new Date(created);
      if (isNaN(d)) return false;
      const monthsDiff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      return monthsDiff < rangeMonths;
    });
  }, [tickets, rangeMonths, filterPropertyId]);

  const chartData = useMemo(() => {
    const map = new Map();
    filteredTickets.forEach((t) => {
      const created = getCreatedAt(t);
      const d = new Date(created);
      if (isNaN(d)) return;
      const label = d.toLocaleString('default', { month: 'long' });
      const quoteSum = t.quote ? Number(t.quote.amount || 0) : 0;
      map.set(label, (map.get(label) || 0) + quoteSum);
    });
    const monthsOrdered = Array.from(new Set(
      filteredTickets
        .map((t) => {
          const created = getCreatedAt(t);
          const d = new Date(created);
          if (isNaN(d)) return null;
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        })
        .filter(Boolean)
    )).sort();
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

  // ===== Approval Lists (use unified jobs-* styling) =====
  const awaitingTickets = tickets.filter(
    (t) => t.ticketNeedsLandlordApproval === true && (!filterPropertyId || getPropertyId(t) === String(filterPropertyId))
  );

  const pendingQuoteTickets = tickets.filter((t) => {
    return (
      t.quoteNeedsLandlordApproval === true &&
      t.quote &&
      t.quote.status === 'Pending' &&
      (!t.quote.landlordApproval || !t.quote.landlordApproval.status) &&
      (!filterPropertyId || getPropertyId(t) === String(filterPropertyId))
    );
  });

  return (
    <div className="dashboard-page">
      <RoleNavbar />

      <div className="content" style={{ padding: '20px 24px 40px' }}>
        <div className="dashboard-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '20px 0' }}>
          <h1 style={{ margin: 0 }}>Dashboard</h1>
        </div>

        {/* ===== Awaiting Ticket Approvals ===== */}
        <div className="sub-title"><h2>Awaiting Ticket Approvals</h2></div>
        <div className="jobs-section">
          {awaitingTickets.length === 0 ? (
            <div className="empty-tickets">No tickets awaiting approval</div>
          ) : (
            <div className="jobs-table-container">
              <div className="jobs-table-scroll">
                <table className="jobs-table">
                  <thead>
                    <tr>
                      <th>Ticket ID</th>
                      <th>Property</th>
                      <th>Issue</th>
                      <th>Submitted</th>
                      <th className="actions-col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {awaitingTickets.map((t) => {
                      const ticketId = getTicketId(t);
                      const ref = getReference(t);
                      const created = getCreatedAt(t);
                      return (
                        <tr key={ticketId}>
                          <td>{ref || ticketId}</td>
                          <td>{t.propertyAddress || '-'}</td>
                          <td>{getTitle(t) || '-'}</td>
                          <td>{created ? new Date(created).toLocaleDateString() : ''}</td>
                          <td className="actions-col">
                            <div className="action-buttons">
                              {/* Details (opens modal w/ media) */}
                              <button
                                className="btn btn-view"
                                onClick={() => openDetails(t)}
                                title="View ticket details"
                              >
                                Details
                              </button>

                              <button
                                className="btn btn-approve"
                                onClick={() => approveTicket(ticketId).then(() =>
                                  setTickets((prev) => prev.map((tk) => {
                                    const id = tk.ticketId ?? tk.TicketID;
                                    return id === ticketId
                                      ? { ...tk, status: 'New', CurrentStatus: 'New', ticketNeedsLandlordApproval: false }
                                      : tk;
                                  }))
                                )}
                              >
                                Approve
                              </button>

                              <button
                                className="btn btn-reject"
                                onClick={() => {
                                
                                  rejectTicket(ticketId).then(() =>
                                    setTickets((prev) => prev.map((tk) => {
                                      const id = tk.ticketId ?? tk.TicketID;
                                      return id === ticketId
                                        ? { ...tk, status: 'Rejected', CurrentStatus: 'Rejected', ticketNeedsLandlordApproval: false }
                                        : tk;
                                    }))
                                  );
                                }}
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ===== Quote Approvals ===== */}
        <div className="sub-title" style={{ marginTop: '40px' }}><h2>Quote Approvals</h2></div>
        <div className="jobs-section">
          {pendingQuoteTickets.length === 0 ? (
            <div className="empty-tickets">No quotes awaiting approval</div>
          ) : (
            <div className="jobs-table-container">
              <div className="jobs-table-scroll">
                <table className="jobs-table">
                  <thead>
                    <tr>
                      <th>Ticket ID</th>
                      <th>Property</th>
                      <th>Issue</th>
                      <th>Quote</th>
                      <th className="actions-col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingQuoteTickets.map((t) => {
                      const ticketId = getTicketId(t);
                      const ref = getReference(t);
                      const quoteAmount = t.quote?.amount ? Number(t.quote.amount) : 0;
                      return (
                        <tr key={ticketId}>
                          <td>{ref || ticketId}</td>
                          <td>{t.propertyAddress || '-'}</td>
                          <td>{getDescription(t) || '-'}</td>
                          <td>R {quoteAmount.toFixed(0)}</td>
                          <td className="actions-col">
                            <div className="action-buttons">
                              <button className="btn btn-view" onClick={() => handleViewQuote(t.quote.id)}>View Quote</button>
                              <button
                                className="btn btn-approve"
                                onClick={() =>
                                  approveQuote(t.quote.id).then(() =>
                                    setTickets((prev) =>
                                      prev.map((tk) => {
                                        const id = tk.ticketId ?? tk.TicketID;
                                        if (id === ticketId) {
                                          const updatedQuote = tk.quote
                                            ? { ...tk.quote, status: 'Approved', landlordApproval: { status: 'Approved' } }
                                            : null;
                                          return { ...tk, quote: updatedQuote, status: 'Approved', CurrentStatus: 'Approved', quoteNeedsLandlordApproval: false };
                                        }
                                        return tk;
                                      })
                                    )
                                  )
                                }
                              >
                                Approve
                              </button>
                              <button
                                className="btn btn-reject"
                                onClick={() => {
                                  rejectQuote(t.quote.id).then(() =>
                                    setTickets((prev) =>
                                      prev.map((tk) => {
                                        const id = tk.ticketId ?? tk.TicketID;
                                        if (id === ticketId) {
                                          const updatedQuote = tk.quote
                                            ? { ...tk.quote, status: 'Rejected', landlordApproval: { status: 'Rejected' } }
                                            : null;
                                          return { ...tk, quote: updatedQuote, status: 'In Review', CurrentStatus: 'In Review', quoteNeedsLandlordApproval: false };
                                        }
                                        return tk;
                                      })
                                    )
                                  );
                                }}
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ===== Maintenance Overview (CHART + SUMMARY) ===== */}
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
                      const addr = [p.AddressLine1, p.AddressLine2, p.City, p.Province, p.PostalCode]
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
      </div>

      {/* Ticket Details Modal (tenant-style, with media; no timeline) */}
      {detailsTicket && (
        <div className="modal-overlay" onClick={closeDetails}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            {/* HEADER */}
            <div className="modal-header">
              <h2 className="modal-title">Ticket Details</h2>
              <button
                type="button"
                className="modal-close-icon"
                aria-label="Close ticket details"
                onClick={closeDetails}
              >
                ✕
              </button>
            </div>

            {/* DETAILS */}
            <div className="modal-section">
              <p>
                <strong>Ref / ID:</strong>{" "}
                {getReference(detailsTicket) || getTicketId(detailsTicket)}
              </p>
              <p>
                <strong>Property:</strong> {detailsTicket.propertyAddress || "-"}
              </p>
              <p>
                <strong>Submitted:</strong>{" "}
                {getCreatedAt(detailsTicket)
                  ? new Date(getCreatedAt(detailsTicket)).toLocaleString()
                  : "-"}
              </p>
              <p>
                <strong>Status:</strong>{" "}
                <span className="status-text">{getStatus(detailsTicket) || "-"}</span>
              </p>
              <p>
                <strong>Urgency:</strong> {detailsTicket.urgencyLevel || "-"}
              </p>
              <div style={{ marginTop: 8 }}>
                <strong>Issue Description:</strong>
                <div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>
                  {getDescription(detailsTicket) || "-"}
                </div>
              </div>
            </div>

            {/* QUOTE (optional) */}
            {detailsTicket.quote && (
              <div className="modal-section">
                <h3 style={{ marginTop: 0 }}>Latest Quote</h3>
                <div>
                  {detailsTicket.quote?.status} - R{" "}
                  {Number(detailsTicket.quote?.amount || 0).toFixed(0)}
                </div>
                <div style={{ marginTop: 8 }}>
                  <button
                    className="btn btn-view"
                    type="button"
                    onClick={() => handleViewQuote(detailsTicket.quote.id)}
                  >
                    View Quote
                  </button>
                </div>
              </div>
            )}

            {/* MEDIA */}
            <div className="modal-section">
              <h3 style={{ marginTop: 0 }}>Media</h3>
              {modalLoading ? (
                <p>Loading media…</p>
              ) : ticketMedia.length === 0 ? (
                <p className="empty-text">No media uploaded</p>
              ) : (
                <div className="media-gallery-grid">
                  {ticketMedia.map((m, idx) => {
                    const url = m.MediaURL || "";
                    const type = (m.MediaType || "").toLowerCase();
                    const isImage =
                      type.startsWith("image") ||
                      /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                    const isVideo =
                      type.startsWith("video") || /\.(mp4|webm|ogg)$/i.test(url);

                    return (
                      <div key={idx} className="media-card">
                        {isImage ? (
                          <img
                            src={url}
                            alt={`Media ${idx}`}
                            onError={(e) =>
                            (e.currentTarget.src =
                              "https://placehold.co/150x100?text=No+Image")
                            }
                            onClick={() =>
                              window.open(url, "_blank", "noopener,noreferrer")
                            }
                            style={{ cursor: "pointer" }}
                          />
                        ) : isVideo ? (
                          <video
                            controls
                            className="media-thumb"
                            style={{ width: "100%", borderRadius: 8 }}
                          >
                            <source src={url} type={type || "video/mp4"} />
                          </video>
                        ) : (
                          <div
                            className="media-placeholder"
                            onClick={() =>
                              url &&
                              window.open(url, "_blank", "noopener,noreferrer")
                            }
                            style={{ cursor: url ? "pointer" : "default" }}
                          >
                            {url ? "Open file" : "No preview available"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* FOOTER */}
            <div className="modal-footer">
              <button onClick={closeDetails} className="action-btn" type="button">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default LandlordDashboard;
