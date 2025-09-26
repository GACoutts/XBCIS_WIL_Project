import { useState } from 'react';
import gearIcon from './assets/settings.png';
import { useAuth } from "./context/AuthContext.jsx";
import './styles/ContractorDashboard.css';

function CDashboard() {
  const [activeTab, setActiveTab] = useState('assigned');
  const { logout } = useAuth();
  const [showLogout, setShowLogout] = useState(false);

  const assignedJobs = [
    { id: 1, ticketId: "#0234493", property: "23 Apple Road", issue: "Leaky Tap", submitted: "04-03-2023", urgency: "High", status: "Awaiting Appointment", actions: ["Book Appointment", "Upload Quote"] },
    { id: 2, ticketId: "#0234494", property: "45 Banana Street", issue: "Broken Window", submitted: "05-03-2023", urgency: "Medium", status: "Pending Approval", actions: ["Completion Proof", "Book Appointment"] },
    { id: 3, ticketId: "#0234495", property: "67 Cherry Lane", issue: "Faulty Wiring", submitted: "06-03-2023", urgency: "Low", status: "Pending Approval", actions: ["Upload Quote", "Book Appointment"] }
  ];

  const completedJobs = [
    { id: 1, ticketId: "#0234491", property: "23 Apple Road", issue: "Leaky Tap", completed: "04-05-2023", actions: ["Completion Proof"] },
    { id: 2, ticketId: "#0234492", property: "89 Date Avenue", issue: "Paint Job", completed: "04-10-2023", actions: ["Completion Proof"] },
    { id: 3, ticketId: "#0234496", property: "101 Elderberry Blvd", issue: "Roof Repair", completed: "04-15-2023", actions: ["Completion Proof"] }
  ];

  const handleLogout = async () => {
    await logout();
    window.location.reload();
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
            <li><a href="#" className={activeTab === 'jobs' ? 'active' : ''}>Jobs</a></li>
           {/* <li><a href="#" className={activeTab === 'reports' ? 'active' : ''}>Reports</a></li> */}
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

      {/* Scrollable content container */}
      <div className="contractor-content">
        <div className="dashboard-title">
          <h1>Dashboard</h1>
        </div>

        <div className="contractor-tabs">
          <button className={activeTab === 'assigned' ? 'active' : ''} onClick={() => setActiveTab('assigned')}>Assigned Jobs</button>
          <button className={activeTab === 'completed' ? 'active' : ''} onClick={() => setActiveTab('completed')}>Completed Jobs</button>
        </div>

        {activeTab === 'assigned' && (
          <div className="jobs-section">
            <h2>Assigned Jobs</h2>
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
                  {assignedJobs.map(job => (
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
                            <button key={index} className="action-btn">{action}</button>
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
                            <button key={index} className="action-btn">{action}</button>
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
      </div>
    </div>
  );
}

export default CDashboard;
