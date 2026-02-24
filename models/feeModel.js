const { runQuery, getQuery, allQuery } = require('../config/database');

class FeeModel {
  static async create(feeData) {
    const {
      fee_name, class_id, amount, fee_type, frequency,
      academic_year, due_date, is_mandatory, description
    } = feeData;
    
    const result = await runQuery(
      `INSERT INTO fees_structure (fee_name, class_id, amount, fee_type, frequency,
        academic_year, due_date, is_mandatory, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [fee_name, class_id, amount, fee_type, frequency,
       academic_year, due_date, is_mandatory, description]
    );
    return result.id;
  }

  static async findById(feeId) {
    return await getQuery(
      `SELECT f.*, c.class_name, c.section
       FROM fees_structure f
       LEFT JOIN classes c ON f.class_id = c.class_id
       WHERE f.fee_id = ?`,
      [feeId]
    );
  }

  static async getAll(filters = {}) {
    let sql = `
      SELECT f.*, c.class_name, c.section
      FROM fees_structure f
      LEFT JOIN classes c ON f.class_id = c.class_id
      WHERE 1=1
    `;
    const params = [];
    
    if (filters.class_id) {
      sql += ' AND f.class_id = ?';
      params.push(filters.class_id);
    }
    if (filters.academic_year) {
      sql += ' AND f.academic_year = ?';
      params.push(filters.academic_year);
    }
    if (filters.fee_type) {
      sql += ' AND f.fee_type = ?';
      params.push(filters.fee_type);
    }
    
    sql += ' ORDER BY f.created_at DESC';
    return await allQuery(sql, params);
  }

  static async getByStudent(studentId) {
    return await allQuery(
      `SELECT f.*, c.class_name
       FROM fees_structure f
       JOIN students s ON f.class_id = s.current_class_id OR f.class_id IS NULL
       JOIN classes c ON f.class_id = c.class_id
       WHERE s.student_id = ? AND f.academic_year = (
         SELECT academic_year FROM student_enrollment 
         WHERE student_id = ? AND status = 'active' 
         ORDER BY enrollment_date DESC LIMIT 1
       )`,
      [studentId, studentId]
    );
  }

  static async update(feeId, updateData) {
    const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updateData), feeId];
    const result = await runQuery(
      `UPDATE fees_structure SET ${fields} WHERE fee_id = ?`,
      values
    );
    return result.changes > 0;
  }

  static async delete(feeId) {
    const result = await runQuery('DELETE FROM fees_structure WHERE fee_id = ?', [feeId]);
    return result.changes > 0;
  }

  static async getTotalFees(classId, academicYear) {
    const result = await getQuery(
      `SELECT SUM(amount) as total FROM fees_structure 
       WHERE (class_id = ? OR class_id IS NULL) AND academic_year = ?`,
      [classId, academicYear]
    );
    return result?.total || 0;
  }
}

module.exports = FeeModel;