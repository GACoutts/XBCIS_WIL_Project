import { useState, useEffect } from 'react';
import { useAuth } from "./context/AuthContext.jsx";
import { Link } from 'react-router-dom';
import './styles/ContractorDashboard.css';
import {
  getJobs,
  postJobSchedule,
  formatJobStatus,
  formatUrgency
} from './api/contractorApi.js';

/**
 * Contractor dashboard to manage assigned jobs.  Jobs are fetched from the
 * backend using the contractor API.  Contractors can view their assigned
 * tickets, filter by status or date, propose appointment times and mark
 * tickets as completed.  Completed jobs are shown in a separate tab.
 */
function CDashboard() {
  const { logout } = useAuth();
  const [showLogout, setShowLogout] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('assigned');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [modalJob, setModalJob] = useState(null);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [uploadingQuote, setUploadingQuote] = useState(false);
  const [markingComplete, setMarkingComplete] = useState(false);

  // Load jobs on mount
  useEffect(() => {
    async function loadJobs() {
      setLoading(true);
      try {
        const response = await getJobs({ page: 1, pageSize: 100 });
        const list = Array.isArray(response?.data?.jobs)
          ? response.data.jobs
          : [];
        setJobs(list);
      } catch (err) {
        console.error('Error loading contractor jobs:', err);
        setJobs([]);
      } finally {
        setLoading(false);
      }
    }
    loadJobs();
  }, []);

  // Logout handler
  const handleLogout = async () => {
    await logout();
    window.location.reload();
  };

  // Derived lists for assigned vs completed jobs
  const assignedJobs = jobs.filter(j => j.status !== 'Completed');
  const completedJobs = jobs.filter(j => j.status === 'Completed');

  // Filtering logic
  const filterJobs = (list) => {
    return list.filter(job => {
      const statusDisp = formatJobStatus(job.status).display;
      const matchesStatus = filterStatus ? statusDisp === filterStatus : true;
      const dateStr = job.createdAt ? job.createdAt.split('T')[0] : null;
      const matchesDate = filterDate ? (dateStr === filterDate) : true;
      return matchesStatus && matchesDate;
    });
  };

  const filteredAssignedJobs = filterJobs(assignedJobs);
  const filteredCompletedJobs = filterJobs(completedJobs);

  const handleUploadQuote = async (job) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('files', file);
      const quoteAmount = prompt('Enter quote amount (numeric):');
      const quoteDescription = prompt('Enter quote description:');
      formData.append('quoteAmount', quoteAmount || '0');
      formData.append('quoteDescription', quoteDescription || '');
      try {
        setUploadingQuote(true);
        const res = await fetch(`/api/quotes/${job.ticketId}`, {
          method: 'POST',
          credentials: 'include',
          body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || 'Failed to upload quote');
        alert('Quote submitted successfully');
        const refreshed = await getJobs({ page: 1, pageSize: 100 });
        setJobs(Array.isArray(refreshed?.data?.jobs) ? refreshed.data.jobs : []);
        setModalJob(null);
      } catch (error) {
        console.error(error);
        alert(error.message);
      } finally {
        setUploadingQuote(false);
      }
    };
    input.click();
  };

  const handleBookAppointment = async (job) => {
    if (!appointmentDate) {
      alert('Select a date/time');
      return;
    }
    try {
      const proposed = new Date(appointmentDate);
      if (!appointmentDate.includes('T')) {
        proposed.setHours(12, 0, 0, 0);
      }
      await postJobSchedule(job.ticketId, { proposedStart: proposed.toISOString() });
      alert('Appointment proposed successfully');
      const refreshed = await getJobs({ page: 1, pageSize: 100 });
      setJobs(Array.isArray(refreshed?.data?.jobs) ? refreshed.data.jobs : []);
      setModalJob(null);
      setAppointmentDate('');
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to propose appointment');
    }
  };

  const handleMarkCompleted = async (job) => {
    if (markingComplete) return;
    try {
      setMarkingComplete(true);
      const res = await fetch(`/api/tickets/${job.ticketId}/complete`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to mark completed');
      alert('Ticket marked as completed');
      const refreshed = await getJobs({ page: 1, pageSize: 100 });
      setJobs(Array.isArray(refreshed?.data?.jobs) ? refreshed.data.jobs : []);
      setModalJob(null);
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      setMarkingComplete(false);
    }
  };

  const getJobActions = (job) => {
    const actions = [];
    if ((job.status === 'In Review' || job.status === 'Quoting' || job.status === 'Awaiting Landlord Approval') && (!job.quote || job.quote.status !== 'Approved')) {
      actions.push({ label: 'Upload Quote', onClick: () => handleUploadQuote(job) });
    }
    const quoteApproved = job.quote && job.quote.status === 'Approved';
    if (quoteApproved || job.status === 'Approved' || job.status === 'Awaiting Appointment') {
      actions.push({ label: 'Book Appointment', onClick: () => setModalJob(job) });
    }
    if (job.status === 'Scheduled' || job.status === 'In Progress') {
      actions.push({ label: 'Mark Completed', onClick: () => handleMarkCompleted(job) });
    }
    return actions;
  };

  return (
    <div className="contractor-dashboard">
      <nav className="navbar">
        <div className="navbar-logo">
          <div className="logo-placeholder">GoodLiving</div>
        </div>
        <div className="navbar-right">
          <ul className="navbar-menu">
            <li>
              <a
                href="#"
                className={activeTab === 'assigned' ? 'active' : ''}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab('assigned');
                }}
              >
                Assigned Jobs
              </a>
            </li>
            <li>
              <a
                href="#"
                className={activeTab === 'completed' ? 'active' : ''}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab('completed');
                }}
              >
                Completed Jobs
              </a>
            </li>
            <li>
              <Link to="/notifications">Notifications</Link>
            </li>
            <li>
              <Link to="/contractor/settings">Settings</Link>
            </li>
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

        {/* Filters only apply to the active tab */}
        <div className="jobs-filters">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="New">New</option>
            <option value="In Review">In Review</option>
            <option value="Quoting">Quoting</option>
            <option value="Awaiting Approval">Awaiting Approval</option>
            <option value="Approved">Approved</option>
            <option value="Awaiting Appointment">Awaiting Appointment</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
          />
        </div>

        {loading ? (
          <p>Loading jobs...</p>
        ) : activeTab === 'assigned' ? (
          <div className="jobs-section">
            <h2>Assigned Jobs</h2>
            {filteredAssignedJobs.length === 0 ? (
              <p>No assigned jobs</p>
            ) : (
              <div className="jobs-table-container">
                <table className="jobs-table">
                  <thead>
                    <tr>
                      <th>Ref #</th>
                      <th>Issue</th>
                      <th>Submitted</th>
                      <th>Urgency / Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssignedJobs.map(job => {
                      const statusInfo = formatJobStatus(job.status);
                      const urgencyInfo = formatUrgency(job.urgency);
                      const actions = getJobActions(job);
                      return (
                        <tr key={job.ticketId}>
                          <td>{job.ticketRefNumber || job.ticketId}</td>
                          <td>{job.description || job.subject}</td>
                          <td>{job.createdAt ? new Date(job.createdAt).toLocaleDateString() : ''}</td>
                          <td>
                            <div className="urgency-status">
                              <span className={`urgency ${urgencyInfo.class}`}>{urgencyInfo.display}</span>
                              <span className={`status-text ${statusInfo.class}`}>{statusInfo.display}</span>
                            </div>
                          </td>
                          <td>
                            <div className="action-buttons">
                              {actions.map((action, idx) => (
                                <button key={idx} className="action-btn" onClick={action.onClick}>{action.label}</button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="jobs-section">
            <h2>Completed Jobs</h2>
            {filteredCompletedJobs.length === 0 ? (
              <p>No completed jobs</p>
            ) : (
              <div className="jobs-table-container">
                <table className="jobs-table">
                  <thead>
                    <tr>
                      <th>Ref #</th>
                      <th>Issue</th>
                      <th>Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompletedJobs.map(job => (
                      <tr key={job.ticketId}>
                        <td>{job.ticketRefNumber || job.ticketId}</td>
                        <td>{job.description || job.subject}</td>
                        <td>{job.updatedAt ? new Date(job.updatedAt).toLocaleDateString() : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Modal for proposing appointment */}
        {modalJob && (
          <div className="ticket-modal-overlay">
            <div className="ticket-modal">
              <h3>Book Appointment</h3>
              <p>Propose a date/time for ticket {modalJob.ticketRefNumber || modalJob.ticketId}.</p>
              <input
                type="datetime-local"
                value={appointmentDate}
                onChange={e => setAppointmentDate(e.target.value)}
                min={new Date().toISOString().slice(0,16)}
              />
              <div className="modal-buttons">
                <button onClick={() => handleBookAppointment(modalJob)}>Submit</button>
                <button onClick={() => {
                  setModalJob(null);
                  setAppointmentDate('');
                }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CDashboard;
