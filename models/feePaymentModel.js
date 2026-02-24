const { runQuery, getQuery, allQuery } = require('../config/database');
const { generateReceiptNumber } = require('../utils/helpers');

class FeePaymentModel {
  static async create(paymentData) {
    const {
      student_id, fee_id, amount_paid, payment_date,
      payment_method, transaction_id, remarks, received_by
    } = paymentData;
    
    const receipt_number = generateReceiptNumber();
    
    const result = await runQuery(
      `INSERT INTO fee_payments (student_id, fee_id, amount_paid, payment_date, payment_method,
        transaction_id, receipt_number, remarks, received_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [student_id, fee_id, amount_paid, payment_date, payment_method,
       transaction_id, receipt_number, remarks, received_by]
    );
    return { id: result.id, receipt_number };
  }

  static async findById(paymentId) {
    return await getQuery(
      `SELECT fp.*, u.first_name || ' ' || u.last_name as student_name,
        s.admission_number, f.fee_name, f.fee_type,
        r.first_name || ' ' || r.last_name as received_by_name
       FROM fee_payments fp
       JOIN students s ON fp.student_id = s.student_id
       JOIN users u ON s.user_id = u.user_id
       JOIN fees_structure f ON fp.fee_id = f.fee_id
       LEFT JOIN users r ON fp.received_by = r.user_id
       WHERE fp.payment_id = ?`,
      [paymentId]
    );
  }

  static async getByStudent(studentId) {
    return await allQuery(
      `SELECT fp.*, f.fee_name, f.fee_type
       FROM fee_payments fp
       JOIN fees_structure f ON fp.fee_id = f.fee_id
       WHERE fp.student_id = ?
       ORDER BY fp.payment_date DESC`,
      [studentId]
    );
  }

  static async getRecent(limit = 10) {
    return await allQuery(
      `SELECT fp.*, u.first_name || ' ' || u.last_name as student_name,
        s.admission_number, f.fee_name
       FROM fee_payments fp
       JOIN students s ON fp.student_id = s.student_id
       JOIN users u ON s.user_id = u.user_id
       JOIN fees_structure f ON fp.fee_id = f.fee_id
       WHERE fp.payment_status = 'completed'
       ORDER BY fp.payment_date DESC
       LIMIT ?`,
      [limit]
    );
  }

  static async getByReceipt(receiptNumber) {
    return await getQuery(
      `SELECT fp.*, u.first_name || ' ' || u.last_name as student_name,
        s.admission_number, s.current_class_id, f.fee_name, f.fee_type
       FROM fee_payments fp
       JOIN students s ON fp.student_id = s.student_id
       JOIN users u ON s.user_id = u.user_id
       JOIN fees_structure f ON fp.fee_id = f.fee_id
       WHERE fp.receipt_number = ?`,
      [receiptNumber]
    );
  }

  static async getPaymentStats(academicYear) {
    return await getQuery(
      `SELECT 
        COALESCE(SUM(amount_paid), 0) as total_collected,
        COUNT(DISTINCT student_id) as paying_students
       FROM fee_payments
       WHERE payment_status = 'completed' AND strftime('%Y', payment_date) = ?`,
      [academicYear]
    );
  }

  static async updateStatus(paymentId, status) {
    const result = await runQuery(
      'UPDATE fee_payments SET payment_status = ? WHERE payment_id = ?',
      [status, paymentId]
    );
    return result.changes > 0;
  }

  static async getPendingPayments() {
    return await allQuery(
      `SELECT fp.*, u.first_name || ' ' || u.last_name as student_name,
        f.fee_name, f.due_date
       FROM fee_payments fp
       JOIN students s ON fp.student_id = s.student_id
       JOIN users u ON s.user_id = u.user_id
       JOIN fees_structure f ON fp.fee_id = f.fee_id
       WHERE fp.payment_status = 'pending' AND f.due_date < date('now', '+7 days')
       ORDER BY f.due_date ASC`
    );
  }
}

module.exports = FeePaymentModel;