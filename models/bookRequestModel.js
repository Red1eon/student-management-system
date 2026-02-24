const { runQuery, getQuery, allQuery } = require('../config/database');

class BookRequestModel {
  static async create(requestData) {
    const { book_id, user_id, request_date, remarks } = requestData;
    const result = await runQuery(
      `INSERT INTO book_requests (book_id, user_id, request_date, status, remarks)
       VALUES (?, ?, ?, 'pending', ?)`,
      [book_id, user_id, request_date, remarks || null]
    );
    return result.id;
  }

  static async findById(requestId) {
    return await getQuery(
      `SELECT br.*, b.title, b.author, b.available_quantity,
        u.first_name || ' ' || u.last_name AS student_name
       FROM book_requests br
       JOIN books b ON br.book_id = b.book_id
       JOIN users u ON br.user_id = u.user_id
       WHERE br.request_id = ?`,
      [requestId]
    );
  }

  static async findPendingByUserAndBook(userId, bookId) {
    return await getQuery(
      `SELECT request_id FROM book_requests
       WHERE user_id = ? AND book_id = ? AND status = 'pending'`,
      [userId, bookId]
    );
  }

  static async getPending() {
    return await allQuery(
      `SELECT br.*, b.title, b.author,
        u.first_name || ' ' || u.last_name AS student_name
       FROM book_requests br
       JOIN books b ON br.book_id = b.book_id
       JOIN users u ON br.user_id = u.user_id
       WHERE br.status = 'pending'
       ORDER BY br.request_date ASC`
    );
  }

  static async getByUser(userId) {
    return await allQuery(
      `SELECT br.*, b.title, b.author
       FROM book_requests br
       JOIN books b ON br.book_id = b.book_id
       WHERE br.user_id = ?
       ORDER BY br.request_date DESC`,
      [userId]
    );
  }

  static async approve(requestId, processedBy, remarks) {
    const result = await runQuery(
      `UPDATE book_requests
       SET status = 'approved',
           processed_by = ?,
           processed_at = CURRENT_TIMESTAMP,
           remarks = COALESCE(?, remarks)
       WHERE request_id = ? AND status = 'pending'`,
      [processedBy, remarks || null, requestId]
    );
    return result.changes > 0;
  }

  static async reject(requestId, processedBy, remarks) {
    const result = await runQuery(
      `UPDATE book_requests
       SET status = 'rejected',
           processed_by = ?,
           processed_at = CURRENT_TIMESTAMP,
           remarks = COALESCE(?, remarks)
       WHERE request_id = ? AND status = 'pending'`,
      [processedBy, remarks || null, requestId]
    );
    return result.changes > 0;
  }
}

module.exports = BookRequestModel;
