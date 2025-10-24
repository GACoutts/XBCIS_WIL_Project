import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/auth';

export default function DebugHUD() {

  const { user, initializing, reload, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

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
      {msg && <div style={{ marginTop: 6, opacity: 0.9 }}>{msg}</div>}
    </div>
  );
}
