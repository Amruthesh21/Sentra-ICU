import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isHospitalAdminUser } from '../utils/userRoles';

export function HospitalAdminOnly({ children }) {
  const { user } = useAuth();
  if (!isHospitalAdminUser(user)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
