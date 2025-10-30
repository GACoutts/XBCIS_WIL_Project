import React, { useEffect, useState } from 'react';
import RoleNavbar from './components/RoleNavbar.jsx';
import './styles/userdash.css';

/** Notifications page */
function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const res = await fetch('/api/notifications', { credentials: 'include' });
        const data = await res.json();
        if (res.ok) {
          setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
        } else {
          setError(data?.message || 'Failed to load notifications');
        }
      } catch (err) {
        setError(err.message || 'Failed to load notifications');
      } finally {
        setLoading(false);
      }
    }
    fetchNotifications();
  }, []);

  return (
    <div className="dashboard-page">
      <RoleNavbar />

      <div className="content" style={{ padding: '20px 24px' }}>
        <h1>Notifications</h1>
        {loading ? (
          <p>Loading notifications...</p>
        ) : error ? (
          <p style={{ color: 'red' }}>{error}</p>
        ) : notifications.length === 0 ? (
          <p>No notifications found.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {notifications.map(n => {
              const ts = n.SentAt || n.LastAttemptAt || n.CreatedAt || Date.now();
              return (
                <li
                  key={n.NotificationID}
                  style={{
                    marginBottom: '15px',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: 11,
                        border: '1px solid #e0e0e0',
                        background: n.Status === 'Sent' ? '#111' : '#fff',
                        color: n.Status === 'Sent' ? '#fff' : '#555'
                      }}
                    >
                      {n.NotificationType}
                    </span>
                    <small style={{ color: '#666' }}>
                      {new Date(ts).toLocaleString()}
                    </small>
                  </div>
                  <div style={{ marginTop: 6, whiteSpace: 'pre-line' }}>{n.NotificationContent}</div>
                  {n.ErrorMessage && (
                    <div style={{ marginTop: 6, color: '#b00020', fontSize: 12 }}>
                      Error: {n.ErrorMessage}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default Notifications;
