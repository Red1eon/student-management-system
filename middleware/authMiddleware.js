const requireAuth = (req, res, next) => {
    if (!req.session.user) {
      return res.redirect('/auth/login');
    }
    next();
  };
  
  const requireRole = (roles) => {
    return (req, res, next) => {
      if (!req.session.user) return res.redirect('/auth/login');
      const role = req.session.user.userType || req.session.user.user_type;
      if (!roles.includes(role)) {
        return res.status(403).render('error', { message: 'Access denied' });
      }
      next();
    };
  };
  
  const requireOwnershipOrRole = (userIdParam, allowedRoles) => {
    return (req, res, next) => {
      const userId = req.params[userIdParam];
      const currentUser = req.session.user;
      
      const role = currentUser.userType || currentUser.user_type;
      if (allowedRoles.includes(role)) return next();
      if (currentUser.id === parseInt(userId)) return next();
      
      return res.status(403).render('error', { message: 'Access denied' });
    };
  };
  
  module.exports = { requireAuth, requireRole, requireOwnershipOrRole };
