import React, { useState } from 'react';
import './styles/requestrole.css';

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
      setMsg(data.message || 'Request submitted');
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className="request-role-page-container">
      {msg && <div className="msg">{msg}</div>}
      {err && <div className="err">{err}</div>}
    <div className="admin-card">
      <h2>Request a Role Upgrade</h2>
      <hr className="underline" />
      <p>Choose the role you want. Staff will review and approve/deny.</p>

      <form onSubmit={submit}>
        <label>Requested role</label>
        <select
          value={requestedRole}
          onChange={e => setRequestedRole(e.target.value)}
          required
        >
          <option value="Landlord">Landlord</option>
          <option value="Contractor">Contractor</option>
          <option value="Staff">Staff</option>
        </select>

        <label>Notes (optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
        />
      <div className="submit-container">
        <button type="submit" className="admin-btn">
          Submit request
        </button>
      </div>
      </form>
    </div>
    </div>
  );
}
