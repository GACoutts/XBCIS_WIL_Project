import React, { useState, useEffect } from "react";
import gearIcon from "./assets/settings.png";
import "./styles/staffdash.css";
import ManageRoles from './components/ManageRoles.jsx';
import ReviewRoleRequests from './components/ReviewRoleRequest.jsx';
import { Link } from 'react-router-dom';
import { useAuth } from "./context/AuthContext.jsx";

function StaffDashboard() {

  const [showLogout, setShowLogout] = useState(false);
  const [allTickets, setAllTickets] = useState([]);
  const [newTickets, setNewTickets] = useState([]);

  const contractorsData = [
    {
      name: "John Doe",
      currentJobs: 3,
      assignedJob: "Yes",
      hasGearIcon: true,
      status: "Awaiting Appointment"
    },
    {
      name: "John Doe",
      currentJobs: 0,
      assignedJob: "-",
      hasGearIcon: false,
      status: "None"
    },
    {
      name: "John Doe",
      currentJobs: 1,
      assignedJob: "Yes",
      hasGearIcon: true,
      status: "Awaiting Quote"
    }
  ];

  const propertyStatsData = [
    {
      property: "23 Apple Road",
      landlord: "John Doe",
      tenant: "John Doe",
      ticketsLogged: {
        total: 5,
        done: 3,
        inProgress: 2
      },
      totalSpend: "R4000"
    },
    {
      property: "23 Apple Road",
      landlord: "John Doe",
      tenant: "John Doe",
      ticketsLogged: {
        total: 0,
        done: 0,
        inProgress: 0
      },
      totalSpend: "R0"
    }
  ];

  useEffect(() => {
    async function fetchTickets() {
      try {
        const res = await fetch("/api/tickets", { credentials: "include" });
        const data = await res.json();
        if (res.ok && Array.isArray(data.tickets)) {
          setAllTickets(data.tickets);
          setNewTickets(data.tickets.filter(t => t.CurrentStatus === "New"));
        }
      } catch (err) {
        setAllTickets([]);
        setNewTickets([]);
      }
    }
    fetchTickets();
  }, []);

  const handleLogout = async () => {
    await logout();
    window.location.reload(); // redirect to login or refresh
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency.toLowerCase()) {
      case 'high': return 'high-urgency';
      case 'medium': return 'medium-urgency';
      case 'low': return 'low-urgency';
      default: return '';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Awaiting Appointment': return 'status-awaiting';
      case 'Approved': return 'status-approved';
      case 'Rejected': return 'status-rejected';
      default: return '';
    }
  };

  const handleAssignContractor = (ticketId) => {
    console.log(`Assigning contractor to ticket ${ticketId}`);
  };

  const handleViewQuote = (ticketId) => {
    console.log(`Viewing quote for ticket ${ticketId}`);
  };

  const handleChangeStatus = (ticketId) => {
    console.log(`Changing status for ticket ${ticketId}`);
  };

  const handleAssignContractorToJob = (contractorName) => {
    console.log(`Assigning job to contractor ${contractorName}`);
  };

  const handleViewContractorQuote = (contractorName) => {
    console.log(`Viewing quote for contractor ${contractorName}`);
  };

  const getUrgencyClass = (urgency) => {
    switch (urgency.toLowerCase()) {
      case 'high': return 'high-urgency';
      case 'medium': return 'medium-urgency';
      case 'low': return 'low-urgency';
      default: return '';
    }
  };

  const getStatusClass = (status) => {
    const statusLower = status.toLowerCase().replace(/\s+/g, '-');
    return `status-${statusLower}`;
  };

  // Filter new tickets to only those less than a month old
  const recentNewTickets = newTickets.filter(ticket => {
    if (!ticket.CreatedAt) return false;
    const createdDate = new Date(ticket.CreatedAt);
    const now = new Date();
    const diffDays = (now - createdDate) / (1000 * 60 * 60 * 24);
    return diffDays <= 31;
  });

  return (
    <>
      <nav className="navbar">
        <div className="navbar-logo">
          <img src="https://placehold.co/120x40" alt="logo" />
        </div>
        <div className="navbar-right">
          <ul className="navbar-menu">
            <li>
              <Link to="/">Dashboard</Link>
            </li>
            <li>
              <Link to="/tickets">Tickets</Link>
            </li>
            <li>
              <Link to="/reports">Reports</Link>
            </li>
            <li>
              <Link to="/quotes">Quotes</Link>
            </li>
            <li>
              <Link to="/contractors">Contractors</Link>
            </li>
            <li>
              <Link to="/settings">Settings</Link>
            </li>
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

      <div className="dashboard-title">
        <h1>Dashboard</h1>
      </div>

    {/* Staff admin panel */}
      <section className="staff-admin-panel">
        <h2 className="section-title">Role Requests</h2>
        <ReviewRoleRequests /> {/* No newTickets prop */}
      </section>

      <div className="sub-titles-container">
        <div className="sub-title">
          <h2>Awaiting Tickets</h2>
        </div>
        <div className="contractor-sub-title">
          <h2>Contractor Management</h2>
        </div>
      </div>
      <div className="cards-wrapper">

        {/* Awaiting Tickets Section - only show if there are recent new tickets */}
        {recentNewTickets.length > 0 && (
          <div className="awaiting-tickets-container">
            <div className="table-header">
              <div className="header-content">
                <div className="header-grid">
                  <div className="header-item">Ticket ID</div>
                  <div className="header-item">Property</div>
                  <div className="header-item">Issue</div>
                  <div className="header-item">Submitted</div>
                  <div className="header-status">Urgency/Status</div>
                  <div className="header-actions">Actions</div>
                </div>
              </div>
            </div>

            {recentNewTickets
              .slice() // create a copy to avoid mutating state
              .sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt))
              .map((ticket, index) => (
                <div key={ticket.TicketID || index} className="ticket-card">
                  <div className="ticket-layout">
                    <div className="ticket-info-grid">
                      <div className="info-value ticket-id">{ticket.TicketRefNumber || ticket.TicketID}</div>
                      <div className="info-value">{ticket.PropertyAddress || ticket.property}</div>
                      <div className="info-value issue-cell">
                        <span>{ticket.Description || ticket.issue}</span>
                        <img src={gearIcon} alt="Settings" className="gear-icon" />
                      </div>
                      <div className="info-value">{ticket.CreatedAt ? new Date(ticket.CreatedAt).toLocaleDateString() : ticket.submitted}</div>
                      <div className="urgency-status-column">
                        <span className={`urgency-badge ${getUrgencyColor(ticket.UrgencyLevel || ticket.urgency)}`}>
                          {ticket.UrgencyLevel || ticket.urgency}
                        </span>
                        <span className={`status-badge ${getStatusColor(ticket.CurrentStatus || ticket.status)}`}>
                          {ticket.CurrentStatus || ticket.status}
                        </span>
                      </div>
                      <div className="action-buttons">
                        <button className="action-btn assign-btn" onClick={() => handleAssignContractor(ticket.TicketID)}>
                          Assign Contractor
                        </button>
                        <button className="action-btn quote-btn" onClick={() => handleViewQuote(ticket.TicketID)}>
                          View Quote
                        </button>
                        <button className="action-btn status-btn" onClick={() => handleChangeStatus(ticket.TicketID)}>
                          Change Status
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}

        <div className="contractor-container">
          <div className="table-header">
            <div className="header-content">
              <div className="contractor-header-grid">
                <div className="header-item">Name</div>
                <div className="header-item">Current Jobs</div>
                <div className="header-item">Assigned Job</div>
                <div className="header-status">Status</div>
              </div>
            </div>
          </div>

          {contractorsData.map((contractor, index) => (
            <div key={index} className="contractor-card">
              <div className="contractor-layout">
                <div className="contractor-content">
                  <div className="contractor-info-grid">
                    <div className="info-item">
                      <div className="info-value">{contractor.name}</div>
                    </div>
                    <div className="info-item">
                      <div className="info-value">{contractor.currentJobs}</div>
                    </div>
                    <div className="info-item">
                      <div className="assigned-job-cell">
                        <span className="info-value">{contractor.assignedJob}</span>
                        {contractor.hasGearIcon && (
                          <img src={gearIcon} alt="Settings" className="gear-icon" />
                        )}
                      </div>
                    </div>
                    <div className="info-item">
                      <div className="contractor-status-column">
                        <div className={`status-badge ${getStatusClass(contractor.status)}`}>
                          {contractor.status}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="action-buttons">
                    <button className="action-btn" onClick={() => handleAssignContractorToJob(contractor.name)}>
                      Assign Contractor
                    </button>
                    <button className="action-btn" onClick={() => handleViewContractorQuote(contractor.name)}>
                      View Quote
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="sub-title2">
        <h2>Property Stats</h2>
      </div>
      <div className="property-stats-container">
        <div className="table-header">
          <div className="header-content">
            <div className="property-stats-header-grid">
              <div className="header-item">Property</div>
              <div className="header-item">Landlord</div>
              <div className="header-item">Tenant</div>
              <div className="header-item">Tickets Logged</div>
              <div className="header-item">Total Spend</div>
            </div>
          </div>
        </div>

        {propertyStatsData.map((property, index) => (
          <div key={index} className="property-stats-card">
            <div className="property-stats-layout">
              <div className="property-stats-content">
                <div className="property-stats-info-grid">
                  <div className="info-item">
                    <div className="info-value">{property.property}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-value">{property.landlord}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-value">{property.tenant}</div>
                  </div>
                  <div className="info-item">
                    <div className="tickets-logged-cell">
                      <div className="tickets-summary">
                        <div className="total-tickets">Total: {property.ticketsLogged.total}</div>
                        <div className="done-tickets">Done: {property.ticketsLogged.done}</div>
                        <div className="progress-tickets">In Progress: {property.ticketsLogged.inProgress}</div>
                      </div>
                    </div>
                  </div>
                  <div className="info-item">
                    <div className="info-value total-spend">{property.totalSpend}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

    </>
  );
}

export default StaffDashboard