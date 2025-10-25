import { useState, useEffect } from 'react';
import './styles/ContractorDashboard.css';
import RoleNavbar from './components/RoleNavbar.jsx';
import {
  getJobs,
  postJobSchedule,
  getJobSchedule,
  formatJobStatus,
  formatUrgency
} from './api/contractorApi.js';
import './styles/userdash.css'; //

function CDashboard() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('assigned');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [modalJob, setModalJob] = useState(null);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [uploadingQuote, setUploadingQuote] = useState(false);
  const [markingComplete, setMarkingComplete] = useState(false);
  const [infoJob, setInfoJob] = useState(null); // full-details modal
  const [ticketMedia, setTicketMedia] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [quoteModal, setQuoteModal] = useState({
    open: false,
    job: null,
    amount: '',
    files: [],
    error: '',
    submitting: false,
  });
  const titleOrDesc = (j) =>
    (j?.title && j.title.trim()) ||
    (j?.description && j.description.trim()) ||
    '-';

  useEffect(() => {
    async function loadJobs() {
      setLoading(true);
      try {
        const response = await getJobs({ page: 1, pageSize: 100 });
        const list = Array.isArray(response?.data?.jobs) ? response.data.jobs : [];
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

  const assignedJobs = jobs.filter(j => j.status !== 'Completed');
  const completedJobs = jobs.filter(j => j.status === 'Completed');

  const filterJobs = (list) =>
    list.filter(job => {
      const statusDisp = formatJobStatus(job.status).display;
      const matchesStatus = filterStatus ? statusDisp === filterStatus : true;
      const dateStr = job.createdAt ? job.createdAt.split('T')[0] : null;
      const matchesDate = filterDate ? (dateStr === filterDate) : true;
      return matchesStatus && matchesDate;
    });

  const filteredAssignedJobs = filterJobs(assignedJobs);
  const filteredCompletedJobs = filterJobs(completedJobs);

  const handleBookAppointment = async (job) => {
    if (!appointmentDate) {
      alert('Select a date/time');
      return;
    }
    try {
      const proposed = new Date(appointmentDate);
      if (!appointmentDate.includes('T')) proposed.setHours(12, 0, 0, 0);
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

  const openAppointmentModal = async (job) => {
    setModalJob(job);
    setAppointmentDate('');
    try {
      const existing = job.schedule;
      if (existing && !(existing.clientConfirmed && existing.contractorConfirmed) && existing.proposedDate) {
        const dt = new Date(existing.proposedDate);
        const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
          .toISOString().slice(0, 16);
        setAppointmentDate(local);
        return;
      }
      const resp = await getJobSchedule(job.ticketId);
      const s = resp?.data;
      if (s) {
        setModalJob(prev => prev ? {
          ...prev,
          schedule: {
            scheduleId: s.ScheduleID,
            proposedDate: s.ProposedDate,
            clientConfirmed: !!s.ClientConfirmed,
            contractorConfirmed: !!s.ContractorConfirmed,
            proposedBy: s.ProposedBy || null,
            notes: s.Notes ?? null,
          }
        } : prev);
      }

      if (s && !(s.ClientConfirmed && s.ContractorConfirmed) && s.ProposedDate) {
        const dt = new Date(s.ProposedDate);
        const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
          .toISOString().slice(0, 16);
        setAppointmentDate(local);
      }
    } catch (e) {
      console.warn('Prefill schedule failed:', e?.message || e);
    }
  };

  const openDetails = async (job) => {
    setInfoJob(job);
    setTicketMedia([]);
    setModalLoading(true);
    try {
      const id = job.ticketId;

      // Try generic ticket endpoint first (if it supports Contractor)
      let media = [];
      try {
        const res = await fetch(`/api/tickets/${id}`, { credentials: 'include' });
        const data = await res.json();
        if (res.ok && Array.isArray(data?.media)) {
          media = data.media;
        }
      } catch { }

      // Fallback to contractor media endpoint we just added
      if (!media.length) {
        try {
          const res2 = await fetch(`/api/contractor/jobs/${id}/media`, { credentials: 'include' });
          const data2 = await res2.json();
          if (res2.ok && Array.isArray(data2?.data)) {
            media = data2.data;
          }
        } catch { }
      }

      setTicketMedia(Array.isArray(media) ? media : []);
    } catch (e) {
      console.error('Failed to load ticket media:', e);
      setTicketMedia([]);
    } finally {
      setModalLoading(false);
    }
  };

  const closeDetails = () => {
    setInfoJob(null);
    setTicketMedia([]);
    setModalLoading(false);
  };


  const getJobActions = (job) => {
    const actions = [];
    if ((job.status === 'In Review' || job.status === 'Quoting' || job.status === 'Awaiting Landlord Approval') &&
      (!job.quote || job.quote.status !== 'Approved')) {
      actions.push({
        label: 'Upload Quote',
        onClick: () =>
          setQuoteModal({
            open: true,
            job,
            amount: '',
            files: [],
            error: '',
            submitting: false,
          }),
      });
    }
    const quoteApproved = job.quote && job.quote.status === 'Approved';

    const hasPendingProposal =
      job.schedule &&
      !(job.schedule.clientConfirmed && job.schedule.contractorConfirmed);

    if (quoteApproved || job.status === 'Approved' || job.status === 'Awaiting Appointment' || hasPendingProposal) {
      actions.push({
        label: hasPendingProposal ? 'Edit Appointment' : 'Book Appointment',
        onClick: () => openAppointmentModal(job)
      });
    }
    if (job.status === 'Scheduled' || job.status === 'In Progress') {
      actions.push({ label: 'Mark Completed', onClick: () => handleMarkCompleted(job) });
    }
    return actions;
  };

  const clearFilters = () => {
    setFilterStatus('');
    setFilterDate('');
  };

  return (
    <div className="contractor-dashboard">
      <RoleNavbar />
      <div className="contractor-content">
        <div className="contractordashboard-title">
          <h1>Dashboard</h1>
        </div>

        {/* Filters */}
        <div className="jobs-filters">
          <div className="filter-card">
            <div className="filter-item">
              <label htmlFor="status-filter">Status</label>
              <select
                id="status-filter"
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
              >
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
            </div>

            <div className="filter-item">
              <label htmlFor="date-filter">Date</label>
              <input
                id="date-filter"
                type="date"
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
              />
            </div>

            <button className="filter-reset" onClick={clearFilters} title="Reset filters">
              Reset
            </button>
          </div>
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
                      <th className="actions-col">Actions</th>
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
                          <td className="issue-cell">
                            <div className="issue-inner">
                              <button
                                className="icon-btn"
                                title="View full details"
                                onClick={() => openDetails(job)}
                                aria-label="View full ticket details"
                              >
                                ⚙️
                              </button>
                              <div className="issue-text">
                                <div className="issue-desc">{titleOrDesc(job)}</div>
                                {job.schedule && (
                                  <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>
                                    {(job.schedule.clientConfirmed && job.schedule.contractorConfirmed)
                                      ? `Scheduled: ${new Date(job.schedule.proposedDate).toLocaleString()}`
                                      : `Proposed: ${new Date(job.schedule.proposedDate).toLocaleString()} (awaiting ${job.schedule.clientConfirmed ? 'contractor' : 'client'})`}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>{job.createdAt ? new Date(job.createdAt).toLocaleDateString() : ''}</td>
                          <td>
                            <div className="urgency-status">
                              <span className={`urgency ${urgencyInfo.class}`}>{urgencyInfo.display}</span>
                              <span className={`status-text ${statusInfo.class}`}>{statusInfo.display}</span>
                            </div>
                          </td>
                          <td className="actions-col">
                            <div className="action-buttons">
                              {actions.map((action, idx) => (
                                <button key={idx} className="action-btn" onClick={action.onClick}>
                                  {action.label}
                                </button>
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
                        <td>{titleOrDesc(job)}</td>
                        <td>{job.completedAt ? new Date(job.completedAt).toLocaleDateString() : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {quoteModal.open && (
          <div className="ticket-modal-overlay">
            <div className="ticket-modal" onClick={e => e.stopPropagation()}>
              <h3>Submit Quote</h3>
              <div style={{ display: 'grid', gap: 10 }}>
                <label>
                  Amount (e.g. 1250.50)
                  <input
                    className="gl-input"
                    type="number"
                    step="0.01"
                    min="0.01"
                    inputMode="decimal"
                    placeholder="e.g. 1250.50"
                    value={quoteModal.amount}
                    onChange={e => setQuoteModal(s => ({ ...s, amount: e.target.value }))}
                  />

                  <input
                    className="gl-file"
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    multiple
                    onChange={e => setQuoteModal(s => ({ ...s, files: Array.from(e.target.files || []) }))}
                  />
                </label>

                {quoteModal.error && (
                  <div style={{ color: 'crimson', fontSize: 13 }}>{quoteModal.error}</div>
                )}
              </div>

              <div className="modal-buttons" style={{ marginTop: 12 }}>
                <button
                  disabled={quoteModal.submitting}
                  onClick={async () => {
                    const n = Number.parseFloat(
                      String(quoteModal.amount).replace(/[^\d.,-]/g, '').replace(/,/g, '.')
                    );
                    if (!Number.isFinite(n) || n <= 0) {
                      setQuoteModal(s => ({ ...s, error: 'Please enter a valid positive number.' }));
                      return;
                    }
                    if (!quoteModal.files.length) {
                      setQuoteModal(s => ({ ...s, error: 'Please attach at least one file.' }));
                      return;
                    }

                    try {
                      setQuoteModal(s => ({ ...s, submitting: true, error: '' }));
                      const fd = new FormData();
                      quoteModal.files.forEach(f => fd.append('files', f));
                      fd.append('quoteAmount', String(n));

                      const res = await fetch(`/api/quotes/${quoteModal.job.ticketId}`, {
                        method: 'POST',
                        credentials: 'include',
                        body: fd,
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data?.message || 'Failed to upload quote');

                      alert('Quote submitted successfully');
                      const refreshed = await getJobs({ page: 1, pageSize: 100 });
                      setJobs(Array.isArray(refreshed?.data?.jobs) ? refreshed.data.jobs : []);
                      setQuoteModal({ open: false, job: null, amount: '', files: [], error: '', submitting: false });
                    } catch (e) {
                      setQuoteModal(s => ({ ...s, error: e.message || 'Upload failed', submitting: false }));
                    }
                  }}
                >
                  Submit
                </button>
                <button
                  onClick={() =>
                    setQuoteModal({ open: false, job: null, amount: '', files: [], error: '', submitting: false })
                  }
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}


        {/* Appointment Modal */}
        {modalJob && (
          <div className="ticket-modal-overlay">
            <div className="ticket-modal">
              <h3>
                {modalJob.schedule &&
                  !(modalJob.schedule.clientConfirmed && modalJob.schedule.contractorConfirmed)
                  ? 'Edit Appointment'
                  : 'Book Appointment'}
              </h3>              <p>Propose a date/time for ticket {modalJob.ticketRefNumber || modalJob.ticketId}.</p>
              <input
                type="datetime-local"
                value={appointmentDate}
                onChange={e => setAppointmentDate(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
              <div className="modal-buttons">
                {modalJob?.schedule &&
                  modalJob.schedule.clientConfirmed &&
                  !modalJob.schedule.contractorConfirmed ? (
                  <>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch(
                            `/api/tickets/${modalJob.ticketId}/appointments/confirm`,
                            {
                              method: 'POST',
                              credentials: 'include',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ scheduleId: modalJob.schedule.scheduleId }),
                            }
                          );
                          const data = await res.json();
                          if (!res.ok) throw new Error(data?.message || 'Failed to confirm appointment');
                          alert(data?.message || 'Appointment confirmed');

                          // Refresh list then close modal
                          const refreshed = await getJobs({ page: 1, pageSize: 100 });
                          setJobs(Array.isArray(refreshed?.data?.jobs) ? refreshed.data.jobs : []);
                          setModalJob(null);
                          setAppointmentDate('');
                        } catch (e) {
                          alert(e.message || 'Confirmation failed');
                        }
                      }}
                    >
                      Accept
                    </button>

                    <span style={{ margin: '0 8px', opacity: .7 }}>or</span>

                    <button onClick={() => handleBookAppointment(modalJob)}>
                      Propose different time
                    </button>

                    <button onClick={() => { setModalJob(null); setAppointmentDate(''); }}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    {/* Default propose/edit flow */}
                    <button onClick={() => handleBookAppointment(modalJob)}>Submit</button>
                    <button onClick={() => { setModalJob(null); setAppointmentDate(''); }}>Cancel</button>
                  </>
                )}
              </div>

            </div>
          </div>
        )}

        {/* Full Ticket Details Modal (landlord-style) */}
        {infoJob && (
          <div className="ticket-modal-overlay" onClick={closeDetails}>
            <div className="ticket-modal" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="modal-title" style={{ margin: 0 }}>
                  Ticket {infoJob.ticketRefNumber || infoJob.ticketId}
                </h3>
                <button
                  type="button"
                  className="modal-close-icon"
                  aria-label="Close ticket details"
                  onClick={closeDetails}
                >
                  ✕
                </button>
              </div>

              {/* Details */}
              <div className="modal-section">
                <p>
                  <strong>Property:</strong> {infoJob.propertyAddress || '-'}
                </p>
                <p>
                  <strong>Submitted:</strong>{' '}
                  {infoJob.createdAt ? new Date(infoJob.createdAt).toLocaleString() : '-'}
                </p>
                <p>
                  <strong>Status:</strong>{' '}
                  <span className={`status-text ${formatJobStatus(infoJob.status).class}`}>
                    {formatJobStatus(infoJob.status).display}
                  </span>
                </p>
                <p>
                  <strong>Urgency:</strong> {formatUrgency(infoJob.urgency).display}
                </p>
                <div style={{ marginTop: 8 }}>
                  <strong>Title / Issue:</strong>
                  <div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>
                    {titleOrDesc(infoJob) || '-'}
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <strong>Description:</strong>
                  <div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>
                    {infoJob.description || '-'}
                  </div>
                </div>
                {infoJob.client?.name && (
                  <p style={{ marginTop: 8 }}>
                    <strong>Client:</strong> {infoJob.client.name}
                    {infoJob.client.phone ? ` • ${infoJob.client.phone}` : ''}
                  </p>
                )}
                {infoJob.schedule && (
                  <p style={{ marginTop: 8 }}>
                    <strong>Appointment:</strong>{' '}
                    {(infoJob.schedule.clientConfirmed && infoJob.schedule.contractorConfirmed) ? 'Confirmed' : 'Pending'} -{' '}
                    {infoJob.schedule.proposedDate
                      ? new Date(infoJob.schedule.proposedDate).toLocaleString()
                      : '-'}
                  </p>
                )}
                {infoJob.quote && (
                  <p style={{ marginTop: 8 }}>
                    <strong>Quote:</strong> {infoJob.quote.status}
                    {Number.isFinite(infoJob.quote.amount) ? ` • R ${infoJob.quote.amount.toFixed(0)}` : ''}
                  </p>
                )}
              </div>

              {/* Media */}
              <div className="modal-section">
                <h4 style={{ marginTop: 0 }}>Media</h4>
                {modalLoading ? (
                  <p>Loading media…</p>
                ) : !ticketMedia.length ? (
                  <p className="empty-text">No media uploaded</p>
                ) : (
                  <div className="media-gallery-grid">
                    {ticketMedia.map((m, idx) => {
                      const url = m.MediaURL || '';
                      const type = (m.MediaType || '').toLowerCase();
                      const isImage = type.startsWith('image') || /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                      const isVideo = type.startsWith('video') || /\.(mp4|webm|ogg)$/i.test(url);
                      return (
                        <div key={idx} className="media-card">
                          {isImage ? (
                            <img
                              src={url}
                              alt={`Media ${idx}`}
                              onError={(e) => (e.currentTarget.src = 'https://placehold.co/150x100?text=No+Image')}
                              onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                              style={{ cursor: 'pointer' }}
                            />
                          ) : isVideo ? (
                            <video controls className="media-thumb" style={{ width: '100%', borderRadius: 8 }}>
                              <source src={url} type={type || 'video/mp4'} />
                            </video>
                          ) : (
                            <div
                              className="media-placeholder"
                              onClick={() => url && window.open(url, '_blank', 'noopener,noreferrer')}
                              style={{ cursor: url ? 'pointer' : 'default' }}
                            >
                              {url ? 'Open file' : 'No preview available'}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="modal-buttons" style={{ marginTop: 12 }}>
                <button onClick={closeDetails}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CDashboard;
