import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import gearIcon from "./assets/settings.png";
import "./styles/userdash.css";

function UserDashboard() {
  const { logout } = useAuth();

  // State
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLogout, setShowLogout] = useState(false);

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketHistory, setTicketHistory] = useState([]);
  const [ticketMedia, setTicketMedia] = useState([]);
  const [contractorResponses, setContractorResponses] = useState([]);
  const [landlordApprovals, setLandlordApprovals] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Priority order
  const priorityOrder = { High: 1, Medium: 2, Low: 3 };

  // Fetch tickets (or mock)
  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const res = await fetch("/api/client/tickets", { credentials: "include" });
        if (!res.ok) throw new Error("Fallback");
        const data = await res.json();
        setTickets(data.tickets || []);
      } catch {
        console.warn("Using mock ticket data");
        setTickets([
          { TicketID: 1, TicketRefNumber: "GL-001", Description: "Leaking kitchen tap", CreatedAt: "2025-09-15T08:00:00Z", Status: "Pending", UrgencyLevel: "Medium" },
          { TicketID: 2, TicketRefNumber: "GL-002", Description: "Broken window in bedroom", CreatedAt: "2025-09-18T09:30:00Z", Status: "Scheduled", UrgencyLevel: "High" },
          { TicketID: 3, TicketRefNumber: "GL-003", Description: "Air conditioner not cooling", CreatedAt: "2025-09-20T10:00:00Z", Status: "Closed", UrgencyLevel: "Low" },
          { TicketID: 4, TicketRefNumber: "GL-004", Description: "Power outlet sparking in living room", CreatedAt: "2025-09-22T15:00:00Z", Status: "Rejected", UrgencyLevel: "High" },
        ]);
      } finally {
        setLoading(false);
      }
    };
    fetchTickets();
  }, []);

  const handleLogout = async () => {
    await logout();
    window.location.reload();
  };

  const openTicketModal = (ticket) => {
    setSelectedTicket(ticket);
    setModalLoading(true);

    // Mock detail data
    setTimeout(() => {
      setTicketHistory([
        { Status: "Pending", UpdatedAt: "2025-09-15T08:00:00Z", UpdatedByUserID: "User" },
        { Status: "Scheduled", UpdatedAt: "2025-09-17T12:00:00Z", UpdatedByUserID: "Admin" },
        { Status: "Closed", UpdatedAt: "2025-09-18T15:00:00Z", UpdatedByUserID: "System" },
      ]);
      setTicketMedia([
        { MediaURL: "https://placehold.co/200x120?text=Tap", MediaType: "image/jpeg" },
        { MediaURL: "https://placehold.co/200x120?text=Window", MediaType: "image/jpeg" },
      ]);
      setContractorResponses([
        { contractorName: "FixIt Co.", message: "Parts ordered, will arrive tomorrow.", date: "2025-09-16T10:30:00Z" },
        { contractorName: "FixIt Co.", message: "Issue resolved successfully.", date: "2025-09-18T14:00:00Z" },
      ]);
      setLandlordApprovals([{ status: "Approved repair quote", date: "2025-09-17T11:00:00Z" }]);
      setModalLoading(false);
    }, 800);
  };

  const closeModal = () => {
    setSelectedTicket(null);
    setTicketHistory([]);
    setTicketMedia([]);
    setContractorResponses([]);
    setLandlordApprovals([]);
  };

  const handleCloseTicket = () => {
    if (!selectedTicket) return;
    if (window.confirm("Are you sure you want to close this ticket?")) {
      setTickets(prev => prev.map(t => t.TicketID === selectedTicket.TicketID ? { ...t, Status: "Closed" } : t));
      setSelectedTicket(prev => ({ ...prev, Status: "Closed" }));
    }
  };

  // Filter, search, paginate & sort tickets
  const filteredTickets = tickets.filter(ticket => {
    const matchesStatus = filterStatus ? ticket.Status === filterStatus : true;
    const matchesDate = filterDate ? ticket.CreatedAt.split("T")[0] === filterDate : true;
    const matchesSearch = searchTerm
      ? ticket.Description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.TicketRefNumber.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
    return matchesStatus && matchesDate && matchesSearch;
  });

  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTickets = filteredTickets.slice(startIndex, startIndex + itemsPerPage);
  const sortedTickets = [...paginatedTickets].sort((a, b) => priorityOrder[a.UrgencyLevel] - priorityOrder[b.UrgencyLevel]);

  return (
    <>
      <div className="dashboard-page">
        {/* Navbar */}
        <nav className="navbar">
          <div className="navbar-logo"><div className="logo-placeholder">GoodLiving</div></div>
          <div className="navbar-right">
            <ul className="navbar-menu">
              <li><Link to="/">Dashboard</Link></li>
              <li><Link to="/ticket">Tickets</Link></li>
              <li><Link to="/settings">Settings</Link></li>
            </ul>
          </div>
          <div className="navbar-profile">
            <button className="profile-btn" onClick={() => setShowLogout(!showLogout)}>
              <img src="https://placehold.co/40" alt="profile" />
            </button>
            {showLogout && (
              <div className="logout-popup">
                <button onClick={handleLogout}>Log Out</button>
              </div>
            )}
          </div>
        </nav>

        {/* Content */}
        <div className="content">
          <div className="clientdashboard-title"><h1>Dashboard</h1></div>
          <div className="sub-title"><h2>My Tickets</h2></div>

          {/* Filters + Search */}
          <div className="ticket-filters">
            <input type="text" placeholder="Search tickets..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}>
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Rejected">Rejected</option>
              <option value="Closed">Closed</option>
            </select>
            <input type="date" value={filterDate} onChange={e => { setFilterDate(e.target.value); setCurrentPage(1); }} />
          </div>

          <div className="dash-submit-container">
            <Link to="/ticket" className="dash-submit">Log a New Ticket</Link>
          </div>

          {/* Ticket List */}
          {loading ? (
            <p className="empty-tickets">Loading tickets...</p>
          ) : sortedTickets.length === 0 ? (
            <div className="empty-tickets">No tickets logged yet.</div>
          ) : (
            <div className="tickets-container">
              <div className="tickets-grid">
                {sortedTickets.map(ticket => {
                  const ticketDate = new Date(ticket.CreatedAt);
                  const isOld = ticketDate <= new Date(Date.now() - 30*24*60*60*1000);

                  return (
                    <div key={ticket.TicketID} className="ticket-card">
                      <div className="ticket-info">
                        <h3>{ticket.Description}</h3>
                        <p>Ticket Ref: {ticket.TicketRefNumber}</p>
                        <p>Logged: {ticketDate.toLocaleDateString()}</p>
                        <p>
                          Priority: <span className={`priority-badge priority-${ticket.UrgencyLevel.toLowerCase()}`}>
                            {ticket.UrgencyLevel}{isOld ? " • Old" : ""}
                          </span>
                        </p>
                        <p>Status: <span className={`status-badge status-${ticket.Status.toLowerCase()}`}>{ticket.Status}</span></p>
                        <div className="ticket-actions">
                          <button className="view-details" onClick={() => openTicketModal(ticket)}>View Details</button>
                          <img src={gearIcon} alt="settings" className="settings-icon" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="pagination-controls">
                  <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Prev</button>
                  <span>Page {currentPage} of {totalPages}</span>
                  <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Ticket Modal */}
      {selectedTicket && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close" onClick={closeModal}>×</button>
            <h2 className="modal-title">Ticket Details</h2>

            <div className="modal-section">
              <p><strong>Submitted:</strong> {new Date(selectedTicket.CreatedAt).toLocaleString()}</p>
              <p><strong>Description:</strong> {selectedTicket.Description}</p>
              <p><strong>Status:</strong> <span className={`status-badge status-${selectedTicket.Status.toLowerCase()}`}>{selectedTicket.Status}</span></p>
            </div>

            {/* Media Preview */}
            <div className="modal-section">
              <h3>Media</h3>
              {ticketMedia.length === 0 ? (
                <div className="media-placeholder">No media uploaded</div>
              ) : (
                <div className="media-gallery">
                  {ticketMedia.map((m, idx) => (
                    <div key={idx} className="media-item">
                      {m.MediaURL && (m.MediaType?.startsWith("image") || m.MediaURL.match(/\.(jpg|jpeg|png|gif)$/i)) ? (
                        <img src={m.MediaURL} alt={`Media ${idx}`} className="media-thumb" onError={(e) => e.currentTarget.src = "https://placehold.co/150x100?text=No+Image"} onClick={() => window.open(m.MediaURL, "_blank")} />
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

            {/* Combined Timeline */}
            <div className="modal-section">
              <h3>Timeline</h3>
              {modalLoading ? <p>Loading history...</p> : (
                <ul className="timeline-list">
                  {[...ticketHistory.map(h => ({ type: "status", label: h.Status, date: h.UpdatedAt, user: h.UpdatedByUserID || "System" })), ...contractorResponses.map(r => ({ type: "update", label: "Contractor Update", date: r.date, user: r.contractorName || "Contractor", message: r.message }))].sort((a, b) => new Date(a.date) - new Date(b.date)).map((entry, idx) => (
                    <li key={idx} className="timeline-entry">
                      <div className={`timeline-icon ${entry.type}`} />
                      <div className="timeline-content">
                        <strong>{entry.label}</strong>
                        <p className="timeline-meta">{new Date(entry.date).toLocaleString()} — {entry.user}</p>
                        {entry.message && <p>{entry.message}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Landlord Approvals */}
            <div className="modal-section">
              <h3>Landlord Approvals</h3>
              {landlordApprovals.length === 0 ? <p>No approvals yet.</p> : (
                <ul>{landlordApprovals.map((a, i) => <li key={i}>{a.status} - {new Date(a.date).toLocaleString()}</li>)}</ul>
              )}
            </div>

            {/* Close Ticket Button */}
            {selectedTicket.Status !== "Closed" && (
              <button className="close-ticket-btn" onClick={handleCloseTicket}>Close Ticket</button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default UserDashboard;
