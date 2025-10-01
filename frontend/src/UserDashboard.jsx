import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import gearIcon from "./assets/settings.png";
import "./styles/userdash.css";

function UserDashboard() {
  const { logout } = useAuth();

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

  // Fetch tickets
  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const res = await fetch("/api/client/tickets", { credentials: "include" });
        const data = await res.json();
        if (res.ok) setTickets(data.tickets || []);
        else console.error("Failed to fetch tickets:", data);
      } catch (err) {
        console.error("Error fetching tickets:", err);
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

  // Open ticket modal & fetch details
  const openTicketModal = async (ticket) => {
    setSelectedTicket(ticket);
    setModalLoading(true);
    setTicketHistory([]);
    setTicketMedia([]);
    setContractorResponses([]);
    setLandlordApprovals([]);

    try {
      // Fetch ticket history
      const historyRes = await fetch(`/api/tickets/${ticket.TicketID}/history`, { credentials: "include" });
      const historyData = await historyRes.json();
      if (historyRes.ok) setTicketHistory(historyData.timeline || []);

      // Fetch ticket media
      const mediaRes = await fetch(`/api/tickets/${ticket.TicketID}`, { credentials: "include" });
      const mediaData = await mediaRes.json();
      if (mediaRes.ok) setTicketMedia(mediaData.media || []);

      // TODO: If your backend includes contractorResponses and landlordApprovals
      // setContractorResponses(mediaData.contractorResponses || []);
      // setLandlordApprovals(mediaData.landlordApprovals || []);

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
        setTickets(prev => prev.map(t =>
          t.TicketID === selectedTicket.TicketID ? { ...t, Status: "Closed" } : t
        ));
        setSelectedTicket(prev => ({ ...prev, Status: "Closed" }));
      } else console.error("Failed to close ticket", data);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesStatus = filterStatus ? ticket.Status === filterStatus : true;
    const matchesDate = filterDate ? ticket.CreatedAt.split("T")[0] === filterDate : true;
    return matchesStatus && matchesDate;
  });

  return (
    <div className="dashboard-page">
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-logo">
          <div className="logo-placeholder">GoodLiving</div>
        </div>
        <div className="navbar-right">
          <ul className="navbar-menu">
            <li><Link to="/">Dashboard</Link></li>
            <li><Link to="/ticket">Tickets</Link></li>
            {/*<li><Link to="/reports">Reports</Link></li>*/}
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

      <div className="content">
        <div className="clientdashboard-title"><h1>Dashboard</h1></div>
        <div className="sub-title"><h2>My Tickets</h2></div>

        {/* Ticket Filters */}
        <div className="ticket-filters" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select">
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Rejected">Rejected</option>
            <option value="Closed">Closed</option>
          </select>
          <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="filter-date" />
        </div>

        <div className="dash-submit-container">
          <Link to="/ticket" className="dash-submit">Log a New Ticket</Link>
        </div>

        {loading ? (
          <p className="empty-tickets">Loading tickets...</p>
        ) : filteredTickets.length === 0 ? (
          <div className="empty-tickets">No tickets logged yet.</div>
        ) : (
          <div className="tickets-container">
            <div className="tickets-grid">
              {filteredTickets.map(ticket => (
                <div key={ticket.TicketID} className="ticket-card">
                  <div className="ticket-info">
                    <h3>{ticket.Description}</h3>
                    <p>Ticket Ref: {ticket.TicketRefNumber}</p>
                    <p>Logged: {new Date(ticket.CreatedAt).toLocaleDateString()}</p>
                    <p>Urgency: <span className={`urgency urgency-${ticket.UrgencyLevel.toLowerCase()}`}>{ticket.UrgencyLevel}</span></p>
                    <p>Status: <span className={`status-badge status-${ticket.Status.toLowerCase()}`}>{ticket.Status}</span></p>
                    <div className="ticket-actions">
                      <button className="view-details" onClick={() => openTicketModal(ticket)}>View Details</button>
                      <img src={gearIcon} alt="settings" className="settings-icon" />
                    </div>
                  </div>
                  <div className="ticket-image">View Image</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Ticket Modal */}
      {selectedTicket && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close" onClick={closeModal}>X</button>
            <h2>Ticket Detail</h2>
            <p><strong>Submitted:</strong> {new Date(selectedTicket.CreatedAt).toLocaleString()}</p>
            <p><strong>Description:</strong> {selectedTicket.Description}</p>

            <div className="media">
              <h3>Media</h3>
              {ticketMedia.length === 0 ? (
                <p>No media uploaded</p>
              ) : (
                <ul>
                  {ticketMedia.map((m, idx) => (
                    <li key={idx}>
                      {m.MediaType}: <a href={m.MediaURL} target="_blank" rel="noopener noreferrer">{m.MediaURL}</a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="timeline">
              <h3>Status History</h3>
              {modalLoading ? (
                <p>Loading history...</p>
              ) : ticketHistory.length === 0 ? (
                <p>No history available.</p>
              ) : (
                <ul>
                  {ticketHistory.map((entry, idx) => (
                    <li key={idx}>
                      <strong>{entry.Status}</strong> - {new Date(entry.UpdatedAt).toLocaleString()} (by {entry.UpdatedByUserID || "System"})
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="contractor-responses">
              <h3>Contractor Responses</h3>
              {contractorResponses.length === 0 ? <p>No responses.</p> :
                <ul>{contractorResponses.map((r, i) => <li key={i}>{r.message} - {new Date(r.date).toLocaleString()}</li>)}</ul>
              }
            </div>

            <div className="landlord-approvals">
              <h3>Landlord Approvals</h3>
              {landlordApprovals.length === 0 ? <p>No approvals yet.</p> :
                <ul>{landlordApprovals.map((a, i) => <li key={i}>{a.status} - {new Date(a.date).toLocaleString()}</li>)}</ul>
              }
            </div>

            {selectedTicket.Status !== "Closed" && (
              <button className="close-ticket-btn" onClick={closeTicket}>Close Ticket</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default UserDashboard;
