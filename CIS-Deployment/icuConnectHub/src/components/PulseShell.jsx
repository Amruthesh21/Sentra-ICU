import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import PulseLogo from './PulseLogo';
import AccountHoverCard from './AccountHoverCard';
import { useAuth } from '../context/AuthContext';
import { getActiveAlarms } from '../api/hub';
import '../styles/pulse-clinical.css';

const NAV = [
  { to: '/overview', label: 'Overview', icon: 'overview', end: true },
  { to: '/patients', label: 'Patients', icon: 'patients' },
  { to: '/beds', label: 'Beds', icon: 'beds' },
  { to: '/alerts', label: 'Alerts', icon: 'alerts', badge: true },
];

const TOOLS = [
  { to: '/admissions', label: 'Admissions' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/scoring', label: 'Scoring' },
  { to: '/reports', label: 'Reports' },
  { to: '/universal', label: 'Universal' },
];

function titleForPath(pathname) {
  if (pathname.startsWith('/bed/')) return 'Bed Detail';
  const map = {
    '/overview': 'Overview',
    '/patients': 'Patients',
    '/beds': 'Beds',
    '/alerts': 'Alerts',
    '/analytics': 'Analytics',
    '/scoring': 'Scoring',
    '/reports': 'Reports',
    '/universal': 'Universal',
    '/admissions': 'Admissions',
    '/alarms': 'Alerts',
  };
  return map[pathname] || 'Sentra ICU';
}

function NavGlyph({ name }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7 };
  if (name === 'overview') {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    );
  }
  if (name === 'patients') {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5 19c1.2-3.2 3.6-4.8 7-4.8S17.8 15.8 19 19" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'beds') {
    return (
      <svg {...common}>
        <path d="M3 17V11a2 2 0 0 1 2-2h5a3 3 0 0 1 3 3v1h5a2 2 0 0 1 2 2v2" strokeLinecap="round" />
        <path d="M3 17h18M6 17v2M18 17v2" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'alerts') {
    return (
      <svg {...common}>
        <path d="M9 18.5c.5 1.3 1.6 2 3 2s2.5-.7 3-2" strokeLinecap="round" />
        <path d="M6 9.5a6 6 0 1 1 12 0c0 4 1.4 5.3 1.4 5.3H4.6S6 13.5 6 9.5Z" />
      </svg>
    );
  }
  if (name === 'admin') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v2.2M12 18.8V21M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M3 12h2.2M18.8 12H21M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'analytics') {
    return (
      <svg {...common}>
        <path d="M4 19V10M10 19V5M16 19v-7M22 19H2" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'users') {
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="2.4" />
        <circle cx="16" cy="9" r="2" />
        <path d="M4 19c.5-3 2.5-4.6 5-4.6S13.5 16 14 19" strokeLinecap="round" />
        <path d="M14.5 14.8c1.3-.5 2.8-.4 4 .5" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'audit') {
    return (
      <svg {...common}>
        <path d="M7 4h10a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
        <path d="M9 9h6M9 13h6M9 17h4" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'hospitals') {
    return (
      <svg {...common}>
        <path d="M4 20V8l8-4 8 4v12" />
        <path d="M10 20v-6h4v6M12 8v2" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'centers') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="2.2" />
        <circle cx="5" cy="7" r="1.6" />
        <circle cx="19" cy="7" r="1.6" />
        <circle cx="6" cy="18" r="1.6" />
        <circle cx="18" cy="18" r="1.6" />
        <path d="M10.2 11 6.4 8.2M13.8 11l3.8-2.8M10.4 13.6 7.2 16.8M13.6 13.6l3.2 3.2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="9" cy="8" r="2.4" />
      <circle cx="16" cy="9" r="2" />
      <path d="M4 19c.5-3 2.5-4.6 5-4.6S13.5 16 14 19" strokeLinecap="round" />
      <path d="M14.5 14.8c1.3-.5 2.8-.4 4 .5" strokeLinecap="round" />
    </svg>
  );
}

function todayLabel() {
  const d = new Date();
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

export default function PulseShell({
  children,
  nav = NAV,
  tools = TOOLS,
  titles = null,
  titleFor = null,
  toolsLabel = 'Tools',
  contentClassName = '',
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [alertCount, setAlertCount] = useState(0);
  const [search, setSearch] = useState('');
  const isPatients = location.pathname === '/patients';
  const showAlertBadge = nav.some((item) => item.badge);

  useEffect(() => {
    setSearch('');
  }, [location.pathname]);

  useEffect(() => {
    if (!showAlertBadge) return undefined;
    let alive = true;
    async function refreshBadge() {
      try {
        const alarms = await getActiveAlarms();
        if (alive) setAlertCount(Array.isArray(alarms) ? alarms.length : 0);
      } catch {
        if (alive) setAlertCount(0);
      }
    }
    refreshBadge();
    const id = setInterval(refreshBadge, 5000);
    window.addEventListener('pulse-alerts-changed', refreshBadge);
    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener('pulse-alerts-changed', refreshBadge);
    };
  }, [location.pathname, showAlertBadge]);

  const pageTitle = titleFor
    ? titleFor(location.pathname, location.search)
    : (titles && titles[location.pathname]) || titleForPath(location.pathname);

  useEffect(() => {
    document.title = `${pageTitle} · Sentra ICU`;
    document.documentElement.classList.add('pulse-clinical-active');
    document.body.classList.add('pulse-clinical-active');
    return () => {
      document.documentElement.classList.remove('pulse-clinical-active');
      document.body.classList.remove('pulse-clinical-active');
    };
  }, [pageTitle]);

  const outletContext = useMemo(() => ({ search, setSearch }), [search]);

  return (
    <div className="pulse-app">
      <aside className="pulse-side">
        <div className="pulse-side-brand">
          <PulseLogo size="sm" />
        </div>
        <nav className="pulse-side-nav">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `pulse-side-link${isActive ? ' is-active' : ''}`}
            >
              <NavGlyph name={item.icon} />
              <span>{item.label}</span>
              {item.badge && alertCount > 0 ? <em className="pulse-badge">{alertCount}</em> : null}
            </NavLink>
          ))}

          {tools.length > 0 ? (
            <>
              <div className="pulse-side-tools-label">{toolsLabel}</div>
              {tools.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `pulse-side-link pulse-side-link--tool${isActive ? ' is-active' : ''}`}
                >
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </>
          ) : null}
        </nav>
        <button
          type="button"
          className="pulse-side-signout"
          onClick={async () => {
            await logout();
            navigate('/login', { replace: true });
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" strokeLinecap="round" />
            <path d="M14 16l4-4-4-4M18 12H10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Sign out
        </button>
      </aside>

      <div className="pulse-main">
        <header className="pulse-top">
          <h1 className="pulse-top-title">{pageTitle}</h1>
          <div className="pulse-top-right">
            {isPatients && (
              <label className="pulse-search">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="M16.5 16.5L21 21" strokeLinecap="round" />
                </svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                />
              </label>
            )}
            {isPatients && (
              <button
                type="button"
                className="pulse-btn-dark"
                onClick={() => navigate('/admissions')}
              >
                <span aria-hidden>+</span> Admit
              </button>
            )}
            <div className="pulse-date">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 9h18M8 3v4M16 3v4" strokeLinecap="round" />
              </svg>
              {todayLabel()}
            </div>
            <AccountHoverCard user={user} />
          </div>
        </header>
        <div className={`pulse-content${contentClassName ? ` ${contentClassName}` : ''}`}>
          {children || <Outlet context={outletContext} />}
        </div>
      </div>
    </div>
  );
}

export function PulseShellLayout() {
  return <PulseShell />;
}
