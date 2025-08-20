import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  // Fetch current session from backend
  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:5000/api/me', {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error('Not authenticated');
      setUser(data.user); // <-- use data.user
    } catch {
      setUser(null);
    } finally {
      setInitializing(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  // Login
  const login = useCallback(async (email, password) => {
    const res = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || 'Login failed');

    setUser(data.user); // <-- fixed: set user to data.user
    return data.user;
  }, []);

  // Register
  const register = useCallback(async ({ fullName, email, phone, password, role }) => {
    const res = await fetch('http://localhost:5000/api/register', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email, phone, password, role }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || 'Registration failed');

    setUser(data.user); // <-- fixed: auto-login sets user correctly
    return data.user;
  }, []);

  // Logout
  const logout = useCallback(async () => {
    await fetch('http://localhost:5000/api/logout', {
      method: 'POST',
      credentials: 'include',
    });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, initializing, login, register, logout, reload: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
