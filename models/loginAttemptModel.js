const { runQuery, getQuery, allQuery } = require('../config/database');

class LoginAttemptModel {
  static async record({ username, ipAddress, success, reason = null }) {
    await runQuery(
      `INSERT INTO login_attempts (username, ip_address, was_success, reason)
       VALUES (?, ?, ?, ?)`,
      [String(username || '').trim(), ipAddress || null, success ? 1 : 0, reason]
    );
  }

  static async countRecentFailures({ username, ipAddress, windowMinutes }) {
    const row = await getQuery(
      `SELECT COUNT(*) AS count, MAX(attempted_at) AS last_attempt_at
       FROM login_attempts
       WHERE username = ?
         AND COALESCE(ip_address, '') = COALESCE(?, '')
         AND was_success = 0
         AND attempted_at >= datetime('now', ?)`,
      [String(username || '').trim(), ipAddress || null, `-${Number(windowMinutes) || 0} minutes`]
    );
    return {
      count: Number(row?.count || 0),
      lastAttemptAt: row?.last_attempt_at || null
    };
  }

  static async getRecentFailures(limit = 100) {
    return allQuery(
      `SELECT attempt_id, username, ip_address, reason, attempted_at
       FROM login_attempts
       WHERE was_success = 0
       ORDER BY attempted_at DESC
       LIMIT ?`,
      [limit]
    );
  }
}

module.exports = LoginAttemptModel;
