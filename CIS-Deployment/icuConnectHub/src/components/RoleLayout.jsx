import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from './Layout';
import SuperAdminLayout from '../layouts/SuperAdminLayout';
import HospitalAdminLayout from '../layouts/HospitalAdminLayout';
import { isHospitalAdminUser, isSuperAdminUser } from '../utils/userRoles';

export default function RoleLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-loading-screen">
        <p>Loading…</p>
      </div>
    );
  }

  if (isSuperAdminUser(user)) {
    return <SuperAdminLayout />;
  }

  if (isHospitalAdminUser(user)) {
    return <HospitalAdminLayout />;
  }

  return <Layout />;
}

/** Clinical bedside routes — not for platform admins; hospital admins use dedicated pages */
export function ClinicalStaffOnly({ children }) {
  const { user } = useAuth();
  if (isSuperAdminUser(user)) {
    return <Navigate to="/" replace />;
  }
  if (isHospitalAdminUser(user)) {
    return <Navigate to="/admin" replace />;
  }
  return children;
}

/** Blocks super-admin from clinical/hospital-admin shared routes */
export function SuperAdminBlock({ children }) {
  const { user } = useAuth();
  if (isSuperAdminUser(user)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

/** @deprecated use ClinicalStaffOnly */
export function ClinicalOnly({ children }) {
  return <ClinicalStaffOnly>{children}</ClinicalStaffOnly>;
}
