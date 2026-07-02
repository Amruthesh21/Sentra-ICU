import { useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

export function usePermissions() {
  const { user } = useAuth();

  const permissions = useMemo(() => {
    const list = user?.permissions;
    if (!Array.isArray(list) || list.length === 0) return null;
    return new Set(list);
  }, [user]);

  const can = useCallback((key) => {
    if (!permissions) return true;
    if (permissions.has('*')) return true;
    return permissions.has(key);
  }, [permissions]);

  const canAny = useCallback((keys = []) => {
    if (!permissions) return true;
    if (permissions.has('*')) return true;
    return keys.some((k) => permissions.has(k));
  }, [permissions]);

  return { can, canAny, permissions };
}
