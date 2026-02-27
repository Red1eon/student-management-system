const { runQuery, getQuery, allQuery } = require('../config/database');

class NotificationDeliveryModel {
  static async create(notificationId, userId, channel, status = 'queued', errorMessage = null) {
    const result = await runQuery(
      `INSERT INTO notification_deliveries
       (notification_id, user_id, channel, delivery_status, error_message, retry_count, last_attempt_at)
       VALUES (?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)`,
      [notificationId, userId, channel, status, errorMessage]
    );
    return result.id;
  }

  static async markStatus(deliveryId, status, errorMessage = null) {
    const result = await runQuery(
      `UPDATE notification_deliveries
       SET delivery_status = ?, error_message = ?, last_attempt_at = CURRENT_TIMESTAMP
       WHERE delivery_id = ?`,
      [status, errorMessage, deliveryId]
    );
    return result.changes > 0;
  }

  static async incrementRetryAndQueue(deliveryId) {
    const result = await runQuery(
      `UPDATE notification_deliveries
       SET retry_count = retry_count + 1,
           delivery_status = 'queued',
           error_message = NULL,
           last_attempt_at = CURRENT_TIMESTAMP
       WHERE delivery_id = ?`,
      [deliveryId]
    );
    return result.changes > 0;
  }

  static async findById(deliveryId) {
    return getQuery(
      `SELECT nd.*, n.title, n.notification_type, u.username
       FROM notification_deliveries nd
       JOIN notifications n ON n.notification_id = nd.notification_id
       JOIN users u ON u.user_id = nd.user_id
       WHERE nd.delivery_id = ?`,
      [deliveryId]
    );
  }

  static async getRecent(limit = 200) {
    return allQuery(
      `SELECT nd.*, n.title, n.notification_type, u.username
       FROM notification_deliveries nd
       JOIN notifications n ON n.notification_id = nd.notification_id
       JOIN users u ON u.user_id = nd.user_id
       ORDER BY nd.created_at DESC
       LIMIT ?`,
      [limit]
    );
  }
}

module.exports = NotificationDeliveryModel;
