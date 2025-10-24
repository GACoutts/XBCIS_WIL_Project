import React, { useEffect, useState } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import RoleNavbar from './components/RoleNavbar.jsx';
import './styles/userdash.css';

export default function Settings() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState({ fullName: '', email: '', phone: '', role: '', whatsappOptIn: false });
  const [form, setForm] = useState({ fullName: '', phone: '', whatsappOptIn: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/profile/me', { credentials: 'include' });
        const data = await res.json();
        if (data.success) {
          setProfile(data.data);
          setForm({
            fullName: data.data.fullName || '',
            phone: data.data.phone || '',
            whatsappOptIn: Boolean(data.data.whatsappOptIn),
          });
        }
      } catch (err) {
        console.error('Error fetching profile', err);
      }
    })();
  }, []);

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.fullName && !form.phone && typeof form.whatsappOptIn === 'undefined') {
      alert('Nothing to update');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/profile/me', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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

  return (
    <div className="dashboard-page">
      <RoleNavbar />

      <div className="content" style={{ padding: '24px 90px' }}>
        <h1 style={{ margin: '16px 0 20px' }}>Account Settings</h1>
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
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <input
              id="whatsapp-optin"
              type="checkbox"
              checked={form.whatsappOptIn || false}
              onChange={(e) => handleChange('whatsappOptIn', e.target.checked)}
              style={{ marginRight: '8px' }}
            />
            <label htmlFor="whatsapp-optin" style={{ fontWeight: 600 }}>Opt into WhatsApp notifications</label>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ backgroundColor: '#FBD402', border: 'none', borderRadius: 5, padding: '8px 16px', fontWeight: 600, cursor: 'pointer' }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
