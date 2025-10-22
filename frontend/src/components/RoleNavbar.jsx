import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * RoleNavbar
 *
 * This component renders a navigation bar that adapts based on the
 * authenticated user's role. Each role has its own set of pages. The
 * component displays the appropriate menu and a logout button. On
 * smaller screens a hamburger icon toggles the visibility of the menu.
 */
export default function RoleNavbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const role = user?.role;

  // Define the navigation items for each role.  These correspond to the
  // routes defined in App.jsx.  If you add or remove pages, update
  // this mapping accordingly.
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
      { to: '/landlord/quotes', label: 'Quote Approvals' },
      { to: '/landlord/properties', label: 'Properties' },
      { to: '/settings', label: 'Settings' },
    ],
    Contractor: [
      { to: '/contractor', label: 'Dashboard' },
      { to: '/contractor/jobs', label: 'Assigned Jobs' },
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
    // Call logout from context and reload the page to clear state
    await logout();
    window.location.reload();
  };

  return (
    <nav className="app-navbar">
      <div className="navbar-left">
        {/* Brand redirects to the first item for the role */}
        <Link to={items[0]?.to || '/'} className="brand">GoodLiving</Link>
      </div>

      {/* Hamburger toggle for small screens */}
      <button
        className="hamburger"
        onClick={() => setOpen(!open)}
        aria-label="Menu"
      >
        ☰
      </button>

      {/* Navigation items */}
      <ul className={`nav-list ${open ? 'open' : ''}`}>
        {items.map((item) => (
          <li
            key={item.to}
            className={location.pathname === item.to ? 'active' : ''}
            onClick={() => setOpen(false)}
          >
            <Link to={item.to}>{item.label}</Link>
          </li>
        ))}
      </ul>

      {/* Logout button */}
      <div className="navbar-right">
        <button className="profile-btn" onClick={handleLogout}>
          Log Out
        </button>
      </div>
    </nav>
  );
}