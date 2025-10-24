import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import '../styles/navbar.css';

/**
 * RoleNavbar
 *
 * Renders a navigation bar that adapts based on the authenticated user's role.
 * Sticky at the top, responsive (hamburger on small screens), and themed per role.
 */
export default function RoleNavbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const role = user?.role;

  const menuByRole = {
    Staff: [
      { to: '/staff', label: 'Dashboard' },
      { to: '/tickets', label: 'Tickets' },
      { to: '/contractors', label: 'Contractors' },
      { to: '/notifications', label: 'Notifications' },
      { to: '/settings', label: 'Settings' },
    ],
    Landlord: [
      { to: '/landlord', label: 'Dashboard' },
      { to: '/landlord/tickets', label: 'Tickets' },
      { to: '/landlord/properties', label: 'Properties' },
      { to: '/notifications', label: 'Notifications' },
      { to: '/settings', label: 'Settings' },
    ],
    Contractor: [
      { to: '/contractor', label: 'Dashboard' },
      { to: '/contractor/completed', label: 'Completed Jobs' },
      { to: '/notifications', label: 'Notifications' },
      { to: '/settings', label: 'Settings' },
    ],
    Client: [
      { to: '/', label: 'Dashboard' },
      { to: '/ticket', label: 'Log Ticket' },
      { to: '/notifications', label: 'Notifications' },
      { to: '/settings', label: 'Settings' },
    ],
  };

  const items = menuByRole[role] || [];

  const handleLogout = async () => {
    await logout();
    window.location.reload();
  };

  // role class applied to navbar for theming
  const roleClass = role ? role.toLowerCase() : 'guest';

  return (
    <nav className={`app-navbar ${roleClass}`} role="navigation" aria-label="Main">
      <div className="navbar-inner">
        <div className="navbar-left">
          {/* Brand sends user to the first item for their role */}
          <Link to={items[0]?.to || '/'} className="brand" aria-label="GoodLiving Home">
            <span className="brand-logo" aria-hidden></span>
            <span className="logo-wordmark">GoodLiving</span>
          </Link>
        </div>

        {/* Hamburger for small screens */}
        <button
          className="hamburger"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-controls="role-menu"
          aria-label="Toggle menu"
        >
          <span />
          <span />
          <span />
        </button>

        {/* Menu */}
        <ul id="role-menu" className={`nav-list ${open ? 'open' : ''}`}>
          {items.map(item => (
            <li
              key={item.to}
              className={location.pathname === item.to ? 'active' : ''}
              onClick={() => setOpen(false)}
            >
              <Link to={item.to}>{item.label}</Link>
            </li>
          ))}
        </ul>

        {/* Right side actions */}
        <div className="navbar-right">
          <button className="profile-btn" onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </div>
    </nav>
  );
}
