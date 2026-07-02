import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UiThemeProvider } from './context/UiThemeContext';
import RoleLayout, { ClinicalStaffOnly, SuperAdminBlock } from './components/RoleLayout';
import ClinicalOrHospitalAdminRoute from './components/ClinicalOrHospitalAdminRoute';
import Login from './pages/Login';
import MfaVerify from './pages/MfaVerify';
import AccountSetup from './pages/AccountSetup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import UniversalDashboard from './pages/UniversalDashboard';
import Dashboard from './pages/Dashboard';
import AlarmCenter from './pages/AlarmCenter';
import BedDetail from './pages/BedDetail';
import Admin from './pages/Admin';
import HospitalAdmin from './pages/HospitalAdmin';
import SuperAdminHospitals from './pages/SuperAdminHospitals';
import SuperAdminCentersAdmins from './pages/SuperAdminCentersAdmins';
import SuperAdminPlatformAnalytics from './pages/SuperAdminPlatformAnalytics';
import SuperAdminAuditLogs from './pages/SuperAdminAuditLogs';
import HospitalAdminAudit from './pages/HospitalAdminAudit';
import { SuperAdminOnly } from './components/SuperAdminOnly';
import { HospitalAdminOnly } from './components/HospitalAdminOnly';
import PatientManagement from './pages/PatientManagement';
import Reports from './pages/Reports';
import Scoring from './pages/Scoring';
import Analytics from './pages/Analytics';
import {
  HospitalAdminAlarmsPage,
  HospitalAdminAnalyticsPage,
  HospitalAdminDashboardPage,
} from './pages/HospitalAdminCenterPages';
import { isHospitalAdminUser, isSuperAdminUser } from './utils/userRoles';
import { homePathForUser } from './utils/authRedirect';

function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="auth-loading-screen">
        <p>Loading…</p>
      </div>
    );
  }
  if (!isAuthenticated) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }
  return children;
}

function PublicOnly({ children }) {
  const { isAuthenticated, loading, user } = useAuth();
  if (loading) return null;
  if (isAuthenticated) return <Navigate to={homePathForUser(user)} replace />;
  return children;
}

function HomePage() {
  const { user } = useAuth();
  if (isSuperAdminUser(user)) return <SuperAdminHospitals />;
  if (isHospitalAdminUser(user)) return <HospitalAdminDashboardPage />;
  return <Navigate to="/unit" replace />;
}

function UniversalRoute() {
  return (
    <ClinicalStaffOnly>
      <UniversalDashboard />
    </ClinicalStaffOnly>
  );
}

function AdminRoute() {
  const { user } = useAuth();
  if (isSuperAdminUser(user)) return <Navigate to="/" replace />;
  if (!isHospitalAdminUser(user)) return <Navigate to="/unit" replace />;
  return <Admin hospitalAdmin />;
}

export default function App() {
  return (
    <UiThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
            <Route path="/mfa" element={<PublicOnly><MfaVerify /></PublicOnly>} />
            <Route path="/account-setup" element={<PublicOnly><AccountSetup /></PublicOnly>} />
            <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
            <Route path="/reset-password" element={<PublicOnly><ResetPassword /></PublicOnly>} />
            <Route
              path="/"
              element={(
                <RequireAuth>
                  <RoleLayout />
                </RequireAuth>
              )}
            >
              <Route index element={<HomePage />} />
              <Route path="universal" element={<SuperAdminBlock><UniversalRoute /></SuperAdminBlock>} />
              <Route
                path="centers-admins"
                element={<SuperAdminOnly><SuperAdminCentersAdmins /></SuperAdminOnly>}
              />
              <Route
                path="platform-analytics"
                element={<SuperAdminOnly><SuperAdminPlatformAnalytics /></SuperAdminOnly>}
              />
              <Route
                path="audit-logs"
                element={<SuperAdminOnly><SuperAdminAuditLogs /></SuperAdminOnly>}
              />
              <Route path="audit-log" element={<HospitalAdminOnly><HospitalAdminAudit /></HospitalAdminOnly>} />
              <Route path="admin" element={<AdminRoute />} />
              <Route path="users" element={<HospitalAdminOnly><HospitalAdmin /></HospitalAdminOnly>} />
              <Route path="platform" element={<Navigate to="/" replace />} />
              <Route path="unit" element={<ClinicalStaffOnly><Dashboard /></ClinicalStaffOnly>} />
              <Route
                path="alarms"
                element={(
                  <SuperAdminBlock>
                    <ClinicalOrHospitalAdminRoute
                      hospitalAdmin={<HospitalAdminAlarmsPage />}
                      clinical={<ClinicalStaffOnly><AlarmCenter /></ClinicalStaffOnly>}
                    />
                  </SuperAdminBlock>
                )}
              />
              <Route path="bed/:bedId" element={<ClinicalStaffOnly><BedDetail /></ClinicalStaffOnly>} />
              <Route path="patients" element={<ClinicalStaffOnly><PatientManagement /></ClinicalStaffOnly>} />
              <Route path="reports" element={<ClinicalStaffOnly><Reports /></ClinicalStaffOnly>} />
              <Route path="scoring" element={<ClinicalStaffOnly><Scoring /></ClinicalStaffOnly>} />
              <Route
                path="analytics"
                element={(
                  <SuperAdminBlock>
                    <ClinicalOrHospitalAdminRoute
                      hospitalAdmin={<HospitalAdminAnalyticsPage />}
                      clinical={<ClinicalStaffOnly><Analytics /></ClinicalStaffOnly>}
                    />
                  </SuperAdminBlock>
                )}
              />
              <Route path="center/*" element={<Navigate to="/admin" replace />} />
              <Route path="hospital-admin" element={<Navigate to="/admin" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </UiThemeProvider>
  );
}
