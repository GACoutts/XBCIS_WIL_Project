import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RoleBasedRoute({ children, allowedRoles = [] }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <div style={{ 
        padding: 24, 
        textAlign: 'center',
        fontSize: '16px',
        color: '#666'
      }}>
        🔐 Checking authentication and permissions...
      </div>
    );
  }

  // Not logged in - redirect to login
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Check role permissions
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return (
      <div style={{ 
        padding: 48, 
        textAlign: 'center',
        maxWidth: '400px',
        margin: '0 auto',
        marginTop: '100px'
      }}>
        <h2 style={{ color: '#e74c3c' }}>🚫 Access Denied</h2>
        <p style={{ color: '#666', fontSize: '16px' }}>
          You don't have permission to access this page.
        </p>
        <p style={{ color: '#999', fontSize: '14px' }}>
          Your role: <strong>{user.role}</strong><br/>
          Required roles: <strong>{allowedRoles.join(', ')}</strong>
        </p>
        <div style={{ marginTop: '20px' }}>
          <button 
            onClick={() => window.history.back()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            Go Back
          </button>
          <button 
            onClick={() => window.location.href = '/'}
            style={{
              padding: '10px 20px',
              backgroundColor: '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Dashboard
          </button>
        </div>
      </div>
    );
  }

  return children;
}
