import { Navigate, useParams } from 'react-router-dom';
import useHospitalAdminCenter from '../hooks/useHospitalAdminCenter';
import HospitalAdmin from './HospitalAdmin';
import UniversalDashboard from './UniversalDashboard';
import Analytics from './Analytics';
import AlarmCenter from './AlarmCenter';

function CenterLoading() {
  return <div className="empty-state glass-card"><h2>Loading hospital data…</h2></div>;
}

export function HospitalAdminUsersPage() {
  const { centerId } = useParams();
  return <HospitalAdmin centerId={centerId} />;
}

export function HospitalAdminDashboardPage() {
  const { centerId, loading } = useHospitalAdminCenter();
  if (loading) return <CenterLoading />;
  return <UniversalDashboard centerId={centerId} hospitalAdmin />;
}

export function HospitalAdminAnalyticsPage() {
  const { centerId, loading } = useHospitalAdminCenter();
  if (loading) return <CenterLoading />;
  return <Analytics centerId={centerId} hospitalAdmin />;
}

export function HospitalAdminAlarmsPage() {
  const { centerId, loading } = useHospitalAdminCenter();
  if (loading) return <CenterLoading />;
  return <AlarmCenter centerId={centerId} hospitalAdmin />;
}

/** @deprecated center drill-down removed */
export function HospitalAdminCenterIndex() {
  const { centerId } = useParams();
  return <Navigate to={`/center/${encodeURIComponent(centerId)}/users`} replace />;
}
