import React, { useState, useEffect, useMemo } from "react";
import RoleNavbar from "./components/RoleNavbar.jsx";
import "./styles/staffdash.css";
import ReviewRoleRequests from "./components/ReviewRoleRequest.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";

function StaffDashboard() {
  const { logout } = useAuth();

  const [allTickets, setAllTickets] = useState([]);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDate, setFilterDate] = useState("");

  // Assign contractor modal
  const [showContractorModal, setShowContractorModal] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [activeContractors, setActiveContractors] = useState([]);
  const [chosenContractorId, setChosenContractorId] = useState(null);

  // Ticket details modal
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [selectedTicketDetails, setSelectedTicketDetails] = useState(null);

  const [ticketMedia, setTicketMedia] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);


  // ===== Helpers =====
  const getUrgencyClass = (urgency) => {
    switch ((urgency || "").toLowerCase()) {
      case "high": return "urgency-high";
      case "medium": return "urgency-medium";
      case "low": return "urgency-low";
      default: return "";
    }
  };

  const mapDisplayStatus = (status, createdAt) => {
    if (!status) return "";
    if (status === "New" && createdAt) {
      const diffDays = (Date.now() - new Date(createdAt)) / 86400000;
      if (diffDays > 31) return "";
      return "New";
    }
    switch (status) {
      case "In Review": return "In Review";
      case "Awaiting Staff Assignment": return "Awaiting Staff Assignment";
      case "Quoting": return "Quoting";
      case "Awaiting Landlord Approval": return "Awaiting Landlord Approval";
      case "Awaiting Appointment": return "Awaiting Appointment";
      case "Approved": return "Approved";
      case "Scheduled": return "Scheduled";
      case "Completed": return "Closed";
      case "Rejected": return "Rejected";
      default: return status;
    }
  };


  const getStatusTone = (statusText) => {
    if (!statusText) return "";
    if ([
      "In Review",
      "Awaiting Staff Assignment",
      "Quoting",
      "Awaiting Landlord Approval",
      "Awaiting Appointment",
      "Scheduled"
    ].includes(statusText)) {
      return "status-awaiting";
    }
    if (statusText === "Approved") return "status-approved";
    if (["Completed", "Closed"].includes(statusText)) return "status-closed";
    if (statusText === "Rejected") return "status-rejected";
    return "";
  };


  const titleOrDesc = (t) => (t?.Title && t.Title.trim()) || t?.Description || "-";

  // Which statuses to show in the pie (order matters)
  const STATUS_ORDER = [
    "New",
    "In Review",
    "Awaiting Staff Assignment",
    "Quoting",
    "Awaiting Landlord Approval",
    "Awaiting Appointment",
    "Approved",
    "Scheduled",
    "Closed",
    "Rejected",
  ];

  // best-effort getter for a resolved/closed timestamp
  const getResolvedAt = (t) =>
    t?.ResolvedAt ||
    t?.ClosedAt ||
    t?.CompletedAt ||
    // if backend didn’t send explicit resolved time but the ticket is closed,
    // fall back to UpdatedAt if present:
    ((t?.CurrentStatus === "Completed" || t?.CurrentStatus === "Closed") ? t?.UpdatedAt : null);


  // ===== Data =====
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/tickets", { credentials: "include" });
        const data = await res.json();
        setAllTickets(Array.isArray(data?.tickets) ? data.tickets : []);
      } catch {
        setAllTickets([]);
      }
    })();
  }, []);

  const filteredTickets = useMemo(() => {
    const list = allTickets
      .filter(t => !filterStatus || mapDisplayStatus(t.CurrentStatus, t.CreatedAt) === filterStatus)
      .filter(t => !filterDate || new Date(t.CreatedAt) >= new Date(filterDate));

    const effective = (t) => new Date(t.CreatedAt || Date.now());
    return list.sort((a, b) => effective(b) - effective(a));
  }, [allTickets, filterStatus, filterDate]);

  const totalOpenTickets = allTickets.filter(t => mapDisplayStatus(t.CurrentStatus, t.CreatedAt) !== "Closed").length;

  // ===== Assign contractor flow =====
  const loadActiveContractors = async () => {
    try {
      const res = await fetch("/api/admin/contractors/active", { credentials: "include" });
      const data = await res.json();
      if (res.ok) setActiveContractors(data.contractors || []);
    } catch { }
  };

  const handleAssignContractor = async (ticketId) => {
    setSelectedTicketId(ticketId);
    setShowContractorModal(true);
    await loadActiveContractors();
    try {
      const res = await fetch(`/api/tickets/${ticketId}/contractor`, { credentials: "include" });
      const data = await res.json();
      setChosenContractorId(res.ok && data.contractor ? data.contractor.UserID : null);
    } catch { setChosenContractorId(null); }
  };

  const handleConfirmAssign = async () => {
    if (!chosenContractorId) return alert("Select contractor");
    try {
      const res = await fetch(`/api/staff/tickets/${selectedTicketId}/assign`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractorUserId: chosenContractorId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to assign contractor");
      setAllTickets(prev => prev.map(t => t.TicketID === selectedTicketId ? { ...t, CurrentStatus: "Quoting" } : t));
      setShowContractorModal(false);
      setChosenContractorId(null);
      setSelectedTicketId(null);
      alert("Contractor assigned successfully!");
    } catch (e) { alert(e.message); }
  };

  // ===== Ticket details modal =====
  const handleOpenTicketModal = async (ticketId) => {
    try {
      setModalLoading(true);
      setTicketMedia([]);
      const res = await fetch(`/api/tickets/${ticketId}`, { credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        // merge any missing property info from the list row we already have
        const row = allTickets.find(t => t.TicketID === ticketId);
        const merged = { ...data.ticket };
        if (!merged.PropertyAddress && row?.PropertyAddress) merged.PropertyAddress = row.PropertyAddress;
        // (some backends use lower-case or nested objects)
        if (!merged.propertyAddress && row?.PropertyAddress) merged.propertyAddress = row.PropertyAddress;
        setSelectedTicketDetails(merged);
        setShowTicketModal(true);
      }

      // fetch media for staff
      try {
        const r2 = await fetch(`/api/staff/tickets/${ticketId}/media`, { credentials: "include" });
        const d2 = await r2.json();
        if (r2.ok && Array.isArray(d2?.data)) setTicketMedia(d2.data);
        else setTicketMedia([]);
      } catch { setTicketMedia([]); }
    } catch {
      setSelectedTicketDetails(null);
      setTicketMedia([]);
    } finally {
      setModalLoading(false);
    }
  };


  const handleCloseTicket = async (ticketId) => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}/close`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to close ticket");
      setAllTickets(prev => prev.map(t => t.TicketID === ticketId ? { ...t, CurrentStatus: "Completed" } : t));
      setShowTicketModal(false);
      alert("Ticket closed!");
    } catch (e) { alert(e.message || "Failed"); }
  };

  const clearFilters = () => {
    setFilterStatus("");
    setFilterDate("");
  };

  // ===== Analytics =====
  const statusColors = {
    New: "#8884d8",
    "Awaiting Staff Assignment": "#ffcc00",
    "Awaiting Landlord Approval": "#ffbb99",
    "Awaiting Appointment": "#82ca9d",
    Quoting: "#a0a0ff",
    Approved: "#ffc658",
    Rejected: "#ff8042",
    Scheduled: "#b0e0e6",
    Closed: "#8dd1e1"
  };

  const ALLOWED_STATUSES = new Set([
    'New', 'In Review', 'Awaiting Staff Assignment', 'Quoting',
    'Awaiting Landlord Approval', 'Awaiting Appointment',
    'Approved', 'Scheduled', 'Rejected', 'Closed'
  ]);

  const ticketsByStatus = useMemo(() => {
    const counts = {};
    allTickets.forEach(t => {
      const s = mapDisplayStatus(t.CurrentStatus, t.CreatedAt);
      if (!s || !ALLOWED_STATUSES.has(s)) return;
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0);
  }, [allTickets]);

  const ticketsByUrgencyData = useMemo(() => {
    const counts = { Low: 0, Medium: 0, High: 0, Critical: 0 };
    const openTickets = allTickets.filter(
      t => mapDisplayStatus(t.CurrentStatus, t.CreatedAt) !== 'Closed'
    );
    openTickets.forEach(t => {
      const u = (t.UrgencyLevel || '').toLowerCase();
      if (u === 'low') counts.Low++;
      else if (u === 'medium') counts.Medium++;
      else if (u === 'high') counts.High++;
      else if (u === 'critical') counts.Critical++;
    });
    return [
      { urgency: 'Low', count: counts.Low },
      { urgency: 'Medium', count: counts.Medium },
      { urgency: 'High', count: counts.High },
      { urgency: 'Critical', count: counts.Critical },
    ].filter(d => d.count > 0);
  }, [allTickets]);

  const ticketsByWeekData = useMemo(() => {
    const toWeekKey = (d) => {
      const date = new Date(d);
      const jan1 = new Date(date.getFullYear(), 0, 1);
      // ISO-ish week calc (good enough for charts)
      const day = (date - jan1) / 86400000 + jan1.getDay() + 1;
      const weekNo = Math.ceil(day / 7);
      return `${date.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
    };

    const byWeek = new Map();

    const bump = (key, field) => {
      if (!byWeek.has(key)) byWeek.set(key, { week: key, opened: 0, resolved: 0 });
      byWeek.get(key)[field]++;
    };

    for (const t of allTickets) {
      if (t.CreatedAt) bump(toWeekKey(t.CreatedAt), "opened");
      const resolvedAt = getResolvedAt(t);
      if (resolvedAt) bump(toWeekKey(resolvedAt), "resolved");
    }

    return Array.from(byWeek.values()).sort((a, b) => a.week.localeCompare(b.week));
  }, [allTickets]);


  const avgResolutionTime = useMemo(() => {
    const solved = allTickets
      .map(t => ({ t, resolvedAt: getResolvedAt(t) }))
      .filter(x => x.resolvedAt);

    if (!solved.length) return 0;

    const totalDays = solved.reduce((acc, x) => {
      const end = new Date(x.resolvedAt);
      const start = new Date(x.t.CreatedAt);
      return acc + ((end - start) / 86400000);
    }, 0);

    return Number((totalDays / solved.length).toFixed(1));
  }, [allTickets]);


  return (
    <>
      <RoleNavbar />

      <div className="staffdashboard-title"><h1>Dashboard</h1></div>
      <div className="sub-title"><h2>Awaiting Tickets</h2></div>

      {/* Filters */}
      <div className="jobs-filters">
        <div className="filter-card">
          <div className="filter-item">
            <label htmlFor="staff-status">Status</label>
            <select id="staff-status" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All</option>
              <option value="New">New</option>
              <option value="In Review">In Review</option>
              <option value="Awaiting Staff Assignment">Awaiting Staff Assignment</option>
              <option value="Quoting">Quoting</option>
              <option value="Awaiting Landlord Approval">Awaiting Landlord Approval</option>
              <option value="Awaiting Appointment">Awaiting Appointment</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
          <div className="filter-item">
            <label htmlFor="staff-date">Submitted After</label>
            <input id="staff-date" type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
          </div>

          <button className="filter-reset" onClick={clearFilters} type="button">Reset</button>
        </div>
      </div>

      {/* ===== Tickets (5 visible rows; whole block scrolls) ===== */}
      <div className="jobs-section">
        {filteredTickets.length === 0 ? (
          <div className="empty-tickets">No tickets available</div>
        ) : (
          <div className="jobs-table-container">
            <div className="jobs-table-scroll"> {/* sets ~5 rows tall and scrolls */}
              <table className="jobs-table">
                <thead>
                  <tr>
                    <th>Ref #</th>
                    <th>Issue</th>
                    <th>Submitted</th>
                    <th>Urgency / Status</th>
                    <th className="actions-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((t) => {
                    const submitted = t.CreatedAt ? new Date(t.CreatedAt).toLocaleDateString() : "";
                    const statusText = mapDisplayStatus(t.CurrentStatus, t.CreatedAt);
                    return (
                      <tr key={t.TicketID}>
                        <td>{t.TicketRefNumber || t.TicketID}</td>

                        <td className="issue-cell">
                          <div className="issue-inner">
                            <div className="issue-desc">{titleOrDesc(t)}</div>
                          </div>
                        </td>

                        <td>{submitted}</td>

                        <td>
                          <div className="urgency-status">
                            <span className={`urgency ${getUrgencyClass(t.UrgencyLevel)}`}>{t.UrgencyLevel || "-"}</span>
                            <span className={`status-text ${getStatusTone(statusText)}`}>{statusText}</span>
                          </div>
                        </td>

                        <td className="actions-col">
                          <div className="action-buttons">
                            <button className="action-btn" onClick={() => handleAssignContractor(t.TicketID)}>Assign Contractor</button>
                            <button className="action-btn" onClick={() => handleOpenTicketModal(t.TicketID)}>View Details</button>
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

      {/* ===== Role Requests (new style, 5 visible rows; block scrolls) ===== */}
      <section className="staff-admin-panel">
        <h2 className="section-title">Role Requests</h2>
        <ReviewRoleRequests />
      </section>

      {/* ===== Assign Contractor Modal ===== */}
      {showContractorModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Assign Contractor</h2>
            <div className="modal-content">
              <label>Select Contractor:</label>
              <select value={chosenContractorId || ""} onChange={e => setChosenContractorId(Number(e.target.value))}>
                <option value="">-- Select --</option>
                {activeContractors.map(c => <option key={c.UserID} value={c.UserID}>{c.FullName}</option>)}
              </select>
              <div className="modal-buttons">
                <button onClick={handleConfirmAssign}>Confirm</button>
                <button onClick={() => setShowContractorModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Ticket Detail Modal (richer details) ===== */}
      {showTicketModal && selectedTicketDetails && (
        <div className="modal-overlay">
          <div className="modal modal-wide">
            <h2>Ticket {selectedTicketDetails.TicketRefNumber || selectedTicketDetails.TicketID}</h2>

            <div className="details-grid">
              <div>
                <div className="detail-row"><strong>Title:</strong> {titleOrDesc(selectedTicketDetails)}</div>
                <div className="detail-row"><strong>Description:</strong> {selectedTicketDetails.Description || "-"}</div>
                <div className="detail-row"><strong>Status:</strong> {selectedTicketDetails.CurrentStatus || "-"}</div>
                <div className="detail-row"><strong>Urgency:</strong> {selectedTicketDetails.UrgencyLevel || "-"}</div>
                <div className="detail-row"><strong>Submitted:</strong> {selectedTicketDetails.CreatedAt ? new Date(selectedTicketDetails.CreatedAt).toLocaleString() : "-"}</div>
                {selectedTicketDetails.UpdatedAt && (
                  <div className="detail-row"><strong>Updated:</strong> {new Date(selectedTicketDetails.UpdatedAt).toLocaleString()}</div>
                )}
                {selectedTicketDetails.ResolvedAt && (
                  <div className="detail-row"><strong>Resolved:</strong> {new Date(selectedTicketDetails.ResolvedAt).toLocaleString()}</div>
                )}
              </div>

              <div>
                {(() => {
                  const t = selectedTicketDetails || {};
                  const nested =
                    t.Property?.Address ||
                    [t.Property?.AddressLine1, t.Property?.AddressLine2, t.Property?.City, t.Property?.Province, t.Property?.PostalCode]
                      .filter(v => v && String(v).trim()).join(', ');
                  const flat =
                    t.PropertyAddress || t.propertyAddress ||
                    [t.AddressLine1, t.AddressLine2, t.City, t.Province, t.PostalCode]
                      .filter(v => v && String(v).trim()).join(', ');
                  const joined = (flat || nested || '').trim();
                  return (
                    <div className="detail-row">
                      <strong>Property:</strong> {joined || "-"}
                    </div>
                  );
                })()}
                {selectedTicketDetails.Client?.Name && (
                  <div className="detail-row"><strong>Client:</strong> {selectedTicketDetails.Client.Name}{selectedTicketDetails.Client.Phone ? ` • ${selectedTicketDetails.Client.Phone}` : ""}</div>
                )}
                {selectedTicketDetails.Landlord?.Name && (
                  <div className="detail-row"><strong>Landlord:</strong> {selectedTicketDetails.Landlord.Name}{selectedTicketDetails.Landlord.Phone ? ` • ${selectedTicketDetails.Landlord.Phone}` : ""}</div>
                )}
                {selectedTicketDetails.AssignedContractor?.FullName && (
                  <div className="detail-row"><strong>Assigned Contractor:</strong> {selectedTicketDetails.AssignedContractor.FullName}</div>
                )}
                {selectedTicketDetails.Schedule && (
                  <div className="detail-row">
                    <strong>Appointment:</strong>{" "}
                    {selectedTicketDetails.Schedule.ClientConfirmed ? "Confirmed" : "Pending"} -{" "}
                    {selectedTicketDetails.Schedule.ProposedDate ? new Date(selectedTicketDetails.Schedule.ProposedDate).toLocaleString() : "-"}
                  </div>
                )}
                {selectedTicketDetails.Quote && (
                  <div className="detail-row">
                    <strong>Quote:</strong> {selectedTicketDetails.Quote.Status || "-"}
                    {Number.isFinite(selectedTicketDetails.Quote.Amount) ? ` • R ${Number(selectedTicketDetails.Quote.Amount).toFixed(0)}` : ""}
                  </div>
                )}
              </div>
            </div>

            {selectedTicketDetails.Attachments?.length ? (
              <>
                <h3>Attachments</h3>
                <ul className="list-block">
                  {selectedTicketDetails.Attachments.map((f, i) => (
                    <li key={i}>
                      <a href={f.Url} target="_blank" rel="noreferrer">{f.Name || `File ${i + 1}`}</a>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            <h3>Media</h3>
            {modalLoading ? (
              <p>Loading media…</p>
            ) : !ticketMedia.length ? (
              <p className="muted">No media uploaded</p>
            ) : (
              <div className="media-gallery-grid">
                {ticketMedia.map((m, idx) => {
                  const url = m.MediaURL || '';
                  const type = (m.MediaType || '').toLowerCase();
                  const isImage = type.startsWith('image') || /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                  const isVideo = type.startsWith('video') || /\.(mp4|webm|ogg)$/i.test(url);
                  return (
                    <div key={idx} className="media-card">
                      {isImage ? (
                        <img
                          src={url}
                          alt={`Media ${idx}`}
                          onError={(e) => (e.currentTarget.src = 'https://placehold.co/150x100?text=No+Image')}
                          onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                          style={{ cursor: 'pointer' }}
                        />
                      ) : isVideo ? (
                        <video controls className="media-thumb" style={{ width: '100%', borderRadius: 8 }}>
                          <source src={url} type={type || 'video/mp4'} />
                        </video>
                      ) : (
                        <div
                          className="media-placeholder"
                          onClick={() => url && window.open(url, '_blank', 'noopener,noreferrer')}
                          style={{ cursor: url ? 'pointer' : 'default' }}
                        >
                          {url ? 'Open file' : 'No preview available'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="modal-buttons">
              {selectedTicketDetails.CurrentStatus !== "Closed" && (
                <button onClick={() => handleCloseTicket(selectedTicketDetails.TicketID)}>Close Ticket</button>
              )}
              <button onClick={() => setShowTicketModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Analytics ===== */}
      <div className="analytics-panel">
        <h2>Analytics</h2>
        <div className="charts-container">
          <div className="chart-card">
            <h3>Tickets by Status</h3>
            <PieChart width={300} height={300}>
              <Pie data={ticketsByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                {ticketsByStatus.map((entry, i) => (
                  <Cell key={i} fill={statusColors[entry.name] || "#ccc"} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </div>

          {ticketsByUrgencyData.length > 0 && (
            <div className="chart-card">
              <h3>Tickets by Urgency</h3>
              <BarChart width={400} height={300} data={ticketsByUrgencyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="urgency" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" name="Count" fill="#8884d8" />
              </BarChart>
            </div>
          )}
        </div>

        <div className="analytics-summary">
          <div className="summary-card">
            <h4>Total Open Tickets</h4>
            <p>{totalOpenTickets}</p>
          </div>
          <div className="summary-card">
            <h4>Average Resolution Time (days)</h4>
            <p>{avgResolutionTime}</p>
          </div>
        </div>

        <div className="chart-card">
          <h3>Tickets Opened vs Resolved (Weekly)</h3>
          <BarChart width={600} height={300} data={ticketsByWeekData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="opened" name="Opened" fill="#82ca9d" />
            <Bar dataKey="resolved" name="Resolved" fill="#8884d8" />
          </BarChart>
        </div>
      </div>

      <div className="page-bottom-spacer" />
    </>
  );
}

export default StaffDashboard;
