const { runQuery, allQuery } = require('../config/database');

class AuditLogModel {
  static async create(data) {
    const {
      user_id,
      action,
      entity_type,
      entity_id,
      details,
      ip_address
    } = data;

    const payload = typeof details === 'string' ? details : JSON.stringify(details || {});
    const result = await runQuery(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user_id || null, action, entity_type || null, entity_id || null, payload, ip_address || null]
    );
    return result.id;
  }

  static async getRecent(limit = 50) {
    return await allQuery(
      `SELECT al.*, u.username, u.first_name, u.last_name
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.user_id
       ORDER BY al.created_at DESC
       LIMIT ?`,
      [limit]
    );
  }

  static async getFiltered(filters = {}) {
    const where = [];
    const params = [];

    if (filters.action) {
      where.push('al.action = ?');
      params.push(filters.action);
    }
    if (filters.entity_type) {
      where.push('al.entity_type = ?');
      params.push(filters.entity_type);
    }
    if (filters.username) {
      where.push('u.username LIKE ?');
      params.push(`%${filters.username}%`);
    }
    if (filters.from) {
      where.push('date(al.created_at) >= date(?)');
      params.push(filters.from);
    }
    if (filters.to) {
      where.push('date(al.created_at) <= date(?)');
      params.push(filters.to);
    }

    const limit = Math.min(Number(filters.limit) || 200, 1000);
    const sql = `
      SELECT al.*, u.username, u.first_name, u.last_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.user_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY al.created_at DESC
      LIMIT ?
    `;
    params.push(limit);
    return allQuery(sql, params);
  }
}

module.exports = AuditLogModel;
