import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children, redirectByRole = false }) {
  const { user, initializing } = useAuth();
  const loc = useLocation();

  if (initializing) {
    return (
      <div style={{ 
        padding: 24, 
        textAlign: 'center',
        fontSize: '16px',
        color: '#666'
      }}>
        🔐 Checking session…
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc }} />;
  }
  
  // Optional: Redirect to role-specific dashboard
  if (redirectByRole && loc.pathname === '/') {
    const dashboardRoutes = {
      'Client': '/dashboard/client',
      'Staff': '/dashboard/staff', 
      'Contractor': '/dashboard/contractor',
      'Landlord': '/dashboard/landlord'
    };
    
    const targetRoute = dashboardRoutes[user.role];
    if (targetRoute && targetRoute !== loc.pathname) {
      return <Navigate to={targetRoute} replace />;
    }
  }
  
  return children;
}

