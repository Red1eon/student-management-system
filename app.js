require('dotenv').config();

// Node 24 compatibility fixes
process.env.NODE_NO_WARNINGS = 1;

const express = require('express');
const path = require('path');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const expressLayouts = require('express-ejs-layouts');
const cookieParser = require('cookie-parser');
const methodOverride = require('method-override');
const i18n = require('./config/i18n');
const fs = require('fs');
const { applySecurityHeaders } = require('./middleware/securityMiddleware');
const { ensureCsrfToken, csrfProtection } = require('./middleware/csrfMiddleware');
const { setLanguage } = require('./middleware/i18nMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Database initialization
const { initializeDatabase } = require('./config/database');

// Initialize with error handling
try {
  initializeDatabase();
  console.log('? Database initialized');
} catch (err) {
  console.error('? Database error:', err);
  process.exit(1);
}

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// ============================================
//  ALL REQUIRED VIEWS
// ============================================
const requiredViews = {
  // Dashboard
  'dashboard/index.ejs': { title: 'Dashboard', hasStats: true },
  
  // Auth
  'auth/login.ejs': { title: 'Login', layout: false },
  'auth/register.ejs': { title: 'Register', layout: false },
  
  // Attendance
  'attendance/index.ejs': { title: 'Attendance', actions: ['mark', 'report'] },
  'attendance/mark.ejs': { title: 'Mark Attendance', backLink: '/attendance' },
  'attendance/report.ejs': { title: 'Attendance Report', backLink: '/attendance' },
  'attendance/student.ejs': { title: 'Student Attendance', backLink: '/students' },
  
  // Exams
  'exams/index.ejs': { title: 'Exams', actions: ['create'] },
  'exams/create.ejs': { title: 'Create Exam', backLink: '/exams' },
  'exams/detail.ejs': { title: 'Exam Details', backLink: '/exams' },
  'exams/student-results.ejs': { title: 'Student Results', backLink: '/exams' },
  
  // Fees
  'fees/index.ejs': { title: 'Fee Management', actions: ['record', 'structure'] },
  'fees/record.ejs': { title: 'Record Payment', backLink: '/fees' },
  'fees/receipt.ejs': { title: 'Payment Receipt', backLink: '/fees' },
  'fees/structure.ejs': { title: 'Fee Structure', backLink: '/fees' },
  'fees/student.ejs': { title: 'Student Fees', backLink: '/students' },
  'fees/add.ejs': { title: 'Add Fee Structure', backLink: '/fees/structure' },
  
  // Library
  'library/index.ejs': { title: 'Library', actions: ['books', 'issue'] },
  'library/books.ejs': { title: 'Books', backLink: '/library', actions: ['add'] },
  'library/issue.ejs': { title: 'Issue Book', backLink: '/library' },
  'library/add-book.ejs': { title: 'Add Book', backLink: '/library/books' },
  'library/user-books.ejs': { title: 'My Books', backLink: '/library' },
  
  // Students
  'students/index.ejs': { title: 'Students', actions: ['add'] },
  'students/add.ejs': { title: 'Add Student', backLink: '/students' },
  'students/detail.ejs': { title: 'Student Details', backLink: '/students' },
  'students/edit.ejs': { title: 'Edit Student', backLink: '/students' },
  'students/dashboard.ejs': { title: 'Student Dashboard' },
  'students/my-attendance.ejs': { title: 'My Attendance', backLink: '/student/dashboard' },
  'students/my-results.ejs': { title: 'My Results', backLink: '/student/dashboard' },
  'students/my-timetable.ejs': { title: 'My Timetable', backLink: '/student/dashboard' },
  'students/my-fees.ejs': { title: 'My Fees', backLink: '/student/dashboard' },
  'students/my-profile.ejs': { title: 'My Profile', backLink: '/student/dashboard' },

  // Teachers
  'teachers/index.ejs': { title: 'Teachers', actions: ['add'] },
  'teachers/add.ejs': { title: 'Add Teacher', backLink: '/teachers' },
  'teachers/detail.ejs': { title: 'Teacher Details', backLink: '/teachers' },
  
  // Classes
  'classes/index.ejs': { title: 'Classes', actions: ['add'] },
  'classes/add.ejs': { title: 'Add Class', backLink: '/classes' },
  'classes/detail.ejs': { title: 'Class Details', backLink: '/classes' },
  
  // Events
  'events/index.ejs': { title: 'Events', actions: ['create', 'calendar'] },
  'events/create.ejs': { title: 'Create Event', backLink: '/events' },
  'events/detail.ejs': { title: 'Event Details', backLink: '/events' },
  'events/calendar.ejs': { title: 'Event Calendar', backLink: '/events' },
  
  // Notifications
  'notifications/index.ejs': { title: 'Notifications', actions: ['create'] },
  'notifications/create.ejs': { title: 'Send Notification', backLink: '/notifications' },
  
  // Profile
  'profile/index.ejs': { title: 'My Profile', actions: ['edit', 'change-password'] },
  'profile/edit.ejs': { title: 'Edit Profile', backLink: '/profile' },
  'profile/change-password.ejs': { title: 'Change Password', backLink: '/profile' },
  
  // Errors
  '404.ejs': { title: 'Page Not Found', layout: false },
  'error.ejs': { title: 'Error', layout: false }
};

// Generate view content based on configuration
function generateViewContent(viewPath, config) {
  const { title, layout, backLink, actions, hasStats } = config;
  
  // Special layouts
  if (layout === false) {
    if (viewPath.includes('auth/login')) {
      return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | School Management System</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/style.css">
</head>
<body class="gradient-bg min-h-screen flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div class="text-center mb-8">
            <div class="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <i class="fas fa-graduation-cap text-3xl text-white"></i>
            </div>
            <h1 class="text-3xl font-bold text-gray-800">EduPortal</h1>
            <p class="text-gray-500 mt-2">School Management System</p>
        </div>
        <% if (locals.error) { %>
            <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"><%= error %></div>
        <% } %>
        <form action="/auth/login" method="POST" class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <div class="relative">
                    <i class="fas fa-user absolute left-3 top-3 text-gray-400"></i>
                    <input type="text" name="username" required class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                </div>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div class="relative">
                    <i class="fas fa-lock absolute left-3 top-3 text-gray-400"></i>
                    <input type="password" name="password" required class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                </div>
            </div>
            <button type="submit" class="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg">Sign In</button>
        </form>
        <div class="mt-6 text-center text-sm text-gray-500">
            <p>Demo: admin / admin123</p>
        </div>
    </div>
</body>
</html>`;
    }
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | School Management System</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center">
    <div class="text-center">
        <h1 class="text-6xl font-bold text-gray-300 mb-4">${title === 'Page Not Found' ? '404' : 'Error'}</h1>
        <h2 class="text-2xl font-semibold text-gray-800 mb-2">${title}</h2>
        <p class="text-gray-600 mb-6"><%= typeof message !== 'undefined' ? message : 'Something went wrong' %></p>
        <a href="/dashboard" class="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Go to Dashboard</a>
    </div>
</body>
</html>`;
  }

  // Standard page with layout
  let actionsHtml = '';
  if (actions) {
    const actionButtons = {
      'mark': { href: '/attendance/mark', color: 'blue', icon: 'clipboard-check', text: 'Mark Attendance' },
      'report': { href: '/attendance/report', color: 'green', icon: 'chart-bar', text: 'View Report' },
      'create': { href: `/${viewPath.split('/')[0]}/create`, color: 'purple', icon: 'plus', text: `Create ${title.split(' ')[0]}` },
      'add': { href: `/${viewPath.split('/')[0]}/add`, color: 'blue', icon: 'plus', text: `Add ${title.split(' ')[0]}` },
      'record': { href: '/fees/record', color: 'yellow', icon: 'cash-register', text: 'Record Payment' },
      'structure': { href: '/fees/structure', color: 'gray', icon: 'list', text: 'Fee Structure' },
      'books': { href: '/library/books', color: 'blue', icon: 'book', text: 'View Books' },
      'issue': { href: '/library/issue', color: 'purple', icon: 'hand-holding', text: 'Issue Book' },
      'calendar': { href: '/events/calendar', color: 'green', icon: 'calendar', text: 'Calendar' },
      'edit': { href: '/profile/edit', color: 'blue', icon: 'edit', text: 'Edit Profile' },
      'change-password': { href: '/profile/change-password', color: 'yellow', icon: 'key', text: 'Change Password' }
    };
    
    const buttons = actions.map(a => {
      const btn = actionButtons[a];
      if (!btn) return '';
      return `<a href="${btn.href}" class="bg-${btn.color}-600 text-white px-4 py-2 rounded-lg hover:bg-${btn.color}-700">
        <i class="fas fa-${btn.icon} mr-2"></i> ${btn.text}
      </a>`;
    }).join('');
    
    actionsHtml = `<div class="flex flex-wrap gap-4 mb-6">${buttons}</div>`;
  }

  const backButton = backLink ? `<a href="${backLink}" class="text-blue-600 hover:underline mb-4 inline-block"><i class="fas fa-arrow-left mr-2"></i> Back</a>` : '';
  
  const statsSection = hasStats ? `
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
      <div class="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
        <p class="text-gray-500 text-sm">Total Students</p>
        <h3 class="text-3xl font-bold text-gray-800"><%= typeof stats !== 'undefined' ? stats.total_students : 0 %></h3>
      </div>
      <div class="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
        <p class="text-gray-500 text-sm">Total Teachers</p>
        <h3 class="text-3xl font-bold text-gray-800"><%= typeof stats !== 'undefined' ? stats.total_teachers : 0 %></h3>
      </div>
      <div class="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
        <p class="text-gray-500 text-sm">Today's Attendance</p>
        <h3 class="text-3xl font-bold text-gray-800"><%= typeof stats !== 'undefined' ? stats.today_attendance : 0 %></h3>
      </div>
      <div class="bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-500">
        <p class="text-gray-500 text-sm">Total Classes</p>
        <h3 class="text-3xl font-bold text-gray-800"><%= typeof stats !== 'undefined' ? stats.total_classes : 0 %></h3>
      </div>
    </div>
  ` : '';

  const dataTable = !hasStats && !viewPath.includes('add') && !viewPath.includes('create') && !viewPath.includes('edit') ? `
    <div class="bg-white rounded-xl shadow-lg overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr>
            <td class="px-6 py-4 text-gray-500 text-center" colspan="3">No data available</td>
          </tr>
        </tbody>
      </table>
    </div>
  ` : (viewPath.includes('add') || viewPath.includes('create') || viewPath.includes('edit') ? `
    <div class="bg-white rounded-xl shadow-lg p-6">
      <form class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
        </div>
        <div class="flex justify-end space-x-3">
          <a href="${backLink || '/'}" class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</a>
          <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
        </div>
      </form>
    </div>
  ` : '');

  return `<div class="space-y-6 animate-fade-in">
  ${backButton}
  <h2 class="text-2xl font-bold text-gray-800">${title}</h2>
  ${actionsHtml}
  ${statsSection}
  ${dataTable}
</div>`;
}

// Create all views
Object.entries(requiredViews).forEach(([viewPath, config]) => {
  const fullPath = path.join(__dirname, 'views', viewPath);
  
  if (!fs.existsSync(fullPath)) {
    const dir = path.dirname(fullPath);
    fs.mkdirSync(dir, { recursive: true });
    
    const content = generateViewContent(viewPath, config);
    fs.writeFileSync(fullPath, content);
    console.log(`? Auto-created: ${viewPath}`);
  }
});

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
const sessionConfig = {
  store: new SQLiteStore({ 
    db: 'sessions.db', 
    dir: './',
    concurrentDB: true 
  }),
  secret: process.env.SESSION_SECRET || 'defaultsecretchangeme',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 24 * 60 * 60 * 1000,
    secure: false
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
  ['/subjects', './routes/subjectRoutes'],
  ['/attendance', './routes/attendanceRoutes'],
  ['/exams', './routes/examRoutes'],
  ['/fees', './routes/feeRoutes'],
  ['/library', './routes/libraryRoutes'],
  ['/events', './routes/eventRoutes'],
  ['/notifications', './routes/notificationRoutes'],
  ['/profile', './routes/profileRoutes'],
  ['/parent', './routes/parentRoutes'],
  ['/', './routes/index']
];

routes.forEach(([routePath, routeModule]) => {
  try {
    app.use(routePath, require(routeModule));
    console.log(`? Route loaded: ${routePath}`);
  } catch (err) {
    console.warn(`?? Route skipped: ${routePath} - ${err.message}`);
  }
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
??????????????????????????????????????????????????
?     ? School Management System Started        ?
??????????????????????????????????????????????????
?  Local:   http://localhost:${PORT}             ?
?  Network: http://0.0.0.0:${PORT}               ?
??????????????????????????????????????????????????
?  Login: admin / admin123                       ?
??????????????????????????????????????????????????
  `);
});

module.exports = app;
