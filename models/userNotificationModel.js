const { runQuery, getQuery, allQuery } = require('../config/database');

class UserNotificationModel {
  static async create(userId, notificationId) {
    const result = await runQuery(
      'INSERT OR IGNORE INTO user_notifications (user_id, notification_id) VALUES (?, ?)',
      [userId, notificationId]
    );
    return result.id;
  }

  static async findById(userNotificationId) {
    return await getQuery(
      `SELECT un.*, n.title, n.message, n.notification_type, n.sent_at
       FROM user_notifications un
       JOIN notifications n ON un.notification_id = n.notification_id
       WHERE un.user_notification_id = ?`,
      [userNotificationId]
    );
  }

  static async getByUser(userId, options = {}) {
    let sql = `
      SELECT un.*, n.title, n.message, n.notification_type, n.sent_at, n.expires_at
      FROM user_notifications un
      JOIN notifications n ON un.notification_id = n.notification_id
      WHERE un.user_id = ?
    `;
    const params = [userId];
    
    if (options.unreadOnly) {
      sql += ' AND un.is_read = 0';
    }
    if (options.type) {
      sql += ' AND n.notification_type = ?';
      params.push(options.type);
    }
    
    sql += ' ORDER BY n.sent_at DESC';
    
    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }
    
    return await allQuery(sql, params);
  }

  static async markAsRead(userNotificationId) {
    const result = await runQuery(
      `UPDATE user_notifications SET is_read = 1, read_at = datetime('now') 
       WHERE user_notification_id = ?`,
      [userNotificationId]
    );
    return result.changes > 0;
  }

  static async markAllAsRead(userId) {
    const result = await runQuery(
      `UPDATE user_notifications SET is_read = 1, read_at = datetime('now') 
       WHERE user_id = ? AND is_read = 0`,
      [userId]
    );
    return result.changes > 0;
  }

  static async delete(userNotificationId) {
    const result = await runQuery(
      'DELETE FROM user_notifications WHERE user_notification_id = ?',
      [userNotificationId]
    );
    return result.changes > 0;
  }

  static async getStats(userId) {
    return await getQuery(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN is_read = 0 THEN 1 END) as unread,
        COUNT(CASE WHEN is_read = 1 THEN 1 END) as read
       FROM user_notifications
       WHERE user_id = ?`,
      [userId]
    );
  }
}

module.exports = UserNotificationModel;