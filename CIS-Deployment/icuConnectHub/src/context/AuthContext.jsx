import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearStoredAuth,
  getStoredAuth,
  logout as apiLogout,
  setStoredAuth,
} from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((session) => {
    if (!session?.accessToken) return;
    setStoredAuth(session);
    setUser(session.user || null);
    if (!localStorage.getItem('doctorId')) {
      localStorage.setItem('doctorId', 'doctor-001');
    }
  }, []);

  useEffect(() => {
    const stored = getStoredAuth();
    if (stored?.accessToken && stored?.user) {
      setUser(stored.user);
    } else {
      clearStoredAuth();
      setUser(null);
    }
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  const patchUser = useCallback((partial) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...partial };
      const stored = getStoredAuth();
      if (stored) setStoredAuth({ ...stored, user: next });
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated: Boolean(user && getStoredAuth()?.accessToken),
    applySession,
    patchUser,
    logout,
  }), [user, loading, applySession, patchUser, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
