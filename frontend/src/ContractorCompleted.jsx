// ContractorCompleted.jsx
import { useEffect, useState } from 'react';
import RoleNavbar from './components/RoleNavbar.jsx';
import { getJobs, formatJobStatus, formatUrgency } from './api/contractorApi.js';
import './styles/ContractorDashboard.css';

export default function ContractorCompleted() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterDate, setFilterDate] = useState('');
  const [search, setSearch] = useState('');

  // Full-details modal
  const [infoJob, setInfoJob] = useState(null);

  const titleOrDesc = (j) =>
    (j?.title && j.title.trim()) ||
    (j?.subject && j.subject.trim()) ||
    (j?.Title && j.Title.trim()) ||
    j?.description ||
    '-';


  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await getJobs({ page: 1, pageSize: 200, status: 'Completed' });
        const list = Array.isArray(res?.data?.jobs) ? res.data.jobs : [];
        setJobs(list);
      } catch (e) {
        console.error('Failed to load completed jobs', e);
        setJobs([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const clearFilters = () => {
    setFilterDate('');
    setSearch('');
  };

  const filtered = jobs.filter(j => {
    const dateBase = j.completedAt || j.updatedAt || j.createdAt;
    const matchesDate = filterDate ? (dateBase?.slice(0, 10) === filterDate) : true;

    const hay = `${j.ticketRefNumber || j.ticketId} ${j.subject || j.title || j.Title || ''} ${j.description || ''} ${j.propertyAddress || ''}`.toLowerCase(); const matchesSearch = search ? hay.includes(search.toLowerCase()) : true;

    return matchesDate && matchesSearch;
  });

  return (
    <div className="contractor-dashboard">
      <RoleNavbar />
      <div className="contractor-content">
        <div className="contractordashboard-title">
          <h1>Completed Jobs</h1>
        </div>

        {/* Filters - same card look/feel */}
        <div className="jobs-filters">
          <div className="filter-card">
            <div className="filter-item" style={{ minWidth: 260 }}>
              <label htmlFor="completed-search">Search</label>
              <input
                id="completed-search"
                type="text"
                placeholder="Search by ref, issue, or property…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="filter-item">
              <label htmlFor="completed-date">Date</label>
              <input
                id="completed-date"
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

        {/* Wrap content in the same padded container as Assigned Jobs */}
        <div className="jobs-section">
          <h2>Completed Jobs</h2>
          {loading ? (
            <p>Loading completed jobs…</p>
          ) : filtered.length === 0 ? (
            <p>No completed jobs</p>
          ) : (
            <div className="jobs-table-container">
              <table className="jobs-table">
                <thead>
                  <tr>
                    <th>Ref #</th>
                    <th>Issue</th>
                    <th>Property</th>
                    <th>Urgency / Status</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(job => {
                    const statusInfo = formatJobStatus(job.status);
                    const urgencyInfo = formatUrgency(job.urgency);
                    const completedDt = job.completedAt || job.updatedAt || job.createdAt;

                    return (
                      <tr key={job.ticketId}>
                        <td>{job.ticketRefNumber || job.ticketId}</td>

                        {/* Issue column with the gear icon */}
                        <td className="issue-cell">
                          <div className="issue-inner">
                            <button
                              className="icon-btn"
                              title="View full details"
                              onClick={() => setInfoJob(job)}
                              aria-label="View full ticket details"
                            >
                              ⚙️
                            </button>
                            <div className="issue-text">
                              <div className="issue-desc">{titleOrDesc(job)}</div>
                            </div>
                          </div>
                        </td>

                        <td>{job.propertyAddress || '-'}</td>

                        <td>
                          <div className="urgency-status">
                            <span className={`urgency ${urgencyInfo.class}`}>{urgencyInfo.display}</span>
                            <span className={`status-text ${statusInfo.class}`}>{statusInfo.display}</span>
                          </div>
                        </td>

                        <td>{completedDt ? new Date(completedDt).toLocaleString() : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Full Ticket Details Modal */}
        {infoJob && (
          <div className="ticket-modal-overlay" onClick={() => setInfoJob(null)}>
            <div className="ticket-modal" onClick={e => e.stopPropagation()}>
              <h3>Ticket {infoJob.ticketRefNumber || infoJob.ticketId}</h3>
              <p style={{ marginTop: 8 }}>
                <strong>Title:</strong><br />
                {titleOrDesc(infoJob)}
              </p>
              <p style={{ marginTop: 8 }}>
                <strong>Description:</strong><br />
                {infoJob.description || '-'}
              </p>
              <div style={{ marginTop: 10, fontSize: 14 }}>
                <div><strong>Status:</strong> {formatJobStatus(infoJob.status).display}</div>
                <div><strong>Urgency:</strong> {formatUrgency(infoJob.urgency).display}</div>
                <div>
                  <strong>Completed:</strong>{' '}
                  {infoJob.completedAt
                    ? new Date(infoJob.completedAt).toLocaleString()
                    : infoJob.updatedAt
                      ? new Date(infoJob.updatedAt).toLocaleString()
                      : infoJob.createdAt
                        ? new Date(infoJob.createdAt).toLocaleString()
                        : '-'}
                </div>
                {infoJob.propertyAddress && <div><strong>Property:</strong> {infoJob.propertyAddress}</div>}
                {infoJob.client?.name && (
                  <div>
                    <strong>Client:</strong> {infoJob.client.name}
                    {infoJob.client.phone ? ` • ${infoJob.client.phone}` : ''}
                  </div>
                )}
                {infoJob.quote && (
                  <div style={{ marginTop: 6 }}>
                    <strong>Quote:</strong> {infoJob.quote.status}
                    {Number.isFinite(infoJob.quote.amount) ? ` • R ${infoJob.quote.amount.toFixed(0)}` : ''}
                  </div>
                )}
              </div>
              <div className="modal-buttons" style={{ marginTop: 12 }}>
                <button onClick={() => setInfoJob(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
