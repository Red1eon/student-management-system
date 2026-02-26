const { runQuery, getQuery, allQuery } = require('../config/database');

class StudentModel {
  
  // Create new student
  static async create(studentData) {
    const {
      user_id, admission_number, admission_date, current_class_id,
      roll_number, parent_id, emergency_contact_name, 
      emergency_contact_phone, medical_conditions
    } = studentData;
    
    const result = await runQuery(
      `INSERT INTO students (user_id, admission_number, admission_date, current_class_id,
        roll_number, parent_id, emergency_contact_name, emergency_contact_phone, medical_conditions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, admission_number, admission_date, current_class_id,
       roll_number, parent_id, emergency_contact_name, emergency_contact_phone, medical_conditions]
    );
    return result.id;
  }

  // Find student by student_id
  static async findById(studentId) {
    return await getQuery(
      `SELECT s.*, u.first_name, u.last_name, u.email, u.phone, u.address, 
        u.date_of_birth, u.gender, u.profile_picture, u.is_active,
        c.class_name, c.section
       FROM students s
       JOIN users u ON s.user_id = u.user_id
       LEFT JOIN classes c ON s.current_class_id = c.class_id
       WHERE s.student_id = ?`,
      [studentId]
    );
  }

  // Find student by user_id
  static async findByUserId(userId) {
    return await getQuery(
      `SELECT s.*, u.first_name, u.last_name, u.email, u.phone, u.profile_picture,
        c.class_name, c.section
       FROM students s
       JOIN users u ON s.user_id = u.user_id
       LEFT JOIN classes c ON s.current_class_id = c.class_id
       WHERE s.user_id = ?`,
      [userId]
    );
  }

  static async getByParentUserId(parentUserId) {
    return await allQuery(
      `SELECT s.*, u.first_name, u.last_name, u.email, u.phone, u.profile_picture, u.is_active,
        c.class_name, c.section
       FROM students s
       JOIN users u ON s.user_id = u.user_id
       LEFT JOIN classes c ON s.current_class_id = c.class_id
       WHERE s.parent_id = ? AND u.is_active = 1
       ORDER BY u.last_name, u.first_name`,
      [parentUserId]
    );
  }

  static async getContactUsersByStudentIds(studentIds = []) {
    const ids = Array.from(new Set((studentIds || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)));
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(', ');
    return await allQuery(
      `SELECT s.student_id, s.user_id AS student_user_id, s.parent_id,
              u.first_name, u.last_name
       FROM students s
       JOIN users u ON s.user_id = u.user_id
       WHERE s.student_id IN (${placeholders})`,
      ids
    );
  }

  // ? ADDED: Get students by class ID (REQUIRED FOR CONTROLLER)
  static async getByClassId(classId) {
    return await allQuery(
      `SELECT s.*, u.first_name, u.last_name, u.email, u.phone, u.gender, u.profile_picture,
        s.roll_number, s.admission_number
       FROM students s
       JOIN users u ON s.user_id = u.user_id
       WHERE s.current_class_id = ? AND u.is_active = 1
       ORDER BY u.last_name, u.first_name`,
      [classId]
    );
  }

  // Get all students with optional filters
  static async getAll(filters = {}) {
    let sql = `
      SELECT s.*, u.first_name, u.last_name, u.email, u.phone, u.profile_picture,
        c.class_name, c.section
      FROM students s
      JOIN users u ON s.user_id = u.user_id
      LEFT JOIN classes c ON s.current_class_id = c.class_id
      WHERE u.is_active = 1
    `;
    const params = [];
    
    if (filters.class_id) {
      sql += ' AND s.current_class_id = ?';
      params.push(filters.class_id);
    }
    
    if (filters.search) {
      sql += ` AND (u.first_name LIKE ? OR u.last_name LIKE ? OR s.admission_number LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    sql += ' ORDER BY u.last_name, u.first_name';
    
    return await allQuery(sql, params);
  }

  // Update student
  static async update(studentId, updateData) {
    const allowedFields = [
      'current_class_id', 'roll_number', 'parent_id',
      'emergency_contact_name', 'emergency_contact_phone', 'medical_conditions'
    ];
    
    const fields = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    
    if (fields.length === 0) return false;
    
    values.push(studentId);
    const result = await runQuery(
      `UPDATE students SET ${fields.join(', ')} WHERE student_id = ?`,
      values
    );
    return result.changes > 0;
  }

  // Delete student
  static async delete(studentId) {
    const result = await runQuery(
      'DELETE FROM students WHERE student_id = ?',
      [studentId]
    );
    return result.changes > 0;
  }

  // Get attendance stats for student
  static async getAttendanceStats(studentId, month, year) {
    return await allQuery(
      `SELECT status, COUNT(*) as count 
       FROM attendance 
       WHERE student_id = ? AND strftime('%m', date) = ? AND strftime('%Y', date) = ?
       GROUP BY status`,
      [studentId, month, year]
    );
  }

  // ? ADDED: Get attendance records for student
  static async getAttendance(studentId, month, year) {
    return await allQuery(
      `SELECT a.*, c.class_name
       FROM attendance a
       JOIN classes c ON a.class_id = c.class_id
       WHERE a.student_id = ? AND strftime('%m', a.date) = ? AND strftime('%Y', a.date) = ?
       ORDER BY a.date DESC`,
      [studentId, month, year]
    );
  }

  // ? ADDED: Get exam results for student
  static async getResults(studentId) {
    return await allQuery(
      `SELECT er.*, e.exam_name, e.exam_type, e.total_marks, e.exam_date,
        s.subject_name, s.subject_code
       FROM exam_results er
       JOIN exams e ON er.exam_id = e.exam_id
       JOIN subjects s ON e.subject_id = s.subject_id
       WHERE er.student_id = ?
       ORDER BY e.exam_date DESC`,
      [studentId]
    );
  }

  // Get fee balance for student
  static async getFeeBalance(studentId) {
    const result = await getQuery(
      `SELECT
        COALESCE(NULLIF(c.course_fee, 0), crs.fee_amount, 0) as total_fees,
        COALESCE((
          SELECT SUM(fp.amount_paid)
          FROM fee_payments fp
          WHERE fp.student_id = s.student_id AND fp.payment_status = 'completed'
        ), 0) as paid_amount,
        COALESCE(NULLIF(c.fee_payment_plan, ''), crs.fee_payment_plan, 'one_time') as fee_payment_plan,
        (
          SELECT MIN(fs.due_date)
          FROM fees_structure fs
          WHERE (fs.class_id = s.current_class_id OR fs.class_id IS NULL)
            AND fs.due_date IS NOT NULL
            AND TRIM(fs.due_date) <> ''
        ) as next_due_date
       FROM students s
       LEFT JOIN classes c ON s.current_class_id = c.class_id
       LEFT JOIN courses crs ON c.course_id = crs.course_id
       WHERE s.student_id = ?`,
      [studentId]
    );
    const total = Number(result?.total_fees || 0);
    const paid = Number(result?.paid_amount || 0);
    const balance = Math.max(total - paid, 0);
    return {
      total,
      paid,
      balance,
      fee_payment_plan: result?.fee_payment_plan || 'one_time',
      next_due_date: result?.next_due_date || null
    };
  }

  // ? ADDED: Count students in a class
  static async countByClass(classId) {
    const result = await getQuery(
      `SELECT COUNT(*) as count FROM students s
       JOIN users u ON s.user_id = u.user_id
       WHERE s.current_class_id = ? AND u.is_active = 1`,
      [classId]
    );
    return result?.count || 0;
  }

  // ? ADDED: Get student enrollment history
  static async getEnrollmentHistory(studentId) {
    return await allQuery(
      `SELECT se.*, c.class_name, c.section, c.academic_year
       FROM student_enrollment se
       JOIN classes c ON se.class_id = c.class_id
       WHERE se.student_id = ?
       ORDER BY se.enrollment_date DESC`,
      [studentId]
    );
  }
}

module.exports = StudentModel;
