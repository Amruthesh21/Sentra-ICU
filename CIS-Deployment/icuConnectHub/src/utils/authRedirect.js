import { isHospitalAdminUser, isSuperAdminUser } from './userRoles';

export function homePathForUser(user) {
  if (isSuperAdminUser(user)) return '/hospitals';
  if (isHospitalAdminUser(user)) return '/hospital-config';
  return '/overview';
}

export function resolveReturnPath(returnTo) {
  if (!returnTo || typeof returnTo !== 'string') return null;
  // Reject anything that isn't a plain in-app path. Beyond the obvious
  // "//host" protocol-relative form, browsers/URL parsers normalize a
  // leading backslash to a forward slash (e.g. "/\evil.com" -> "//evil.com"),
  // so a check for "//" alone is bypassable (CVE behind GHSA-wrjc-x8rr-h8h6) —
  // reject any backslash in the value, not just a literal "//" prefix.
  if (!returnTo.startsWith('/') || returnTo.startsWith('//') || returnTo.includes('\\')) return null;
  if (returnTo.startsWith('/login') || returnTo.startsWith('/mfa')
    || returnTo.startsWith('/forgot-password') || returnTo.startsWith('/reset-password')
    || returnTo.startsWith('/account-setup')) {
    return null;
  }
  return returnTo;
}

export function redirectAfterLogin(navigate, user, searchParams) {
  const returnTo = resolveReturnPath(searchParams?.get('returnTo'));
  const home = homePathForUser(user);
  if (!returnTo) {
    navigate(home, { replace: true });
    return;
  }
  if (isSuperAdminUser(user) && !isPlatformPath(returnTo)) {
    navigate(home, { replace: true });
    return;
  }
  if (isHospitalAdminUser(user) && !isHospitalAdminPath(returnTo)) {
    navigate(home, { replace: true });
    return;
  }
  if (!isSuperAdminUser(user) && !isHospitalAdminUser(user) && !isClinicalPath(returnTo)) {
    navigate(home, { replace: true });
    return;
  }
  navigate(returnTo, { replace: true });
}

function isPlatformPath(path) {
  return path.startsWith('/hospitals')
    || path.startsWith('/centers-admins')
    || path.startsWith('/platform-analytics')
    || path.startsWith('/audit-logs');
}

function isHospitalAdminPath(path) {
  return path.startsWith('/hospital-config')
    || path.startsWith('/users')
    || path.startsWith('/audit-log')
    || path.startsWith('/universal')
    || path.startsWith('/analytics')
    || path.startsWith('/alarms');
}

function isClinicalPath(path) {
  if (isPlatformPath(path)) return false;
  if (path.startsWith('/hospital-config') || path.startsWith('/users') || path.startsWith('/audit-log')) {
    return false;
  }
  return true;
}
