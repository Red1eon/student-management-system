const { runQuery, getQuery, allQuery } = require('../config/database');

class BookIssueModel {
  static async create(issueData) {
    const { book_id, user_id, issue_date, due_date, issued_by } = issueData;
    const result = await runQuery(
      `INSERT INTO book_issues (book_id, user_id, issue_date, due_date, issued_by, status)
       VALUES (?, ?, ?, ?, ?, 'issued')`,
      [book_id, user_id, issue_date, due_date, issued_by]
    );
    
    // Update available quantity
    await runQuery(
      'UPDATE books SET available_quantity = available_quantity - 1 WHERE book_id = ?',
      [book_id]
    );
    
    return result.id;
  }

  static async findById(issueId) {
    return await getQuery(
      `SELECT bi.*, b.title, b.author, b.isbn,
        u.first_name || ' ' || u.last_name as user_name,
        u.email as user_email
       FROM book_issues bi
       JOIN books b ON bi.book_id = b.book_id
       JOIN users u ON bi.user_id = u.user_id
       WHERE bi.issue_id = ?`,
      [issueId]
    );
  }

  static async getByUser(userId) {
    return await allQuery(
      `SELECT bi.*, b.title, b.author, b.isbn
       FROM book_issues bi
       JOIN books b ON bi.book_id = b.book_id
       WHERE bi.user_id = ? AND bi.status = 'issued'
       ORDER BY bi.due_date ASC`,
      [userId]
    );
  }

  static async getOverdue() {
    return await allQuery(
      `SELECT bi.*, b.title, b.author,
        u.first_name || ' ' || u.last_name as user_name, u.email, u.phone
       FROM book_issues bi
       JOIN books b ON bi.book_id = b.book_id
       JOIN users u ON bi.user_id = u.user_id
       WHERE bi.status = 'issued' AND bi.due_date < date('now')
       ORDER BY bi.due_date ASC`
    );
  }

  static async getActiveIssues() {
    return await allQuery(
      `SELECT bi.*, b.title, b.author,
        u.first_name || ' ' || u.last_name as user_name
       FROM book_issues bi
       JOIN books b ON bi.book_id = b.book_id
       JOIN users u ON bi.user_id = u.user_id
       WHERE bi.status = 'issued'
       ORDER BY bi.due_date ASC
       LIMIT 50`
    );
  }

  static async returnBook(issueId, returnData) {
    const { return_date, fine_amount, remarks } = returnData;
    
    const issue = await this.findById(issueId);
    
    const result = await runQuery(
      `UPDATE book_issues SET status = 'returned', return_date = ?, fine_amount = ?, remarks = ?
       WHERE issue_id = ?`,
      [return_date, fine_amount, remarks, issueId]
    );
    
    // Restore available quantity
    await runQuery(
      'UPDATE books SET available_quantity = available_quantity + 1 WHERE book_id = ?',
      [issue.book_id]
    );
    
    return result.changes > 0;
  }

  static async markLost(issueId, fine_amount) {
    const issue = await this.findById(issueId);
    
    const result = await runQuery(
      `UPDATE book_issues SET status = 'lost', fine_amount = ? WHERE issue_id = ?`,
      [fine_amount, issueId]
    );
    
    return result.changes > 0;
  }

  static async getStats() {
    return await getQuery(
      `SELECT 
        COUNT(CASE WHEN status = 'issued' THEN 1 END) as active_issues,
        COUNT(CASE WHEN status = 'issued' AND due_date < date('now') THEN 1 END) as overdue_count,
        SUM(CASE WHEN status = 'returned' THEN fine_amount ELSE 0 END) as total_fines_collected
       FROM book_issues`
    );
  }

  static async renew(issueId, newDueDate) {
    const result = await runQuery(
      'UPDATE book_issues SET due_date = ? WHERE issue_id = ? AND status = \'issued\'',
      [newDueDate, issueId]
    );
    return result.changes > 0;
  }
}

module.exports = BookIssueModel;