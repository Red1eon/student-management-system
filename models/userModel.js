const { runQuery, getQuery, allQuery } = require('../config/database');
const bcrypt = require('bcryptjs');

class UserModel {
  static async create(userData) {
    const {
      username, password, email, first_name, last_name,
      phone, address, date_of_birth, gender, user_type
    } = userData;
    
    const password_hash = await bcrypt.hash(password, 10);
    
    const result = await runQuery(
      `INSERT INTO users (username, password_hash, email, first_name, last_name, 
        phone, address, date_of_birth, gender, user_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, password_hash, email, first_name, last_name, 
       phone, address, date_of_birth, gender, user_type]
    );
    return result.id;
  }

  static async findByUsername(username) {
    return await getQuery('SELECT * FROM users WHERE username = ?', [username]);
  }

  static async findById(userId) {
    return await getQuery('SELECT * FROM users WHERE user_id = ?', [userId]);
  }

  static async findByEmail(email) {
    return await getQuery('SELECT * FROM users WHERE email = ?', [email]);
  }

  static async update(userId, updateData) {
    const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updateData), userId];
    
    const result = await runQuery(
      `UPDATE users SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
      values
    );
    return result.changes > 0;
  }

  static async delete(userId) {
    const result = await runQuery('UPDATE users SET is_active = 0 WHERE user_id = ?', [userId]);
    return result.changes > 0;
  }

  static async verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  static async getAllByType(userType, limit = 50, offset = 0) {
    return await allQuery(
      'SELECT * FROM users WHERE user_type = ? AND is_active = 1 LIMIT ? OFFSET ?',
      [userType, limit, offset]
    );
  }
}

module.exports = UserModel;