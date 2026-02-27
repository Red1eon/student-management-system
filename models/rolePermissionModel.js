const { runQuery, getQuery, allQuery } = require('../config/database');

class RolePermissionModel {
  static async upsert(role, permissionKey, allowed) {
    await runQuery(
      `INSERT INTO role_permissions (role, permission_key, allowed, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(role, permission_key) DO UPDATE SET
         allowed = excluded.allowed,
         updated_at = CURRENT_TIMESTAMP`,
      [role, permissionKey, allowed ? 1 : 0]
    );
  }

  static async isAllowed(role, permissionKey) {
    const row = await getQuery(
      'SELECT allowed FROM role_permissions WHERE role = ? AND permission_key = ?',
      [role, permissionKey]
    );
    return !!(row && Number(row.allowed) === 1);
  }

  static async getMatrix() {
    return allQuery(
      `SELECT role, permission_key, allowed, updated_at
       FROM role_permissions
       ORDER BY permission_key ASC, role ASC`
    );
  }
}

module.exports = RolePermissionModel;
