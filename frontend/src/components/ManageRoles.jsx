import React, { useEffect, useState } from 'react';
const API = 'http://localhost:5000/api';

export default function ManageRoles() {
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState('');

  async function load() {
    setErr('');
    const res = await fetch(`${API}/admin/users`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) { setErr(data?.message || 'Failed to load'); return; }
    setUsers(data.users);
  }
  useEffect(() => { load(); }, []);

  async function setRole(userId, role) {
    setBusy(userId); setErr('');
    const res = await fetch(`${API}/admin/users/${userId}/role`, {
      method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role })
    });
    const data = await res.json();
    if (!res.ok) setErr(data?.message || 'Failed to update');
    await load();
    setBusy(null);
  }

  const roles = ['Client','Landlord','Contractor','Staff'];

  return (
    <div style={{ marginTop: 16 }}>
      <h3>Manage User Roles (Direct)</h3>
      {err && <div style={{ color: 'red' }}>{err}</div>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th align="left">Name</th><th align="left">Email</th><th>Role</th></tr></thead>
        <tbody>
          {users.map(u => (
            <tr key={u.userId}>
              <td>{u.fullName}</td>
              <td>{u.email}</td>
              <td>
                <select value={u.role} disabled={busy===u.userId} onChange={e => setRole(u.userId, e.target.value)}>
                  {roles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
