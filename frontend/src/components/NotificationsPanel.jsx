import React, { useEffect, useState } from "react";
import './NotificationsPanel.css';

/**
 * Lightweight notifications panel (embed-able widget).
 * Loads the authenticated users notifications from /api/notifications.
 */
export default function NotificationsPanel() {
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadNotifications() {
      try {
        const res = await fetch("/api/notifications", { credentials: "include" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Failed to load notifications");
        setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      } catch (e) {
        setError(e.message || "Failed to load notifications");
      } finally {
        setLoading(false);
      }
    }
    loadNotifications();
  }, []);

  if (loading) return <div className="notifications-panel"><p>Loading notifications…</p></div>;
  if (error) return <div className="notifications-panel"><p style={{ color: "red" }}>{error}</p></div>;

  return (
    <div className="notifications-panel">
      {notifications.length === 0 ? (
        <p>No notifications.</p>
      ) : (
        notifications.map((n) => (
          <div key={n.NotificationID} className="notification-item">
            <h4>{n.Title || "Notification"}</h4>
            <p>{n.Body || n.NotificationContent}</p>
            <small>{new Date(n.SentAt || n.LastAttemptAt || n.CreatedAt || Date.now()).toLocaleString()}</small>
          </div>
        ))
      )}
    </div>
  );
}
