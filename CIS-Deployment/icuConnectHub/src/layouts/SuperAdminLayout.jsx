import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import RtowLogo from '../components/RtowLogo';
import NavIcon from '../components/NavIcon';
import { useAuth } from '../context/AuthContext';
import '../styles/super-admin.css';

const PAGE_TITLES = {
  '/': { title: 'Hospitals', sub: 'Platform overview — onboard hospitals and monitor staff footprint' },
  '/platform-analytics': { title: 'Platform Analytics', sub: 'Cross-hospital adoption, security events, and admin activity' },
  '/audit-logs': { title: 'Audit Logs', sub: 'Immutable trail of platform and hospital administration actions' },
  '/centers-admins': { title: 'Centers & Admins', sub: 'Link Connect Engine centers and manage hospital admins' },
};

function LiveClock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="sa-topbar-clock">{time}</span>;
}

export default function SuperAdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname, searchParams.get('hospitalId')]);

  useEffect(() => {
    document.title = 'Platform · ICU Connect V2';
  }, []);

  const hospitalId = location.pathname === '/' ? searchParams.get('hospitalId') : null;
  const page = hospitalId
    ? { title: 'Hospital profile', sub: 'Full-width tenant overview, staff footprint, and audit trail' }
    : (PAGE_TITLES[location.pathname] || PAGE_TITLES['/']);

  return (
    <div className={`sa-shell${sidebarOpen ? ' sa-shell--open' : ''}`}>
      <button
        type="button"
        className="sa-sidebar-backdrop"
        aria-label="Close menu"
        onClick={() => setSidebarOpen(false)}
      />
      <aside className="sa-sidebar">
        <div className="sa-sidebar-brand">
          <div className="sa-sidebar-logo-wrap">
            <RtowLogo blend />
          </div>
          <span className="sa-role-badge">Super Admin</span>
        </div>
        <nav className="sa-sidebar-nav">
          <NavLink end to="/" className={({ isActive }) => `sa-nav-item${isActive ? ' is-active' : ''}`}>
            <NavIcon name="domain" />
            <span>Hospitals</span>
          </NavLink>
          <NavLink to="/platform-analytics" className={({ isActive }) => `sa-nav-item${isActive ? ' is-active' : ''}`}>
            <NavIcon name="insights" />
            <span>Platform Analytics</span>
          </NavLink>
          <NavLink to="/audit-logs" className={({ isActive }) => `sa-nav-item${isActive ? ' is-active' : ''}`}>
            <NavIcon name="history" />
            <span>Audit Logs</span>
          </NavLink>
          <NavLink to="/centers-admins" className={({ isActive }) => `sa-nav-item${isActive ? ' is-active' : ''}`}>
            <NavIcon name="hub" />
            <span>Centers &amp; Admins</span>
          </NavLink>
        </nav>
        <div className="sa-sidebar-foot">
          <p className="sa-sidebar-foot-text">ICU Connect V2</p>
          <p className="sa-sidebar-foot-sub">Platform control only</p>
        </div>
      </aside>

      <div className="sa-main">
        <header className="sa-topbar">
          <button
            type="button"
            className="sa-menu-toggle"
            aria-label="Open menu"
            onClick={() => setSidebarOpen((o) => !o)}
          >
            ☰
          </button>
          <div className="sa-topbar-title">
            <h1>{page.title}</h1>
            <p>{page.sub}</p>
          </div>
          <div className="sa-topbar-meta">
            <LiveClock />
            {user?.displayName && (
              <span className="sa-topbar-user" title={user.email}>{user.displayName}</span>
            )}
            <button
              type="button"
              className="sa-logout-btn"
              onClick={async () => {
                await logout();
                navigate('/login', { replace: true });
              }}
            >
              Logout
            </button>
          </div>
        </header>
        <main className="sa-content">
          <Outlet />
        </main>
        <footer className="sa-footer">
          <span>V2.0</span>
          <span>© Rtwo Healthcare Technologies</span>
        </footer>
      </div>
    </div>
  );
}
