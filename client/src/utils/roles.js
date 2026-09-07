export const PATRON_ROLES = ['STUDENT', 'MEMBER'];
export const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN'];

export function isPatron(userOrRole) {
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
  return PATRON_ROLES.includes(role);
}

export function needsPreferences(user) {
  return isPatron(user) && !user?.preferencesOnboarded;
}

export function isStaff(userOrRole) {
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
  return STAFF_ROLES.includes(role);
}

export function roleLabel(role) {
  return String(role || '').replaceAll('_', ' ');
}
