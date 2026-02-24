const { runQuery, getQuery, allQuery } = require('../config/database');

class BookModel {
  static async create(bookData) {
    const {
      title, author, publisher, isbn, category,
      quantity, shelf_location, publication_year
    } = bookData;
    
    const result = await runQuery(
      `INSERT INTO books (title, author, publisher, isbn, category, quantity, available_quantity, shelf_location, publication_year)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, author, publisher, isbn, category, quantity, quantity, shelf_location, publication_year]
    );
    return result.id;
  }

  static async findById(bookId) {
    return await getQuery('SELECT * FROM books WHERE book_id = ?', [bookId]);
  }

  static async findByIsbn(isbn) {
    return await getQuery('SELECT * FROM books WHERE isbn = ?', [isbn]);
  }

  static async getAll(filters = {}) {
    let sql = 'SELECT * FROM books WHERE 1=1';
    const params = [];
    
    if (filters.category) {
      sql += ' AND category = ?';
      params.push(filters.category);
    }
    if (filters.search) {
      sql += ` AND (title LIKE ? OR author LIKE ? OR isbn LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    if (filters.available) {
      sql += ' AND available_quantity > 0';
    }
    
    sql += ' ORDER BY title';
    return await allQuery(sql, params);
  }

  static async update(bookId, updateData) {
    const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updateData), bookId];
    const result = await runQuery(
      `UPDATE books SET ${fields} WHERE book_id = ?`,
      values
    );
    return result.changes > 0;
  }

  static async delete(bookId) {
    const result = await runQuery('DELETE FROM books WHERE book_id = ?', [bookId]);
    return result.changes > 0;
  }

  static async updateQuantity(bookId, change) {
    const result = await runQuery(
      `UPDATE books SET available_quantity = available_quantity + ? WHERE book_id = ?`,
      [change, bookId]
    );
    return result.changes > 0;
  }

  static async getCategories() {
    const results = await allQuery('SELECT DISTINCT category FROM books WHERE category IS NOT NULL');
    return results.map(r => r.category);
  }

  static async getStats() {
    return await getQuery(
      `SELECT 
        COUNT(*) as total_books,
        SUM(quantity) as total_copies,
        SUM(available_quantity) as available_copies,
        COUNT(CASE WHEN available_quantity = 0 THEN 1 END) as out_of_stock
       FROM books`
    );
  }
}

module.exports = BookModel;