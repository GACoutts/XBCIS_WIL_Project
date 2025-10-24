// StaffContractors.jsx
import React, { useEffect, useMemo, useState } from 'react';
import RoleNavbar from './components/RoleNavbar.jsx';
import { useAuth } from './context/AuthContext.jsx';
import './styles/userdash.css';
import './styles/staffdash.css';

export default function StaffContractors() {
  const { logout } = useAuth();

  const [contractors, setContractors] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContractor, setNewContractor] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: ''
  });

  // Filters (dashboard-style)
  const [filterStatus, setFilterStatus] = useState(''); // All | Active | Suspended
  const [query, setQuery] = useState('');               // name/email contains

  useEffect(() => {
    fetchContractors();
  }, []);

  const fetchContractors = async () => {
    try {
      // Using your existing endpoint (active). If backend returns Status, filters will work client-side.
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

  // ===== Filters + sorting to mirror dashboard feel =====
  const filteredContractors = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contractors
      .filter(c => !filterStatus || (c.Status || 'Active') === filterStatus)
      .filter(c => {
        if (!q) return true;
        const name = (c.FullName || '').toLowerCase();
        const email = (c.Email || '').toLowerCase();
        return name.includes(q) || email.includes(q);
      })
      .sort((a, b) => (a.FullName || '').localeCompare(b.FullName || ''));
  }, [contractors, filterStatus, query]);

  const clearFilters = () => {
    setFilterStatus('');
    setQuery('');
  };

  return (
    <>
      <RoleNavbar />

      <div className="staffdashboard-title"><h1>Contractors</h1></div>
      <div className="sub-title"><h2>Contractor Management</h2></div>

      {/* Filters (dashboard-style card) */}
      <div className="jobs-filters">
        <div className="filter-card">
          <div className="filter-item">
            <label htmlFor="contractor-status">Status</label>
            <select
              id="contractor-status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">All</option>
              <option value="Active">Active</option>
              <option value="Suspended">Suspended</option>
            </select>
          </div>

          <div className="filter-item" style={{ minWidth: 240 }}>
            <label htmlFor="contractor-search">Search (name/email)</label>
            <input
              id="contractor-search"
              type="text"
              placeholder="e.g. Jane Doe or jane@email.com"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <button className="filter-reset" type="button" onClick={clearFilters}>
            Reset
          </button>

          {/* Add contractor aligned with filters for the same “block” feel */}
          <button
            className="action-btn"
            type="button"
            onClick={() => setShowAddModal(true)}
            style={{ marginLeft: '8px' }}
          >
            Add Contractor
          </button>
        </div>
      </div>

      {/* Table block (same container + scroll) */}
      <div className="jobs-section">
        {filteredContractors.length === 0 ? (
          <div className="empty-tickets">No contractors found</div>
        ) : (
          <div className="jobs-table-container">
            <div className="jobs-table-scroll">
              <table className="jobs-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th className="actions-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContractors.map((c) => (
                    <tr key={c.UserID}>
                      <td>{c.FullName || '-'}</td>
                      <td>{c.Email || '-'}</td>
                      <td>{c.Phone ?? c.phone ?? c.Mobile ?? c.mobile ?? c.ContactNumber ?? c.contactNumber ?? '-'}</td>
                      <td>{c.Status || 'Active'}</td>
                      <td className="actions-col">
                        <div className="action-buttons">
                          <button
                            className="action-btn"
                            onClick={() => handleRemoveContractor(c.UserID)}
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add Contractor Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Add Contractor</h2>
            <div className="modal-content">
              <label>Full Name:</label>
              <input
                type="text"
                value={newContractor.fullName}
                onChange={(e) => handleNewContractorChange('fullName', e.target.value)}
              />
              <label>Email:</label>
              <input
                type="email"
                value={newContractor.email}
                onChange={(e) => handleNewContractorChange('email', e.target.value)}
              />
              <label>Phone:</label>
              <input
                type="tel"
                value={newContractor.phone}
                onChange={(e) => handleNewContractorChange('phone', e.target.value)}
              />
              <label>Password:</label>
              <input
                type="password"
                value={newContractor.password}
                onChange={(e) => handleNewContractorChange('password', e.target.value)}
              />
              <div className="modal-buttons">
                <button onClick={handleAddContractor}>Add</button>
                <button onClick={() => setShowAddModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="page-bottom-spacer" />
    </>
  );
}
