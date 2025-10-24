import { useEffect, useState } from "react";
import { useAuth } from "./context/AuthContext.jsx";
import WhatsAppStarter from "./components/WhatsAppStarter.jsx";
import RoleNavbar from "./components/RoleNavbar.jsx";
import "./styles/userdash.css";

function UserDashboard() {
  const { user } = useAuth();

  // State
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketHistory, setTicketHistory] = useState([]);
  const [ticketMedia, setTicketMedia] = useState([]);
  const [contractorResponses, setContractorResponses] = useState([]);
  const [landlordApprovals, setLandlordApprovals] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState("open"); // "open" | "closed"

  // Appointment & contractor state
  const [approvedContractor, setApprovedContractor] = useState(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [booking, setBooking] = useState(false);

  // Latest schedule snapshot
  const [proposedSchedule, setProposedSchedule] = useState(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Priority order (for sorting)
  const priorityOrder = { High: 1, Medium: 2, Low: 3 };

  // Fetch tickets
  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const res = await fetch("/api/tickets/client/tickets", {
          credentials: "include",
        });
        const data = await res.json();
        setTickets(Array.isArray(data?.tickets) ? data.tickets : []);
      } catch (err) {
        console.error("Error fetching tickets:", err);
        setTickets([]);
      } finally {
        setLoading(false);
      }
    };
    fetchTickets();
  }, []);

  // Helpers
  const statusLabel = (status) => {
    switch (status) {
      case "New":
        return "New";
      case "In Review":
        return "In Review";
      case "Quoting":
        return "Quoting";
      case "Awaiting Landlord Approval":
        return "Awaiting Approval";
      case "Awaiting Appointment":
        return "Awaiting Appointment";
      case "Approved":
        return "Approved";
      case "Scheduled":
        return "Scheduled";
      case "Completed":
        return "Closed";
      default:
        return status || "";
    }
  };

  const toLocalInputValue = (iso) => {
    if (!iso) return "";
    const dt = new Date(iso);
    const tz = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000);
    return tz.toISOString().slice(0, 16);
  };

  const fetchLatestSchedule = async (ticketId) => {
    try {
      setLoadingSchedule(true);
      const res = await fetch(`/api/tickets/${ticketId}/schedule`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setProposedSchedule(data?.data || null);
        if (data?.data && !data.data.ClientConfirmed && data.data.ProposedDate) {
          setScheduleDate(toLocalInputValue(data.data.ProposedDate));
        }
      } else {
        setProposedSchedule(null);
      }
    } catch (err) {
      console.warn("Failed to fetch schedule:", err);
      setProposedSchedule(null);
    } finally {
      setLoadingSchedule(false);
    }
  };

  // Open ticket modal & fetch details
  const openTicketModal = async (ticket) => {
    setSelectedTicket(ticket);
    setModalLoading(true);
    setTicketHistory([]);
    setTicketMedia([]);
    setContractorResponses([]);
    setLandlordApprovals([]);
    setApprovedContractor(null);
    setScheduleDate("");
    setShowScheduleForm(false);
    setProposedSchedule(null);

    try {
      const historyRes = await fetch(`/api/tickets/${ticket.TicketID}/history`, {
        credentials: "include",
      });
      const historyData = await historyRes.json();
      if (historyRes.ok) setTicketHistory(historyData.timeline || []);

      const mediaRes = await fetch(`/api/tickets/${ticket.TicketID}`, {
        credentials: "include",
      });
      const mediaData = await mediaRes.json();
      if (mediaRes.ok) setTicketMedia(mediaData.media || []);

      try {
        const contractorRes = await fetch(
          `/api/tickets/${ticket.TicketID}/approved-contractor`,
          { credentials: "include" }
        );
        const contractorData = await contractorRes.json();
        if (contractorRes.ok && contractorData.contractor) {
          setApprovedContractor(contractorData.contractor);
        } else {
          setApprovedContractor(null);
        }
      } catch (err) {
        console.error("Error fetching approved contractor:", err);
        setApprovedContractor(null);
      }

      await fetchLatestSchedule(ticket.TicketID);
    } catch (err) {
      console.error("Error fetching ticket details:", err);
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedTicket(null);
    setTicketHistory([]);
    setTicketMedia([]);
    setContractorResponses([]);
    setLandlordApprovals([]);
    setApprovedContractor(null);
    setScheduleDate("");
    setShowScheduleForm(false);
    setProposedSchedule(null);
  };

  const closeTicket = async () => {
    if (!selectedTicket) return;
    try {
      const res = await fetch(`/api/tickets/${selectedTicket.TicketID}/close`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setTickets((prev) =>
          prev.map((t) =>
            t.TicketID === selectedTicket.TicketID
              ? { ...t, CurrentStatus: "Completed" }
              : t
          )
        );
        setSelectedTicket((prev) =>
          prev ? { ...prev, CurrentStatus: "Completed" } : prev
        );
      } else {
        console.error("Failed to close ticket", data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filters, search, paging
  const filteredTickets = tickets.filter((ticket) => {
    const dispStatus = statusLabel(ticket.CurrentStatus);
    const matchesStatus = filterStatus ? dispStatus === filterStatus : true;
    const matchesDate = filterDate
      ? ticket.CreatedAt?.split("T")[0] === filterDate
      : true;
    const matchesSearch = searchTerm
      ? (ticket.Title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ticket.Description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ticket.TicketRefNumber || "").toLowerCase().includes(searchTerm.toLowerCase())
      : true;
    return matchesStatus && matchesDate && matchesSearch;
  });

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setFilterStatus(tab === "closed" ? "Closed" : "");
  };

  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTickets = filteredTickets.slice(
    startIndex,
    startIndex + itemsPerPage
  );
  const sortedTickets = [...paginatedTickets].sort(
    (a, b) => (priorityOrder[a.UrgencyLevel] || 99) - (priorityOrder[b.UrgencyLevel] || 99)
  );
  const displayedTickets = sortedTickets.filter((ticket) =>
    activeTab === "open"
      ? statusLabel(ticket.CurrentStatus) !== "Closed"
      : statusLabel(ticket.CurrentStatus) === "Closed"
  );

  const clearFilters = () => {
    setSearchTerm("");
    setFilterStatus(activeTab === "closed" ? "Closed" : "");
    setFilterDate("");
  };

  return (
    <>
      <div className="dashboard-page">
        <RoleNavbar />

        <div className="content">
          <div className="clientdashboard-title">
            <h1>Dashboard</h1>
          </div>
          <div className="sub-title">
            <h2>My Tickets</h2>
          </div>

          {/* Filter row */}
          <div className="jobs-filters">
            <div className="filter-card">
              <div className="filter-item" style={{ minWidth: 260 }}>
                <label htmlFor="tenant-search">Search</label>
                <input
                  id="tenant-search"
                  type="text"
                  placeholder="Search by ref or issue…"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              <div className="filter-item">
                <label htmlFor="tenant-status">Status</label>
                <select
                  id="tenant-status"
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="">All Statuses</option>
                  {activeTab === "open" ? (
                    <>
                      <option value="New">New</option>
                      <option value="In Review">In Review</option>
                      <option value="Quoting">Quoting</option>
                      <option value="Awaiting Approval">Awaiting Approval</option>
                      <option value="Awaiting Appointment">
                        Awaiting Appointment
                      </option>
                      <option value="Approved">Approved</option>
                      <option value="Scheduled">Scheduled</option>
                    </>
                  ) : (
                    <option value="Closed">Closed</option>
                  )}
                </select>
              </div>

              <div className="filter-item">
                <label htmlFor="tenant-date">Date</label>
                <input
                  id="tenant-date"
                  type="date"
                  value={filterDate}
                  onChange={(e) => {
                    setFilterDate(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              <div className="filter-item" style={{ marginLeft: "auto" }}>
                <label>&nbsp;</label>
                <div className="tab-chip-row">
                  <button
                    className={`tab-chip ${activeTab === "open" ? "active" : ""}`}
                    onClick={() => handleTabChange("open")}
                    type="button"
                  >
                    Open Tickets
                  </button>
                  <button
                    className={`tab-chip ${activeTab === "closed" ? "active" : ""}`}
                    onClick={() => handleTabChange("closed")}
                    type="button"
                  >
                    Closed Tickets
                  </button>
                </div>
              </div>

              <button
                className="filter-reset"
                onClick={clearFilters}
                title="Reset filters"
                type="button"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Ticket list */}
          <div className="jobs-section">
            {loading ? (
              <p className="empty-tickets">Loading tickets...</p>
            ) : displayedTickets.length === 0 ? (
              <div className="empty-tickets">
                {activeTab === "open" ? "No open tickets." : "No closed tickets."}
              </div>
            ) : (
              <div className="jobs-table-container">
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
                    {displayedTickets.map((ticket) => {
                      const submitted = ticket.CreatedAt
                        ? new Date(ticket.CreatedAt).toLocaleDateString()
                        : "";
                      const isClosed =
                        statusLabel(ticket.CurrentStatus) === "Closed";
                      const urgencyClass =
                        {
                          High: "urgency-high",
                          Medium: "urgency-medium",
                          Low: "urgency-low",
                        }[ticket.UrgencyLevel] || "";

                      return (
                        <tr key={ticket.TicketID}>
                          <td>{ticket.TicketRefNumber || ticket.TicketID}</td>

                          <td className="issue-cell">
                            <div className="issue-inner">
                              <div className="issue-desc">
                                {ticket.Title?.trim() || ticket.Description || "-"}
                              </div>
                              {ticket.ScheduledAt ? (
                                <div
                                  style={{
                                    fontSize: 12,
                                    color: "#555",
                                    marginTop: 4,
                                  }}
                                >
                                  Scheduled:{" "}
                                  {new Date(
                                    ticket.ScheduledAt
                                  ).toLocaleString()}
                                </div>
                              ) : null}
                            </div>
                          </td>

                          <td>{submitted}</td>

                          <td>
                            <div className="urgency-status">
                              <span className={`urgency ${urgencyClass}`}>
                                {ticket.UrgencyLevel || "-"}
                              </span>
                              <span className="status-text">
                                {statusLabel(ticket.CurrentStatus)}
                              </span>
                            </div>
                          </td>

                          <td className="actions-col">
                            <div className="action-buttons">
                              <button
                                className="action-btn"
                                onClick={() => openTicketModal(ticket)}
                                type="button"
                              >
                                View Details
                              </button>
                              {!isClosed && (
                                <button
                                  className="action-btn"
                                  onClick={() => {
                                    setSelectedTicket(ticket);
                                    setShowConfirm(true);
                                  }}
                                  type="button"
                                >
                                  Close Ticket
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {totalPages > 1 && (
              <div className="pagination-controls">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  type="button"
                >
                  Prev
                </button>
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  type="button"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ticket Modal */}
      {selectedTicket && (
        <div className="modal-overlay">
          <div className="modal-content">
            {/* HEADER */}
            <div className="modal-header">
              <h2 className="modal-title">Ticket Details</h2>
              <button
                type="button"
                className="modal-close-icon"
                aria-label="Close ticket details"
                onClick={closeModal}
              >
                ✕
              </button>
            </div>

            {/* DETAILS */}
            <div className="modal-section">
              <p>
                <strong>Submitted:</strong>{" "}
                {new Date(selectedTicket.CreatedAt).toLocaleString()}
              </p>
              <p>
                <strong>Description:</strong> {selectedTicket.Description}
              </p>
              <p>
                <strong>Status:</strong>{" "}
                <span
                  className={`status-badge status-${statusLabel(
                    selectedTicket.CurrentStatus
                  ).toLowerCase()}`}
                >
                  {statusLabel(selectedTicket.CurrentStatus)}
                </span>
              </p>
            </div>

            {/* Media */}
            <div className="modal-section">
              <h3>Media</h3>
              {ticketMedia.length === 0 ? (
                <p className="empty-text">No media uploaded</p>
              ) : (
                <div className="media-gallery-grid">
                  {ticketMedia.map((m, idx) => (
                    <div key={idx} className="media-card">
                      {m.MediaURL &&
                      (m.MediaType?.startsWith("image") ||
                        /\.(jpg|jpeg|png|gif)$/i.test(m.MediaURL)) ? (
                        <img
                          src={m.MediaURL}
                          alt={`Media ${idx}`}
                          onError={(e) =>
                            (e.currentTarget.src =
                              "https://placehold.co/150x100?text=No+Image")
                          }
                          onClick={() => window.open(m.MediaURL, "_blank")}
                        />
                      ) : m.MediaURL && m.MediaType?.startsWith("video") ? (
                        <video controls className="media-thumb">
                          <source src={m.MediaURL} type={m.MediaType} />
                        </video>
                      ) : (
                        <div className="media-placeholder">No preview available</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Appointment summary */}
            {proposedSchedule && (
              <div className="modal-section">
                <h3>Appointment</h3>
                <div className="appointment-summary">
                  {(() => {
                    const clientOk = !!proposedSchedule.ClientConfirmed;
                    const contractorOk = !!proposedSchedule.ContractorConfirmed;
                    const bothOk = clientOk && contractorOk;
                    const waitingOn = !clientOk && !contractorOk
                      ? "client & contractor"
                      : !clientOk
                        ? "client"
                        : !contractorOk
                          ? "contractor"
                          : null;
                    return (
                      <div className={`appointment-chip ${bothOk ? "confirmed" : "pending"}`}>
                        {bothOk ? "Confirmed" : `Pending${waitingOn ? ` (awaiting ${waitingOn})` : ""}`}
                      </div>
                    );
                  })()}
                  <div className="appointment-time">
                    {new Date(proposedSchedule.ProposedDate).toLocaleString()}
                  </div>
                  {proposedSchedule.Notes ? (
                    <div className="appointment-notes">
                      Notes: {proposedSchedule.Notes}
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="modal-section">
              <h3>Timeline</h3>
              {modalLoading ? (
                <p>Loading history...</p>
              ) : (
                <ul className="timeline-list">
                  {[
                    ...ticketHistory.map((h) => ({
                      type: "status",
                      label: h.Status,
                      date: h.UpdatedAt,
                      user: h.UpdatedByUserID || "System",
                    })),
                    ...contractorResponses.map((r) => ({
                      type: "update",
                      label: "Contractor Update",
                      date: r.date,
                      user: r.contractorName || "Contractor",
                      message: r.message,
                    })),
                  ]
                    .sort((a, b) => new Date(a.date) - new Date(b.date))
                    .map((entry, idx) => (
                      <li key={idx} className="timeline-entry">
                        <div className={`timeline-icon ${entry.type}`} />
                        <div className="timeline-content">
                          <strong>{entry.label}</strong>
                          <p className="timeline-meta">
                            {new Date(entry.date).toLocaleString()} - {entry.user}
                          </p>
                          {entry.message && <p>{entry.message}</p>}
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </div>

            {/* Footer - split buttons */}
            <div className="modal-footer split">
              <div className="left-side">
                {statusLabel(selectedTicket.CurrentStatus) !== "Closed" && (
                  <button
                    type="button"
                    className="close-ticket-btn"
                    onClick={() => setShowConfirm(true)}
                  >
                    Close Ticket
                  </button>
                )}
              </div>

              <div className="right-side">
                {(selectedTicket.CurrentStatus === "Approved" ||
                  selectedTicket.CurrentStatus === "Awaiting Appointment") &&
                  approvedContractor && (
                    <div className="appointment-actions">
                      {loadingSchedule ? (
                        <div style={{ fontSize: 14, opacity: 0.8 }}>
                          Checking appointment proposal…
                        </div>
                      ) : proposedSchedule && !proposedSchedule.ClientConfirmed ? (
                        <>
                          <div style={{ fontSize: 14 }}>
                            Contractor proposed:{" "}
                            <strong>
                              {new Date(
                                proposedSchedule.ProposedDate
                              ).toLocaleString()}
                            </strong>
                            {proposedSchedule.Notes ? (
                              <> - {proposedSchedule.Notes}</>
                            ) : null}
                          </div>

                          <div className="schedule-form">
                            <button
                              type="button"
                              className="schedule-submit-btn"
                              disabled={booking}
                              onClick={async () => {
                                try {
                                  setBooking(true);
                                  const res = await fetch(
                                    `/api/tickets/${selectedTicket.TicketID}/appointments/confirm`,
                                    {
                                      method: "POST",
                                      credentials: "include",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        scheduleId: proposedSchedule.ScheduleID,
                                      }),
                                    }
                                  );
                                  const data = await res.json();
                                  if (!res.ok) throw new Error(data?.message || "Failed to confirm appointment");
                                  const bothConfirmed = !!data?.data?.bothConfirmed;
                                  setTickets((prev) =>
                                    prev.map((t) =>
                                      t.TicketID === selectedTicket.TicketID
                                        ? { ...t, CurrentStatus: bothConfirmed ? "Scheduled" : "Awaiting Appointment" }
                                        : t
                                    )
                                  );
                                  setSelectedTicket((prev) =>
                                    prev
                                      ? { ...prev, CurrentStatus: bothConfirmed ? "Scheduled" : "Awaiting Appointment" }
                                      : prev
                                  );
                                  setProposedSchedule(prev =>
                                    prev ? { ...prev, ClientConfirmed: true } : prev
                                  );
                                  await fetchLatestSchedule(selectedTicket.TicketID);
                                  alert("Appointment confirmed");
                                } catch (err) {
                                  console.error(err);
                                  alert(
                                    err.message || "Failed to confirm appointment"
                                  );
                                } finally {
                                  setBooking(false);
                                }
                              }}
                            >
                              Accept
                            </button>

                            <div
                              style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}
                            >
                              or
                            </div>

                            {showScheduleForm ? (
                              <>
                                <input
                                  type="datetime-local"
                                  className="schedule-input"
                                  value={scheduleDate}
                                  onChange={(e) => setScheduleDate(e.target.value)}
                                  min={new Date().toISOString().slice(0, 16)}
                                />
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button
                                    type="button"
                                    className="schedule-submit-btn"
                                    disabled={!scheduleDate || booking}
                                    onClick={async () => {
                                      if (!scheduleDate) return;
                                      try {
                                        setBooking(true);
                                        const proposedDate = new Date(scheduleDate);
                                        if (!scheduleDate.includes("T"))
                                          proposedDate.setHours(12, 0, 0, 0);
                                        const res = await fetch(
                                          `/api/tickets/${selectedTicket.TicketID}/appointments`,
                                          {
                                            method: "POST",
                                            credentials: "include",
                                            headers: {
                                              "Content-Type": "application/json",
                                            },
                                            body: JSON.stringify({
                                              scheduledAt: proposedDate.toISOString(),
                                            }),
                                          }
                                        );
                                        const data = await res.json();
                                        if (!res.ok)
                                          throw new Error(
                                            data?.message ||
                                              "Failed to propose appointment"
                                          );
                                        await fetchLatestSchedule(
                                          selectedTicket.TicketID
                                        );
                                        setShowScheduleForm(false);
                                        setScheduleDate("");
                                        alert("New time sent to contractor");
                                      } catch (err) {
                                        console.error(err);
                                        alert(
                                          err.message ||
                                            "Failed to propose appointment"
                                        );
                                      } finally {
                                        setBooking(false);
                                      }
                                    }}
                                  >
                                    Send new time
                                  </button>
                                  <button
                                    type="button"
                                    className="schedule-cancel-btn"
                                    onClick={() => {
                                      setShowScheduleForm(false);
                                      setScheduleDate("");
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="book-appointment-btn"
                                onClick={() => {
                                  setShowScheduleForm(true);
                                  if (proposedSchedule?.ProposedDate) {
                                    setScheduleDate(
                                      toLocalInputValue(proposedSchedule.ProposedDate)
                                    );
                                  }
                                }}
                              >
                                Suggest a different time
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          {showScheduleForm ? (
                            <div className="schedule-form">
                              <input
                                type="datetime-local"
                                className="schedule-input"
                                value={scheduleDate}
                                onChange={(e) => setScheduleDate(e.target.value)}
                                min={new Date().toISOString().slice(0, 16)}
                              />
                              <div style={{ display: "flex", gap: 8 }}>
                                <button
                                  type="button"
                                  className="schedule-submit-btn"
                                  disabled={!scheduleDate || booking}
                                  onClick={async () => {
                                    if (!scheduleDate) return;
                                    try {
                                      setBooking(true);
                                      const proposedDate = new Date(scheduleDate);
                                      if (!scheduleDate.includes("T"))
                                        proposedDate.setHours(12, 0, 0, 0);
                                      const res = await fetch(
                                        `/api/tickets/${selectedTicket.TicketID}/appointments`,
                                        {
                                          method: "POST",
                                          credentials: "include",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({
                                            scheduledAt: proposedDate.toISOString(),
                                          }),
                                        }
                                      );
                                      const data = await res.json();
                                      if (!res.ok)
                                        throw new Error(
                                          data?.message || "Failed to book appointment"
                                        );
                                      await fetchLatestSchedule(
                                        selectedTicket.TicketID
                                      );
                                      setShowScheduleForm(false);
                                      setScheduleDate("");
                                      alert("Appointment proposed successfully");
                                    } catch (err) {
                                      console.error(err);
                                      alert(err.message || "Failed to book appointment");
                                    } finally {
                                      setBooking(false);
                                    }
                                  }}
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  className="schedule-cancel-btn"
                                  onClick={() => {
                                    setShowScheduleForm(false);
                                    setScheduleDate("");
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="book-appointment-btn"
                              onClick={() => setShowScheduleForm(true)}
                            >
                              Book Appointment
                            </button>
                          )}
                        </>
                      )}

                      <WhatsAppStarter
                        context={{
                          ticketRef: selectedTicket.TicketRefNumber,
                          tenantName: user?.fullName || "",
                        }}
                        contacts={{ contractor: approvedContractor }}
                        className="whatsapp-btn"
                      />
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Close Ticket Modal */}
      {showConfirm && (
        <div className="modal-overlay">
          <div className="confirm-modal">
            <h3>Confirm Ticket Closure</h3>
            <p>
              Are you sure you want to close this ticket? This action cannot be
              undone.
            </p>
            <div className="confirm-buttons">
              <button
                className="cancel-btn"
                onClick={() => setShowConfirm(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="accept-btn"
                onClick={() => {
                  closeTicket();
                  setShowConfirm(false);
                  closeModal();
                }}
                type="button"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default UserDashboard;
