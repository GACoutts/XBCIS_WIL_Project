import React, { useEffect, useState } from 'react';
const API = 'http://localhost:5000/api';

const testUsers = [
  {
    userId: '1',
    fullName: 'John Doe',
    email: 'john.doe@example.com',
    role: 'Client',
  },
  {
    userId: '2',
    fullName: 'Jane Smith',
    email: 'jane.smith@example.com',
    role: 'Landlord',
  },
  {
    userId: '3',
    fullName: 'Mike Johnson',
    email: 'mike.johnson@example.com',
    role: 'Contractor',
  },
  {
    userId: '4',
    fullName: 'Sarah Lee',
    email: 'sarah.lee@example.com',
    role: 'Staff',
  },
  {
    userId: '5',
    fullName: 'Emily Brown',
    email: 'emily.brown@example.com',
    role: 'Client',
  },
];


export default function ManageRoles() {
  const [users, setUsers] = useState(testUsers);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState('');

  async function load() {
    setErr('');
    const res = await fetch(`${API}/admin/users`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) { setErr(data?.message || 'Failed to load'); return; }
    setUsers(data.users);
  }
  //useEffect(() => { load(); }, []);

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
    <div className="admin-card">
      <div className="admin-card-header">
      <h3>Manage User Roles (Direct)</h3>
      {err && <div className="error-msg">{err}</div>}
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th><th>Email</th><th>Role</th>
          </tr>
        </thead>
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
