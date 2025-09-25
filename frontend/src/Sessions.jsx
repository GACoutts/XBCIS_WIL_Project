import React, { useEffect, useState } from 'react';
import { useAuth } from './context/AuthContext';

export default function Sessions() {
  const { listSessions, revokeSession, revokeAll } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const data = await listSessions();
      setRows(data.sessions || []);
    } catch (e) {
      setErr(e.message || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const onRevoke = async (id) => {
    try {
      await revokeSession(id);
      await load();
    } catch (e) {
      alert(e.message || 'Failed to revoke session');
    }
  };

  const onRevokeAll = async () => {
    if (!confirm('Revoke ALL sessions? This will log you out everywhere.')) return;
    try {
      await revokeAll();
      await load();
    } catch (e) {
      alert(e.message || 'Failed to revoke all');
    }
  };

  if (loading) return <div className="p-4">Loading…</div>;
  if (err) return <div className="p-4 text-red-600">{err}</div>;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Active Sessions</h2>
        <button className="bg-red-600 text-white px-3 py-1 rounded" onClick={onRevokeAll}>
          Revoke All
        </button>
      </div>
      {rows.length === 0 ? (
        <div>No sessions.</div>
      ) : (
        <table className="min-w-full border">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 text-left">TokenID</th>
              <th className="p-2 text-left">Family</th>
              <th className="p-2 text-left">Issued</th>
              <th className="p-2 text-left">Expires</th>
              <th className="p-2 text-left">UserAgent</th>
              <th className="p-2 text-left">IP</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.tokenId} className="border-t">
                <td className="p-2">{r.tokenId}</td>
                <td className="p-2">{r.familyId}</td>
                <td className="p-2">{new Date(r.issuedAt).toLocaleString()}</td>
                <td className="p-2">{new Date(r.expiresAt).toLocaleString()}</td>
                <td className="p-2">{r.userAgent}</td>
                <td className="p-2">{r.ip}</td>
                <td className="p-2">
                  {r.revokedAt ? 'Revoked' : r.isCurrent ? 'Current' : 'Active'}
                </td>
                <td className="p-2 text-right">
                  {!r.revokedAt && (
                    <button className="bg-gray-800 text-white px-3 py-1 rounded" onClick={() => onRevoke(r.tokenId)}>
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
