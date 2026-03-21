const authorizeRole = (...allowedRoles) => {
  const normalized = allowedRoles.map((role) => role.toLowerCase());
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'No user found in request' });
    }
    if (!normalized.includes((req.user.role || '').toLowerCase())) {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions' });
    }
    next();
  };
};

module.exports = { authorizeRole };
