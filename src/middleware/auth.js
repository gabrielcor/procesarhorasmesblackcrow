function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  if (!req.session.user.isAdmin) {
    return res.status(403).send('No autorizado');
  }

  return next();
}

function canAccessEmployee(req, employeeId) {
  if (!req.session.user) {
    return false;
  }

  if (req.session.user.isAdmin) {
    return true;
  }

  return Number(req.session.user.employeeId) === Number(employeeId);
}

module.exports = {
  requireAuth,
  requireAdmin,
  canAccessEmployee
};
