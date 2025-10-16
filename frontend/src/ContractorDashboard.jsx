import { useState, useEffect } from 'react';
import { useAuth } from "./context/AuthContext.jsx";
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

  // Modal state for job details
  const [detailsJob, setDetailsJob] = useState(null);

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

  /**
   * Trigger quote upload flow.  Currently this simply opens a file input and
   * submits the selected PDF to the /api/quotes/:ticketId endpoint.  After
   * successful upload, the job list is refreshed.  Only PDF files up to
   * 10MB are accepted by the backend.
   */
  const handleUploadQuote = async (job) => {
    // Create a temporary file input to select a PDF
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('files', file);
      // Example fields; adjust if backend expects quoteAmount/description
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
        // Refresh jobs
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

  /**
   * Propose an appointment date/time for a job using the contractor API.
   * If the proposed date/time is invalid or the API returns an error,
   * a message is displayed.  Upon success the job list is refreshed.
   */
  const handleBookAppointment = async (job) => {
    if (!appointmentDate) {
      alert('Select a date/time');
      return;
    }
    try {
      const proposed = new Date(appointmentDate);
      // Use start time as midday if only date selected (without time)
      if (!appointmentDate.includes('T')) {
        proposed.setHours(12, 0, 0, 0);
      }
      await postJobSchedule(job.ticketId, { proposedStart: proposed.toISOString() });
      alert('Appointment proposed successfully');
      // Refresh jobs
      const refreshed = await getJobs({ page: 1, pageSize: 100 });
      setJobs(Array.isArray(refreshed?.data?.jobs) ? refreshed.data.jobs : []);
      setModalJob(null);
      setAppointmentDate('');
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to propose appointment');
    }
  };

  /**
   * Mark a job/ticket as completed.  Sends a POST request to the backend
   * /api/tickets/:ticketId/complete endpoint.  Only contractors with an
   * approved quote (assigned jobs) may complete tickets.  On success the
   * job status is refreshed.
   */
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
      // Refresh jobs
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

  /**
   * Determine available actions for a job based on its current status.  The
   * returned array of action objects contains a label and an onClick
   * handler.  When new statuses are introduced, update this function
   * accordingly.
   */
  const getJobActions = (job) => {
    const actions = [];
    // Contractors can upload a quote when the job is in review or quoting stage and no approved quote exists
    if ((job.status === 'In Review' || job.status === 'Quoting') && (!job.quote || job.quote.status !== 'Approved')) {
      actions.push({ label: 'Upload Quote', onClick: () => handleUploadQuote(job) });
    }
    // When a quote is approved, the contractor may propose an appointment even if ticket status still says Quoting
    const quoteApproved = job.quote && job.quote.status === 'Approved';
    if (quoteApproved || job.status === 'Approved' || job.status === 'Awaiting Appointment') {
      actions.push({ label: 'Book Appointment', onClick: () => setModalJob(job) });
    }
    // If an appointment is scheduled or the job is in progress, allow completion
    if (job.status === 'Scheduled' || job.status === 'In Progress') {
      actions.push({ label: 'Mark Completed', onClick: () => handleMarkCompleted(job) });
    }
    return actions;
  };

  /**
   * Open job details modal.  Currently details are taken from the job
   * object itself (client details and quote info).  You may extend
   * this to fetch additional information (e.g. property address) from
   * the backend if needed.
   */
  const handleViewDetails = (job) => {
    setDetailsJob(job);
  };

  return (
    <div className="contractor-dashboard">
      {/* Top navigation bar */}
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

      {/* Main content area */}
      <div className="contractor-content">
        <div className="contractordashboard-title">
          <h1>Dashboard</h1>
        </div>

        {/* Filters apply to whichever tab is active */}
        <div className="jobs-filters">
          <label>
            Status:
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
          </label>
          <label>
            Submitted After:
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
            />
          </label>
        </div>

        {loading ? (
          <p>Loading jobs...</p>
        ) : activeTab === 'assigned' ? (
          <div className="jobs-section">
            <h2>Assigned Jobs</h2>
            {filteredAssignedJobs.length === 0 ? (
              <p>No assigned jobs</p>
            ) : (
              <div className="jobs-container">
                {/* Header row */}
                <div className="jobs-header">
                  <div>Ticket ID</div>
                  <div>Issue</div>
                  <div>Submitted</div>
                  <div>Urgency/Status</div>
                  <div>Actions</div>
                </div>
                {/* Job cards */}
                {filteredAssignedJobs.map((job) => {
                  const statusInfo = formatJobStatus(job.status);
                  const urgencyInfo = formatUrgency(job.urgency);
                  const actions = getJobActions(job);
                  return (
                    <div key={job.ticketId} className="job-card">
                      <div className="job-info-grid">
                        <div className="info-value job-id">{job.ticketRefNumber || job.ticketId}</div>
                        <div className="info-value">{job.description}</div>
                        <div className="info-value">{job.createdAt ? new Date(job.createdAt).toLocaleDateString() : ''}</div>
                        <div className="job-urgency-status">
                          <span className={`urgency ${urgencyInfo.class}`}>{urgencyInfo.display}</span>
                          <span className={`status-text ${statusInfo.class}`}>{statusInfo.display}</span>
                        </div>
                        <div className="action-buttons">
                          {actions.map((action, idx) => (
                            <button key={idx} className="action-btn" onClick={action.onClick}>{action.label}</button>
                          ))}
                          <button className="action-btn" onClick={() => handleViewDetails(job)}>View Details</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="jobs-section">
            <h2>Completed Jobs</h2>
            {filteredCompletedJobs.length === 0 ? (
              <p>No completed jobs</p>
            ) : (
              <div className="jobs-container">
                <div className="jobs-header jobs-header-completed">
                  <div>Ticket ID</div>
                  <div>Issue</div>
                  <div>Completed</div>
                  <div>Actions</div>
                </div>
                {filteredCompletedJobs.map((job) => (
                  <div key={job.ticketId} className="job-card">
                    <div className="job-completed-grid">
                      <div className="info-value job-id">{job.ticketRefNumber || job.ticketId}</div>
                      <div className="info-value">{job.description}</div>
                      <div className="info-value">{job.updatedAt ? new Date(job.updatedAt).toLocaleDateString() : ''}</div>
                      <div className="action-buttons">
                        <button className="action-btn" onClick={() => handleViewDetails(job)}>View Details</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal for proposing appointment */}
        {modalJob && (
          <div className="ticket-modal-overlay">
            <div className="ticket-modal">
              <h3>Book Appointment</h3>
              <p>
                Propose a date/time for ticket {modalJob.ticketRefNumber || modalJob.ticketId}.
              </p>
              <input
                type="datetime-local"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
              <div className="modal-buttons">
                <button onClick={() => handleBookAppointment(modalJob)}>Submit</button>
                <button
                  onClick={() => {
                    setModalJob(null);
                    setAppointmentDate('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal for job details */}
        {detailsJob && (
          <div className="ticket-modal-overlay">
            <div className="ticket-modal">
              <h3>Job Details</h3>
              <p>
                <strong>Ticket Ref:</strong>{' '}
                {detailsJob.ticketRefNumber || detailsJob.ticketId}
              </p>
              <p>
                <strong>Issue:</strong> {detailsJob.description}
              </p>
              <p>
                <strong>Status:</strong> {detailsJob.status}
              </p>
              <p>
                <strong>Urgency:</strong> {detailsJob.urgency}
              </p>
              {detailsJob.client && (
                <p>
                  <strong>Client:</strong>{' '}
                  {detailsJob.client.name} ({detailsJob.client.email}, {detailsJob.client.phone})
                </p>
              )}
              <p>
                <strong>Property:</strong> {detailsJob.propertyAddress || '—'}
              </p>
              {detailsJob.quote && (
                <>
                  <p>
                    <strong>Quote Amount:</strong>{' '}
                    {detailsJob.quote.amount != null ? `R${detailsJob.quote.amount}` : '—'}
                  </p>
                  <p>
                    <strong>Quote Status:</strong>{' '}
                    {detailsJob.quote.status || '—'}
                  </p>
                  {detailsJob.quote.landlordApproval && (
                    <p>
                      <strong>Landlord Approval:</strong>{' '}
                      {detailsJob.quote.landlordApproval.status || 'Pending'}
                    </p>
                  )}
                </>
              )}
              <div className="modal-buttons">
                <button onClick={() => setDetailsJob(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CDashboard;
