import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import InAppAlarmMonitor from './InAppAlarmMonitor';
import { isPushSubscribed, refreshBedSubscriptions } from '../api/pushSubscribe';

export default function Layout() {
  const navigate = useNavigate();
  const doctorName = localStorage.getItem('doctorName') || 'Doctor';

  useEffect(() => {
    const doctorId = localStorage.getItem('doctorId') || 'doctor-001';
    if (isPushSubscribed()) {
      refreshBedSubscriptions(doctorId).catch(() => {});
    }
  }, []);

  function logout() {
    localStorage.clear();
    navigate('/login');
  }

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-brand">
          <span className="header-icon">🏥</span>
          <span>ICU Alerts</span>
        </div>
        <span className="header-user">{doctorName}</span>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <InAppAlarmMonitor />

      <nav className="bottom-nav">
        <NavLink to="/patients" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <span>👥</span>
          <span>Patients</span>
        </NavLink>
        <NavLink to="/alarms" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <span>🔔</span>
          <span>Alarms</span>
        </NavLink>
        <NavLink to="/notifications" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <span>📲</span>
          <span>Notify</span>
        </NavLink>
        <button className="nav-item logout-btn" onClick={logout}>
          <span>🚪</span>
          <span>Logout</span>
        </button>
      </nav>
    </div>
  );
}
