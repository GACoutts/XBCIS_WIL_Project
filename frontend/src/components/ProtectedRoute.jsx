import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children }) {
  const { user, initializing } = useAuth();
  const loc = useLocation();

  if (initializing) {
    return <div style={{ padding: 24 }}>Checking session…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc }} />;
  }
  return children;
}

