import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi } from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const data = await authApi.me();
      setUser(data.user || null);
      return true;
    } catch (e) {
      if (e.status === 401) {
        try {
          await authApi.refresh();
          const data = await authApi.me();
          setUser(data.user || null);
          return true;
        } catch {
          setUser(null);
          return false;
        }
      }
      console.error('fetchMe error:', e);
      setUser(null);
      return false;
    } finally {
      setInitializing(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  // Login
  const login = useCallback(async (email, password) => {
    const data = await authApi.login({ email, password });
    setUser(data.user || null); // cookies set server-side
    return data.user;
  }, []);

  // Register
  const register = useCallback(async ({ fullName, email, phone, password, role }) => {
    const data = await authApi.register({ fullName, email, phone, password, role });
    setUser(data.user || null);
    return data.user;
  }, []);

  // Logout
  const logout = useCallback(async () => {
    try { await authApi.logout(); } finally { setUser(null); }
    return true;
  }, []);

  // Session helpers (for Sessions page)
  const listSessions = useCallback(() => authApi.listSessions(), []);
  const revokeSession = useCallback((id) => authApi.revokeSession(id), []);
  const revokeAll = useCallback(async () => {
    try { await authApi.revokeAll(); } finally { setUser(null); }
  }, []);

  // Helpful derived state
  const isAuthenticated = !!user;
  const hasRole = useCallback((...roles) => roles.includes(user?.role), [user]);

  return (
    <AuthContext.Provider value={{
      user,
      initializing,
      isAuthenticated,
      hasRole,
      login,
      register,
      logout,
      reload: fetchMe,
      listSessions,
      revokeSession,
      revokeAll,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
