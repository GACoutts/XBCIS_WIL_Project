import React, { useEffect, useState } from 'react';
const API = 'http://localhost:5000/api';

export default function ReviewRoleRequests() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState('');

  // Load inactive users from backend
  async function loadInactiveUsers() {
    setErr('');
    try {
      const res = await fetch(`${API}/admin/inactive-users`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { setErr(data?.message || 'Failed to load'); return; }
      setItems(data.users);
    } catch (e) {
      setErr('Failed to load');
    }
  }

  useEffect(() => { loadInactiveUsers(); }, []);

  // Accept: set status to Active
  async function handleAccept(userId) {
    setErr('');
    try {
      const res = await fetch(`${API}/admin/users/${userId}/status`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Active' })
      });
      const data = await res.json();
      if (!res.ok) { setErr(data?.message || 'Failed'); return; }
      await loadInactiveUsers();
    } catch (e) {
      setErr('Failed');
    }
  }

  // Reject: set status to Rejected
  async function handleReject(userId) {
    setErr('');
    try {
      const res = await fetch(`${API}/admin/users/${userId}/status`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Rejected' })
      });
      const data = await res.json();
      if (!res.ok) { setErr(data?.message || 'Failed'); return; }
      await loadInactiveUsers();
    } catch (e) {
      setErr('Failed');
    }
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
            <th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map(u => (
            <tr key={u.UserID}>
              <td>{u.FullName}</td>
              <td>{u.Email}</td>
              <td>{u.Role}</td>
              <td>{u.Status}</td>
              <td>
                <button className="admin-btn" onClick={() => handleAccept(u.UserID)}>Accept</button>
                <button className="admin-btn" onClick={() => handleReject(u.UserID)}>Reject</button>
              </td>
            </tr>
          ))}
          {!items.length && (
            <tr>
              <td colSpan={5} style={{ padding: 12 }}>No pending requests.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
