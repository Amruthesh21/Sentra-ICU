import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UiThemeProvider } from './context/UiThemeContext';
import RoleLayout, { ClinicalStaffOnly, SuperAdminBlock } from './components/RoleLayout';
import ClinicalOrHospitalAdminRoute from './components/ClinicalOrHospitalAdminRoute';
import UniversalDashboard from './pages/UniversalDashboard';
import Overview from './pages/Overview';
import Patients from './pages/Patients';
import Beds from './pages/Beds';
import Alerts from './pages/Alerts';
import Staff from './pages/Staff';
import BedRoute from './pages/BedRoute';
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
import Connectivity from './pages/Connectivity';
import Landing from './pages/Landing';
import Login from './pages/Login';
import MfaVerify from './pages/MfaVerify';
import PulseAdmin, { AdminHome, AdminStaffPage } from './pages/PulseAdmin';
import {
  HospitalAdminAlarmsPage,
  HospitalAdminAnalyticsPage,
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

function UniversalRoute() {
  return (
    <ClinicalStaffOnly>
      <UniversalDashboard />
    </ClinicalStaffOnly>
  );
}

function HospitalAdminConfigRoute() {
  const { user } = useAuth();
  if (isSuperAdminUser(user)) return <Navigate to="/hospitals" replace />;
  if (!isHospitalAdminUser(user)) return <Navigate to="/overview" replace />;
  return <Admin hospitalAdmin />;
}

function ClinicalAdminUnits() {
  return <Admin />;
}

export default function App() {
  return (
    <UiThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
            <Route path="/mfa" element={<PublicOnly><MfaVerify /></PublicOnly>} />
            <Route path="/account-setup" element={<Navigate to="/login" replace />} />
            <Route path="/forgot-password" element={<Navigate to="/login" replace />} />
            <Route path="/reset-password" element={<Navigate to="/login" replace />} />

            <Route
              element={(
                <RequireAuth>
                  <RoleLayout />
                </RequireAuth>
              )}
            >
              <Route path="hospitals" element={<SuperAdminOnly><SuperAdminHospitals /></SuperAdminOnly>} />
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
              <Route path="hospital-config" element={<HospitalAdminConfigRoute />} />
              <Route path="users" element={<HospitalAdminOnly><HospitalAdmin /></HospitalAdminOnly>} />
              <Route path="platform" element={<Navigate to="/hospitals" replace />} />
              <Route path="overview" element={<ClinicalStaffOnly><Overview /></ClinicalStaffOnly>} />
              <Route path="patients" element={<ClinicalStaffOnly><Patients /></ClinicalStaffOnly>} />
              <Route path="beds" element={<ClinicalStaffOnly><Beds /></ClinicalStaffOnly>} />
              <Route path="alerts" element={<ClinicalStaffOnly><Alerts /></ClinicalStaffOnly>} />
              <Route path="staff" element={<ClinicalStaffOnly><Staff /></ClinicalStaffOnly>} />
              <Route path="admin" element={<ClinicalStaffOnly><PulseAdmin /></ClinicalStaffOnly>}>
                <Route index element={<AdminHome />} />
                <Route path="staff" element={<AdminStaffPage />} />
                <Route path="units" element={<ClinicalAdminUnits />} />
              </Route>
              <Route path="unit" element={<Navigate to="/overview" replace />} />
              <Route
                path="alarms"
                element={(
                  <SuperAdminBlock>
                    <ClinicalOrHospitalAdminRoute
                      hospitalAdmin={<HospitalAdminAlarmsPage />}
                      clinical={<Navigate to="/alerts" replace />}
                    />
                  </SuperAdminBlock>
                )}
              />
              <Route path="bed/:bedId" element={<ClinicalStaffOnly><BedRoute /></ClinicalStaffOnly>} />
              <Route path="admissions" element={<ClinicalStaffOnly><PatientManagement /></ClinicalStaffOnly>} />
              <Route path="reports" element={<ClinicalStaffOnly><Reports /></ClinicalStaffOnly>} />
              <Route path="scoring" element={<ClinicalStaffOnly><Scoring /></ClinicalStaffOnly>} />
              <Route path="connectivity" element={<ClinicalStaffOnly><Connectivity /></ClinicalStaffOnly>} />
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
              <Route path="center/*" element={<Navigate to="/hospital-config" replace />} />
              <Route path="hospital-admin" element={<Navigate to="/hospital-config" replace />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </UiThemeProvider>
  );
}
