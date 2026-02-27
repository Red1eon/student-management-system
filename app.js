require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const expressLayouts = require('express-ejs-layouts');
const cookieParser = require('cookie-parser');
const methodOverride = require('method-override');
const i18n = require('./config/i18n');
const crypto = require('crypto');
const { applySecurityHeaders } = require('./middleware/securityMiddleware');
const { ensureCsrfToken, csrfProtection } = require('./middleware/csrfMiddleware');
const { setLanguage } = require('./middleware/i18nMiddleware');
const { evaluateAttendanceRisks } = require('./utils/attendanceRiskService');
const attendanceRiskScheduler = require('./utils/attendanceRiskScheduler');

const app = express();
const PORT = process.env.PORT || 3000;
const appHealth = {
  status: 'ok',
  lastAttendanceRiskRun: null,
  lastAttendanceRiskError: null
};

// Database initialization
const { initializeDatabase } = require('./config/database');

// Initialize with error handling
try {
  initializeDatabase();
  console.log('Database initialized');
} catch (err) {
  console.error('Database error:', err);
  process.exit(1);
}

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// View files are managed in source control and should not be generated at runtime.

// ============================================
// MIDDLEWARE
// ============================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(methodOverride('_method'));
app.use(applySecurityHeaders);

// Default title middleware
app.use((req, res, next) => {
  res.locals.title = res.locals.title || 'School Management System';
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// i18n middleware
app.use(i18n.init);
app.use(setLanguage);

// Session configuration
const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET || (
  isProduction ? null : crypto.randomBytes(32).toString('hex')
);

if (!sessionSecret) {
  throw new Error('SESSION_SECRET is required in production');
}

if (!process.env.SESSION_SECRET && !isProduction) {
  console.warn('SESSION_SECRET not set; using ephemeral development secret.');
}

if (isProduction) {
  app.set('trust proxy', 1);
}

const sessionConfig = {
  store: new SQLiteStore({ 
    db: 'sessions.db', 
    dir: './',
    concurrentDB: true 
  }),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction
  },
  name: 'school.sid'
};

app.use(session(sessionConfig));
app.use(ensureCsrfToken);
app.use(csrfProtection);

function getDashboardPath(user) {
  if (!user) return '/auth/login';
  switch (user.userType || user.user_type) {
    case 'teacher':
      return '/teacher/dashboard';
    case 'student':
      return '/student/dashboard';
    case 'parent':
      return '/parent/dashboard';
    default:
      return '/dashboard';
  }
}

// Global middleware
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.currentPath = req.path;
  res.locals.locale = req.getLocale ? req.getLocale() : 'en';
  res.locals.__ = res.__ ? res.__.bind(res) : ((text) => text);
  res.locals.dashboardPath = getDashboardPath(req.session.user);
  res.locals.messages = req.session.messages || [];
  delete req.session.messages;
  next();
});

app.get('/health', (req, res) => {
  const schedulerStatus = attendanceRiskScheduler.getStatus();
  res.json({
    status: appHealth.status,
    uptime_seconds: Math.floor(process.uptime()),
    last_attendance_risk_run: appHealth.lastAttendanceRiskRun,
    last_attendance_risk_error: appHealth.lastAttendanceRiskError,
    attendance_scheduler: schedulerStatus
  });
});

// ============================================
// ROUTES - SPECIFIC FIRST, CATCH-ALL LAST
// ============================================
const routes = [
  ['/auth', './routes/authRoutes'],
  ['/dashboard', './routes/dashboardRoutes'],
  ['/students', './routes/studentRoutes'],           // Admin manages students
  ['/student', './routes/studentDashboardRoutes'],   // Student portal
  ['/teachers', './routes/teacherRoutes'],           // Admin manages teachers
  ['/teacher', './routes/teacherDashboardRoutes'],   // Teacher portal
  ['/classes', './routes/classRoutes'],
  ['/courses', './routes/courseRoutes'],
  ['/subjects', './routes/subjectRoutes'],
  ['/attendance', './routes/attendanceRoutes'],
  ['/exams', './routes/examRoutes'],
  ['/fees', './routes/feeRoutes'],
  ['/library', './routes/libraryRoutes'],
  ['/events', './routes/eventRoutes'],
  ['/guidance', './routes/guidanceRoutes'],
  ['/notifications', './routes/notificationRoutes'],
  ['/admin', './routes/adminRoutes'],
  ['/profile', './routes/profileRoutes'],
  ['/parent', './routes/parentRoutes'],
  ['/', './routes/index']
];

routes.forEach(([routePath, routeModule]) => {
  app.use(routePath, require(routeModule));
  console.log(`Route loaded: ${routePath}`);
});


// ============================================
// ERROR HANDLING
// ============================================
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).render('error', { 
    title: 'Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
==================================================
  School Management System Started
==================================================
  Local:   http://localhost:${PORT}
  Network: http://0.0.0.0:${PORT}
==================================================
  Login: use configured school account
==================================================
  `);
});

async function runAttendanceRiskJob() {
  try {
    await evaluateAttendanceRisks({ notify: true, createGuidance: true, threshold: 75 });
    appHealth.lastAttendanceRiskRun = new Date().toISOString();
    appHealth.lastAttendanceRiskError = null;
  } catch (err) {
    appHealth.lastAttendanceRiskError = err.message;
    console.error('Attendance risk job failed:', err.message);
  }
}

attendanceRiskScheduler.init(runAttendanceRiskJob, {
  initialDelayMs: 30 * 1000,
  intervalMs: 24 * 60 * 60 * 1000
});

module.exports = app;
