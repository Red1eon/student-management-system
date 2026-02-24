const { runQuery, getQuery, allQuery } = require('../config/database');

class ExamModel {
  static async create(examData) {
    const {
      exam_name, exam_type, class_id, subject_id, academic_year, term,
      total_marks, passing_marks, exam_date, start_time, end_time, room_number
    } = examData;
    
    const result = await runQuery(
      `INSERT INTO exams (exam_name, exam_type, class_id, subject_id, academic_year, term,
        total_marks, passing_marks, exam_date, start_time, end_time, room_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [exam_name, exam_type, class_id, subject_id, academic_year, term,
       total_marks, passing_marks, exam_date, start_time, end_time, room_number]
    );
    return result.id;
  }

  static async findById(examId) {
    return await getQuery(
      `SELECT e.*, c.class_name, c.section, s.subject_name, s.subject_code
       FROM exams e
       JOIN classes c ON e.class_id = c.class_id
       JOIN subjects s ON e.subject_id = s.subject_id
       WHERE e.exam_id = ?`,
      [examId]
    );
  }

  static async getAll(filters = {}) {
    let sql = `
      SELECT e.*, c.class_name, c.section, s.subject_name
      FROM exams e
      JOIN classes c ON e.class_id = c.class_id
      JOIN subjects s ON e.subject_id = s.subject_id
      WHERE 1=1
    `;
    const params = [];
    
    if (filters.class_id) {
      sql += ' AND e.class_id = ?';
      params.push(filters.class_id);
    }
    if (filters.subject_id) {
      sql += ' AND e.subject_id = ?';
      params.push(filters.subject_id);
    }
    if (filters.academic_year) {
      sql += ' AND e.academic_year = ?';
      params.push(filters.academic_year);
    }
    if (filters.exam_type) {
      sql += ' AND e.exam_type = ?';
      params.push(filters.exam_type);
    }
    
    sql += ' ORDER BY e.exam_date DESC';
    return await allQuery(sql, params);
  }

  static async getUpcoming(limit = 5) {
    return await allQuery(
      `SELECT e.*, c.class_name, s.subject_name
       FROM exams e
       JOIN classes c ON e.class_id = c.class_id
       JOIN subjects s ON e.subject_id = s.subject_id
       WHERE e.exam_date >= date('now')
       ORDER BY e.exam_date ASC
       LIMIT ?`,
      [limit]
    );
  }

  static async update(examId, updateData) {
    const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updateData), examId];
    const result = await runQuery(
      `UPDATE exams SET ${fields} WHERE exam_id = ?`,
      values
    );
    return result.changes > 0;
  }

  static async delete(examId) {
    const result = await runQuery('DELETE FROM exams WHERE exam_id = ?', [examId]);
    return result.changes > 0;
  }

  static async getResults(examId) {
    return await allQuery(
      `SELECT er.*, u.first_name || ' ' || u.last_name as student_name,
        s.admission_number
       FROM exam_results er
       JOIN students s ON er.student_id = s.student_id
       JOIN users u ON s.user_id = u.user_id
       WHERE er.exam_id = ?
       ORDER BY er.marks_obtained DESC`,
      [examId]
    );
  }

  static async getStudentExams(studentId) {
    return await allQuery(
      `SELECT e.*, er.marks_obtained, er.grade, c.class_name, s.subject_name
       FROM exams e
       JOIN classes c ON e.class_id = c.class_id
       JOIN subjects s ON e.subject_id = s.subject_id
       LEFT JOIN exam_results er ON e.exam_id = er.exam_id AND er.student_id = ?
       WHERE e.class_id IN (SELECT current_class_id FROM students WHERE student_id = ?)
       ORDER BY e.exam_date DESC`,
      [studentId, studentId]
    );
  }
}

module.exports = ExamModel;