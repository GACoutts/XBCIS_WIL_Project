import React from 'react';
import RoleRoute from './RoleRoute.jsx';

/**
 * @deprecated Use RoleRoute instead with `roles` prop
 * Backward compatibility wrapper for existing RoleBasedRoute usage
 */
export default function RoleBasedRoute({ children, allowedRoles = [] }) {
  // Wrapper that forwards to the new hybrid RoleRoute component
  return (
    <RoleRoute allowedRoles={allowedRoles}>
      {children}
    </RoleRoute>
  );
}
