import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Hybrid RoleRoute component combining the best of both approaches:
 * - Clean API with `roles` prop (string or array)
 * - Backward compatibility with `allowedRoles` prop (deprecated)
 * - Detailed user-friendly error UI when unauthorized
 * - Simple redirect when minimal prop is true
 * - Optional debug mode for development
 */
export default function RoleRoute({ 
  roles, 
  allowedRoles, // Deprecated - use roles instead
  children, 
  redirectTo = '/login',
  fallbackPath = '/',
  minimal = false,
  debugMode = false
}) {
  const { user, initializing } = useAuth();
  const location = useLocation();
  
  // Normalize roles - support both new (roles) and legacy (allowedRoles) props
  const requiredRoles = roles || allowedRoles || [];
  const normalizedRoles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  
  // Loading state
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

  // Not authenticated - redirect to login
  if (!user) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  // Check role permissions
  if (normalizedRoles.length > 0 && !normalizedRoles.includes(user.role)) {
    // If minimal mode or no detailed error UI needed, just redirect
    if (minimal) {
      return <Navigate to={fallbackPath} replace />;
    }

    // Full error UI with helpful information
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
          Required roles: <strong>{normalizedRoles.join(', ')}</strong>
        </p>
        
        {debugMode && (
          <div style={{ 
            marginTop: '20px', 
            padding: '10px', 
            backgroundColor: '#f8f9fa', 
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'monospace'
          }}>
            <div>Debug Info:</div>
            <div>User ID: {user.userId || 'N/A'}</div>
            <div>Current Path: {location.pathname}</div>
            <div>Props: {JSON.stringify({ roles, allowedRoles, minimal }, null, 2)}</div>
          </div>
        )}
        
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
            onClick={() => window.location.href = fallbackPath}
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
