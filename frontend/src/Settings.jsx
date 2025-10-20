import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';

/**
 * Settings page
 *
 * A generic settings page that allows any authenticated user to view and
 * update basic profile details such as their full name and phone number.
 * It retrieves the current user's profile via the `/api/profile/me` API
 * endpoint and submits updates via `PUT /api/profile/me`.  Email and
 * password changes are out of scope for this page.  The navigation menu
 * adapts based on the user's role to link back to the appropriate
 * dashboard and other sections.
 */
export default function Settings() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState({ fullName: '', email: '', phone: '', role: '' });
  const [showLogout, setShowLogout] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '' });
  const [saving, setSaving] = useState(false);

  // Load current profile on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/profile/me', { credentials: 'include' });
        const data = await res.json();
        if (data.success) {
          setProfile(data.data);
          setForm({ fullName: data.data.fullName || '', phone: data.data.phone || '' });
        }
      } catch (err) {
        console.error('Error fetching profile', err);
      }
    })();
  }, []);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.fullName && !form.phone) {
      alert('Nothing to update');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/profile/me', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.success) {
        setProfile(data.data);
        alert('Profile updated successfully');
      } else {
        alert(data.message || 'Failed to update profile');
      }
    } catch (err) {
      console.error('Profile update error', err);
      alert('An error occurred while updating your profile');
    } finally {
      setSaving(false);
    }
  };

  const role = user?.role;

  // Build navigation based on role
  const navLinks = [];
  if (role === 'Landlord') {
    navLinks.push({ to: '/landlord', label: 'Dashboard' });
    navLinks.push({ to: '/landlord/tickets', label: 'Tickets' });
    navLinks.push({ to: '/landlord/properties', label: 'Properties' });
    navLinks.push({ to: '/landlord/settings', label: 'Settings' });
  } else if (role === 'Staff') {
    navLinks.push({ to: '/staff', label: 'Dashboard' });
    navLinks.push({ to: '/tickets', label: 'Tickets' });
    navLinks.push({ to: '/contractors', label: 'Contractors' });
    navLinks.push({ to: '/settings', label: 'Settings' });
  } else if (role === 'Contractor') {
    navLinks.push({ to: '/contractor', label: 'Dashboard' });
    navLinks.push({ to: '/contractor/settings', label: 'Settings' });
  } else {
    // Default (Client)
    navLinks.push({ to: '/client', label: 'Dashboard' });
    navLinks.push({ to: '/ticket', label: 'Create Ticket' });
    navLinks.push({ to: '/settings', label: 'Settings' });
  }

  return (
    <>
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-logo">
          <div className="logo-placeholder">GoodLiving</div>
        </div>
        <div className="navbar-right">
          <ul className="navbar-menu">
            {navLinks.map((lnk) => (
              <li key={lnk.to}>
                <Link to={lnk.to} className={lnk.to.endsWith('/settings') ? 'active' : ''}>{lnk.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="navbar-profile">
          <button className="profile-btn" onClick={() => setShowLogout(!showLogout)}>
            <img src="https://placehold.co/40" alt="profile" />
          </button>
          {showLogout && (
            <div className="logout-popup">
              <button
                onClick={async () => {
                  await logout();
                  window.location.reload();
                }}
              >
                Log Out
              </button>
            </div>
          )}
        </div>
      </nav>

      <div style={{ padding: '80px 90px' }}>
        <h1 style={{ marginBottom: '20px' }}>Account Settings</h1>
        <div style={{ maxWidth: 500 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Full Name</label>
          <input
            type="text"
            value={form.fullName}
            onChange={(e) => handleChange('fullName', e.target.value)}
            style={{ width: '100%', padding: '6px 8px', marginBottom: '12px', border: '1px solid #FBD402', borderRadius: 4 }}
          />
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            style={{ width: '100%', padding: '6px 8px', marginBottom: '12px', border: '1px solid #FBD402', borderRadius: 4 }}
          />
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ backgroundColor: '#FBD402', border: 'none', borderRadius: 5, padding: '8px 16px', fontWeight: 600, cursor: 'pointer' }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  );
}