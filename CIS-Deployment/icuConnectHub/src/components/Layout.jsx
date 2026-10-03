import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import NavIcon from './NavIcon';
import PulseLogo from './PulseLogo';
import HubAlarmMonitor from './HubAlarmMonitor';
import UiThemeSwitcher from './UiThemeSwitcher';
import AccountHoverCard from './AccountHoverCard';
import { BED_DETAIL_TABS, resolveBedTab } from '../constants/bedDetailTabs';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { NAV_PERMISSIONS } from '../constants/permissionsCatalog';

function LiveClock({ className = 'topbar-clock' }) {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(id);
  }, []);

  return <span className={className}>{time}</span>;
}

const PAGE_META = {
  '/unit': {
    title: 'Unit Dashboard',
    subtitle: 'Occupied beds, live vitals, and unit risk at a glance',
  },
  '/': {
    title: 'Unit Dashboard',
    subtitle: 'Occupied beds, live vitals, and unit risk at a glance',
  },
  '/universal': {
    title: 'Universal Dashboard',
    subtitle: 'Hospital-wide ICU overview — occupancy, risk, and active alarms',
  },
  '/patients': {
    title: 'Patient Management',
    subtitle: 'Admit, transfer, and manage patient assignments',
  },
  '/alarms': {
    title: 'Alarm Center',
    subtitle: 'Active physiological alarms across your units',
  },
  '/analytics': {
    title: 'ICU Analytics',
    subtitle: 'Command center metrics, throughput, and clinical quality',
  },
  '/scoring': {
    title: 'Clinical Scoring',
    subtitle: 'Severity scores and trended assessment tools',
  },
  '/reports': {
    title: 'Reports Generator',
    subtitle: 'Build and export clinical documentation',
  },
  '/admin': {
    title: 'Administration',
    subtitle: 'Create ICU units and beds, then map bedside devices',
  },
  '/hospital-admin': {
    title: 'Hospital Administration',
    subtitle: 'Hospital-wide configuration and staff management',
  },
};

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { canAny } = usePermissions();

  function showNav(path) {
    const keys = NAV_PERMISSIONS[path];
    if (!keys) return true;
    return canAny(keys);
  }
  const [searchParams] = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pageRef = useRef(null);
  const isBedRoute = /^\/bed\/[^/]+/.test(location.pathname);
  const activeBedTab = resolveBedTab(searchParams.get('tab'));

  function selectBedTab(tabId) {
    const params = new URLSearchParams(searchParams);
    params.set('tab', tabId);
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  }

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const el = pageRef.current;
    if (el) el.scrollTop = 0;
  }, [location.pathname]);

  const pageMeta = location.pathname.startsWith('/bed/')
    ? { title: 'Patient Monitor', subtitle: 'Bedside vitals, waveforms, and clinical documentation' }
    : (PAGE_META[location.pathname] || PAGE_META['/unit']);
  const title = pageMeta.title;

  useEffect(() => {
    document.title = `${title} · Sentra ICU`;
  }, [title]);

  return (
    <div className={`app-shell${sidebarOpen ? ' sidebar-open' : ''}`}>
      <button
        type="button"
        className="sidebar-backdrop"
        aria-label="Close menu"
        onClick={() => setSidebarOpen(false)}
        tabIndex={sidebarOpen ? 0 : -1}
      />
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Link to="/" className="sidebar-brand-link" aria-label="Sentra ICU home">
            <PulseLogo size="sm" />
          </Link>
        </div>
        <nav className="sidebar-nav">
          {showNav('/unit') && (
            <NavLink to="/unit" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} title="Unit Dashboard">
              <span className="nav-icon-wrap">
                <NavIcon name="bed" />
              </span>
              <span className="nav-label">Unit</span>
            </NavLink>
          )}
          {showNav('/universal') && (
            <NavLink to="/universal" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} title="Universal Dashboard">
              <span className="nav-icon-wrap">
                <NavIcon name="dashboard" />
              </span>
              <span className="nav-label">Universal</span>
            </NavLink>
          )}
          {showNav('/patients') && (
            <NavLink to="/patients" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} title="Patient Management">
              <span className="nav-icon-wrap">
                <NavIcon name="person" />
              </span>
              <span className="nav-label">Patient</span>
            </NavLink>
          )}
          {showNav('/alarms') && (
            <NavLink to="/alarms" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} title="Alarm Center">
              <span className="nav-icon-wrap">
                <NavIcon name="notifications_active" />
              </span>
              <span className="nav-label">Alarm</span>
            </NavLink>
          )}
          {showNav('/analytics') && (
            <NavLink to="/analytics" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} title="ICU Analytics">
              <span className="nav-icon-wrap">
                <NavIcon name="insights" />
              </span>
              <span className="nav-label">Analytics</span>
            </NavLink>
          )}
          {showNav('/scoring') && (
            <NavLink to="/scoring" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} title="Clinical Scoring">
              <span className="nav-icon-wrap">
                <NavIcon name="analytics" />
              </span>
              <span className="nav-label">Scoring</span>
            </NavLink>
          )}
          {showNav('/reports') && (
            <NavLink to="/reports" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} title="Reports">
              <span className="nav-icon-wrap">
                <NavIcon name="description" />
              </span>
              <span className="nav-label">Reports</span>
            </NavLink>
          )}
          <a href="http://127.0.0.1:7031" className="nav-item" title="Mobile PWA" target="_blank" rel="noreferrer">
            <span className="nav-icon-wrap">
              <NavIcon name="smartphone" />
            </span>
            <span className="nav-label">Mobile</span>
          </a>
        </nav>
      </aside>

      <div className="main-area">
        <header className={`app-chrome${isBedRoute ? ' app-chrome--bed' : ''}`}>
          <button
            type="button"
            className="menu-toggle"
            aria-label="Open menu"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen((open) => !open)}
          >
            ☰
          </button>

          {isBedRoute ? (
            <nav className="app-chrome-tabs" aria-label="Patient monitor sections">
              {BED_DETAIL_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`app-chrome-tab${activeBedTab === t.id ? ' is-active' : ''}`}
                  onClick={() => selectBedTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          ) : (
            <div className="app-chrome-title-block">
              <h1>{pageMeta.title}</h1>
              <p>{pageMeta.subtitle}</p>
            </div>
          )}

          <div className="app-chrome-meta">
            <UiThemeSwitcher />
            <span className="ax-live-pill app-chrome-live"><span className="ax-live-dot" /> Live</span>
            <LiveClock className="app-chrome-clock" />
            {user && <AccountHoverCard user={user} variant="name" />}
            <button
              type="button"
              className="app-chrome-logout"
              onClick={async () => {
                await logout();
                navigate('/login', { replace: true });
              }}
            >
              Logout
            </button>
          </div>
        </header>
        <main className="page-content" ref={pageRef}>
          <HubAlarmMonitor />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
