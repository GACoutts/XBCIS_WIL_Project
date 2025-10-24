import React, { useState, useEffect, useMemo } from 'react';
import RoleNavbar from './components/RoleNavbar.jsx';
import { useAuth } from './context/AuthContext.jsx';
import './styles/staffdash.css';
import './styles/responsive-cards.css';
import './styles/userdash.css';

/*
 * StaffTickets - dashboard-style list
 * Uses the same block, filter, and table styling as StaffDashboard.
 */
export default function StaffTickets() {
  const { logout } = useAuth();

  // Ticket + filters
  const [allTickets, setAllTickets] = useState([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate] = useState('');

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

  const closeTicketModal = () => {
    setShowTicketModal(false);
    setSelectedTicketDetails(null);
    setTicketMedia([]);
    setModalLoading(false);
  };

  // ===== Helpers to match dashboard look =====
  const getUrgencyClass = (urgency) => {
    switch ((urgency || '').toLowerCase()) {
      case 'high': return 'urgency-high';
      case 'medium': return 'urgency-medium';
      case 'low': return 'urgency-low';
      case 'critical': return 'urgency-high';
      default: return '';
    }
  };

  const getStatusTone = (statusText) => {
    if (!statusText) return '';
    if (['In Review', 'Awaiting Staff Assignment', 'Quoting', 'Awaiting Landlord Approval', 'Awaiting Appointment', 'Scheduled'].includes(statusText)) {
      return 'status-awaiting';
    }
    if (statusText === 'Approved') return 'status-approved';
    if (['Completed', 'Closed'].includes(statusText)) return 'status-closed';
    if (statusText === 'Rejected') return 'status-rejected';
    return '';
  };

  const getEffectiveDate = (ticket) => {
    if (!ticket.CreatedAt) return new Date();
    const created = new Date(ticket.CreatedAt);
    const diffDays = (Date.now() - created) / 86400000;
    if (diffDays > 31) {
      const monthsOld = Math.floor(diffDays / 30);
      const bumped = new Date(created);
      bumped.setMonth(bumped.getMonth() + monthsOld);
      return bumped;
    }
    return created;
  };

  const mapDisplayStatus = (status, createdAt) => {
    if (!status) return '';
    if (status === 'New' && createdAt) {
      const diffDays = (Date.now() - new Date(createdAt)) / 86400000;
      if (diffDays > 31) return '';
      return 'New';
    }
    switch (status) {
      case 'In Review': return 'In Review';
      case 'Awaiting Staff Assignment': return 'Awaiting Staff Assignment';
      case 'Quoting': return 'Quoting';
      case 'Awaiting Landlord Approval': return 'Awaiting Landlord Approval';
      case 'Awaiting Appointment': return 'Awaiting Appointment';
      case 'Approved': return 'Approved';
      case 'Scheduled': return 'Scheduled';
      case 'Completed': return 'Closed';
      case 'Rejected': return 'Rejected';
      default: return status;
    }
  };

  const titleOrDesc = (t) => (t?.Title && t.Title.trim()) || t?.Description || '-';


  // ===== Data =====
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/tickets', { credentials: 'include' });
        const data = await res.json();
        setAllTickets(Array.isArray(data?.tickets) ? data.tickets : []);
      } catch {
        setAllTickets([]);
      }
    })();
  }, []);

  // Active vs closed
  const sortedActiveTickets = useMemo(() => {
    const list = allTickets
      .filter(t => mapDisplayStatus(t.CurrentStatus, t.CreatedAt) !== 'Closed')
      .filter(t => !filterStatus || mapDisplayStatus(t.CurrentStatus, t.CreatedAt) === filterStatus)
      .filter(t => !filterDate || new Date(t.CreatedAt) >= new Date(filterDate));

    // Bubble >30 day old to top, then by effective date desc
    return list.slice().sort((a, b) => {
      const aCreated = a?.CreatedAt ? new Date(a.CreatedAt) : null;
      const bCreated = b?.CreatedAt ? new Date(b.CreatedAt) : null;
      const aOld = aCreated ? ((Date.now() - aCreated) / 86400000 > 30) : false;
      const bOld = bCreated ? ((Date.now() - bCreated) / 86400000 > 30) : false;
      if (aOld && !bOld) return -1;
      if (!aOld && bOld) return 1;
      return getEffectiveDate(b) - getEffectiveDate(a);
    });
  }, [allTickets, filterStatus, filterDate]);

  const sortedClosedTickets = useMemo(() => {
    const list = allTickets
      .filter(t => mapDisplayStatus(t.CurrentStatus, t.CreatedAt) === 'Closed')
      .filter(t => !filterStatus || mapDisplayStatus(t.CurrentStatus, t.CreatedAt) === filterStatus)
      .filter(t => !filterDate || new Date(t.CreatedAt) >= new Date(filterDate));

    return list.slice().sort((a, b) => getEffectiveDate(b) - getEffectiveDate(a));
  }, [allTickets, filterStatus, filterDate]);

  const clearFilters = () => {
    setFilterStatus('');
    setFilterDate('');
  };

  // ===== Assign contractor flow =====
  const loadActiveContractors = async () => {
    try {
      const res = await fetch('/api/admin/contractors/active', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setActiveContractors(data.contractors || []);
    } catch { }
  };

  const handleAssignContractor = async (ticketId) => {
    setSelectedTicketId(ticketId);
    setShowContractorModal(true);
    await loadActiveContractors();
    try {
      const res = await fetch(`/api/tickets/${ticketId}/contractor`, { credentials: 'include' });
      const data = await res.json();
      setChosenContractorId(res.ok && data.contractor ? data.contractor.UserID : null);
    } catch { setChosenContractorId(null); }
  };

  const handleConfirmSchedule = async () => {
    if (!chosenContractorId) return alert('Select contractor');
    try {
      const res = await fetch(`/api/staff/tickets/${selectedTicketId}/assign`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractorUserId: chosenContractorId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to assign contractor');

      // Move to Quoting locally
      setAllTickets(prev => prev.map(t => t.TicketID === selectedTicketId ? { ...t, CurrentStatus: 'Quoting' } : t));
      setShowContractorModal(false);
      setChosenContractorId(null);
      setSelectedTicketId(null);
      alert('Contractor assigned successfully!');
    } catch (e) {
      alert(e.message || 'Failed to assign contractor');
    }
  };

  // ===== Ticket details modal =====
  const handleOpenTicketModal = async (ticketId) => {
    try {
      setModalLoading(true);
      setTicketMedia([]);
      const res = await fetch(`/api/tickets/${ticketId}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        const row = allTickets.find(t => t.TicketID === ticketId);
        const merged = { ...data.ticket };
        if (!merged.PropertyAddress && row?.PropertyAddress) merged.PropertyAddress = row.PropertyAddress;
        if (!merged.propertyAddress && row?.PropertyAddress) merged.propertyAddress = row.PropertyAddress;
        setSelectedTicketDetails(merged);
        setShowTicketModal(true);
      }

      try {
        const r2 = await fetch(`/api/staff/tickets/${ticketId}/media`, { credentials: 'include' });
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
      const res = await fetch(`/api/tickets/${ticketId}/close`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to close ticket');
      setAllTickets(prev => prev.map(t => t.TicketID === ticketId ? { ...t, CurrentStatus: 'Completed' } : t));
      setShowTicketModal(false);
      alert('Ticket closed!');
    } catch (e) {
      alert(e.message || 'Failed to close ticket');
    }
  };

  return (
    <>
      <RoleNavbar />

      <div className="staffdashboard-title"><h1>Tickets</h1></div>
      <div className="sub-title"><h2>Awaiting Tickets</h2></div>

      {/* Filters (same as dashboard) */}
      <div className="jobs-filters">
        <div className="filter-card">
          <div className="filter-item">
            <label htmlFor="tickets-status">Status</label>
            <select id="tickets-status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
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
            <label htmlFor="tickets-date">Submitted After</label>
            <input id="tickets-date" type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
          </div>
          <button className="filter-reset" type="button" onClick={clearFilters}>Reset</button>
        </div>
      </div>

      {/* ===== Active tickets block (dashboard-style table) ===== */}
      <div className="jobs-section">
        {sortedActiveTickets.length === 0 ? (
          <div className="empty-tickets">No tickets available</div>
        ) : (
          <div className="jobs-table-container">
            <div className="jobs-table-scroll">
              <table className="jobs-table">
                <thead>
                  <tr>
                    <th>Ref #</th>
                    <th>Property</th>
                    <th>Issue</th>
                    <th>Submitted</th>
                    <th>Urgency / Status</th>
                    <th className="actions-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedActiveTickets.map((t) => {
                    const submitted = t.CreatedAt ? new Date(t.CreatedAt).toLocaleDateString() : '';
                    const statusText = mapDisplayStatus(t.CurrentStatus, t.CreatedAt);
                    return (
                      <tr key={t.TicketID}>
                        <td>{t.TicketRefNumber || t.TicketID}</td>
                        <td>{t.PropertyAddress || '-'}</td>
                        <td className="issue-cell">
                          <div className="issue-inner">
                            <div className="issue-desc">{titleOrDesc(t)}</div>
                          </div>
                        </td>
                        <td>{submitted}</td>
                        <td>
                          <div className="urgency-status">
                            <span className={`urgency ${getUrgencyClass(t.UrgencyLevel)}`}>{t.UrgencyLevel || '-'}</span>
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

      {/* ===== Ticket History (same block style, no assign btn) ===== */}
      <div className="sub-title"><h2>Ticket History</h2></div>
      <div className="jobs-section">
        {sortedClosedTickets.length === 0 ? (
          <div className="empty-tickets">No historical tickets</div>
        ) : (
          <div className="jobs-table-container">
            <div className="jobs-table-scroll">
              <table className="jobs-table">
                <thead>
                  <tr>
                    <th>Ref #</th>
                    <th>Property</th>
                    <th>Issue</th>
                    <th>Submitted</th>
                    <th>Urgency / Status</th>
                    <th className="actions-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedClosedTickets.map((t) => {
                    const submitted = t.CreatedAt ? new Date(t.CreatedAt).toLocaleDateString() : '';
                    const statusText = mapDisplayStatus(t.CurrentStatus, t.CreatedAt);
                    return (
                      <tr key={t.TicketID}>
                        <td>{t.TicketRefNumber || t.TicketID}</td>
                        <td>{t.PropertyAddress || '-'}</td>
                        <td className="issue-cell">
                          <div className="issue-inner">
                            <div className="issue-desc">{titleOrDesc(t)}</div>
                          </div>
                        </td>
                        <td>{submitted}</td>
                        <td>
                          <div className="urgency-status">
                            <span className={`urgency ${getUrgencyClass(t.UrgencyLevel)}`}>{t.UrgencyLevel || '-'}</span>
                            <span className={`status-text ${getStatusTone(statusText)}`}>{statusText}</span>
                          </div>
                        </td>
                        <td className="actions-col">
                          <div className="action-buttons">
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

      {/* ===== Assign Contractor Modal ===== */}
      {showContractorModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Assign Contractor</h2>
            <div className="modal-content">
              <label>Select Contractor:</label>
              <select value={chosenContractorId || ''} onChange={(e) => setChosenContractorId(Number(e.target.value))}>
                <option value="">-- Select --</option>
                {activeContractors.map((c) => (
                  <option key={c.UserID} value={c.UserID}>{c.FullName}</option>
                ))}
              </select>
              <div className="modal-buttons">
                <button onClick={handleConfirmSchedule}>Confirm</button>
                <button onClick={() => setShowContractorModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Ticket Detail Modal ===== */}
      {showTicketModal && selectedTicketDetails && (
        <div className="modal-overlay" onClick={closeTicketModal}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            {/* HEADER */}
            <div className="modal-header">
              <h2 className="modal-title">Ticket Details</h2>
              <button
                type="button"
                className="modal-close-icon"
                aria-label="Close ticket details"
                onClick={closeTicketModal}
              >
                ✕
              </button>
            </div>

            {/* DETAILS */}
            <div className="modal-section">
              <p>
                <strong>Ref / ID:</strong>{" "}
                {selectedTicketDetails.TicketRefNumber || selectedTicketDetails.TicketID}
              </p>
              <p>
                <strong>Property:</strong>{" "}
                {(() => {
                  const t = selectedTicketDetails || {};
                  const nested =
                    t.Property?.Address ||
                    [t.Property?.AddressLine1, t.Property?.AddressLine2, t.Property?.City, t.Property?.Province, t.Property?.PostalCode]
                      .filter(v => v && String(v).trim())
                      .join(", ");
                  const flat =
                    t.PropertyAddress || t.propertyAddress ||
                    [t.AddressLine1, t.AddressLine2, t.City, t.Province, t.PostalCode]
                      .filter(v => v && String(v).trim())
                      .join(", ");
                  const joined = (flat || nested || "").trim();
                  return joined || "-";
                })()}
              </p>
              <p>
                <strong>Submitted:</strong>{" "}
                {selectedTicketDetails.CreatedAt
                  ? new Date(selectedTicketDetails.CreatedAt).toLocaleString()
                  : "-"}
              </p>
              <p>
                <strong>Status:</strong>{" "}
                <span className="status-text">
                  {mapDisplayStatus(selectedTicketDetails.CurrentStatus, selectedTicketDetails.CreatedAt) || "-"}
                </span>
              </p>
              <p>
                <strong>Urgency:</strong> {selectedTicketDetails.UrgencyLevel || "-"}
              </p>
              <div style={{ marginTop: 8 }}>
                <strong>Issue Description:</strong>
                <div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>
                  {selectedTicketDetails.Description || "-"}
                </div>
              </div>
            </div>

            {/* QUOTE (optional) */}
            {selectedTicketDetails.Quote && (
              <div className="modal-section">
                <h3 style={{ marginTop: 0 }}>Latest Quote</h3>
                <div>
                  {selectedTicketDetails.Quote.Status || "-"} -{" "}
                  {(() => {
                    const amt = Number(selectedTicketDetails.Quote?.Amount);
                    return Number.isFinite(amt) ? `R ${amt.toFixed(0)}` : "R 0";
                  })()}
                </div>
              </div>
            )}

            {/* CONTRACTOR RESPONSES */}
            <h3>Contractor Responses</h3>
            {selectedTicketDetails.ContractorResponses?.length ? (
              <ul className="list-block">
                {selectedTicketDetails.ContractorResponses.map(r => (
                  <li key={r.ResponseID}>
                    {r.Message}
                    {r.Date ? ` - ${new Date(r.Date).toLocaleString()}` : ""}
                  </li>
                ))}
              </ul>
            ) : selectedTicketDetails.Quote ? (
              <ul className="list-block">
                <li>
                  Contractor Uploaded Quote
                  {selectedTicketDetails.Quote.CreatedAt ||
                    selectedTicketDetails.Quote.Date ||
                    selectedTicketDetails.Quote.UpdatedAt
                    ? ` - ${new Date(
                      selectedTicketDetails.Quote.CreatedAt ||
                      selectedTicketDetails.Quote.Date ||
                      selectedTicketDetails.Quote.UpdatedAt
                    ).toLocaleString()}`
                    : ""}
                </li>
              </ul>
            ) : (
              <p className="muted">No responses yet</p>
            )}

            {/* LANDLORD APPROVALS */}
            <h3>Landlord Approvals</h3>
            {(() => {
              const rows = [];

              // Ticket-level approvals (array)
              if (Array.isArray(selectedTicketDetails.LandlordApprovals) && selectedTicketDetails.LandlordApprovals.length) {
                selectedTicketDetails.LandlordApprovals.forEach(a => {
                  const label = a.Approved ? "Landlord Approved Ticket" : "Landlord Rejected Ticket";
                  rows.push(`${label}${a.Date ? ` - ${new Date(a.Date).toLocaleString()}` : ""}`);
                });
              }

              // Quote approval/rejection (single object with Status)
              if (selectedTicketDetails.Quote?.Status === "Approved") {
                const ts = selectedTicketDetails.Quote.ApprovedAt || selectedTicketDetails.Quote.UpdatedAt || selectedTicketDetails.Quote.Date;
                rows.push(`Landlord Approved Quote${ts ? ` - ${new Date(ts).toLocaleString()}` : ""}`);
              }
              if (selectedTicketDetails.Quote?.Status === "Rejected") {
                const ts = selectedTicketDetails.Quote.RejectedAt || selectedTicketDetails.Quote.UpdatedAt || selectedTicketDetails.Quote.Date;
                rows.push(`Landlord Rejected Quote${ts ? ` - ${new Date(ts).toLocaleString()}` : ""}`);
              }

              return rows.length ? (
                <ul className="list-block">
                  {rows.map((text, i) => <li key={i}>{text}</li>)}
                </ul>
              ) : (
                <p className="muted">No approvals yet</p>
              );
            })()}

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
                    const isImage = type.startsWith("image") || /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                    const isVideo = type.startsWith("video") || /\.(mp4|webm|ogg)$/i.test(url);
                    return (
                      <div key={idx} className="media-card">
                        {isImage ? (
                          <img
                            src={url}
                            alt={`Media ${idx}`}
                            onError={(e) => (e.currentTarget.src = "https://placehold.co/150x100?text=No+Image")}
                            onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
                            style={{ cursor: "pointer" }}
                          />
                        ) : isVideo ? (
                          <video controls className="media-thumb" style={{ width: "100%", borderRadius: 8 }}>
                            <source src={url} type={type || "video/mp4"} />
                          </video>
                        ) : (
                          <div
                            className="media-placeholder"
                            onClick={() => url && window.open(url, "_blank", "noopener,noreferrer")}
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
              {selectedTicketDetails.CurrentStatus !== "Closed" && (
                <button
                  onClick={() => handleCloseTicket(selectedTicketDetails.TicketID)}
                  className="action-btn"
                  type="button"
                >
                  Close Ticket
                </button>
              )}
              <button onClick={closeTicketModal} className="action-btn" type="button">
                Close
              </button>
            </div>
          </div>
        </div>
      )}


      <div className="page-bottom-spacer"></div>
    </>
  );
}