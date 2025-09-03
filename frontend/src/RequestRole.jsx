import React, { useState } from 'react';

const API = 'http://localhost:5000/api';

export default function RequestRole() {
  const [requestedRole, setRequestedRole] = useState('Landlord');
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setMsg(''); setErr('');
    try {
      const res = await fetch(`${API}/roles/request`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requestedRole, notes })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to submit request');
      setMsg(data.message || 'Request submitted.');
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '24px auto', padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
      <h2>Request a Role Upgrade</h2>
      <p>Choose the role you want. Staff will review and approve/deny.</p>
      {msg && <div style={{ color: 'green', marginBottom: 8 }}>{msg}</div>}
      {err && <div style={{ color: 'red', marginBottom: 8 }}>{err}</div>}

      <form onSubmit={submit}>
        <label>Requested role</label>
        <select value={requestedRole} onChange={e => setRequestedRole(e.target.value)} required>
          <option value="Landlord">Landlord</option>
          <option value="Contractor">Contractor</option>
          <option value="Staff">Staff</option>
        </select>

        <label style={{ display: 'block', marginTop: 12 }}>Notes (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ width: '100%' }} />

        <button type="submit" style={{ marginTop: 12 }}>Submit request</button>
      </form>
    </div>
  );
}
