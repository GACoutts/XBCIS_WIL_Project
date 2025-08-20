import { useEffect, useState } from "react";
import { useAuth } from "./context/AuthContext"; // import your auth context
import gearIcon from "./assets/settings.png";
import "./styles/userdash.css";

function UserDashboard() {
  const { logout } = useAuth(); // get logout function
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLogout, setShowLogout] = useState(false); // toggle logout button

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const res = await fetch("/api/tickets", {
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok) setTickets(data.tickets || []);
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
    window.location.reload(); // redirect to login or refresh
  };

  return (
    <div className="dashboard-page">
      <nav className="navbar">
        <div className="navbar-logo">
          <img src="https://placehold.co/120x40" alt="logo" />
        </div>
        <div className="navbar-right">
          <ul className="navbar-menu">
            <li><a href="/">Dashboard</a></li>
            <li><a href="/ticket">Tickets</a></li>
            <li><a href="">Reports</a></li>
            <li><a href="">Settings</a></li>
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

      <div className="content">
        <div className="dashboard-title"><h1>Dashboard</h1></div>
        <div className="sub-title"><h2>My Tickets</h2></div>

        <div className="dash-submit-container">
          <a href="/ticket" className="dash-submit">Log a New Ticket</a>
        </div>

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
                    <div className="ticket-actions">
                      <button className="view-details">View Details</button>
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
    </div>
  );
}

export default UserDashboard;
