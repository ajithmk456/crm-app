const ROLE_HIERARCHY = {
  user: 1,
  admin: 2,
  superadmin: 3,
};

const ROLE_ALIASES = {
  employee: 'user',
};

const normalizeRole = (role) => {
  const normalizedRole = String(role || '').trim().toLowerCase();
  return ROLE_ALIASES[normalizedRole] || normalizedRole;
};

const hasRequiredRole = (userRole, allowedRoles = []) => {
  const normalizedUserRole = normalizeRole(userRole);
  const userRank = ROLE_HIERARCHY[normalizedUserRole] || 0;

  return allowedRoles.some((allowedRole) => {
    const allowedRank = ROLE_HIERARCHY[normalizeRole(allowedRole)] || 0;
    return userRank >= allowedRank;
  });
};

module.exports = {
  ROLE_HIERARCHY,
  normalizeRole,
  hasRequiredRole,
};