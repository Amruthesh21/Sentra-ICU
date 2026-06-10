import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import MyPatients from './pages/MyPatients';
import AlarmBeds from './pages/AlarmBeds';
import SetAlarm from './pages/SetAlarm';
import EnableNotifications from './pages/EnableNotifications';
import Layout from './components/Layout';

function RequireAuth({ children }) {
  const doctorId = localStorage.getItem('doctorId');
  if (!doctorId) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/patients" replace />} />
          <Route path="patients" element={<MyPatients />} />
          <Route path="alarms" element={<AlarmBeds />} />
          <Route path="alarms/:bedId" element={<SetAlarm />} />
          <Route path="notifications" element={<EnableNotifications />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
