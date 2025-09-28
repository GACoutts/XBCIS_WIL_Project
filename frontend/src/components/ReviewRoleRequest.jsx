import React, { useEffect, useState } from 'react';

const API = 'http://localhost:5000/api';

export default function ReviewRoleRequests() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState('');
  const [toast, setToast] = useState('');

  // Load inactive users from backend
  async function loadInactiveUsers() {
    setErr('');
    try {
      const res = await fetch(`${API}/admin/inactive-users`, { credentials: 'include' });
      const data = await res.json();

      if (!res.ok) {
        setErr(data?.message || 'Failed to load users');
        return;
      }

      setItems(data.users);
    } catch (e) {
      console.error('Load inactive users error:', e);
      setErr('Failed to load users');
    }
  }

  useEffect(() => {
    loadInactiveUsers();
  }, []);

  // Show toast message
  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(''), 3000); // hide after 3s
  }

  // Accept user - set status to Active
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

      if (!res.ok) throw new Error(data?.message || 'Failed to accept user');

      await loadInactiveUsers(); // Refresh table
      showToast(`Accepted ${data.user.fullName}`);
    } catch (e) {
      console.error('Accept user error:', e);
      setErr(e.message || 'Failed to accept user');
    }
  }

  // Reject user - set status to Rejected
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

      if (!res.ok) throw new Error(data?.message || 'Failed to reject user');

      await loadInactiveUsers(); // Refresh table
      showToast(`Rejected ${data.user.fullName}`);
    } catch (e) {
      console.error('Reject user error:', e);
      setErr(e.message || 'Failed to reject user');
    }
  }

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <h3>Pending Role Requests</h3>
        {err && <div className="error-msg">{err}</div>}
      </div>

      {toast && <div className="toast-msg">{toast}</div>}

      <table className="review-roles-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>User</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.length > 0 ? (
            items.map(u => (
              <tr key={u.UserID}>
                <td>{u.UserID}</td>
                <td>{u.FullName}</td>
                <td>{u.Email}</td>
                <td>{u.Role}</td>
                <td>{u.Status}</td>
                <td>
                  <button className="admin-btn" onClick={() => handleAccept(u.UserID)}>Accept</button>
                  <button className="admin-btn" onClick={() => handleReject(u.UserID)}>Reject</button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} style={{ padding: 12 }}>No pending requests.</td>
            </tr>
          )}
        </tbody>
      </table>

      <style jsx>{`
  .toast-msg {
    position: fixed;
    top: 80px;           /* push below nav bar */
    left: 50%;           
    transform: translateX(-50%); 
    background: #4caf50;
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    z-index: 2000;       /* higher than nav */
    animation: fadein 0.3s, fadeout 0.3s 2.7s;
  }

  @keyframes fadein {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeout {
    from { opacity: 1; transform: translateY(0); }
    to { opacity: 0; transform: translateY(-10px); }
  }
`}</style>

    </div>
  );
}
