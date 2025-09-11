import React, { useEffect, useState } from 'react';
const API = 'http://localhost:5000/api';

const testItems = [
  {
    RequestID: '1',
    FullName: 'John Doe',
    Email: 'john.doe@example.com',
    CurrentRole: 'Client',
    RequestedRole: 'Landlord',
    Notes: 'Needs property management access.',
  },
  {
    RequestID: '2',
    FullName: 'Jane Smith',
    Email: 'jane.smith@example.com',
    CurrentRole: 'Contractor',
    RequestedRole: 'Staff',
    Notes: 'Request for admin privileges.',
  },
  {
    RequestID: '3',
    FullName: 'Mike Johnson',
    Email: 'mike.johnson@example.com',
    CurrentRole: 'Client',
    RequestedRole: 'Contractor',
    Notes: '',
  },
  {
    RequestID: '4',
    FullName: 'Sarah Lee',
    Email: 'sarah.lee@example.com',
    CurrentRole: 'Staff',
    RequestedRole: 'Landlord',
    Notes: 'Long note about needing multi-role access for testing purposes.',
  },
  {
    RequestID: '5',
    FullName: 'Emily Brown',
    Email: 'emily.brown@example.com',
    CurrentRole: 'Landlord',
    RequestedRole: 'Client',
    Notes: 'Temporary role change requested.',
  },
];

export default function ReviewRoleRequests({ newTickets = [] }) {
  const [items, setItems] = useState(testItems);
  const [err, setErr] = useState('');

  async function load(status = 'Pending') {
    setErr('');
    const res = await fetch(`${API}/admin/role-requests?status=${encodeURIComponent(status)}`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) { setErr(data?.message || 'Failed to load'); return; }
    setItems(data.requests);
  }
  //useEffect(() => { load('Pending'); }, []);

  async function decide(id, action) {
    setErr('');
    const url = `${API}/admin/role-requests/${id}/${action}`;
    const res = await fetch(url, { method: 'POST', credentials: 'include' });
    const data = await res.json();
    if (!res.ok) { setErr(data?.message || 'Failed'); return; }
    await load('Pending');
  }

  // Accept/Reject for tickets
  async function handleTicketAction(ticketId, action) {
    // TODO: Implement backend call for ticket approval/rejection if needed
    alert(`Ticket ${ticketId} ${action}ed`);
  }

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <h3>Pending Role Requests</h3>
        {err && <div className="error-msg">{err}</div>}
      </div>
      <table className="review-roles-table">
        <thead>
          <tr>
            <th>User</th><th>Email</th><th>Current</th>
            <th>Requested</th><th>Notes</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {/* Role Requests */}
          {items.map(r => (
            <tr key={`role-${r.RequestID}`}>
              <td>{r.FullName}</td>
              <td>{r.Email}</td>
              <td>{r.CurrentRole}</td>
              <td>{r.RequestedRole}</td>
              <td>{r.Notes || ''}</td>
              <td>
                <button className="admin-btn" onClick={() => decide(r.RequestID, 'approve')}>Approve</button>
                <button className="admin-btn" onClick={() => decide(r.RequestID, 'reject')}>Reject</button>
              </td>
            </tr>
          ))}
          {/* New Tickets */}
          {newTickets.map(t => (
            <tr key={`ticket-${t.TicketID}`}>
              <td>{t.FullName || '-'}</td>
              <td>{t.Email || '-'}</td>
              <td>{t.CurrentRole || '-'}</td>
              <td>{"Ticket: " + (t.TicketRefNumber || t.TicketID)}</td>
              <td>{t.Description}</td>
              <td>
                <button className="admin-btn" onClick={() => handleTicketAction(t.TicketID, 'accept')}>Accept</button>
                <button className="admin-btn" onClick={() => handleTicketAction(t.TicketID, 'reject')}>Reject</button>
              </td>
            </tr>
          ))}
          {/* Empty State */}
          {!items.length && !newTickets.length && (
            <tr>
              <td colSpan={6} style={{ padding: 12 }}>No pending requests.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
