import { useEffect, useState } from "react";
import { Link } from 'react-router-dom';
import { useAuth } from "./context/AuthContext.jsx";
import gearIcon from "./assets/settings.png";
import "./styles/userdash.css";

function UserDashboard() {
  const { logout } = useAuth(); // Auth context provides logout function
  const [tickets, setTickets] = useState([]); // Store tickets
  const [loading, setLoading] = useState(true); // Loading state for ticket fetch
  const [showLogout, setShowLogout] = useState(false); // Toggle logout popup

  // Modal states
  const [selectedTicket, setSelectedTicket] = useState(null); // Currently selected ticket
  const [ticketHistory, setTicketHistory] = useState([]); // History for selected ticket
  const [modalLoading, setModalLoading] = useState(false); // Loading state for modal

  // Fetch tickets on component mount
  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const res = await fetch("/api/client/tickets", { credentials: "include" }); // Fetch tickets for logged-in client
        const data = await res.json();
        if (res.ok) setTickets(data.tickets || []); // Save tickets or empty array
        else console.error("Failed to fetch tickets:", data);
      } catch (err) {
        console.error("Error fetching tickets:", err);
      } finally {
        setLoading(false); // Stop loading spinner
      }
    };

    fetchTickets();
  }, []);

  // Handle user logout
  const handleLogout = async () => {
    await logout();
    window.location.reload(); // Refresh page or redirect to login
  };

  // Open ticket modal and fetch history
  const openTicketModal = async (ticket) => {
    setSelectedTicket(ticket); // Set selected ticket
    setModalLoading(true); // Start loading history

    try {
      const res = await fetch(`/api/tickets/${ticket.TicketID}/history`, { credentials: "include" });
      const data = await res.json();
      if (res.ok) setTicketHistory(data.history || []); // Save history or empty
      else console.error("Failed to fetch ticket history:", data);
    } catch (err) {
      console.error("Error fetching ticket history:", err);
    } finally {
      setModalLoading(false); // Stop loading history
    }
  };

  // Close ticket modal
  const closeModal = () => {
    setSelectedTicket(null);
    setTicketHistory([]);
  };

  return (
    <div className="dashboard-page">
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-logo">
          <div className="logo-placeholder">GoodLiving</div>
        </div>

        {/* Navigation links */}
        <div className="navbar-right">
          <ul className="navbar-menu">
            <li><Link to="/">Dashboard</Link></li>
            <li><Link to="/ticket">Tickets</Link></li>
            {/*<li><Link to="/reports">Reports</Link></li>*/}
            <li><Link to="/settings">Settings</Link></li>
          </ul>
        </div>

        {/* Profile button with logout popup */}
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

      {/* Main content */}
      <div className="content">
        <div className="clientdashboard-title"><h1>Dashboard</h1></div>
        <div className="sub-title"><h2>My Tickets</h2></div>

        {/* Button to log a new ticket */}
        <div className="dash-submit-container">
          <Link to="/ticket" className="dash-submit">Log a New Ticket</Link>
        </div>

        {/* Loading / empty / tickets view */}
        {loading ? (
          <p className="empty-tickets">Loading tickets...</p>
        ) : tickets.length === 0 ? (
          <div className="empty-tickets">No tickets logged yet.</div>
        ) : (
          <div className="tickets-container">
            <div className="tickets-grid">
              {tickets.map((ticket) => (
                <div key={ticket.TicketID} className="ticket-card">
                  <div className="ticket-info">
                    <h3>{ticket.Description}</h3>
                    <p>Ticket Ref: {ticket.TicketRefNumber}</p>
                    <p>Logged: {new Date(ticket.CreatedAt).toLocaleDateString()}</p>
                    <p>
                      Urgency:{" "}
                      <span className={`urgency urgency-${ticket.UrgencyLevel.toLowerCase()}`}>
                        {ticket.UrgencyLevel}
                      </span>
                    </p>

                    {/* Actions for each ticket */}
                    <div className="ticket-actions">
                      {/* Open modal on click */}
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

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <div className="modal-overlay">
          <div className="modal-content">
            {/* Close modal button */}
            <button className="modal-close" onClick={closeModal}>X</button>

            <h2>Ticket Detail</h2>

            {/* Ticket info */}
            <p><strong>Submitted:</strong> {new Date(selectedTicket.CreatedAt).toLocaleString()}</p>
            <p><strong>Description:</strong> {selectedTicket.Description}</p>

            {/* Media section */}
            <div className="media">
              <h3>Media</h3>
              <p>No media uploaded</p> {/* Replace with dynamic media */}
            </div>

            {/* Status history timeline */}
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
                      <strong>{entry.Status}</strong> - {new Date(entry.UpdatedAt).toLocaleString()} (by {entry.UpdatedBy || "System"})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserDashboard;
