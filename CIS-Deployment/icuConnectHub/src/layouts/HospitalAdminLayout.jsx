import PulseShell from '../components/PulseShell';
import '../styles/hospital-admin.css';

const NAV = [
  { to: '/universal', label: 'Universal', icon: 'overview', end: true },
  { to: '/hospital-config', label: 'Administration', icon: 'admin' },
  { to: '/users', label: 'Users & Roles', icon: 'users' },
  { to: '/alarms', label: 'Alarms', icon: 'alerts', badge: true },
];

const TOOLS = [
  { to: '/analytics', label: 'Analytics' },
  { to: '/audit-log', label: 'Audit Log' },
];

const TITLES = {
  '/universal': 'Universal',
  '/hospital-config': 'Administration',
  '/analytics': 'Analytics',
  '/alarms': 'Alarms',
  '/users': 'Users & Roles',
  '/audit-log': 'Audit Log',
};

function titleFor(pathname) {
  return TITLES[pathname] || 'Hospital admin';
}

export default function HospitalAdminLayout() {
  return (
    <PulseShell
      nav={NAV}
      tools={TOOLS}
      titleFor={titleFor}
      contentClassName="ha-content"
    />
  );
}
