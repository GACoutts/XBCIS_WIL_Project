import React, { useEffect, useState } from "react";
import RoleNavbar from "./components/RoleNavbar.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import {
  getTicketsFiltered,
  approveTicket,
  rejectTicket,
  approveQuote,
  rejectQuote,
  getProperties,
  getQuoteMedia,
} from "./landlordApi";

import "./styles/userdash.css";
import "./styles/landlorddash.css";

export default function LandlordTickets() {
  const { logout } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [properties, setProperties] = useState([]);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPropertyId, setFilterPropertyId] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await getProperties();
        setProperties(res.success ? res.data || [] : []);
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterPropertyId) params.propertyId = filterPropertyId;
      const res = await getTicketsFiltered(params);
      const list = Array.isArray(res?.data?.tickets)
        ? res.data.tickets
        : res.tickets || [];
      setTickets(list);
    })();
  }, [filterStatus, filterPropertyId]);

  const getTicketId = (t) => t.ticketId ?? t.TicketID;
  const getReference = (t) => t.referenceNumber ?? t.TicketRefNumber;
  const getDescription = (t) => t.description ?? t.Description ?? "";

  const handleViewQuote = async (quoteId) => {
    const files = await getQuoteMedia(quoteId);
    const first = Array.isArray(files) ? files[0] : null;
    if (first?.MediaURL) window.open(first.MediaURL, "_blank");
    else alert("No quote found.");
  };

  const currentTickets = tickets.filter(
    (t) => t.status !== "Completed" && t.status !== "Rejected"
  );
  const historyTickets = tickets.filter(
    (t) => t.status === "Completed" || t.status === "Rejected"
  );

  return (
    <>
      <RoleNavbar />

      <div className="staffdashboard-title">
        <h1>My Tickets</h1>
      </div>

      {/* Filters */}
      <div className="jobs-filters">
        <div className="filter-card">
          <div className="filter-item">
            <label>Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">All</option>
              <option value="Awaiting Landlord Approval">Awaiting Approval</option>
              <option value="New">New</option>
              <option value="In Review">In Review</option>
              <option value="Quoting">Quoting</option>
              <option value="Approved">Approved</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Completed">Completed</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
          <div className="filter-item">
            <label>Property</label>
            <select
              value={filterPropertyId}
              onChange={(e) => setFilterPropertyId(e.target.value)}
            >
              <option value="">All</option>
              {properties.map((p) => {
                const addr = [p.AddressLine1, p.City, p.Province]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <option key={p.PropertyID} value={p.PropertyID}>
                    {addr}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Current Tickets */}
      <div className="jobs-section">
        <div className="sub-title">
          <h2>Current Tickets</h2>
        </div>
        <div className="jobs-table-container">
          <div className="jobs-table-scroll">
            <table className="jobs-table">
              <thead>
                <tr>
                  <th>Ticket ID</th>
                  <th>Property</th>
                  <th>Issue</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentTickets.map((t) => (
                  <tr key={getTicketId(t)}>
                    <td>{getReference(t) || getTicketId(t)}</td>
                    <td>{t.propertyAddress || "-"}</td>
                    <td>{getDescription(t)}</td>
                    <td>{t.status}</td>
                    <td>
                      {/* Ticket-level approval when there are NO quotes but landlord approval is needed */}
                      {t.ticketNeedsLandlordApproval === true ? (
                        <>
                          <button
                            className="btn btn-approve"
                            onClick={() =>
                              approveTicket(getTicketId(t)).then(() =>
                                setTickets((prev) =>
                                  prev.map((tk) =>
                                    getTicketId(tk) === getTicketId(t)
                                      ? { ...tk, status: 'New', ticketNeedsLandlordApproval: false }
                                      : tk
                                  )
                                )
                              )
                            }
                          >
                            Approve
                          </button>
                          <button
                            className="btn btn-reject"
                            onClick={() => {
                              const reason = prompt('Reason for rejection (optional):', '');
                              rejectTicket(getTicketId(t), reason).then(() =>
                                setTickets((prev) =>
                                  prev.map((tk) =>
                                    getTicketId(tk) === getTicketId(t)
                                      ? { ...tk, status: 'Rejected', ticketNeedsLandlordApproval: false }
                                      : tk
                                  )
                                )
                              );
                            }}
                          >
                            Reject
                          </button>
                        </>
                      ) : t.quoteNeedsLandlordApproval === true && t.quote && t.quote.status === 'Pending' ? (
                        /* Quote-level approval when there IS a pending quote */
                        <>
                          <button
                            className="btn btn-view"
                            onClick={() => handleViewQuote(t.quote.id)}
                          >
                            View
                          </button>
                          <button
                            className="btn btn-approve"
                            onClick={() =>
                              approveQuote(t.quote.id).then(() =>
                                setTickets((prev) =>
                                  prev.map((tk) =>
                                    getTicketId(tk) === getTicketId(t)
                                      ? { ...tk, quote: { ...tk.quote, status: 'Approved' }, status: 'Approved' }
                                      : tk
                                  )
                                )
                              )
                            }
                          >
                            Approve
                          </button>
                          <button
                            className="btn btn-reject"
                            onClick={() =>
                              rejectQuote(t.quote.id).then(() =>
                                setTickets((prev) =>
                                  prev.map((tk) =>
                                    getTicketId(tk) === getTicketId(t)
                                      ? { ...tk, quote: { ...tk.quote, status: 'Rejected' }, status: 'In Review' }
                                      : tk
                                  )
                                )
                              )
                            }
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <span style={{ color: '#666' }}>-</span>
                      )}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="jobs-section" style={{ marginTop: 40 }}>
        <div className="sub-title">
          <h2>Ticket History</h2>
        </div>
        <div className="jobs-table-container">
          <div className="jobs-table-scroll">
            <table className="jobs-table">
              <thead>
                <tr>
                  <th>Ticket ID</th>
                  <th>Property</th>
                  <th>Issue</th>
                  <th>Status</th>
                  <th>Quote</th>
                </tr>
              </thead>
              <tbody>
                {historyTickets.map((t) => (
                  <tr key={getTicketId(t)}>
                    <td>{getReference(t) || getTicketId(t)}</td>
                    <td>{t.propertyAddress || "-"}</td>
                    <td>{getDescription(t)}</td>
                    <td>{t.status}</td>
                    <td>
                      {t.quote
                        ? `${t.quote.status} (R${t.quote.amount || 0})`
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
