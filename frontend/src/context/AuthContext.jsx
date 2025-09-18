import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const AuthContext = createContext(null);

/**
 * AuthProvider aligned to new backend endpoints:
 *   POST /api/auth/login
 *   POST /api/auth/register
 *   GET  /api/auth/me
 *   POST /api/auth/logout
 *
 * Includes fallback to legacy routes
 */

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  // Helper to try a request against primary route, then fallback (legacy)
  const tryFetch = async (primary, fallback, init) => {
    const res = await fetch(primary, init);
    if (res.ok || !fallback) return res;
    // Only fallback if primary failed with 404/405
    if ([404, 405].includes(res.status)) {
      return fetch(fallback, init);
    }
    return res;
  };

  // Robust session fetch (won't hang UI even if network fails)
  const fetchMe = useCallback(async () => {
    let ok = false;
    try {
      const res = await tryFetch(
        '/api/auth/me',
        '/api/me',
        { credentials: 'include' }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.user) {
        setUser(data.user);
        ok = true;
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setInitializing(false);
    }
    return ok;
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  // Login
  const login = useCallback(async (email, password) => {
    const init = {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    };
    const res = await tryFetch('/api/auth/login', '/api/login', init);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || 'Login failed');
    setUser(data.user);
    return data.user;
  }, []);

  // Register (new API requires role; no legacy fallback to avoid forcing Client)
  const register = useCallback(async ({ fullName, email, phone, password, role }) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email, phone, password, role }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || 'Registration failed');
    setUser(data.user);
    return data.user;
  }, []);

  // Logout
  const logout = useCallback(async () => {
    const init = { method: 'POST', credentials: 'include' };
    const res = await tryFetch('/api/auth/logout', '/api/logout', init);
    if (!res.ok) {
      // Even if server errors, clear local user to avoid sticky sessions client-side
      setUser(null);
      return false;
    }
    setUser(null);
    return true;
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
