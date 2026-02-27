const { runQuery, getQuery, allQuery } = require('../config/database');

class AppSettingModel {
  static async get(key, fallback = null) {
    const row = await getQuery('SELECT setting_value FROM app_settings WHERE setting_key = ?', [key]);
    return row ? row.setting_value : fallback;
  }

  static async getNumber(key, fallback = 0) {
    const raw = await this.get(key, String(fallback));
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  static async set(key, value) {
    await runQuery(
      `INSERT INTO app_settings (setting_key, setting_value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(setting_key) DO UPDATE SET
         setting_value = excluded.setting_value,
         updated_at = CURRENT_TIMESTAMP`,
      [key, String(value)]
    );
  }

  static async getByPrefix(prefix) {
    return allQuery(
      `SELECT setting_key, setting_value, updated_at
       FROM app_settings
       WHERE setting_key LIKE ?
       ORDER BY setting_key ASC`,
      [`${prefix}%`]
    );
  }
}

module.exports = AppSettingModel;
