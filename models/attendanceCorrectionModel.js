const { runQuery, allQuery, getQuery } = require('../config/database');

class AttendanceCorrectionModel {
  static async create(data) {
    const result = await runQuery(
      `INSERT INTO attendance_corrections
       (attendance_id, student_id, requested_by, requested_status, reason, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [data.attendance_id, data.student_id, data.requested_by, data.requested_status, data.reason]
    );
    return result.id;
  }

  static async getAll(filters = {}) {
    let sql = `
      SELECT ac.*,
             su.first_name || ' ' || su.last_name AS student_name,
             ru.first_name || ' ' || ru.last_name AS requested_by_name,
             rv.first_name || ' ' || rv.last_name AS reviewed_by_name,
             a.date AS attendance_date,
             a.status AS current_status
      FROM attendance_corrections ac
      JOIN students s ON ac.student_id = s.student_id
      JOIN users su ON s.user_id = su.user_id
      JOIN users ru ON ac.requested_by = ru.user_id
      LEFT JOIN users rv ON ac.reviewed_by = rv.user_id
      JOIN attendance a ON ac.attendance_id = a.attendance_id
      WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
      sql += ' AND ac.status = ?';
      params.push(filters.status);
    }
    if (filters.student_id) {
      sql += ' AND ac.student_id = ?';
      params.push(filters.student_id);
    }
    if (filters.requested_by) {
      sql += ' AND ac.requested_by = ?';
      params.push(filters.requested_by);
    }

    sql += ' ORDER BY ac.created_at DESC';
    return await allQuery(sql, params);
  }

  static async findById(correctionId) {
    return await getQuery('SELECT * FROM attendance_corrections WHERE correction_id = ?', [correctionId]);
  }

  static async review(correctionId, reviewData) {
    const result = await runQuery(
      `UPDATE attendance_corrections
       SET status = ?, reviewed_by = ?, review_comment = ?, reviewed_at = datetime('now')
       WHERE correction_id = ?`,
      [reviewData.status, reviewData.reviewed_by, reviewData.review_comment || null, correctionId]
    );
    return result.changes > 0;
  }
}

module.exports = AttendanceCorrectionModel;

