const { runQuery, getQuery, allQuery } = require('../config/database');

class NotificationModel {
  static async create(notificationData) {
    const {
      title, message, notification_type, target_user_type,
      target_class_id, sent_by, expires_at
    } = notificationData;
    
    const result = await runQuery(
      `INSERT INTO notifications (title, message, notification_type, target_user_type, target_class_id, sent_by, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, message, notification_type, target_user_type, target_class_id, sent_by, expires_at]
    );
    
    // Create user notifications for target users
    await this.distributeToUsers(result.id, target_user_type, target_class_id);
    
    return result.id;
  }

  static async distributeToUsers(notificationId, targetUserType, targetClassId) {
    let userSql = 'SELECT user_id FROM users WHERE is_active = 1';
    const params = [];
    
    if (targetUserType && targetUserType !== 'all') {
      userSql += ' AND user_type = ?';
      params.push(targetUserType);
    }
    
    if (targetClassId) {
      userSql += ' AND user_id IN (SELECT user_id FROM students WHERE current_class_id = ?)';
      params.push(targetClassId);
    }
    
    const users = await allQuery(userSql, params);
    
    if (!users.length) return;

    const db = require('../config/database').getDatabase();
    await new Promise((resolve, reject) => {
      const stmt = db.prepare(
        'INSERT OR IGNORE INTO user_notifications (notification_id, user_id) VALUES (?, ?)'
      );

      let pending = users.length;
      let failed = false;

      users.forEach((u) => {
        stmt.run([notificationId, u.user_id], (runErr) => {
          if (failed) return;
          if (runErr) {
            failed = true;
            return stmt.finalize(() => reject(runErr));
          }

          pending -= 1;
          if (pending === 0) {
            stmt.finalize((finalizeErr) => {
              if (finalizeErr) reject(finalizeErr);
              else resolve();
            });
          }
        });
      });
    });
  }

  static async findById(notificationId) {
    return await getQuery(
      `SELECT n.*, u.first_name || ' ' || u.last_name as sent_by_name,
        c.class_name as target_class_name
       FROM notifications n
       LEFT JOIN users u ON n.sent_by = u.user_id
       LEFT JOIN classes c ON n.target_class_id = c.class_id
       WHERE n.notification_id = ?`,
      [notificationId]
    );
  }

  static async getForUser(userId, unreadOnly = false) {
    let sql = `
      SELECT n.*, un.is_read, un.read_at, un.user_notification_id
      FROM notifications n
      JOIN user_notifications un ON n.notification_id = un.notification_id
      WHERE un.user_id = ? AND (n.expires_at IS NULL OR n.expires_at > datetime('now'))
    `;
    const params = [userId];
    
    if (unreadOnly) {
      sql += ' AND un.is_read = 0';
    }
    
    sql += ' ORDER BY n.sent_at DESC';
    return await allQuery(sql, params);
  }

  static async getUnreadCount(userId) {
    const result = await getQuery(
      `SELECT COUNT(*) as count 
       FROM user_notifications un
       JOIN notifications n ON un.notification_id = n.notification_id
       WHERE un.user_id = ? AND un.is_read = 0 
       AND (n.expires_at IS NULL OR n.expires_at > datetime('now'))`,
      [userId]
    );
    return result?.count || 0;
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

  static async delete(notificationId) {
    await runQuery('DELETE FROM user_notifications WHERE notification_id = ?', [notificationId]);
    const result = await runQuery('DELETE FROM notifications WHERE notification_id = ?', [notificationId]);
    return result.changes > 0;
  }

  static async getRecent(limit = 10) {
    return await allQuery(
      `SELECT n.*, u.first_name || ' ' || u.last_name as sent_by_name,
        (SELECT COUNT(*) FROM user_notifications WHERE notification_id = n.notification_id) as recipient_count
       FROM notifications n
       LEFT JOIN users u ON n.sent_by = u.user_id
       ORDER BY n.sent_at DESC
       LIMIT ?`,
      [limit]
    );
  }

  static async createForUserIds({ title, message, notification_type = 'general', sent_by = null, userIds = [] }) {
    if (!Array.isArray(userIds) || userIds.length === 0) return null;
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    if (!uniqueIds.length) return null;

    const result = await runQuery(
      `INSERT INTO notifications (title, message, notification_type, target_user_type, target_class_id, sent_by, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, message, notification_type, 'all', null, sent_by, null]
    );

    const db = require('../config/database').getDatabase();
    await new Promise((resolve, reject) => {
      const stmt = db.prepare('INSERT OR IGNORE INTO user_notifications (notification_id, user_id) VALUES (?, ?)');
      let pending = uniqueIds.length;
      let failed = false;

      uniqueIds.forEach((userId) => {
        stmt.run([result.id, userId], (err) => {
          if (failed) return;
          if (err) {
            failed = true;
            return stmt.finalize(() => reject(err));
          }
          pending -= 1;
          if (pending === 0) {
            stmt.finalize((finalizeErr) => {
              if (finalizeErr) reject(finalizeErr);
              else resolve();
            });
          }
        });
      });
    });

    return result.id;
  }
}

module.exports = NotificationModel;
