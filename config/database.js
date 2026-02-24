const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

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
      capacity INTEGER DEFAULT 30,
      room_number TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_teacher_id) REFERENCES users(user_id) ON DELETE SET NULL
    )`);

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
      FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE
    )`);

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
    
    // Create default admin user if not exists
    const defaultPassword = bcrypt.hashSync('admin123', 10);
    
    database.get("SELECT * FROM users WHERE username = 'admin'", (err, row) => {
      if (err) {
        console.error('Error checking admin:', err);
        return;
      }
      if (!row) {
        database.run(
          `INSERT INTO users (username, password_hash, email, first_name, last_name, user_type) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          ['admin', defaultPassword, 'admin@school.edu', 'System', 'Administrator', 'admin'],
          (err) => {
            if (err) console.error('Error creating admin:', err);
            else console.log('Default admin user created');
          }
        );
      }
    });

    // Create default teacher if not exists
    const teacherPassword = bcrypt.hashSync('teacher123', 10);
    
    database.get("SELECT * FROM users WHERE username = 'teacher'", (err, row) => {
      if (err) {
        console.error('Error checking teacher:', err);
        return;
      }
      if (!row) {
        database.run(
          `INSERT INTO users (username, password_hash, email, first_name, last_name, user_type) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          ['teacher', teacherPassword, 'teacher@school.edu', 'John', 'Smith', 'teacher'],
          function(err) {
            if (err) {
              console.error('Error creating teacher user:', err);
              return;
            }
            const userId = this.lastID;
            // Create teacher record
            database.run(
              `INSERT INTO teachers (user_id, employee_number, hire_date, qualification, specialization) 
               VALUES (?, ?, date('now'), 'M.Ed', 'Mathematics')`,
              [userId, 'EMP001'],
              (err) => {
                if (err) console.error('Error creating teacher record:', err);
                else console.log('Default teacher user created');
              }
            );
          }
        );
      }
    });


    // Create or repair default student profile
    const ensureStudentRecord = (userId) => {
      database.get(
        `SELECT student_id FROM students WHERE user_id = ?`,
        [userId],
        (studentErr, studentRow) => {
          if (studentErr) {
            console.error('Error checking student profile:', studentErr);
            return;
          }
          if (studentRow) return;

          database.get(`SELECT class_id FROM classes ORDER BY class_id LIMIT 1`, (classErr, classRow) => {
            if (classErr) {
              console.error('Error finding default class for student:', classErr);
              return;
            }

            const classId = classRow ? classRow.class_id : null;
            const admissionNumber = `ADM${String(userId).padStart(3, '0')}`;

            database.run(
              `INSERT INTO students (user_id, admission_number, admission_date, current_class_id, roll_number)
               VALUES (?, ?, date('now'), ?, '001')`,
              [userId, admissionNumber, classId],
              (insertErr) => {
                if (insertErr) console.error('Error creating student record:', insertErr);
                else console.log('Default student profile ensured');
              }
            );
          });
        }
      );
    };

    const studentPassword = bcrypt.hashSync('student123', 10);
    database.get("SELECT user_id FROM users WHERE username = 'student'", (err, row) => {
      if (err) {
        console.error('Error checking student:', err);
        return;
      }
      if (!row) {
        database.run(
          `INSERT INTO users (username, password_hash, email, first_name, last_name, user_type)
           VALUES (?, ?, ?, ?, ?, ?)`,
          ['student', studentPassword, 'student@school.edu', 'Jane', 'Doe', 'student'],
          function(insertErr) {
            if (insertErr) {
              console.error('Error creating student user:', insertErr);
              return;
            }
            ensureStudentRecord(this.lastID);
          }
        );
      } else {
        ensureStudentRecord(row.user_id);
      }
    });

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
