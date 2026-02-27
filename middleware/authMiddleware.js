const StudentModel = require('../models/studentModel');
const RolePermissionModel = require('../models/rolePermissionModel');

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

  const requireStudentAccess = (studentIdParam = 'studentId', allowedRoles = ['admin', 'staff']) => {
    return async (req, res, next) => {
      try {
        if (!req.session.user) return res.redirect('/auth/login');

        const currentUser = req.session.user;
        const role = currentUser.userType || currentUser.user_type;
        if (allowedRoles.includes(role)) return next();

        const studentId = parseInt(req.params[studentIdParam], 10);
        if (!Number.isInteger(studentId) || studentId <= 0) {
          return res.status(400).render('error', { message: 'Invalid student id' });
        }

        const student = await StudentModel.findById(studentId);
        if (!student) {
          return res.status(404).render('404', { title: 'Page Not Found' });
        }

        const currentUserId = currentUser.id || currentUser.user_id;
        const isStudentOwner = role === 'student' && student.user_id === currentUserId;
        const isParentOwner = role === 'parent' && student.parent_id === currentUserId;

        if (isStudentOwner || isParentOwner) return next();
        return res.status(403).render('error', { message: 'Access denied' });
      } catch (error) {
        return res.status(500).render('error', { message: error.message });
      }
    };
  };

  const requirePermission = (permissionKey, fallbackRoles = []) => {
    return async (req, res, next) => {
      try {
        if (!req.session.user) return res.redirect('/auth/login');
        const role = req.session.user.userType || req.session.user.user_type;
        if (fallbackRoles.includes(role)) return next();

        const allowed = await RolePermissionModel.isAllowed(role, permissionKey);
        if (!allowed) {
          return res.status(403).render('error', { message: 'Access denied' });
        }
        return next();
      } catch (error) {
        return res.status(500).render('error', { message: error.message });
      }
    };
  };
  
  module.exports = { requireAuth, requireRole, requireOwnershipOrRole, requireStudentAccess, requirePermission };
