const { runQuery, getQuery, allQuery } = require('../config/database');

class EnrollmentModel {
  static async create(enrollmentData) {
    const { student_id, class_id, academic_year, enrollment_date, status } = enrollmentData;
    const result = await runQuery(
      `INSERT INTO student_enrollment (student_id, class_id, academic_year, enrollment_date, status)
       VALUES (?, ?, ?, ?, ?)`,
      [student_id, class_id, academic_year, enrollment_date, status || 'active']
    );
    return result.id;
  }

  static async findById(enrollmentId) {
    return await getQuery(
      `SELECT se.*, s.admission_number, u.first_name || ' ' || u.last_name as student_name,
        c.class_name, c.section
       FROM student_enrollment se
       JOIN students s ON se.student_id = s.student_id
       JOIN users u ON s.user_id = u.user_id
       JOIN classes c ON se.class_id = c.class_id
       WHERE se.enrollment_id = ?`,
      [enrollmentId]
    );
  }

  static async getByStudent(studentId) {
    return await allQuery(
      `SELECT se.*, c.class_name, c.section
       FROM student_enrollment se
       JOIN classes c ON se.class_id = c.class_id
       WHERE se.student_id = ?
       ORDER BY se.academic_year DESC`,
      [studentId]
    );
  }

  static async getByClass(classId, academicYear) {
    return await allQuery(
      `SELECT se.*, s.admission_number, u.first_name || ' ' || u.last_name as student_name,
        u.email, u.phone
       FROM student_enrollment se
       JOIN students s ON se.student_id = s.student_id
       JOIN users u ON s.user_id = u.user_id
       WHERE se.class_id = ? AND se.academic_year = ? AND se.status = 'active'`,
      [classId, academicYear]
    );
  }

  static async updateStatus(enrollmentId, status) {
    const result = await runQuery(
      'UPDATE student_enrollment SET status = ? WHERE enrollment_id = ?',
      [status, enrollmentId]
    );
    return result.changes > 0;
  }

  static async getCurrentEnrollment(studentId) {
    return await getQuery(
      `SELECT se.*, c.class_name, c.section
       FROM student_enrollment se
       JOIN classes c ON se.class_id = c.class_id
       WHERE se.student_id = ? AND se.status = 'active'
       ORDER BY se.enrollment_date DESC LIMIT 1`,
      [studentId]
    );
  }
}

module.exports = EnrollmentModel;