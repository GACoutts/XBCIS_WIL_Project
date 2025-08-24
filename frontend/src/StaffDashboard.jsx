import React, { useState } from "react";
import gearIcon from "./assets/settings.png";
import "./styles/staffdash.css";

function StaffDashboard(){

    const [tickets, setTickets] = useState([
    {
      id: "#029495",
      property: "23 Apple Road",
      issue: "Leaky Tap",
      submitted: "04-03-2025",
      urgency: "High",
      status: "Awaiting Appointment"
    },
    {
      id: "#029495",
      property: "23 Apple Road", 
      issue: "Leaky Tap",
      submitted: "04-03-2025",
      urgency: "Medium",
      status: "Approved"
    },
    {
      id: "#029495",
      property: "23 Apple Road",
      issue: "Leaky Tap", 
      submitted: "04-03-2025",
      urgency: "Low",
      status: "Rejected"
    }
  ]);

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

    return(
        <>
        <nav className="navbar">
        <div className="navbar-logo">
            <img src="https://placehold.co/120x40" alt="logo" />
        </div>
        <div className="navbar-right">
            <ul className="navbar-menu">
                <li>
                    <a href="">Dashboard</a>
                </li>
                <li>
                    <a href="">Tickets</a>
                </li>
                <li>
                    <a href="">Reports</a>
                </li>
                <li>
                    <a href="">Quotes</a>
                </li>
                <li>
                    <a href="">Contractors</a>
                </li>
                <li>
                    <a href="">Settings</a>
                </li>
            </ul>
        </div>
      <div className="navbar-profile">
        <img src="https://placehold.co/40" alt="profile" />
      </div>
    </nav>

     <div className = "dashboard-title">
        <h1>Dashboard</h1>
    </div>
    <div className="sub-titles-container">
        <div className="sub-title">
            <h2>Awaiting Tickets</h2> 
        </div>
        <div className="contractor-sub-title">
            <h2>Contractor Management</h2>
        </div>
    </div>
    <div className="cards-wrapper">

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
        
        {tickets.map((ticket, index) => (
          <div key={index} className="ticket-card">
            <div className="ticket-layout">
              <div className="ticket-content">
                <div className="ticket-info-grid">
                  <div className="info-value ticket-id">{ticket.id}</div>
                  <div className="info-value">{ticket.property}</div>
                  <div className="info-value issue-cell">
                    <span>{ticket.issue}</span>
                    <img src={gearIcon} alt="Settings" className="gear-icon" />
                    </div>
                  <div className="info-value">{ticket.submitted}</div>
                  <div className="urgency-status-column">
                    <span className={`urgency-badge ${getUrgencyColor(ticket.urgency)}`}>
                      {ticket.urgency}
                    </span>
                    <span className={`status-badge ${getStatusColor(ticket.status)}`}>
                      {ticket.status}
                    </span>
                  </div>
                </div>
                <div className="action-buttons">
                  <button 
                    className="action-btn assign-btn"
                    onClick={() => handleAssignContractor(ticket.id)}
                  >
                    Assign Contractor
                  </button>
                  <button 
                    className="action-btn quote-btn"
                    onClick={() => handleViewQuote(ticket.id)}
                  >
                    View Quote
                  </button>
                  <button 
                    className="action-btn status-btn"
                    onClick={() => handleChangeStatus(ticket.id)}
                  >
                    Change Status
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

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