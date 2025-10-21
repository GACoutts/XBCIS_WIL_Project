import React, { useState, useEffect } from "react";
import gearIcon from "./assets/settings.png";
import "./styles/staffdash.css";
import ReviewRoleRequests from './components/ReviewRoleRequest.jsx';
import { Link } from 'react-router-dom';
import { useAuth } from "./context/AuthContext.jsx";
import { PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

function StaffDashboard() {
  const { logout } = useAuth();
  const [showLogout, setShowLogout] = useState(false);
  const [allTickets, setAllTickets] = useState([]);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDate, setFilterDate] = useState("");

  // Modal state
  const [showContractorModal, setShowContractorModal] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [activeContractors, setActiveContractors] = useState([]);
  const [chosenContractorId, setChosenContractorId] = useState(null);

  const [showTicketModal, setShowTicketModal] = useState(false);
  const [selectedTicketDetails, setSelectedTicketDetails] = useState(null);

  // Contractor management state has been moved to its own page (StaffContractors).
  // We retain only the ability to assign a contractor to a ticket using the
  // `activeContractors` list loaded when assigning.  The full contractor
  // management UI is now located in `StaffContractors.jsx`.

  const loadActiveContractors = async () => {
    try {
      const res = await fetch("/api/admin/contractors/active", { credentials: "include" });
      const data = await res.json();
      if (res.ok) setActiveContractors(data.contractors);
    } catch (err) {
      console.error("Failed to load active contractors:", err);
    }
  };

  const handleAssignContractor = async (ticketId) => {
    setSelectedTicketId(ticketId);
    setShowContractorModal(true);

    // Load active contractors
    await loadActiveContractors();

    // Load currently assigned contractor
    try {
      const res = await fetch(`/api/tickets/${ticketId}/contractor`, { credentials: "include" });
      const data = await res.json();
      if (res.ok && data.contractor) {
        setChosenContractorId(data.contractor.UserID);
      } else {
        setChosenContractorId(null);
      }
    } catch (err) {
      console.error("Failed to load assigned contractor", err);
      setChosenContractorId(null);
    }
  };

  const handleConfirmSchedule = async () => {
    if (!chosenContractorId) return alert("Select contractor");

    try {
      const res = await fetch("/api/admin/contractor-assign", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          TicketID: selectedTicketId,
          ContractorUserID: chosenContractorId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to create schedule");

      // Update local ticket status to In Review (assignment moves ticket to in review)
      const id = selectedTicketId;
      setAllTickets(prev => prev.map(t => t.TicketID === id ? { ...t, CurrentStatus: 'In Review' } : t));
      setShowContractorModal(false);
      setChosenContractorId(null);
      setSelectedTicketId(null);
      alert("Contractor assigned successfully!");
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.reload();
  };

  const getUrgencyColor = (urgency) => {
    switch ((urgency || "").toLowerCase()) {
      case 'high': return 'high-urgency';
      case 'medium': return 'medium-urgency';
      case 'low': return 'low-urgency';
      default: return '';
    }
  };

  const getEffectiveDate = (ticket) => {
    if (!ticket.CreatedAt) return new Date();
    const createdDate = new Date(ticket.CreatedAt);
    const now = new Date();
    const diffDays = (now - createdDate) / (1000 * 60 * 60 * 24);
    if (diffDays > 31) {
      const monthsOld = Math.floor(diffDays / 30);
      const bumpedDate = new Date(createdDate);
      bumpedDate.setMonth(bumpedDate.getMonth() + monthsOld);
      return bumpedDate;
    }
    return createdDate;
  };

  const getStatusColor = (status) => {
    // Map various ticket states to CSS classes.  If you add new statuses
    // on the backend, update this mapping accordingly.  Unrecognised
    // statuses fall back to no additional styling.
    switch (status) {
      case 'New':
      case 'In Review':
      case 'Quoting':
      case 'Awaiting Landlord Approval':
      case 'Awaiting Approval':
      case 'Awaiting Appointment':
      case 'Scheduled':
        return 'status-awaiting';
      case 'Approved':
        return 'status-approved';
      case 'Rejected':
        return 'status-rejected';
      case 'Completed':
      case 'Closed':
        return 'status-closed';
      default:
        return '';
    }
  };

  const getDisplayStatus = (ticket) => {
    const status = ticket.CurrentStatus;
    if (!status) return "";
    // Show "New" only for the first 31 days
    if (status === 'New' && ticket.CreatedAt) {
      const createdDate = new Date(ticket.CreatedAt);
      const now = new Date();
      const diffDays = (now - createdDate) / (1000 * 60 * 60 * 24);
      if (diffDays > 31) return '';
      return 'New';
    }
    switch (status) {
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
        return status;
    }
  };

  const totalOpenTickets = allTickets.filter(t => getDisplayStatus(t) !== "Closed").length;

  // Fetch tickets on mount
  useEffect(() => {
    async function fetchTickets() {
      try {
        const res = await fetch("/api/tickets", { credentials: "include" });
        const data = await res.json();
        if (res.ok && Array.isArray(data.tickets)) {
          setAllTickets(data.tickets);
        }
      } catch (err) {
        setAllTickets([]);
      }
    }
    fetchTickets();
  }, []);

  // The contractor management functions (fetching, adding, removing) have
  // moved to the separate StaffContractors component.  Only the
  // ticket-assignment flows remain here.

  // Ticket detail modal
  const handleOpenTicketModal = async (ticketId) => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, { credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        setSelectedTicketDetails(data.ticket);
        setShowTicketModal(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Close ticket action
  const handleCloseTicket = async (ticketId) => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}/close`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        // Backend sets CurrentStatus to 'Completed'; update local list accordingly
        setAllTickets(prev => prev.map(t => t.TicketID === ticketId ? { ...t, CurrentStatus: 'Completed' } : t));
        alert("Ticket closed!");
        setShowTicketModal(false);
      } else {
        throw new Error(data?.message || "Failed to close ticket");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filter & sort tickets
  const filteredTickets = allTickets
    .filter(ticket => !filterStatus || getDisplayStatus(ticket) === filterStatus)
    .filter(ticket => !filterDate || new Date(ticket.CreatedAt) >= new Date(filterDate))
    .slice()
    .sort((a, b) => {
      const aOld = (new Date() - new Date(a.CreatedAt)) / (1000 * 60 * 60 * 24) > 30;
      const bOld = (new Date() - new Date(b.CreatedAt)) / (1000 * 60 * 60 * 24) > 30;
      if (aOld && !bOld) return -1;
      if (!aOld && bOld) return 1;
      return getEffectiveDate(b) - getEffectiveDate(a);
    });


  // Colors for pie chart statuses
  const statusColors = {
    New: "#8884d8",
    "Awaiting Appointment": "#82ca9d",
    Approved: "#ffc658",
    Rejected: "#ff8042",
    Closed: "#8dd1e1"
  };

  // Prepare Pie Chart data (tickets by status)
  const ticketsByStatus = Object.entries(
    allTickets.reduce((acc, ticket) => {
      const status = getDisplayStatus(ticket) || "Unknown";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {})
  ).map(([status, count]) => ({ name: status, value: count }));

  // Group tickets by week (opened vs resolved)
  const ticketsByWeekData = React.useMemo(() => {
    const weekMap = {};

    allTickets.forEach(ticket => {
      const created = new Date(ticket.CreatedAt);
      const resolved = ticket.ResolvedAt ? new Date(ticket.ResolvedAt) : null;

      const getWeekKey = (date) => {
        const firstDay = new Date(date.getFullYear(), 0, 1);
        const weekNo = Math.ceil(((date - firstDay) / (1000 * 60 * 60 * 24) + firstDay.getDay() + 1) / 7);
        return `${date.getFullYear()}-W${weekNo}`;
      };

      const createdWeek = getWeekKey(created);
      if (!weekMap[createdWeek]) weekMap[createdWeek] = { week: createdWeek, opened: 0, resolved: 0 };
      weekMap[createdWeek].opened += 1;

      if (resolved) {
        const resolvedWeek = getWeekKey(resolved);
        if (!weekMap[resolvedWeek]) weekMap[resolvedWeek] = { week: resolvedWeek, opened: 0, resolved: 0 };
        weekMap[resolvedWeek].resolved += 1;
      }
    });

    return Object.values(weekMap).sort((a, b) => a.week.localeCompare(b.week));
  }, [allTickets]);

  const avgResolutionTime = React.useMemo(() => {
    const resolvedTickets = allTickets.filter(t => t.ResolvedAt);
    if (!resolvedTickets.length) return 0;
    const totalDays = resolvedTickets.reduce((acc, t) => {
      const created = new Date(t.CreatedAt);
      const resolved = new Date(t.ResolvedAt);
      return acc + ((resolved - created) / (1000 * 60 * 60 * 24));
    }, 0);
    return (totalDays / resolvedTickets.length).toFixed(1); // days
  }, [allTickets]);

  // Prepare Bar Chart data (tickets by urgency).  Group tickets by their urgency
  const ticketsByUrgencyData = React.useMemo(() => {
    const counts = { Low: 0, Medium: 0, High: 0, Critical: 0 };
    allTickets.forEach(t => {
      const urgency = (t.UrgencyLevel || '').toLowerCase();
      if (urgency === 'low') counts.Low += 1;
      else if (urgency === 'medium') counts.Medium += 1;
      else if (urgency === 'high') counts.High += 1;
      else if (urgency === 'critical') counts.Critical += 1;
    });
    return [
      { urgency: 'Low', count: counts.Low },
      { urgency: 'Medium', count: counts.Medium },
      { urgency: 'High', count: counts.High },
      { urgency: 'Critical', count: counts.Critical },
    ];
  }, [allTickets]);

  return (
    <>
      <nav className="navbar">
        <div className="navbar-logo"><div className="logo-placeholder">GoodLiving</div></div>
        <div className="navbar-right">
          <ul className="navbar-menu">
            <li><Link to="/staff">Dashboard</Link></li>
            <li><Link to="/tickets">Tickets</Link></li>
            <li><Link to="/contractors">Contractors</Link></li>
            <li><Link to="/notifications">Notifications</Link></li>
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

      <div className="staffdashboard-title"><h1>Dashboard</h1></div>

      <div className="sub-titles-container">
        <div className="sub-title"><h2>Awaiting Tickets</h2></div>
      </div>

      <div className="awaiting-tickets-container">
        <div className="table-header">
          <div className="header-content">
            <div className="header-grid">
              <div className="header-item">Ticket ID</div>
              <div className="header-item">Property</div>
              <div className="header-item">Issue</div>
              <div className="header-item">Submitted</div>
              <div className="header-status">Urgency/Status</div>
            </div>
          </div>
        </div>

        {/* Ticket filters */}
        <div className="ticket-filters">
          <label>
            Status:
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All</option>
              <option value="New">New</option>
              <option value="In Review">In Review</option>
              <option value="Quoting">Quoting</option>
              <option value="Awaiting Appointment">Awaiting Appointment</option>
              <option value="Awaiting Approval">Awaiting Approval</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Closed">Closed</option>
            </select>
          </label>
          <label>
            Submitted After:
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
          </label>
        </div>

        {filteredTickets.length > 0 ? (
          filteredTickets.map((ticket, index) => (
            <div key={ticket.TicketID || index} className="ticket-card">
              <div className="ticket-layout">
                <div className="ticket-info-grid">
                  <div className="info-value ticket-id">{ticket.TicketRefNumber || ticket.TicketID}</div>
                  <div className="info-value">{ticket.PropertyAddress || ticket.property || '—'}</div>
                  <div className="info-value issue-cell">
                    <span>{ticket.Description || ticket.issue}</span>
                    <img src={gearIcon} alt="Settings" className="gear-icon" />
                  </div>
                  <div className="info-value">{ticket.CreatedAt ? new Date(ticket.CreatedAt).toLocaleDateString() : ticket.submitted}</div>
                  <div className="urgency-status-column">
                    <span className={`urgency-badge ${getUrgencyColor(ticket.UrgencyLevel || ticket.urgency)}`}>
                      {ticket.UrgencyLevel || ticket.urgency}
                    </span>
                    <span className={`status-badge ${getStatusColor(getDisplayStatus(ticket) || ticket.status)}`}>
                      {getDisplayStatus(ticket) || ticket.status}
                    </span>
                  </div>
                  <div className="action-buttons">
                    <button className="action-btn assign-btn" onClick={() => handleAssignContractor(ticket.TicketID)}>
                      Assign Contractor
                    </button>
                    <button className="action-btn view-btn" onClick={() => handleOpenTicketModal(ticket.TicketID)}>
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="empty-state">No tickets available</p>
        )}
      </div>

      <section className="staff-admin-panel">
        <h2 className="section-title">Role Requests</h2>
        <ReviewRoleRequests />
      </section>

      {/* Assign Contractor Modal */}
      {showContractorModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Assign Contractor</h2>
            <div className="modal-content">
              <label>Select Contractor:</label>
              <select value={chosenContractorId || ""} onChange={e => setChosenContractorId(Number(e.target.value))}>
                <option value="">-- Select --</option>
                {activeContractors.map(c => (
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

      {/* Ticket Detail Modal */}
      {showTicketModal && selectedTicketDetails && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Ticket Details</h2>
            <p><strong>Issue:</strong> {selectedTicketDetails.Description}</p>
            <p><strong>Status:</strong> {selectedTicketDetails.CurrentStatus}</p>

            <h3>Contractor Responses</h3>
            {selectedTicketDetails.ContractorResponses?.length ? (
              <ul>
                {selectedTicketDetails.ContractorResponses.map(r => (
                  <li key={r.ResponseID}>{r.Message} - {new Date(r.Date).toLocaleDateString()}</li>
                ))}
              </ul>
            ) : <p>No responses yet</p>}

            <h3>Landlord Approvals</h3>
            {selectedTicketDetails.LandlordApprovals?.length ? (
              <ul>
                {selectedTicketDetails.LandlordApprovals.map(a => (
                  <li key={a.ApprovalID}>{a.Approved ? "Approved" : "Rejected"} - {new Date(a.Date).toLocaleDateString()}</li>
                ))}
              </ul>
            ) : <p>No approvals yet</p>}

            <div className="modal-buttons">
              {selectedTicketDetails.CurrentStatus !== "Closed" && (
                <button onClick={() => handleCloseTicket(selectedTicketDetails.TicketID)}>Close Ticket</button>
              )}
              <button onClick={() => setShowTicketModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}


      {/* The contractor management section has been moved to its own page.  */}

      <div className="analytics-panel">
        <h2>Analytics</h2>
        <div className="charts-container">
          <div className="chart-wrapper">
            <h3>Tickets by Status</h3>
            <PieChart width={300} height={300}>
              <Pie
                data={ticketsByStatus}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {ticketsByStatus.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={statusColors[entry.name] || "#ccc"} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </div>

          <div className="chart-wrapper">
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

        <div className="chart-wrapper">
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

      <div className="page-bottom-spacer"></div>
    </>
  );
}

export default StaffDashboard;
