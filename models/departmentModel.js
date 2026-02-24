const { runQuery, getQuery, allQuery } = require('../config/database');

class DepartmentModel {
  static async create(departmentData) {
    const { department_name, department_code, description, head_of_department } = departmentData;
    const result = await runQuery(
      `INSERT INTO departments (department_name, department_code, description, head_of_department)
       VALUES (?, ?, ?, ?)`,
      [department_name, department_code, description, head_of_department]
    );
    return result.id;
  }

  static async findById(departmentId) {
    return await getQuery(
      `SELECT d.*, u.first_name || ' ' || u.last_name as head_name
       FROM departments d
       LEFT JOIN users u ON d.head_of_department = u.user_id
       WHERE d.department_id = ?`,
      [departmentId]
    );
  }

  static async findByCode(code) {
    return await getQuery('SELECT * FROM departments WHERE department_code = ?', [code]);
  }

  static async getAll() {
    return await allQuery(
      `SELECT d.*, u.first_name || ' ' || u.last_name as head_name
       FROM departments d
       LEFT JOIN users u ON d.head_of_department = u.user_id
       ORDER BY d.department_name`
    );
  }

  static async update(departmentId, updateData) {
    const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updateData), departmentId];
    const result = await runQuery(
      `UPDATE departments SET ${fields} WHERE department_id = ?`,
      values
    );
    return result.changes > 0;
  }

  static async delete(departmentId) {
    const result = await runQuery('DELETE FROM departments WHERE department_id = ?', [departmentId]);
    return result.changes > 0;
  }

  static async getTeachers(departmentId) {
    return await allQuery(
      `SELECT t.*, u.first_name, u.last_name, u.email
       FROM teachers t
       JOIN users u ON t.user_id = u.user_id
       WHERE t.department_id = ?`,
      [departmentId]
    );
  }

  static async getSubjects(departmentId) {
    return await allQuery(
      `SELECT * FROM subjects WHERE department_id = ? AND is_active = 1`,
      [departmentId]
    );
  }
}

module.exports = DepartmentModel;