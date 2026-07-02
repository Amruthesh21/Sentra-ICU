/** Super Admin — platform operator only */
export function isSuperAdminUser(user) {
  if (!user) return false;
  return String(user.userType || '').toUpperCase() === 'SUPER_ADMIN';
}

/** Hospital Admin — center operations, not clinical bedside UI */
export function isHospitalAdminUser(user) {
  if (!user || isSuperAdminUser(user)) return false;
  const role = String(user.role || '').toUpperCase();
  return role === 'HOSPITAL_ADMIN';
}
