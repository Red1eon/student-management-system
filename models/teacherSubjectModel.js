const { runQuery, getQuery, allQuery } = require('../config/database');

class TeacherSubjectModel {
  static async create(assignmentData) {
    const { teacher_id, subject_id, class_id, academic_year } = assignmentData;
    const result = await runQuery(
      `INSERT INTO teacher_subjects (teacher_id, subject_id, class_id, academic_year)
       VALUES (?, ?, ?, ?)`,
      [teacher_id, subject_id, class_id, academic_year]
    );
    return result.id;
  }

  static async findById(id) {
    return await getQuery(
      `SELECT ts.*, t.employee_number, u.first_name || ' ' || u.last_name as teacher_name,
        s.subject_name, c.class_name, c.section
       FROM teacher_subjects ts
       JOIN teachers t ON ts.teacher_id = t.teacher_id
       JOIN users u ON t.user_id = u.user_id
       JOIN subjects s ON ts.subject_id = s.subject_id
       JOIN classes c ON ts.class_id = c.class_id
       WHERE ts.teacher_subject_id = ?`,
      [id]
    );
  }

  static async getByTeacher(teacherId) {
    return await allQuery(
      `SELECT ts.*, s.subject_name, s.subject_code, c.class_name, c.section
       FROM teacher_subjects ts
       JOIN subjects s ON ts.subject_id = s.subject_id
       JOIN classes c ON ts.class_id = c.class_id
       WHERE ts.teacher_id = ?
       ORDER BY ts.academic_year DESC, c.class_name`,
      [teacherId]
    );
  }

  static async getByClass(classId) {
    return await allQuery(
      `SELECT ts.*, s.subject_name, u.first_name || ' ' || u.last_name as teacher_name
       FROM teacher_subjects ts
       JOIN subjects s ON ts.subject_id = s.subject_id
       JOIN teachers t ON ts.teacher_id = t.teacher_id
       JOIN users u ON t.user_id = u.user_id
       WHERE ts.class_id = ?`,
      [classId]
    );
  }

  static async delete(id) {
    const result = await runQuery('DELETE FROM teacher_subjects WHERE teacher_subject_id = ?', [id]);
    return result.changes > 0;
  }

  static async checkDuplicate(teacher_id, subject_id, class_id, academic_year) {
    const result = await getQuery(
      `SELECT * FROM teacher_subjects 
       WHERE teacher_id = ? AND subject_id = ? AND class_id = ? AND academic_year = ?`,
      [teacher_id, subject_id, class_id, academic_year]
    );
    return !!result;
  }
}

module.exports = TeacherSubjectModel;