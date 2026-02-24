const { runQuery, getQuery, allQuery } = require('../config/database');

class SubjectModel {
  static async create(subjectData) {
    const { subject_name, subject_code, description, credits, department_id } = subjectData;
    const result = await runQuery(
      `INSERT INTO subjects (subject_name, subject_code, description, credits, department_id)
       VALUES (?, ?, ?, ?, ?)`,
      [subject_name, subject_code, description, credits, department_id]
    );
    return result.id;
  }

  static async findById(subjectId) {
    return await getQuery(
      `SELECT s.*, d.department_name
       FROM subjects s
       LEFT JOIN departments d ON s.department_id = d.department_id
       WHERE s.subject_id = ?`,
      [subjectId]
    );
  }

  static async findByCode(code) {
    return await getQuery('SELECT * FROM subjects WHERE subject_code = ?', [code]);
  }

  static async getAll(filters = {}) {
    let sql = `
      SELECT s.*, d.department_name
      FROM subjects s
      LEFT JOIN departments d ON s.department_id = d.department_id
      WHERE s.is_active = 1
    `;
    const params = [];
    
    if (filters.department_id) {
      sql += ' AND s.department_id = ?';
      params.push(filters.department_id);
    }
    
    sql += ' ORDER BY s.subject_name';
    return await allQuery(sql, params);
  }

  static async update(subjectId, updateData) {
    const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updateData), subjectId];
    const result = await runQuery(
      `UPDATE subjects SET ${fields} WHERE subject_id = ?`,
      values
    );
    return result.changes > 0;
  }

  static async delete(subjectId) {
    const result = await runQuery('UPDATE subjects SET is_active = 0 WHERE subject_id = ?', [subjectId]);
    return result.changes > 0;
  }

  static async getTeachers(subjectId) {
    return await allQuery(
      `SELECT DISTINCT t.*, u.first_name, u.last_name
       FROM teacher_subjects ts
       JOIN teachers t ON ts.teacher_id = t.teacher_id
       JOIN users u ON t.user_id = u.user_id
       WHERE ts.subject_id = ?`,
      [subjectId]
    );
  }
}

module.exports = SubjectModel;