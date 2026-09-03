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
  navigate(returnTo || homePathForUser(user), { replace: true });
}
