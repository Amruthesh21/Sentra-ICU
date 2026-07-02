import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearStoredAuth,
  fetchMe,
  getStoredAuth,
  logout as apiLogout,
  refreshSession,
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
  }, []);

  const refreshUser = useCallback(async () => {
    const stored = getStoredAuth();
    if (!stored?.accessToken) {
      setUser(null);
      return null;
    }
    try {
      const me = await fetchMe();
      setUser(me);
      setStoredAuth({ ...stored, user: me });
      return me;
    } catch {
      try {
        const session = await refreshSession();
        setUser(session.user || stored.user || null);
        const me = await fetchMe();
        setUser(me);
        setStoredAuth({ ...getStoredAuth(), user: me });
        return me;
      } catch {
        clearStoredAuth();
        setUser(null);
        return null;
      }
    }
  }, []);

  useEffect(() => {
    (async () => {
      const stored = getStoredAuth();
      if (stored?.user) setUser(stored.user);
      if (stored?.accessToken) await refreshUser();
      setLoading(false);
    })();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated: Boolean(user && getStoredAuth()?.accessToken),
    applySession,
    refreshUser,
    logout,
  }), [user, loading, applySession, refreshUser, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
