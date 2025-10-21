import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import './styles/staffdash.css';

/*
 * StaffContractors
 *
 * This component encapsulates the contractor management functionality
 * previously embedded on the staff dashboard.  Staff can view active
 * contractors, add new ones, and remove existing contractors.  All
 * actions are performed via the admin API endpoints.  The table is
 * scrollable and includes a modal for adding contractors.  A
 * dedicated page makes contractor administration easier to find and
 * keeps the dashboard focused on ticket information.
 */
export default function StaffContractors() {
  const { logout } = useAuth();

  const [contractors, setContractors] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContractor, setNewContractor] = useState({ fullName: '', email: '', phone: '', password: '' });

  // Load active contractors on mount
  useEffect(() => {
    fetchContractors();
  }, []);

  const fetchContractors = async () => {
    try {
      const res = await fetch('/api/admin/contractors/active', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setContractors(data.contractors || []);
      else setContractors([]);
    } catch (err) {
      console.error('Failed to load contractors', err);
      setContractors([]);
    }
  };

  const reloadContractors = async () => {
    await fetchContractors();
  };

  // Remove contractor by suspending their account
  const handleRemoveContractor = async (userId) => {
    if (!window.confirm('Are you sure you want to remove this contractor?')) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Suspended' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to remove contractor');
      await reloadContractors();
      alert('Contractor removed');
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error removing contractor');
    }
  };

  // Register and activate a new contractor
  const handleAddContractor = async () => {
    const { fullName, email, phone, password } = newContractor;
    if (!fullName || !email || !password) {
      alert('Full name, email and password are required');
      return;
    }
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password, phone, role: 'Contractor' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to register contractor');
      const userId = data.user?.userId || data.userId || data.UserID;
      if (userId) {
        try {
          await fetch(`/api/admin/users/${userId}/status`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Active' })
          });
        } catch (e) {
          console.warn('Could not activate new contractor', e);
        }
      }
      setShowAddModal(false);
      setNewContractor({ fullName: '', email: '', phone: '', password: '' });
      await reloadContractors();
      alert('Contractor added successfully');
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error adding contractor');
    }
  };

  const handleNewContractorChange = (field, value) => {
    setNewContractor((prev) => ({ ...prev, [field]: value }));
  };

  const handleLogout = async () => {
    await logout();
    window.location.reload();
  };

  return (
    <>
      <nav className="navbar">
        <div className="navbar-logo"><div className="logo-placeholder">GoodLiving</div></div>
        <div className="navbar-right">
          <ul className="navbar-menu">
            <li><Link to="/staff">Dashboard</Link></li>
            <li><Link to="/tickets">Tickets</Link></li>
            <li><Link to="/quotes">Quotes</Link></li>
            <li><Link to="/contractors">Contractors</Link></li>
            <li><Link to="/notifications">Notifications</Link></li>
            <li><Link to="/settings">Settings</Link></li>
          </ul>
        </div>
        <div className="navbar-profile">
          <button className="profile-btn" onClick={() => handleLogout()}>
            <img src="https://placehold.co/40" alt="profile" />
          </button>
        </div>
      </nav>

      <div className="staffdashboard-title"><h1>Contractors</h1></div>

      <div className="sub-titles-container">
        <div className="sub-title"><h2>Contractor Management</h2></div>
        {/* Add contractor button placed beneath the heading to keep it outside of the table */}
        <button className="action-btn" onClick={() => setShowAddModal(true)}>Add Contractor</button>
      </div>

      <div className="contractor-table">
        <div className="contractor-container">
          <div className="table-header">
            <div className="header-content">
              <div className="contractor-header-grid">
                <div className="header-item">Name</div>
                <div className="header-item">Email</div>
                <div className="header-item">Status</div>
                <div className="header-item">Actions</div>
              </div>
            </div>
            {/* The add button has been moved above the table in the sub titles section */}
          </div>

          {contractors.length > 0 ? (
            contractors.map((c) => (
              <div key={c.UserID} className="contractor-card">
                <div className="contractor-layout">
                  <div className="contractor-content">
                    <div className="contractor-info-grid">
                      <div className="info-item"><div className="info-value">{c.FullName}</div></div>
                      <div className="info-item"><div className="info-value">{c.Email}</div></div>
                      <div className="info-item"><div className="info-value">{c.Status || 'Active'}</div></div>
                      {/* Actions cell contains the remove button */}
                      <div className="info-item">
                        <div className="info-value">
                          <button className="action-btn" onClick={() => handleRemoveContractor(c.UserID)}>Remove</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="empty-state">No contractors found</p>
          )}
        </div>
      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Add Contractor</h2>
            <div className="modal-content">
              <label>Full Name:</label>
              <input type="text" value={newContractor.fullName} onChange={(e) => handleNewContractorChange('fullName', e.target.value)} />
              <label>Email:</label>
              <input type="email" value={newContractor.email} onChange={(e) => handleNewContractorChange('email', e.target.value)} />
              <label>Phone:</label>
              <input type="tel" value={newContractor.phone} onChange={(e) => handleNewContractorChange('phone', e.target.value)} />
              <label>Password:</label>
              <input type="password" value={newContractor.password} onChange={(e) => handleNewContractorChange('password', e.target.value)} />
              <div className="modal-buttons">
                <button onClick={handleAddContractor}>Add</button>
                <button onClick={() => setShowAddModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="page-bottom-spacer"></div>
    </>
  );
}