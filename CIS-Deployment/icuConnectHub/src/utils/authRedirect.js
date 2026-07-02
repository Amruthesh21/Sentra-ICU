import { isHospitalAdminUser, isSuperAdminUser } from './userRoles';

export function homePathForUser(user) {
  if (isSuperAdminUser(user)) return '/';
  if (isHospitalAdminUser(user)) return '/admin';
  return '/unit';
}

export function resolveReturnPath(returnTo) {
  if (!returnTo || typeof returnTo !== 'string') return null;
  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) return null;
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
