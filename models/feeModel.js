const { runQuery, getQuery, allQuery } = require('../config/database');

class FeeModel {
  static buildPlannedFeeRows(context = {}) {
    const totalFee = Number(context.total_fee || 0);
    if (!(totalFee > 0)) return [];

    const plan = String(context.fee_payment_plan || 'one_time');
    const planBuckets = {
      one_time: 1,
      yearly: 1,
      installment: 3,
      quarterly: 4,
      monthly: 12,
      flexible: 1
    };
    const installments = planBuckets[plan] || 1;
    const baseAmount = installments > 0 ? Math.floor((totalFee / installments) * 100) / 100 : totalFee;
    const rows = [];

    for (let i = 1; i <= installments; i += 1) {
      const isLast = i === installments;
      const amount = isLast ? Number((totalFee - (baseAmount * (installments - 1))).toFixed(2)) : Number(baseAmount.toFixed(2));
      let feeName = 'Course Fee';
      if (plan === 'installment') feeName = `Course Fee Installment ${i}/${installments}`;
      else if (plan === 'monthly') feeName = `Course Fee Month ${i}/${installments}`;
      else if (plan === 'quarterly') feeName = `Course Fee Quarter ${i}/${installments}`;
      else if (plan === 'yearly') feeName = 'Course Fee (Yearly)';
      else if (plan === 'one_time') feeName = 'Course Fee (One-Time)';
      else if (plan === 'flexible') feeName = 'Course Fee (Flexible)';

      rows.push({
        fee_id: null,
        fee_name: feeName,
        amount,
        due_date: null,
        fee_type: 'tuition',
        frequency: plan === 'one_time' ? 'one-time' : (plan === 'installment' ? 'quarterly' : plan),
        class_id: context.current_class_id || null,
        class_name: context.class_name || null,
        section: context.section || null,
        academic_year: context.academic_year || null,
        payment_plan: plan,
        is_virtual: 1
      });
    }

    return rows;
  }

  static async getStudentFeePlanContext(studentId) {
    return await getQuery(
      `SELECT s.student_id, s.current_class_id, c.class_name, c.section,
         COALESCE(NULLIF(c.academic_year, ''), (
           SELECT se.academic_year
           FROM student_enrollment se
           WHERE se.student_id = s.student_id AND se.status = 'active'
           ORDER BY se.enrollment_date DESC LIMIT 1
         ), strftime('%Y', 'now')) as academic_year,
         COALESCE(NULLIF(c.course_fee, 0), crs.fee_amount, 0) as total_fee,
         COALESCE(NULLIF(c.fee_payment_plan, ''), crs.fee_payment_plan, 'one_time') as fee_payment_plan,
         COALESCE(crs.fee_payment_description, '') as fee_payment_description
       FROM students s
       LEFT JOIN classes c ON s.current_class_id = c.class_id
       LEFT JOIN courses crs ON c.course_id = crs.course_id
       WHERE s.student_id = ?`,
      [studentId]
    );
  }

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
    
    sql += ' ORDER BY COALESCE(f.updated_at, f.created_at) DESC';
    try {
      return await allQuery(sql, params);
    } catch (error) {
      if (!String(error.message || '').includes('no such column: f.updated_at')) throw error;
      const fallbackSql = `${sql.replace('COALESCE(f.updated_at, f.created_at)', 'f.created_at')}`;
      return await allQuery(fallbackSql, params);
    }
  }

  static async getByStudent(studentId) {
    const context = await this.getStudentFeePlanContext(studentId);
    if (!context) return [];

    const params = [context.current_class_id];
    let sql = `
      SELECT f.*, c.class_name, c.section
      FROM fees_structure f
      LEFT JOIN classes c ON f.class_id = c.class_id
      WHERE (f.class_id = ? OR f.class_id IS NULL)
    `;

    if (context.academic_year) {
      sql += ' AND f.academic_year = ?';
      params.push(context.academic_year);
    }

    sql += ' ORDER BY f.due_date IS NULL, f.due_date ASC, f.created_at ASC';
    const fees = await allQuery(sql, params);
    if (Array.isArray(fees) && fees.length > 0) {
      return fees.map((fee) => ({
        ...fee,
        payment_plan: context.fee_payment_plan || 'one_time'
      }));
    }

    return this.buildPlannedFeeRows(context);
  }

  static async update(feeId, updateData) {
    const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updateData), feeId];
    let result;
    try {
      result = await runQuery(
        `UPDATE fees_structure SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE fee_id = ?`,
        values
      );
    } catch (error) {
      if (!String(error.message || '').includes('no such column: updated_at')) throw error;
      result = await runQuery(
        `UPDATE fees_structure SET ${fields} WHERE fee_id = ?`,
        values
      );
    }
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

  static async getPaymentContextByStudent(studentId) {
    const studentContext = await this.getStudentFeePlanContext(studentId);

    if (!studentContext) {
      return { paymentPlan: 'one_time', paymentDescription: '', fees: [] };
    }

    const feeParams = [studentContext.current_class_id];
    let feeSql = `
      SELECT fee_id, fee_name, amount, due_date, class_id, academic_year
      FROM fees_structure
      WHERE (class_id = ? OR class_id IS NULL)
    `;

    if (studentContext.academic_year) {
      feeSql += ' AND academic_year = ?';
      feeParams.push(studentContext.academic_year);
    }

    feeSql += ' ORDER BY due_date IS NULL, due_date ASC, created_at ASC';
    let fees = await allQuery(feeSql, feeParams);
    if (!fees || fees.length === 0) {
      fees = this.buildPlannedFeeRows(studentContext);
    }

    return {
      paymentPlan: studentContext.fee_payment_plan || 'one_time',
      paymentDescription: studentContext.fee_payment_description || '',
      fees
    };
  }
}

module.exports = FeeModel;
