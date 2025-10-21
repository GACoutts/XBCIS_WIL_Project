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
  const [showConfirm, setShowConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState("open"); // "open" or "closed"



  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Priority order
  const priorityOrder = { High: 1, Medium: 2, Low: 3 };

// Fetch tickets
  useEffect(() => {
    const fetchTickets = async () => {
      try {
        // Fetch the currently authenticated client's tickets.  The backend
        // returns an array of ticket objects with `CurrentStatus` and other
        // properties.  If you modify the API endpoint, update this path.
        const res = await fetch("/api/tickets/client/tickets", { credentials: "include" });
        const data = await res.json();
        if (res.ok) setTickets(Array.isArray(data.tickets) ? data.tickets : []);
        else console.error("Failed to fetch tickets:", data);
      } catch (err) {
        console.error("Error fetching tickets:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTickets();
  }, []);

// Logout handler
const handleLogout = async () => {
  await logout();
  window.location.reload();
};

// Open ticket modal & fetch details
const openTicketModal = async (ticket) => {
  setSelectedTicket(ticket);
  setModalLoading(true);
  setTicketHistory([]);
  setTicketMedia([]);
  setContractorResponses([]);
  setLandlordApprovals([]);

  try {
    const historyRes = await fetch(`/api/tickets/${ticket.TicketID}/history`, { credentials: "include" });
    const historyData = await historyRes.json();
    if (historyRes.ok) setTicketHistory(historyData.timeline || []);

    const mediaRes = await fetch(`/api/tickets/${ticket.TicketID}`, { credentials: "include" });
    const mediaData = await mediaRes.json();
    if (mediaRes.ok) setTicketMedia(mediaData.media || []);
  } catch (err) {
    console.error("Error fetching ticket details:", err);
  } finally {
    setModalLoading(false);
  }
};

// Close modal
const closeModal = () => {
  setSelectedTicket(null);
  setTicketHistory([]);
  setTicketMedia([]);
  setContractorResponses([]);
  setLandlordApprovals([]);
};

// Close ticket
const closeTicket = async () => {
  if (!selectedTicket) return;
  try {
    const res = await fetch(`/api/tickets/${selectedTicket.TicketID}/close`, {
      method: "POST",
      credentials: "include",
    });
    const data = await res.json();
    if (res.ok) {
      // Update the local list and modal with the new Completed status.  The UI
      // displays Completed as "Closed" via the statusLabel helper above.
      setTickets(prev =>
        prev.map(t => t.TicketID === selectedTicket.TicketID ? { ...t, CurrentStatus: "Completed" } : t)
      );
      setSelectedTicket(prev => ({ ...prev, CurrentStatus: "Completed" }));
    } else {
      console.error("Failed to close ticket", data);
    }
  } catch (err) {
    console.error(err);
  }
};


  // Filter, search, paginate & sort tickets
  // Normalize backend status values into display-friendly labels.  If you
  // introduce new statuses on the backend, update this map accordingly.
  const statusLabel = (status) => {
    switch (status) {
      case 'New':
        return 'New';
      case 'In Review':
        return 'In Review';
      case 'Quoting':
        return 'Quoting';
      case 'Awaiting Landlord Approval':
        return 'Awaiting Approval';
      case 'Awaiting Appointment':
        return 'Awaiting Appointment';
      case 'Approved':
        return 'Approved';
      case 'Scheduled':
        return 'Scheduled';
      case 'Completed':
        return 'Closed';
      default:
        return status || '';
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const dispStatus = statusLabel(ticket.CurrentStatus);
    const matchesStatus = filterStatus ? dispStatus === filterStatus : true;
    const matchesDate = filterDate ? (ticket.CreatedAt?.split('T')[0] === filterDate) : true;
    const matchesSearch = searchTerm
      ? (ticket.Description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ticket.TicketRefNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
      : true;
    return matchesStatus && matchesDate && matchesSearch;
  });
  const handleTabChange = (tab) => {
  setActiveTab(tab);
  setCurrentPage(1); // reset page whenever tab changes
};


  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTickets = filteredTickets.slice(startIndex, startIndex + itemsPerPage);
  const sortedTickets = [...paginatedTickets].sort((a, b) => priorityOrder[a.UrgencyLevel] - priorityOrder[b.UrgencyLevel]);
const displayedTickets = sortedTickets.filter(ticket => 
  activeTab === "open"
    ? statusLabel(ticket.CurrentStatus) !== "Closed"
    : statusLabel(ticket.CurrentStatus) === "Closed"
);

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

          <div className="ticket-tabs">
  <button
    className={`tab-btn ${activeTab === "open" ? "active" : ""}`}
    onClick={() => handleTabChange("open")}
  >
    Open Tickets
  </button>
  <button
    className={`tab-btn ${activeTab === "closed" ? "active" : ""}`}
    onClick={() => handleTabChange("closed")}
  >
    Closed Tickets
  </button>
</div>



         {/* Filters + Search */}
<div className="ticket-filters">
  {/* Search Input */}
  <input
    type="text"
    placeholder="Search tickets..."
    value={searchTerm}
    onChange={e => {
      setSearchTerm(e.target.value);
      setCurrentPage(1); // reset pagination
    }}
  />

  {/* Status Filter */}
  <select
    value={filterStatus}
    onChange={e => {
      setFilterStatus(e.target.value);
      setCurrentPage(1); // reset pagination
    }}
  >
    <option value="">All Statuses</option>
    {activeTab === "open" ? (
      <>
        <option value="New">New</option>
        <option value="In Review">In Review</option>
        <option value="Quoting">Quoting</option>
        <option value="Awaiting Approval">Awaiting Approval</option>
        <option value="Awaiting Appointment">Awaiting Appointment</option>
        <option value="Approved">Approved</option>
        <option value="Scheduled">Scheduled</option>
      </>
    ) : (
      <option value="Closed">Closed</option>
    )}
  </select>

  {/* Date Filter */}
  <input
    type="date"
    value={filterDate}
    onChange={e => {
      setFilterDate(e.target.value);
      setCurrentPage(1); // reset pagination
    }}
  />
</div>

{/* Log New Ticket Button */}
<div className="dash-submit-container">
  <Link to="/ticket" className="dash-submit">Log a New Ticket</Link>
</div>



      {/* Ticket List */}
{loading ? (
  <p className="empty-tickets">Loading tickets...</p>
) : displayedTickets.length === 0 ? (
  <div className="empty-tickets">
    {activeTab === "open" ? "No open tickets." : "No closed tickets."}
  </div>
) : (
  <div className="tickets-container">
    <div className="tickets-grid">
      {displayedTickets.map(ticket => {
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
              <p>
                Status: <span className={`status-badge status-${statusLabel(ticket.CurrentStatus).toLowerCase()}`}>
                  {statusLabel(ticket.CurrentStatus)}
                </span>
              </p>

              <div className="ticket-actions">
                <button className="view-details" onClick={() => openTicketModal(ticket)}>
                  View Details
                </button>

                {statusLabel(ticket.CurrentStatus) !== "Closed" && (
                  <button
                    className="close-ticket-btn"
                    onClick={() => {
                      setSelectedTicket(ticket);
                      setShowConfirm(true);
                    }}
                  >
                    Close Ticket
                  </button>
                )}

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
            <p><strong>Status:</strong> <span className={`status-badge status-${statusLabel(selectedTicket.CurrentStatus).toLowerCase()}`}>{statusLabel(selectedTicket.CurrentStatus)}</span></p>
            </div>

          {/* --- Ticket Details Modal --- */}
{selectedTicket && (
  <div className="modal-overlay">
    <div className="modal-content">
      <button className="modal-close" onClick={closeModal}>×</button>
      <h2 className="modal-title">Ticket Details</h2>

      {/* --- Media Preview --- */}
      <div className="modal-section">
        <h3>Media</h3>
        {ticketMedia.length === 0 ? (
          <p className="empty-text">No media uploaded</p>
        ) : (
          <div className="media-gallery-grid">
            {ticketMedia.map((m, idx) => (
              <div key={idx} className="media-card">
                {m.MediaURL && (m.MediaType?.startsWith("image") || m.MediaURL.match(/\.(jpg|jpeg|png|gif)$/i)) ? (
                  <img
                    src={m.MediaURL}
                    alt={`Media ${idx}`}
                    onError={(e) => e.currentTarget.src = "https://placehold.co/150x100?text=No+Image"}
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

      {/* --- Timeline --- */}
      <div className="modal-section">
        <h3>Timeline</h3>
        {modalLoading ? (
          <p>Loading history...</p>
        ) : (
          <ul className="timeline-list">
            {[...ticketHistory.map(h => ({
              type: "status",
              label: h.Status,
              date: h.UpdatedAt,
              user: h.UpdatedByUserID || "System"
            })), 
            ...contractorResponses.map(r => ({
              type: "update",
              label: "Contractor Update",
              date: r.date,
              user: r.contractorName || "Contractor",
              message: r.message
            }))]
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .map((entry, idx) => (
              <li key={idx} className="timeline-entry">
                <div className={`timeline-icon ${entry.type}`} />
                <div className="timeline-content">
                  <strong>{entry.label}</strong>
                  <p className="timeline-meta">
                    {new Date(entry.date).toLocaleString()} — {entry.user}
                  </p>
                  {entry.message && <p>{entry.message}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* --- Landlord Approvals --- */}
      <div className="modal-section">
        <h3>Landlord Approvals</h3>
        {landlordApprovals.length === 0 ? (
          <p className="empty-text">No approvals yet.</p>
        ) : (
          <ul className="updates-list">
            {landlordApprovals.map((a, i) => (
              <li key={i}>
                <strong>{a.status}</strong>
                <span className="update-date">
                  {new Date(a.date).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* --- Footer --- */}
      <div className="modal-footer">
        {statusLabel(selectedTicket.CurrentStatus) !== "Closed" && (
          <button
            className="close-ticket-btn"
            onClick={() => setShowConfirm(true)}
          >
            Close Ticket
          </button>
        )}
      </div>
    </div>
  </div>
)}

{/* --- Confirm Close Ticket Modal --- */}
{showConfirm && (
  <div className="modal-overlay">
    <div className="confirm-modal">
      <h3>Confirm Ticket Closure</h3>
      <p>Are you sure you want to close this ticket? This action cannot be undone.</p>
      <div className="confirm-buttons">
        <button className="cancel-btn" onClick={() => setShowConfirm(false)}>
          Cancel
        </button>
        <button
          className="accept-btn"
          onClick={() => {
            closeTicket();
            setShowConfirm(false);
            closeModal(); // close the modal
          }}
        >
          Confirm
        </button>
      </div>
    </div>
  </div>
)}
          </div>
        </div>
      )}  
    </>
  );
}

export default UserDashboard;
