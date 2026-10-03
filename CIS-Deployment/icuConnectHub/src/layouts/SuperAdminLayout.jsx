import PulseShell from '../components/PulseShell';
import '../styles/super-admin.css';

const NAV = [
  { to: '/hospitals', label: 'Hospitals', icon: 'hospitals', end: true },
  { to: '/centers-admins', label: 'Centers & Admins', icon: 'centers' },
];

const TOOLS = [
  { to: '/platform-analytics', label: 'Platform Analytics' },
  { to: '/audit-logs', label: 'Audit Logs' },
];

const TITLES = {
  '/hospitals': 'Hospitals',
  '/platform-analytics': 'Platform Analytics',
  '/audit-logs': 'Audit Logs',
  '/centers-admins': 'Centers & Admins',
};

function titleFor(pathname, search) {
  if (pathname === '/hospitals' && new URLSearchParams(search).get('hospitalId')) {
    return 'Hospital profile';
  }
  return TITLES[pathname] || 'Platform';
}

export default function SuperAdminLayout() {
  return (
    <PulseShell
      nav={NAV}
      tools={TOOLS}
      titleFor={titleFor}
      contentClassName="sa-content"
    />
  );
}
