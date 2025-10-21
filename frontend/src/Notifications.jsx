import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Notifications page
 * Shows the authenticated user's recent notifications.
 */
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
          setNotifications(data.notifications || []);
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
      {/* Basic navbar with a back link */}
      <nav className="navbar">
        <div className="navbar-logo">
          <div className="logo-placeholder">GoodLiving</div>
        </div>
        <div className="navbar-right">
          <ul className="navbar-menu">
            <li><Link to="/">Dashboard</Link></li>
            <li><Link to="/notifications">Notifications</Link></li>
          </ul>
        </div>
      </nav>

      <div className="content" style={{ padding: '20px' }}>
        <h1>Notifications</h1>
        {loading ? (
          <p>Loading notifications...</p>
        ) : error ? (
          <p style={{ color: 'red' }}>{error}</p>
        ) : notifications.length === 0 ? (
          <p>No notifications found.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {notifications.map(notif => {
              const ts = notif.SentAt || notif.LastAttemptAt || notif.CreatedAt || Date.now();
              return (
                <li key={notif.NotificationID} style={{ marginBottom: '15px', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
                  <div style={{ fontSize: '14px', marginBottom: '5px', color: '#555' }}>
                    {new Date(ts).toLocaleString()}
                  </div>
                  <div style={{ whiteSpace: 'pre-line' }}>{notif.NotificationContent}</div>
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
