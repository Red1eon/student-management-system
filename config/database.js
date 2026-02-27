const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || './student_management.db';

let db;

function getDatabase() {
  if (!db) {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) console.error('Database connection failed:', err);
      else console.log('Connected to SQLite database');
    });
  }
  return db;
}

function initializeDatabase() {
  const database = getDatabase();
  
  database.serialize(() => {
    // Enable foreign keys
    database.run('PRAGMA foreign_keys = ON');

    // Users table
    database.run(`CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      date_of_birth TEXT,
      gender TEXT CHECK(gender IN ('Male', 'Female', 'Other')),
      user_type TEXT CHECK(user_type IN ('admin', 'teacher', 'student', 'parent', 'staff')) NOT NULL,
      profile_picture TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Departments
    database.run(`CREATE TABLE IF NOT EXISTS departments (
      department_id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_name TEXT NOT NULL,
      department_code TEXT UNIQUE NOT NULL,
      description TEXT,
      head_of_department INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (head_of_department) REFERENCES users(user_id) ON DELETE SET NULL
    )`);

    // Classes
    database.run(`CREATE TABLE IF NOT EXISTS classes (
      class_id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_name TEXT NOT NULL,
      class_code TEXT UNIQUE NOT NULL,
      section TEXT,
      academic_year TEXT NOT NULL,
      class_teacher_id INTEGER,
      course_id INTEGER,
      capacity INTEGER DEFAULT 30,
      room_number TEXT,
      course_type TEXT DEFAULT 'other',
      course_fee REAL DEFAULT 0,
      fee_payment_plan TEXT DEFAULT 'one_time',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_teacher_id) REFERENCES users(user_id) ON DELETE SET NULL,
      FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE SET NULL
    )`);

    // Backfill course-related columns for existing databases.
    database.run(`ALTER TABLE classes ADD COLUMN course_id INTEGER`, () => {});
    database.run(`ALTER TABLE classes ADD COLUMN course_type TEXT DEFAULT 'other'`, () => {});
    database.run(`ALTER TABLE classes ADD COLUMN course_fee REAL DEFAULT 0`, () => {});
    database.run(`ALTER TABLE classes ADD COLUMN fee_payment_plan TEXT DEFAULT 'one_time'`, () => {});

    // Subjects
    database.run(`CREATE TABLE IF NOT EXISTS subjects (
      subject_id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_name TEXT NOT NULL,
      subject_code TEXT UNIQUE NOT NULL,
      description TEXT,
      credits INTEGER DEFAULT 3,
      department_id INTEGER,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(department_id) ON DELETE SET NULL
    )`);

    // Courses
    database.run(`CREATE TABLE IF NOT EXISTS courses (
      course_id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_name TEXT NOT NULL,
      course_code TEXT UNIQUE NOT NULL,
      course_type TEXT CHECK(course_type IN ('certificate', 'diploma', 'degree', 'short_course', 'other')) DEFAULT 'other',
      fee_amount REAL NOT NULL DEFAULT 0,
      fee_payment_plan TEXT CHECK(fee_payment_plan IN ('one_time', 'monthly', 'quarterly', 'yearly', 'installment', 'flexible')) DEFAULT 'one_time',
      fee_payment_description TEXT,
      is_active INTEGER DEFAULT 1,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
    )`);

    // Expand legacy courses.fee_payment_plan CHECK to include "flexible".
    database.get(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'courses'`, (schemaErr, schemaRow) => {
      if (schemaErr) {
        console.error('Error checking courses schema:', schemaErr);
        return;
      }
      const coursesSql = String(schemaRow?.sql || '').toLowerCase();
      if (!coursesSql || coursesSql.includes("'flexible'")) return;

      database.serialize(() => {
        database.run('PRAGMA foreign_keys = OFF');
        database.run('DROP TABLE IF EXISTS courses_migrated');
        database.run(`CREATE TABLE courses_migrated (
          course_id INTEGER PRIMARY KEY AUTOINCREMENT,
          course_name TEXT NOT NULL,
          course_code TEXT UNIQUE NOT NULL,
          course_type TEXT CHECK(course_type IN ('certificate', 'diploma', 'degree', 'short_course', 'other')) DEFAULT 'other',
          fee_amount REAL NOT NULL DEFAULT 0,
          fee_payment_plan TEXT CHECK(fee_payment_plan IN ('one_time', 'monthly', 'quarterly', 'yearly', 'installment', 'flexible')) DEFAULT 'one_time',
          fee_payment_description TEXT,
          is_active INTEGER DEFAULT 1,
          created_by INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
        )`);
        database.run(`INSERT INTO courses_migrated (
            course_id, course_name, course_code, course_type, fee_amount, fee_payment_plan,
            fee_payment_description, is_active, created_by, created_at, updated_at
          )
          SELECT
            course_id, course_name, course_code, course_type, fee_amount, fee_payment_plan,
            fee_payment_description, is_active, created_by, created_at, updated_at
          FROM courses`);
        database.run('DROP TABLE courses');
        database.run('ALTER TABLE courses_migrated RENAME TO courses');
        database.run('PRAGMA foreign_keys = ON');
      });
    });

    // Students
    database.run(`CREATE TABLE IF NOT EXISTS students (
      student_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      admission_number TEXT UNIQUE NOT NULL,
      admission_date TEXT NOT NULL,
      current_class_id INTEGER,
      roll_number TEXT,
      parent_id INTEGER,
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      medical_conditions TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (current_class_id) REFERENCES classes(class_id) ON DELETE SET NULL,
      FOREIGN KEY (parent_id) REFERENCES users(user_id) ON DELETE SET NULL
    )`);

    // Teachers
    database.run(`CREATE TABLE IF NOT EXISTS teachers (
      teacher_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      employee_number TEXT UNIQUE NOT NULL,
      hire_date TEXT NOT NULL,
      qualification TEXT,
      specialization TEXT,
      department_id INTEGER,
      is_class_teacher INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(department_id) ON DELETE SET NULL
    )`);

    // Teacher-Subject Assignment
    database.run(`CREATE TABLE IF NOT EXISTS teacher_subjects (
      teacher_subject_id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      class_id INTEGER NOT NULL,
      academic_year TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(teacher_id, subject_id, class_id, academic_year),
      FOREIGN KEY (teacher_id) REFERENCES teachers(teacher_id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(subject_id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE
    )`);

    // Student Enrollment
    database.run(`CREATE TABLE IF NOT EXISTS student_enrollment (
      enrollment_id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      class_id INTEGER NOT NULL,
      academic_year TEXT NOT NULL,
      enrollment_date TEXT NOT NULL,
      status TEXT CHECK(status IN ('active', 'completed', 'dropped')) DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, class_id, academic_year),
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE
    )`);

    // Attendance
    database.run(`CREATE TABLE IF NOT EXISTS attendance (
      attendance_id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      class_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      status TEXT CHECK(status IN ('present', 'absent', 'late', 'excused')) NOT NULL,
      remarks TEXT,
      marked_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, class_id, date),
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE,
      FOREIGN KEY (marked_by) REFERENCES users(user_id) ON DELETE SET NULL
    )`);

    // Exams
    database.run(`CREATE TABLE IF NOT EXISTS exams (
      exam_id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_name TEXT NOT NULL,
      exam_type TEXT CHECK(exam_type IN ('quiz', 'midterm', 'final', 'unit_test')) NOT NULL,
      class_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      academic_year TEXT NOT NULL,
      term TEXT,
      total_marks REAL NOT NULL,
      passing_marks REAL NOT NULL,
      exam_date TEXT,
      start_time TEXT,
      end_time TEXT,
      room_number TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(subject_id) ON DELETE CASCADE
    )`);

    // Exam Results
    database.run(`CREATE TABLE IF NOT EXISTS exam_results (
      result_id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      marks_obtained REAL NOT NULL,
      grade TEXT,
      remarks TEXT,
      checked_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(exam_id, student_id),
      FOREIGN KEY (exam_id) REFERENCES exams(exam_id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
      FOREIGN KEY (checked_by) REFERENCES users(user_id) ON DELETE SET NULL
    )`);

    // Timetable
    database.run(`CREATE TABLE IF NOT EXISTS timetable (
      timetable_id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      day_of_week TEXT CHECK(day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')) NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      room_number TEXT,
      academic_year TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(subject_id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES teachers(teacher_id) ON DELETE CASCADE
    )`);

    // Fees Structure
    database.run(`CREATE TABLE IF NOT EXISTS fees_structure (
      fee_id INTEGER PRIMARY KEY AUTOINCREMENT,
      fee_name TEXT NOT NULL,
      class_id INTEGER,
      amount REAL NOT NULL,
      fee_type TEXT CHECK(fee_type IN ('tuition', 'admission', 'exam', 'library', 'sports', 'other')) NOT NULL,
      frequency TEXT CHECK(frequency IN ('one-time', 'monthly', 'quarterly', 'yearly')) NOT NULL,
      academic_year TEXT NOT NULL,
      due_date TEXT,
      is_mandatory INTEGER DEFAULT 1,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE
    )`);
    database.run(`ALTER TABLE fees_structure ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`, () => {});

    // Fee Payments
    database.run(`CREATE TABLE IF NOT EXISTS fee_payments (
      payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      fee_id INTEGER NOT NULL,
      amount_paid REAL NOT NULL,
      payment_date TEXT NOT NULL,
      payment_method TEXT CHECK(payment_method IN ('cash', 'card', 'bank_transfer', 'online')) NOT NULL,
      transaction_id TEXT,
      receipt_number TEXT UNIQUE,
      payment_status TEXT CHECK(payment_status IN ('pending', 'completed', 'failed', 'refunded')) DEFAULT 'completed',
      remarks TEXT,
      received_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
      FOREIGN KEY (fee_id) REFERENCES fees_structure(fee_id) ON DELETE CASCADE,
      FOREIGN KEY (received_by) REFERENCES users(user_id) ON DELETE SET NULL
    )`);

    // Library Books
    database.run(`CREATE TABLE IF NOT EXISTS books (
      book_id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      publisher TEXT,
      isbn TEXT UNIQUE,
      category TEXT,
      quantity INTEGER DEFAULT 1,
      available_quantity INTEGER DEFAULT 1,
      shelf_location TEXT,
      publication_year INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Book Issues
    database.run(`CREATE TABLE IF NOT EXISTS book_issues (
      issue_id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      issue_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      return_date TEXT,
      status TEXT CHECK(status IN ('issued', 'returned', 'overdue', 'lost')) DEFAULT 'issued',
      fine_amount REAL DEFAULT 0.00,
      remarks TEXT,
      issued_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (issued_by) REFERENCES users(user_id) ON DELETE SET NULL
    )`);

    // Book Requests
    database.run(`CREATE TABLE IF NOT EXISTS book_requests (
      request_id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      request_date TEXT NOT NULL,
      status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
      remarks TEXT,
      processed_by INTEGER,
      processed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (processed_by) REFERENCES users(user_id) ON DELETE SET NULL
    )`);

    // Events
    database.run(`CREATE TABLE IF NOT EXISTS events (
      event_id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_name TEXT NOT NULL,
      event_type TEXT CHECK(event_type IN ('academic', 'sports', 'cultural', 'meeting', 'holiday')) NOT NULL,
      description TEXT,
      start_date DATETIME NOT NULL,
      end_date DATETIME NOT NULL,
      location TEXT,
      organizer_id INTEGER,
      is_mandatory INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organizer_id) REFERENCES users(user_id) ON DELETE SET NULL
    )`);

    // Notifications
    database.run(`CREATE TABLE IF NOT EXISTS notifications (
      notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      notification_type TEXT CHECK(notification_type IN ('general', 'academic', 'fee', 'event', 'emergency')) NOT NULL,
      target_user_type TEXT CHECK(target_user_type IN ('all', 'students', 'teachers', 'parents', 'staff')),
      target_class_id INTEGER,
      sent_by INTEGER,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      FOREIGN KEY (target_class_id) REFERENCES classes(class_id) ON DELETE CASCADE,
      FOREIGN KEY (sent_by) REFERENCES users(user_id) ON DELETE SET NULL
    )`);

    // User Notifications
    database.run(`CREATE TABLE IF NOT EXISTS user_notifications (
      user_notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
      notification_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      is_read INTEGER DEFAULT 0,
      read_at DATETIME,
      FOREIGN KEY (notification_id) REFERENCES notifications(notification_id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      UNIQUE(notification_id, user_id)
    )`);

    // Audit Logs
    database.run(`CREATE TABLE IF NOT EXISTS audit_logs (
      log_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
    )`);

    // App Settings
    database.run(`CREATE TABLE IF NOT EXISTS app_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Role-based Permission Overrides
    database.run(`CREATE TABLE IF NOT EXISTS role_permissions (
      role TEXT NOT NULL,
      permission_key TEXT NOT NULL,
      allowed INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (role, permission_key)
    )`);

    // Login Attempt Tracking (for lockout and monitoring)
    database.run(`CREATE TABLE IF NOT EXISTS login_attempts (
      attempt_id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      ip_address TEXT,
      was_success INTEGER DEFAULT 0,
      reason TEXT,
      attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Delivery logs per notification/channel/user
    database.run(`CREATE TABLE IF NOT EXISTS notification_deliveries (
      delivery_id INTEGER PRIMARY KEY AUTOINCREMENT,
      notification_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      channel TEXT CHECK(channel IN ('in_app', 'email', 'sms')) NOT NULL,
      delivery_status TEXT CHECK(delivery_status IN ('queued', 'delivered', 'failed')) DEFAULT 'queued',
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      last_attempt_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (notification_id) REFERENCES notifications(notification_id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )`);
    database.run(`CREATE INDEX IF NOT EXISTS idx_login_attempts_username_time ON login_attempts(username, attempted_at DESC)`);
    database.run(`CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status ON notification_deliveries(delivery_status, created_at DESC)`);

    // Guidance Records (student counseling/advising notes)
    database.run(`CREATE TABLE IF NOT EXISTS guidance_records (
      guidance_id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      teacher_id INTEGER,
      guidance_date TEXT NOT NULL,
      category TEXT CHECK(category IN ('academic', 'behavior', 'career', 'attendance', 'wellbeing', 'other')) DEFAULT 'academic',
      notes TEXT NOT NULL,
      follow_up TEXT,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES teachers(teacher_id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
    )`);

    // Attendance risk alert notification dedupe log
    database.run(`CREATE TABLE IF NOT EXISTS attendance_alert_notifications (
      alert_log_id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_date TEXT NOT NULL,
      student_id INTEGER NOT NULL,
      level TEXT CHECK(level IN ('notice', 'warning', 'danger')) NOT NULL,
      reason TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(alert_date, student_id, level, reason),
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
    )`);

    // Attendance correction workflow
    database.run(`CREATE TABLE IF NOT EXISTS attendance_corrections (
      correction_id INTEGER PRIMARY KEY AUTOINCREMENT,
      attendance_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      requested_by INTEGER NOT NULL,
      requested_status TEXT CHECK(requested_status IN ('present', 'absent', 'late', 'excused')) NOT NULL,
      reason TEXT NOT NULL,
      status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
      reviewed_by INTEGER,
      review_comment TEXT,
      reviewed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (attendance_id) REFERENCES attendance(attendance_id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
      FOREIGN KEY (requested_by) REFERENCES users(user_id) ON DELETE SET NULL,
      FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL
    )`);

    // Period-level attendance (by period/subject)
    database.run(`CREATE TABLE IF NOT EXISTS attendance_period_records (
      period_attendance_id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      class_id INTEGER NOT NULL,
      subject_id INTEGER,
      date TEXT NOT NULL,
      period_label TEXT NOT NULL,
      status TEXT CHECK(status IN ('present', 'absent', 'late', 'excused')) NOT NULL,
      remarks TEXT,
      marked_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, class_id, date, period_label),
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE,
       FOREIGN KEY (subject_id) REFERENCES subjects(subject_id) ON DELETE SET NULL,
       FOREIGN KEY (marked_by) REFERENCES users(user_id) ON DELETE SET NULL
     )`);

    // Configurable period master per class
    database.run(`CREATE TABLE IF NOT EXISTS attendance_periods (
      period_id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      period_label TEXT NOT NULL,
      sort_order INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(class_id, period_label),
      FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE
    )`);

    // ==================== DEFAULT USERS ====================
    // Ensure baseline academic data exists for admin forms.
    database.get(`SELECT COUNT(*) AS count FROM departments`, (deptErr, deptRow) => {
      if (deptErr) {
        console.error('Error checking departments:', deptErr);
      } else if (!deptRow || deptRow.count === 0) {
        database.run(
          `INSERT INTO departments (department_name, department_code, description)
           VALUES (?, ?, ?)`,
          ['General Studies', 'GEN', 'Default department'],
          (insertErr) => {
            if (insertErr) console.error('Error creating default department:', insertErr);
            else console.log('Default department created');
          }
        );
      }
    });

    database.get(`SELECT COUNT(*) AS count FROM classes`, (classErr, classRow) => {
      if (classErr) {
        console.error('Error checking classes:', classErr);
      } else if (!classRow || classRow.count === 0) {
        const year = String(new Date().getFullYear());
        database.run(
          `INSERT INTO classes (class_name, class_code, section, academic_year, capacity)
           VALUES (?, ?, ?, ?, ?)`,
          ['Grade 1', 'CLS001', 'A', year, 30],
          (insertErr) => {
            if (insertErr) console.error('Error creating default class:', insertErr);
            else console.log('Default class created');
          }
        );
      }
    });

    database.get(`SELECT COUNT(*) AS count FROM subjects`, (subErr, subRow) => {
      if (subErr) {
        console.error('Error checking subjects:', subErr);
      } else if (!subRow || subRow.count === 0) {
        database.get(`SELECT department_id FROM departments ORDER BY department_id LIMIT 1`, (firstDeptErr, firstDept) => {
          if (firstDeptErr) {
            console.error('Error finding default department for subject:', firstDeptErr);
            return;
          }
          database.run(
            `INSERT INTO subjects (subject_name, subject_code, description, credits, department_id)
             VALUES (?, ?, ?, ?, ?)`,
            ['Mathematics', 'MATH001', 'Default subject', 3, firstDept ? firstDept.department_id : null],
            (insertErr) => {
              if (insertErr) console.error('Error creating default subject:', insertErr);
              else console.log('Default subject created');
            }
          );
        });
      }
    });
    
    // Optional admin bootstrap without hardcoded credentials.
    const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD;
    if (seedAdminPassword) {
      const seedAdminUsername = process.env.SEED_ADMIN_USERNAME || 'admin';
      const seedAdminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@school.edu';
      const seedAdminFirstName = process.env.SEED_ADMIN_FIRST_NAME || 'System';
      const seedAdminLastName = process.env.SEED_ADMIN_LAST_NAME || 'Administrator';
      const seedAdminPasswordHash = bcrypt.hashSync(seedAdminPassword, 10);

      database.get(`SELECT * FROM users WHERE username = ?`, [seedAdminUsername], (err, row) => {
        if (err) {
          console.error('Error checking admin seed user:', err);
          return;
        }
        if (!row) {
          database.run(
            `INSERT INTO users (username, password_hash, email, first_name, last_name, user_type)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [seedAdminUsername, seedAdminPasswordHash, seedAdminEmail, seedAdminFirstName, seedAdminLastName, 'admin'],
            (insertErr) => {
              if (insertErr) console.error('Error creating admin seed user:', insertErr);
              else console.log('Admin seed user created');
            }
          );
        }
      });
    } else {
      console.log('Admin seed skipped (SEED_ADMIN_PASSWORD not set)');
    }

    // Default security settings
    database.run(
      `INSERT OR IGNORE INTO app_settings (setting_key, setting_value)
       VALUES
       ('security.password_min_length', '8'),
       ('security.password_require_number', '1'),
       ('security.password_require_special', '0'),
       ('security.max_failed_login_attempts', '5'),
       ('security.lockout_window_minutes', '15'),
       ('security.lockout_duration_minutes', '15')`
    );

    console.log('Database tables initialized');
  });
}

// Promise wrappers
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDatabase().run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDatabase().get(sql, params, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDatabase().all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  getDatabase,
  initializeDatabase,
  runQuery,
  getQuery,
  allQuery
};

