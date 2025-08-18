import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch('/api/me', { credentials: 'include' });
      if (!res.ok) throw new Error('not authed');
      const data = await res.json();
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setInitializing(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = useCallback(async (email, password) => {
    const res = await fetch('/api/login', {
      method: 'POST',
      credentials: 'include', // crucial to receive/set cookie
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const msg = await res.json().catch(() => ({}));
      throw new Error(msg?.message || 'Login failed');
    }
    const data = await res.json();
    setUser(data.user); // already trusted from server
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
  }, []);

  const value = { user, initializing, login, logout, reload: fetchMe };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
