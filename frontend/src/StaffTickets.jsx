import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import gearIcon from './assets/settings.png';
import './styles/staffdash.css';

/*
 * StaffTickets
 *
 * This component renders the staff-facing ticket listing.  It displays
 * all tickets available to staff, including active and closed tickets.
 * Tickets older than 30 days bubble back to the top of the list to
 * ensure forgotten items receive attention.  Staff can assign
 * contractors, view ticket details, and close tickets directly from
 * this page.  Filtering by status and submission date is supported.
 */
export default function StaffTickets() {
  const { logout } = useAuth();

  // Ticket and filter state
  const [allTickets, setAllTickets] = useState([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Contractor assignment modal state
  const [showContractorModal, setShowContractorModal] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [activeContractors, setActiveContractors] = useState([]);
  const [chosenContractorId, setChosenContractorId] = useState(null);

  // Ticket detail modal state
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [selectedTicketDetails, setSelectedTicketDetails] = useState(null);

  // Log out handler
  const handleLogout = async () => {
    await logout();
    window.location.reload();
  };

  // Fetch all tickets on mount
  useEffect(() => {
    async function fetchTickets() {
      try {
        const res = await fetch('/api/tickets', { credentials: 'include' });
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

  // Load contractors when assigning
  const loadActiveContractors = async () => {
    try {
      const res = await fetch('/api/admin/contractors/active', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setActiveContractors(data.contractors);
    } catch (err) {
      console.error('Failed to load active contractors:', err);
    }
  };

  // Open assign contractor modal
  const handleAssignContractor = async (ticketId) => {
    setSelectedTicketId(ticketId);
    setShowContractorModal(true);
    // Load list of active contractors
    await loadActiveContractors();
    // Load currently assigned contractor for this ticket
    try {
      const res = await fetch(`/api/tickets/${ticketId}/contractor`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.contractor) {
        setChosenContractorId(data.contractor.UserID);
      } else {
        setChosenContractorId(null);
      }
    } catch (err) {
      console.error('Failed to load assigned contractor', err);
      setChosenContractorId(null);
    }
  };

  // Confirm assignment
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
      // Update local ticket status to In Review
      setAllTickets((prev) => prev.map((t) => (t.TicketID === selectedTicketId ? { ...t, CurrentStatus: 'Quoting' } : t))); setShowContractorModal(false);
      setChosenContractorId(null);
      setSelectedTicketId(null);
      alert('Contractor assigned successfully!');
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  // Load ticket details for modal
  const handleOpenTicketModal = async (ticketId) => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setSelectedTicketDetails(data.ticket);
        setShowTicketModal(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Close ticket
  const handleCloseTicket = async (ticketId) => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}/close`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        setAllTickets((prev) => prev.map((t) => (t.TicketID === ticketId ? { ...t, CurrentStatus: 'Completed' } : t)));
        alert('Ticket closed!');
        setShowTicketModal(false);
      } else {
        throw new Error(data?.message || 'Failed to close ticket');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Helpers for urgency, status colours and computed fields
  const getUrgencyColor = (urgency) => {
    switch ((urgency || '').toLowerCase()) {
      case 'high': return 'high-urgency';
      case 'medium': return 'medium-urgency';
      case 'low': return 'low-urgency';
      case 'critical': return 'high-urgency';
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
    if (!status) return '';
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

  // Separate tickets into active (not closed) and closed (history).  Filter by status and date as appropriate.
  const activeTickets = allTickets.filter(
    (t) => getDisplayStatus(t) !== 'Closed' && (!filterStatus || getDisplayStatus(t) === filterStatus) && (!filterDate || new Date(t.CreatedAt) >= new Date(filterDate))
  );
  const closedTickets = allTickets.filter(
    (t) => getDisplayStatus(t) === 'Closed' && (!filterStatus || getDisplayStatus(t) === filterStatus) && (!filterDate || new Date(t.CreatedAt) >= new Date(filterDate))
  );
  // Sort so tickets older than 30 days bubble to top, then by effective date descending
  const sortTickets = (list) => {
    return list
      .slice()
      .sort((a, b) => {
        const aOld = (new Date() - new Date(a.CreatedAt)) / (1000 * 60 * 60 * 24) > 30;
        const bOld = (new Date() - new Date(b.CreatedAt)) / (1000 * 60 * 60 * 24) > 30;
        if (aOld && !bOld) return -1;
        if (!aOld && bOld) return 1;
        return getEffectiveDate(b) - getEffectiveDate(a);
      });
  };
  const sortedActiveTickets = sortTickets(activeTickets);
  const sortedClosedTickets = sortTickets(closedTickets);

  return (
    <>
      <nav className="navbar">
        <div className="navbar-logo"><div className="logo-placeholder">GoodLiving</div></div>
        <div className="navbar-right">
          <ul className="navbar-menu">
            <li><Link to="/staff">Dashboard</Link></li>
            <li><Link to="/tickets">Tickets</Link></li>
            <li><Link to="/quotes">Quotes</Link></li>
            <li><Link to="/contractors">Contractors</Link></li>
            <li><Link to="/notifications">Notifications</Link></li>
            <li><Link to="/settings">Settings</Link></li>
          </ul>
        </div>
        <div className="navbar-profile">
          <button className="profile-btn" onClick={() => handleLogout()}>
            <img src="https://placehold.co/40" alt="profile" />
          </button>
        </div>
      </nav>

      <div className="staffdashboard-title"><h1>Tickets</h1></div>

      <div className="sub-titles-container">
        <div className="sub-title"><h2>All Tickets</h2></div>
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
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
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
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
          </label>
        </div>

        {sortedActiveTickets.length > 0 ? (
          sortedActiveTickets.map((ticket, index) => (
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
                    <span className={`urgency-badge ${getUrgencyColor(ticket.UrgencyLevel || ticket.urgency)}`}>{ticket.UrgencyLevel || ticket.urgency}</span>
                    <span className={`status-badge ${getStatusColor(getDisplayStatus(ticket) || ticket.status)}`}>{getDisplayStatus(ticket) || ticket.status}</span>
                  </div>
                  <div className="action-buttons">
                    <button className="action-btn assign-btn" onClick={() => handleAssignContractor(ticket.TicketID)}>Assign Contractor</button>
                    <button className="action-btn view-btn" onClick={() => handleOpenTicketModal(ticket.TicketID)}>View Details</button>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="empty-state">No tickets available</p>
        )}
      </div>

      {/* Ticket History Section */}
      <div className="sub-titles-container">
        <div className="sub-title"><h2>Ticket History</h2></div>
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
        {sortedClosedTickets.length > 0 ? (
          sortedClosedTickets.map((ticket, index) => (
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
                    <span className={`urgency-badge ${getUrgencyColor(ticket.UrgencyLevel || ticket.urgency)}`}>{ticket.UrgencyLevel || ticket.urgency}</span>
                    <span className={`status-badge ${getStatusColor(getDisplayStatus(ticket) || ticket.status)}`}>{getDisplayStatus(ticket) || ticket.status}</span>
                  </div>
                  <div className="action-buttons">
                    {/* In history view we don't assign or close tickets, but still allow viewing details */}
                    <button className="action-btn view-btn" onClick={() => handleOpenTicketModal(ticket.TicketID)}>View Details</button>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="empty-state">No historical tickets</p>
        )}
      </div>

      {/* Assign Contractor Modal */}
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
                {selectedTicketDetails.ContractorResponses.map((r) => (
                  <li key={r.ResponseID}>{r.Message} - {new Date(r.Date).toLocaleDateString()}</li>
                ))}
              </ul>
            ) : <p>No responses yet</p>}

            <h3>Landlord Approvals</h3>
            {selectedTicketDetails.LandlordApprovals?.length ? (
              <ul>
                {selectedTicketDetails.LandlordApprovals.map((a) => (
                  <li key={a.ApprovalID}>{a.Approved ? 'Approved' : 'Rejected'} - {new Date(a.Date).toLocaleDateString()}</li>
                ))}
              </ul>
            ) : <p>No approvals yet</p>}

            <div className="modal-buttons">
              {selectedTicketDetails.CurrentStatus !== 'Closed' && (
                <button onClick={() => handleCloseTicket(selectedTicketDetails.TicketID)}>Close Ticket</button>
              )}
              <button onClick={() => setShowTicketModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
      <div className="page-bottom-spacer"></div>
    </>
  );
}