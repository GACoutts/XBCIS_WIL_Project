import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Component that redirects authenticated users to their role-specific dashboard
 * Used as the home route ("/") to ensure proper role-based navigation
 */
export default function RoleDashboardRedirect() {
  const { user, initializing } = useAuth();

  // Wait for auth to initialize
  if (initializing) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '1.2em',
        color: '#666'
      }}>
        Loading...
      </div>
    );
  }

  // If not authenticated, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect based on user role
  switch (user.role) {
    case 'Staff':
      return <Navigate to="/staff" replace />;
    case 'Landlord':
      return <Navigate to="/landlord" replace />;
    case 'Contractor':
      return <Navigate to="/contractor" replace />;
    case 'Client':
    default:
      // Clients and fallback go to UserDashboard
      return <Navigate to="/client" replace />;
  }
}