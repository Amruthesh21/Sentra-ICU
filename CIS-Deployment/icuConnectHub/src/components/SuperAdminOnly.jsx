import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isSuperAdminUser } from '../utils/userRoles';

export function SuperAdminOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="auth-loading-screen"><p>Loading…</p></div>;
  if (!isSuperAdminUser(user)) return <Navigate to="/overview" replace />;
  return children;
}
