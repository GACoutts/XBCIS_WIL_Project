import { useState, useEffect } from 'react';
import gearIcon from './assets/settings.png';
import { useAuth } from "./context/AuthContext.jsx";
import './styles/ContractorDashboard.css';

function CDashboard() {
  const [activeTab, setActiveTab] = useState('assigned');
  const { logout } = useAuth();
  const [showLogout, setShowLogout] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [modalTicket, setModalTicket] = useState(null);
  const [assignedJobs, setAssignedJobs] = useState([
    { id: 1, ticketId: "#0234493", property: "23 Apple Road", issue: "Leaky Tap", submitted: "2023-03-04", urgency: "High", status: "Awaiting Appointment", actions: ["Book Appointment", "Upload Quote"], contractorResponse: "Waiting on parts", landlordApproval: "Pending" },
    { id: 2, ticketId: "#0234494", property: "45 Banana Street", issue: "Broken Window", submitted: "2023-03-05", urgency: "Medium", status: "Pending Approval", actions: ["Completion Proof", "Book Appointment"], contractorResponse: "Replaced glass", landlordApproval: "Approved" },
    { id: 3, ticketId: "#0234495", property: "67 Cherry Lane", issue: "Faulty Wiring", submitted: "2023-03-06", urgency: "Low", status: "Pending Approval", actions: ["Upload Quote", "Book Appointment"], contractorResponse: "Estimated quote sent", landlordApproval: "Pending" }
  ]);
  const [completedJobs, setCompletedJobs] = useState([
    { id: 1, ticketId: "#0234491", property: "23 Apple Road", issue: "Leaky Tap", completed: "2023-05-04", actions: ["Completion Proof"] },
    { id: 2, ticketId: "#0234492", property: "89 Date Avenue", issue: "Paint Job", completed: "2023-10-04", actions: ["Completion Proof"] },
    { id: 3, ticketId: "#0234496", property: "101 Elderberry Blvd", issue: "Roof Repair", completed: "2023-04-15", actions: ["Completion Proof"] }
  ]);

  useEffect(() => {
    document.body.style.setProperty("overflow", "hidden", "important");
    return () => {
      document.body.style.setProperty("overflow", "auto", "important");
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    window.location.reload();
  };

  // Filtered assigned jobs
  const filteredAssignedJobs = assignedJobs.filter(job => {
    const matchesStatus = filterStatus ? job.status === filterStatus : true;
    const matchesDate = filterDate ? job.submitted === filterDate : true;
    return matchesStatus && matchesDate;
  });

  // Close ticket action
  const closeTicket = (ticketId) => {
    setAssignedJobs(prev =>
      prev.map(job => job.id === ticketId ? { ...job, status: 'Closed' } : job)
    );
    setModalTicket(null);
    // TODO: PATCH request to server API to update tblTickets.Status
  };

  return (
    <div className="contractor-dashboard">
      <nav className="navbar">
        <div className="navbar-logo">
          <div className="logo-placeholder">GoodLiving</div>
        </div>
        <div className="navbar-right">
          <ul className="navbar-menu">
            <li><a href="#" className={activeTab === 'dashboard' ? 'active' : ''}>Dashboard</a></li>
            <li><a href="#" className={activeTab === 'settings' ? 'active' : ''}>Settings</a></li>
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

      <div className="contractor-content">
        <div className="contractordashboard-title">
          <h1>Dashboard</h1>
        </div>

        <div className="contractor-tabs">
          <button className={activeTab === 'assigned' ? 'active' : ''} onClick={() => setActiveTab('assigned')}>Assigned Jobs</button>
          <button className={activeTab === 'completed' ? 'active' : ''} onClick={() => setActiveTab('completed')}>Completed Jobs</button>
        </div>

        {activeTab === 'assigned' && (
          <div className="jobs-section">
            <h2>Assigned Jobs</h2>

            {/* Filters */}
            <div className="jobs-filters">
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">All Status</option>
                <option value="Awaiting Appointment">Awaiting Appointment</option>
                <option value="Pending Approval">Pending Approval</option>
                <option value="Closed">Closed</option>
              </select>
              <input
                type="date"
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
              />
            </div>

            <div className="jobs-table-container">
              <table className="jobs-table">
                <thead>
                  <tr>
                    <th>Ticket ID</th>
                    <th>Property</th>
                    <th>Issue</th>
                    <th>Submitted</th>
                    <th>Urgency/Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssignedJobs.map(job => (
                    <tr key={job.id}>
                      <td>{job.ticketId}</td>
                      <td>{job.property}</td>
                      <td>{job.issue}</td>
                      <td>{job.submitted}</td>
                      <td>
                        <div className="urgency-status">
                          <span className={`urgency urgency-${job.urgency.toLowerCase()}`}>{job.urgency}</span>
                          <span className="status-text">{job.status}</span>
                        </div>
                      </td>
                      <td>
                        <div className="action-buttons">
                          {job.actions.map((action, index) => (
                            <button key={index} className="action-btn" onClick={() => setModalTicket(job)}>{action}</button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'completed' && (
          <div className="jobs-section">
            <h2>Completed Jobs</h2>
            <div className="jobs-table-container">
              <table className="jobs-table">
                <thead>
                  <tr>
                    <th>Ticket ID</th>
                    <th>Property</th>
                    <th>Issue</th>
                    <th>Completed</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {completedJobs.map(job => (
                    <tr key={job.id}>
                      <td>{job.ticketId}</td>
                      <td>{job.property}</td>
                      <td>{job.issue}</td>
                      <td>{job.completed}</td>
                      <td>
                        <div className="action-buttons">
                          {job.actions.map((action, index) => (
                            <button key={index} className="action-btn" onClick={() => setModalTicket(job)}>{action}</button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Ticket Modal */}
        {modalTicket && (
          <div className="ticket-modal-overlay">
            <div className="ticket-modal">
              <h3>Ticket Details</h3>
              <p><strong>Property:</strong> {modalTicket.property}</p>
              <p><strong>Issue:</strong> {modalTicket.issue}</p>
              {modalTicket.submitted && <p><strong>Submitted:</strong> {modalTicket.submitted}</p>}
              {modalTicket.completed && <p><strong>Completed:</strong> {modalTicket.completed}</p>}
              {modalTicket.contractorResponse && <p><strong>Contractor Response:</strong> {modalTicket.contractorResponse}</p>}
              {modalTicket.landlordApproval && <p><strong>Landlord Approval:</strong> {modalTicket.landlordApproval}</p>}

              {/* Close Ticket Button (for clients) */}
              {modalTicket.status !== 'Closed' && (
                <button className="close-ticket-btn" onClick={() => closeTicket(modalTicket.id)}>Close Ticket</button>
              )}

              {/* Appointment Date Picker (for contractors) */}
              {modalTicket.actions.includes("Book Appointment") && (
                <input
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  onChange={e => console.log("Selected appointment date:", e.target.value)}
                />
              )}

              <button className="modal-close-btn" onClick={() => setModalTicket(null)}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CDashboard;
