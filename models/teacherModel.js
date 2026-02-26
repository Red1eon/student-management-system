const { runQuery, getQuery, allQuery } = require('../config/database');

class TeacherModel {
  
  // Create new teacher
  static async create(teacherData) {
    const {
      user_id, employee_number, hire_date, qualification,
      specialization, department_id, is_class_teacher
    } = teacherData;
    
    const result = await runQuery(
      `INSERT INTO teachers (user_id, employee_number, hire_date, qualification,
        specialization, department_id, is_class_teacher)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user_id, employee_number, hire_date, qualification,
       specialization, department_id, is_class_teacher || 0]
    );
    return result.id;
  }

  // Find teacher by teacher_id
  static async findById(teacherId) {
    return await getQuery(
      `SELECT t.*, u.first_name, u.last_name, u.email, u.phone, u.profile_picture, u.is_active,
        d.department_name
       FROM teachers t
       JOIN users u ON t.user_id = u.user_id
       LEFT JOIN departments d ON t.department_id = d.department_id
       WHERE t.teacher_id = ?`,
      [teacherId]
    );
  }

  // Find teacher by user_id (REQUIRED FOR LOGIN)
  static async findByUserId(userId) {
    return await getQuery(
      `SELECT t.*, u.first_name, u.last_name, u.email, u.phone, u.profile_picture, u.is_active,
        d.department_name
       FROM teachers t
       JOIN users u ON t.user_id = u.user_id
       LEFT JOIN departments d ON t.department_id = d.department_id
       WHERE t.user_id = ?`,
      [userId]
    );
  }

  // Get all teachers
  static async getAll() {
    return await allQuery(
      `SELECT t.*, u.first_name, u.last_name, u.email, u.phone, u.profile_picture, u.is_active,
        d.department_name
       FROM teachers t
       JOIN users u ON t.user_id = u.user_id
       LEFT JOIN departments d ON t.department_id = d.department_id
       WHERE u.is_active = 1
       ORDER BY u.last_name, u.first_name`
    );
  }

  // Find teacher by employee number
  static async findByEmployeeNumber(employeeNumber) {
    return await getQuery(
      `SELECT t.*, u.first_name, u.last_name, u.email, u.phone, u.is_active
       FROM teachers t
       JOIN users u ON t.user_id = u.user_id
       WHERE t.employee_number = ?`,
      [employeeNumber]
    );
  }

  // ? ADDED: Get classes taught by teacher
  static async getClasses(teacherId) {
    return await allQuery(
      `SELECT DISTINCT c.class_id, c.class_name, c.section,
        c.room_number, c.academic_year,
        CASE WHEN c.class_teacher_id = t.user_id THEN 1 ELSE 0 END as is_class_teacher
       FROM classes c
       JOIN teachers t ON t.teacher_id = ?
       LEFT JOIN teacher_subjects ts ON ts.class_id = c.class_id AND ts.teacher_id = t.teacher_id
       WHERE ts.teacher_subject_id IS NOT NULL OR c.class_teacher_id = t.user_id
       ORDER BY c.class_name, c.section`,
      [teacherId]
    );
  }

  // Update teacher
  static async update(teacherId, updateData) {
    const allowedFields = [
      'employee_number', 'qualification', 'specialization', 
      'department_id', 'is_class_teacher'
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
    
    values.push(teacherId);
    const result = await runQuery(
      `UPDATE teachers SET ${fields.join(', ')} WHERE teacher_id = ?`,
      values
    );
    return result.changes > 0;
  }

  // Delete teacher
  static async delete(teacherId) {
    const result = await runQuery(
      'DELETE FROM teachers WHERE teacher_id = ?',
      [teacherId]
    );
    return result.changes > 0;
  }

  // Get teacher's assigned subjects
  static async getSubjects(teacherId) {
    return await allQuery(
      `SELECT ts.*, s.subject_name, s.subject_code, s.credits,
        c.class_name, c.section, c.room_number
       FROM teacher_subjects ts
       JOIN subjects s ON ts.subject_id = s.subject_id
       JOIN classes c ON ts.class_id = c.class_id
       WHERE ts.teacher_id = ?
       ORDER BY c.class_name, s.subject_name`,
      [teacherId]
    );
  }

  // Assign subject to teacher
  static async assignSubject(teacherId, subjectId, classId, academicYear) {
    const result = await runQuery(
      `INSERT INTO teacher_subjects (teacher_id, subject_id, class_id, academic_year)
       VALUES (?, ?, ?, ?)`,
      [teacherId, subjectId, classId, academicYear]
    );
    return result.id;
  }

  // Remove subject assignment
  static async removeSubject(teacherSubjectId) {
    const result = await runQuery(
      'DELETE FROM teacher_subjects WHERE teacher_subject_id = ?',
      [teacherSubjectId]
    );
    return result.changes > 0;
  }

  // ? ADDED: Get students in teacher's classes
  static async getStudents(teacherId) {
    return await allQuery(
      `SELECT DISTINCT s.student_id, s.admission_number, s.roll_number,
        u.first_name, u.last_name, u.email, u.phone,
        c.class_name, c.section
       FROM teacher_subjects ts
       JOIN students s ON ts.class_id = s.current_class_id
       JOIN users u ON s.user_id = u.user_id
       JOIN classes c ON ts.class_id = c.class_id
       WHERE ts.teacher_id = ? AND u.is_active = 1
       ORDER BY c.class_name, u.last_name, u.first_name`,
      [teacherId]
    );
  }

  // Check if teacher is class teacher
  static async isClassTeacher(teacherId, classId) {
    const result = await getQuery(
      `SELECT t.is_class_teacher, c.class_name
       FROM teachers t
       JOIN classes c ON t.user_id = c.class_teacher_id
       WHERE t.teacher_id = ? AND c.class_id = ?`,
      [teacherId, classId]
    );
    return result ? true : false;
  }

  // ? ADDED: Get teacher stats
  static async getStats(teacherId) {
    const subjects = await getQuery(
      'SELECT COUNT(*) as count FROM teacher_subjects WHERE teacher_id = ?',
      [teacherId]
    );
    
    const classes = await getQuery(
      `SELECT COUNT(DISTINCT c.class_id) as count
       FROM classes c
       JOIN teachers t ON t.teacher_id = ?
       LEFT JOIN teacher_subjects ts ON ts.class_id = c.class_id AND ts.teacher_id = t.teacher_id
       WHERE ts.teacher_subject_id IS NOT NULL OR c.class_teacher_id = t.user_id`,
      [teacherId]
    );
    
    const students = await getQuery(
      `SELECT COUNT(DISTINCT s.student_id) as count 
       FROM teacher_subjects ts
       JOIN students s ON ts.class_id = s.current_class_id
       JOIN users u ON s.user_id = u.user_id
       WHERE ts.teacher_id = ? AND u.is_active = 1`,
      [teacherId]
    );
    
    return {
      total_subjects: subjects?.count || 0,
      total_classes: classes?.count || 0,
      total_students: students?.count || 0
    };
  }
}

module.exports = TeacherModel;
