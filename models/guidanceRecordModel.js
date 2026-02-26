const { runQuery, allQuery } = require('../config/database');

class GuidanceRecordModel {
  static async create(data) {
    const {
      student_id,
      teacher_id,
      guidance_date,
      category,
      notes,
      follow_up,
      created_by
    } = data;

    const result = await runQuery(
      `INSERT INTO guidance_records
       (student_id, teacher_id, guidance_date, category, notes, follow_up, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [student_id, teacher_id || null, guidance_date, category || 'academic', notes, follow_up || null, created_by]
    );
    return result.id;
  }

  static async getAll(filters = {}) {
    let sql = `
      SELECT gr.*,
             su.first_name || ' ' || su.last_name AS student_name,
             st.admission_number,
             cu.first_name || ' ' || cu.last_name AS teacher_name,
             c.class_name,
             c.section
      FROM guidance_records gr
      JOIN students st ON gr.student_id = st.student_id
      JOIN users su ON st.user_id = su.user_id
      LEFT JOIN teachers t ON gr.teacher_id = t.teacher_id
      LEFT JOIN users cu ON t.user_id = cu.user_id
      LEFT JOIN classes c ON st.current_class_id = c.class_id
      WHERE 1=1
    `;
    const params = [];

    if (filters.student_id) {
      sql += ' AND gr.student_id = ?';
      params.push(filters.student_id);
    }
    if (filters.class_id) {
      sql += ' AND st.current_class_id = ?';
      params.push(filters.class_id);
    }
    if (filters.teacher_id) {
      sql += ' AND gr.teacher_id = ?';
      params.push(filters.teacher_id);
    }
    if (filters.user_id) {
      sql += ' AND st.user_id = ?';
      params.push(filters.user_id);
    }
    if (filters.student_ids && filters.student_ids.length > 0) {
      const placeholders = filters.student_ids.map(() => '?').join(', ');
      sql += ` AND gr.student_id IN (${placeholders})`;
      params.push(...filters.student_ids);
    }

    sql += ' ORDER BY gr.guidance_date DESC, gr.created_at DESC';
    return await allQuery(sql, params);
  }
}

module.exports = GuidanceRecordModel;

