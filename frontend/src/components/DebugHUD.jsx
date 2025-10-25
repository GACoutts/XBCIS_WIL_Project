import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/auth';

export default function DebugHUD() {

  const { user, initializing, reload, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [shown, setShown] = useState(true);

  const doRefreshToken = async () => {
    setBusy(true);
    setMsg('');
    try {
      await authApi.refresh();   // rotates refresh + issues new access cookie
      await reload();            // re-fetch /me to reflect any changes
      setMsg('Session refreshed');
    } catch (e) {
      setMsg(e?.message || 'Refresh failed');
    } finally {
      setBusy(false);
    }
  };

if (!shown) {
    return null;
  }

  const doReloadMe = async () => {
    setBusy(true);
    setMsg('');
    try {
      await reload();
      setMsg('Reloaded /me');
    } catch (e) {
      setMsg(e?.message || 'Reload failed');
    } finally {
      setBusy(false);
    }
  };

  const doLogout = async () => {
    setBusy(true);
    setMsg('');
    try {
      await logout();
      setMsg('Logged out');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 12,
        right: 12,
        zIndex: 9999,
        background: '#111827',
        color: 'white',
        padding: '10px 12px',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        fontSize: 12,
        lineHeight: 1.4,
        maxWidth: 360,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Debug HUD</div>
      <div>
        <div><strong>init:</strong> {String(initializing)}</div>
        <div><strong>user:</strong> {user ? `${user.fullName} (${user.role})` : 'null'}</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <button
          onClick={doRefreshToken}
          disabled={busy}
          style={{ padding: '4px 8px', borderRadius: 6, background: '#2563eb', color: 'white', border: 'none' }}
        >
          Refresh token
        </button>
        <button
          onClick={doReloadMe}
          disabled={busy}
          style={{ padding: '4px 8px', borderRadius: 6, background: '#10b981', color: 'white', border: 'none' }}
        >
          Reload /me
        </button>
        <Link
          to="/sessions"
          style={{ padding: '4px 8px', borderRadius: 6, background: '#6b7280', color: 'white', textDecoration: 'none' }}
        >
          Sessions
        </Link>
        <button
          onClick={doLogout}
          disabled={busy}
          style={{ padding: '4px 8px', borderRadius: 6, background: '#ef4444', color: 'white', border: 'none' }}
        >
          Logout
        </button>
        <button
          onClick={() => setShown(false)}
          disabled={busy}
          style={{ padding: '4px 8px', borderRadius: 6, background: '#6b7280', color: 'white', border: 'none' }}
        >
          Hide
        </button>
      </div>

      {msg && <div style={{ marginTop: 6, opacity: 0.9 }}>{msg}</div>}
    </div>
  );
}
