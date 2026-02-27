const UserModel = require('../models/userModel');
const StudentModel = require('../models/studentModel');
const TeacherModel = require('../models/teacherModel');
const { logAudit } = require('../utils/auditLogger');
const AppSettingModel = require('../models/appSettingModel');
const LoginAttemptModel = require('../models/loginAttemptModel');

function getRequestIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.connection?.remoteAddress || null;
}

async function resolveLockoutConfig() {
  const maxAttempts = await AppSettingModel.getNumber('security.max_failed_login_attempts', 5);
  const windowMinutes = await AppSettingModel.getNumber('security.lockout_window_minutes', 15);
  const lockoutMinutes = await AppSettingModel.getNumber('security.lockout_duration_minutes', 15);
  return {
    maxAttempts: Math.max(1, maxAttempts),
    windowMinutes: Math.max(1, windowMinutes),
    lockoutMinutes: Math.max(1, lockoutMinutes)
  };
}

function isTemporarilyLocked(lastAttemptAt, count, config) {
  if (!lastAttemptAt || count < config.maxAttempts) return false;
  const last = new Date(lastAttemptAt).getTime();
  if (!Number.isFinite(last)) return false;
  const elapsedMinutes = (Date.now() - last) / (1000 * 60);
  return elapsedMinutes < config.lockoutMinutes;
}

const authController = {
  getLogin: (req, res) => {
    if (req.session.user) {
      // Redirect based on role if already logged in
      return redirectBasedOnRole(req.session.user, res);
    }
    res.render('auth/login', { title: 'Login', layout: false });
  },

  postLogin: async (req, res) => {
    const { username, password } = req.body;
    
    try {
      const ipAddress = getRequestIp(req);
      const config = await resolveLockoutConfig();
      const recentFailureMeta = await LoginAttemptModel.countRecentFailures({
        username,
        ipAddress,
        windowMinutes: config.windowMinutes
      });

      if (isTemporarilyLocked(recentFailureMeta.lastAttemptAt, recentFailureMeta.count, config)) {
        await LoginAttemptModel.record({ username, ipAddress, success: false, reason: 'account_locked' });
        await logAudit(req, 'LOGIN_FAILED', 'user', username, { reason: 'account_locked' });
        return res.render('auth/login', {
          title: 'Login',
          layout: false,
          error: `Too many failed attempts. Try again in about ${config.lockoutMinutes} minutes.`
        });
      }

      const user = await UserModel.findByUsername(username);
      
      if (!user || !(await UserModel.verifyPassword(password, user.password_hash))) {
        await LoginAttemptModel.record({ username, ipAddress, success: false, reason: 'invalid_credentials' });
        await logAudit(req, 'LOGIN_FAILED', 'user', username, { reason: 'invalid_credentials' });
        return res.render('auth/login', { 
          title: 'Login', 
          layout: false,
          error: 'Invalid credentials' 
        });
      }

      if (!user.is_active) {
        await LoginAttemptModel.record({ username, ipAddress, success: false, reason: 'account_disabled' });
        await logAudit(req, 'LOGIN_FAILED', 'user', user.user_id, { reason: 'account_disabled' });
        return res.render('auth/login', { 
          title: 'Login', 
          layout: false,
          error: 'Account is disabled' 
        });
      }

      // Build session user
      const sessionUser = {
        id: user.user_id,
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        first_name: user.first_name,
        lastName: user.last_name,
        last_name: user.last_name,
        userType: user.user_type,
        user_type: user.user_type,
        profilePicture: user.profile_picture
      };

      // Get additional data based on user type
      if (user.user_type === 'student') {
        const student = await StudentModel.findByUserId(user.user_id);
        sessionUser.studentId = student?.student_id;
        sessionUser.student_id = student?.student_id;
      } else if (user.user_type === 'teacher') {
        const teacher = await TeacherModel.findByUserId(user.user_id);
        sessionUser.teacherId = teacher?.teacher_id;
        sessionUser.teacher_id = teacher?.teacher_id;
      }

      req.session.user = sessionUser;
      await LoginAttemptModel.record({ username, ipAddress, success: true, reason: 'login_success' });
      await logAudit(req, 'LOGIN_SUCCESS', 'user', user.user_id, { user_type: user.user_type });

      // Redirect based on role
      if (user.user_type === 'admin') {
        return res.redirect('/dashboard');
      } else if (user.user_type === 'teacher') {
        return res.redirect('/teacher/dashboard');
      } else if (user.user_type === 'student') {
        return res.redirect('/student/dashboard');
      } else if (user.user_type === 'parent') {
        return res.redirect('/parent/dashboard');
      } else {
        return res.redirect('/dashboard');
      }
      
    } catch (error) {
      console.error('Login error:', error);
      await LoginAttemptModel.record({ username, ipAddress: getRequestIp(req), success: false, reason: 'system_error' });
      await logAudit(req, 'LOGIN_FAILED', 'user', username, { reason: 'system_error' });
      res.render('auth/login', { 
        title: 'Login', 
        layout: false,
        error: 'System error' 
      });
    }
  },

  getRegister: (req, res) => {
    res.render('auth/register', { title: 'Register', layout: false });
  },

  postRegister: async (req, res) => {
    try {
      const userId = await UserModel.create(req.body);
      res.redirect('/auth/login?registered=true');
    } catch (error) {
      res.render('auth/register', { 
        title: 'Register', 
        layout: false,
        error: error.message 
      });
    }
  },

  logout: (req, res) => {
    logAudit(req, 'LOGOUT', 'user', req.session?.user?.id || null, {});
    req.session.destroy();
    res.redirect('/auth/login');
  }
};

// Helper function for role-based redirect
function redirectBasedOnRole(user, res) {
  switch (user.userType) {
    case 'admin':
      return res.redirect('/dashboard');
    case 'teacher':
      return res.redirect('/teacher/dashboard');
    case 'student':
      return res.redirect('/student/dashboard');
    case 'parent':
      return res.redirect('/parent/dashboard');
    default:
      return res.redirect('/dashboard');
  }
}

module.exports = authController;
