const { runQuery, getQuery, allQuery } = require('../config/database');

class CourseModel {
  static async create(courseData) {
    const {
      course_name,
      course_code,
      course_type,
      fee_amount,
      fee_payment_plan,
      fee_payment_description,
      is_active,
      created_by
    } = courseData;

    return runQuery(
      `INSERT INTO courses (
        course_name, course_code, course_type, fee_amount, fee_payment_plan,
        fee_payment_description, is_active, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        course_name,
        course_code,
        course_type || 'other',
        fee_amount || 0,
        fee_payment_plan || 'one_time',
        fee_payment_description || null,
        is_active === 0 ? 0 : 1,
        created_by || null
      ]
    );
  }

  static async getAll() {
    return allQuery(
      `SELECT c.*, u.first_name || ' ' || u.last_name AS created_by_name
       FROM courses c
       LEFT JOIN users u ON c.created_by = u.user_id
       ORDER BY c.course_name ASC`
    );
  }

  static async getActive() {
    return allQuery(
      `SELECT c.*, u.first_name || ' ' || u.last_name AS created_by_name
       FROM courses c
       LEFT JOIN users u ON c.created_by = u.user_id
       WHERE c.is_active = 1
       ORDER BY c.course_name ASC`
    );
  }

  static async findById(courseId) {
    return getQuery('SELECT * FROM courses WHERE course_id = ?', [courseId]);
  }

  static async update(courseId, updateData) {
    const fields = Object.keys(updateData).map((key) => `${key} = ?`).join(', ');
    const values = [...Object.values(updateData), courseId];
    return runQuery(`UPDATE courses SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE course_id = ?`, values);
  }

  static async delete(courseId) {
    return runQuery('DELETE FROM courses WHERE course_id = ?', [courseId]);
  }
}

module.exports = CourseModel;
