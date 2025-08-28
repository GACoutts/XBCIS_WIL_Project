import React, { useEffect, useState } from 'react';
const API = 'http://localhost:5000/api';

export default function ReviewRoleRequests() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState('');

  async function load(status = 'Pending') {
    setErr('');
    const res = await fetch(`${API}/admin/role-requests?status=${encodeURIComponent(status)}`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) { setErr(data?.message || 'Failed to load'); return; }
    setItems(data.requests);
  }
  useEffect(() => { load('Pending'); }, []);

  async function decide(id, action) {
    setErr('');
    const url = `${API}/admin/role-requests/${id}/${action}`;
    const res = await fetch(url, { method: 'POST', credentials: 'include' });
    const data = await res.json();
    if (!res.ok) { setErr(data?.message || 'Failed'); return; }
    await load('Pending');
  }

  return (
    <div style={{ marginTop: 24 }}>
      <h3>Pending Role Requests</h3>
      {err && <div style={{ color: 'red' }}>{err}</div>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr><th align="left">User</th><th align="left">Email</th><th>Current</th><th>Requested</th><th>Notes</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {items.map(r => (
            <tr key={r.RequestID}>
              <td>{r.FullName}</td>
              <td>{r.Email}</td>
              <td align="center">{r.CurrentRole}</td>
              <td align="center">{r.RequestedRole}</td>
              <td>{r.Notes || ''}</td>
              <td>
                <button onClick={() => decide(r.RequestID, 'approve')}>Approve</button>
                <button onClick={() => decide(r.RequestID, 'reject')} style={{ marginLeft: 8 }}>Reject</button>
              </td>
            </tr>
          ))}
          {!items.length && <tr><td colSpan={6} style={{ padding: 12 }}>No pending requests.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
