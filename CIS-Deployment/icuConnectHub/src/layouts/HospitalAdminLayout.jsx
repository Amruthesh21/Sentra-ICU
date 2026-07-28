import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import PulseLogo from '../components/PulseLogo';
import NavIcon from '../components/NavIcon';
import { useAuth } from '../context/AuthContext';
import '../styles/hospital-admin.css';

const NAV = [
  { to: '/universal', label: 'Universal', icon: 'dashboard', end: true },
  { to: '/hospital-config', label: 'Administration', icon: 'admin_panel_settings', end: false },
  { to: '/analytics', label: 'Analytics', icon: 'insights', end: false },
  { to: '/alarms', label: 'Alarm Center', icon: 'notifications_active', end: false },
  { to: '/users', label: 'Users & Roles', icon: 'groups', end: false },
  { to: '/audit-log', label: 'Audit Log', icon: 'history', end: false },
];

const PAGE_META = {
  '/': {
    title: 'Universal Dashboard',
    subtitle: 'Hospital-wide ICU overview — occupancy, risk, and active alarms',
  },
  '/hospital-config': {
    title: 'Administration',
    subtitle: 'Create ICU units and beds — hospital feed via Connectivity',
  },
  '/analytics': {
    title: 'ICU Analytics',
    subtitle: 'Command center metrics, throughput, and clinical quality',
  },
  '/alarms': {
    title: 'Alarm Center',
    subtitle: 'Active physiological alarms across your hospital units',
  },
  '/users': {
    title: 'Users & Roles',
    subtitle: 'Manage hospital staff accounts and role permissions',
  },
  '/audit-log': {
    title: 'Audit Log',
    subtitle: 'Security and administration events for your hospital',
  },
};

function LiveClock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="ha-topbar-clock">{time}</span>;
}

export default function HospitalAdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.title = 'Hospital Admin · Sentra ICU';
  }, []);

  const pageMeta = PAGE_META[location.pathname] || PAGE_META['/hospital-config'];
  const pageTitle = pageMeta.title;
  const pageSubtitle = pageMeta.subtitle;

  return (
    <div className={`ha-shell${sidebarOpen ? ' ha-shell--open' : ''}`}>
      <button
        type="button"
        className="ha-sidebar-backdrop"
        aria-label="Close menu"
        onClick={() => setSidebarOpen(false)}
      />
      <aside className="ha-sidebar">
        <div className="ha-sidebar-brand">
          <div className="ha-sidebar-logo-wrap">
            <Link to="/" aria-label="Sentra ICU home">
              <PulseLogo size="sm" />
            </Link>
          </div>
          <span className="ha-role-badge">Hospital Admin</span>
        </div>
        <nav className="ha-sidebar-nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `ha-nav-item${isActive ? ' is-active' : ''}`}
            >
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="ha-sidebar-foot">
          <p className="ha-sidebar-foot-text">{user?.displayName || 'Admin'}</p>
          <p className="ha-sidebar-foot-sub">Configure center, units &amp; staff</p>
        </div>
      </aside>

      <div className="ha-main">
        <header className="ha-topbar">
          <button
            type="button"
            className="ha-menu-toggle"
            aria-label="Open menu"
            onClick={() => setSidebarOpen((o) => !o)}
          >
            ☰
          </button>
          <div className="ha-topbar-title">
            <h1>{pageTitle}</h1>
            <p>{pageSubtitle}</p>
          </div>
          <div className="ha-topbar-meta">
            <LiveClock />
            {user?.displayName && (
              <span className="ha-topbar-user" title={user.email}>{user.displayName}</span>
            )}
            <button
              type="button"
              className="ha-logout-btn"
              onClick={async () => {
                await logout();
                navigate('/login', { replace: true });
              }}
            >
              Logout
            </button>
          </div>
        </header>

        <main className="ha-content">
          <Outlet />
        </main>
        <footer className="ha-footer">
          <span>V2.0</span>
          <span>© Sentra ICU</span>
        </footer>
      </div>
    </div>
  );
}
