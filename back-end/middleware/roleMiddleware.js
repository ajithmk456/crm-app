const { hasRequiredRole } = require('../utils/roles');

const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'No user found in request' });
    }

    if (!hasRequiredRole(req.user.role, allowedRoles)) {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions' });
    }

    next();
  };
};

module.exports = { authorizeRole };
