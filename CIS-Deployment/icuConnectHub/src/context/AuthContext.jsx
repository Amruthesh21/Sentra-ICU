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

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated: Boolean(user && getStoredAuth()?.accessToken),
    applySession,
    logout,
  }), [user, loading, applySession, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
