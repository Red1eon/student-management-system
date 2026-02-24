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
}

module.exports = AuditLogModel;
