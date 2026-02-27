const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const RolePermissionModel = require('../models/rolePermissionModel');
const AppSettingModel = require('../models/appSettingModel');
const LoginAttemptModel = require('../models/loginAttemptModel');
const attendanceRiskScheduler = require('../utils/attendanceRiskScheduler');
const { logAudit } = require('../utils/auditLogger');

const ROLES = ['admin', 'staff', 'teacher', 'student', 'parent', 'accountant', 'librarian'];
const PERMISSIONS = [
  'audit.view',
  'reports.export',
  'fees.export',
  'exams.export',
  'notifications.send',
  'notifications.retry_delivery',
  'scheduler.manage',
  'system.backup',
  'system.restore',
  'security.manage'
];

function parseBool(value) {
  return String(value || '') === '1' || String(value || '').toLowerCase() === 'true' || value === 'on';
}

function readSessionRows(limit = 200) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database('./sessions.db');
    db.all(
      `SELECT sid, sess, expired
       FROM sessions
       ORDER BY expired DESC
       LIMIT ?`,
      [limit],
      (err, rows) => {
        db.close();
        if (err) return reject(err);
        const parsed = rows.map((row) => {
          let session = {};
          try {
            session = JSON.parse(row.sess || '{}');
          } catch (_error) {
            session = {};
          }
          return {
            sid: row.sid,
            expired: row.expired,
            user: session.user || null
          };
        });
        resolve(parsed);
      }
    );
  });
}

function deleteSessionBySid(sid) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database('./sessions.db');
    db.run('DELETE FROM sessions WHERE sid = ?', [sid], function onRun(err) {
      db.close();
      if (err) return reject(err);
      return resolve(this.changes > 0);
    });
  });
}

const adminController = {
  getPermissionMatrix: async (req, res) => {
    try {
      const rows = await RolePermissionModel.getMatrix();
      const matrix = {};
      for (const permission of PERMISSIONS) {
        matrix[permission] = {};
        for (const role of ROLES) matrix[permission][role] = false;
      }
      for (const row of rows) {
        if (!matrix[row.permission_key]) continue;
        matrix[row.permission_key][row.role] = Number(row.allowed) === 1;
      }
      res.render('admin/permissions', {
        title: 'Role Permissions',
        roles: ROLES,
        permissions: PERMISSIONS,
        matrix
      });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  postPermissionMatrix: async (req, res) => {
    try {
      for (const permission of PERMISSIONS) {
        for (const role of ROLES) {
          const key = `${permission}__${role}`;
          await RolePermissionModel.upsert(role, permission, parseBool(req.body[key]));
        }
      }
      await logAudit(req, 'PERMISSIONS_UPDATED', 'role_permissions', 'matrix', {});
      return res.redirect('/admin/permissions?success=Permissions updated');
    } catch (error) {
      return res.status(500).render('error', { message: error.message });
    }
  },

  getReportsHub: async (req, res) => {
    return res.render('admin/reports', { title: 'Reports & Exports' });
  },

  getSchedulerDashboard: async (req, res) => {
    try {
      const status = attendanceRiskScheduler.getStatus();
      return res.render('admin/scheduler', { title: 'Scheduler', status });
    } catch (error) {
      return res.status(500).render('error', { message: error.message });
    }
  },

  postSchedulerRunNow: async (req, res) => {
    try {
      await attendanceRiskScheduler.triggerNow();
      await logAudit(req, 'SCHEDULER_RUN_NOW', 'attendance_risk', 'manual', {});
      return res.redirect('/admin/scheduler?success=Job triggered');
    } catch (error) {
      return res.status(500).render('error', { message: error.message });
    }
  },

  getBackupDashboard: async (req, res) => {
    try {
      const backupDir = path.join(process.cwd(), 'backups');
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      const files = fs.readdirSync(backupDir)
        .map((name) => {
          const full = path.join(backupDir, name);
          const stat = fs.statSync(full);
          return { name, size: stat.size, modified_at: stat.mtime.toISOString() };
        })
        .sort((a, b) => b.modified_at.localeCompare(a.modified_at));
      return res.render('admin/backup', { title: 'Backup & Restore', files });
    } catch (error) {
      return res.status(500).render('error', { message: error.message });
    }
  },

  postCreateBackup: async (req, res) => {
    try {
      const dbPath = path.resolve(process.cwd(), process.env.DB_PATH || './student_management.db');
      const backupDir = path.join(process.cwd(), 'backups');
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `student_management_${stamp}.db`;
      fs.copyFileSync(dbPath, path.join(backupDir, backupName));
      await logAudit(req, 'DB_BACKUP_CREATED', 'database_backup', backupName, {});
      return res.redirect('/admin/backup?success=Backup created');
    } catch (error) {
      return res.redirect(`/admin/backup?error=${encodeURIComponent(error.message)}`);
    }
  },

  postRestoreBackup: async (req, res) => {
    try {
      const backupName = String(req.body.backup_name || '').trim();
      if (!backupName || backupName.includes('..') || backupName.includes('/') || backupName.includes('\\')) {
        return res.redirect('/admin/backup?error=Invalid backup name');
      }
      const backupPath = path.join(process.cwd(), 'backups', backupName);
      if (!fs.existsSync(backupPath)) return res.redirect('/admin/backup?error=Backup not found');

      const dbPath = path.resolve(process.cwd(), process.env.DB_PATH || './student_management.db');
      fs.copyFileSync(backupPath, dbPath);
      await logAudit(req, 'DB_RESTORE_APPLIED', 'database_backup', backupName, {});
      return res.redirect('/admin/backup?success=Restore completed. Restart app to ensure all handles refresh.');
    } catch (error) {
      return res.redirect(`/admin/backup?error=${encodeURIComponent(error.message)}`);
    }
  },

  getSecurityDashboard: async (req, res) => {
    try {
      const sessions = await readSessionRows(200);
      const failedLogins = await LoginAttemptModel.getRecentFailures(100);
      const settings = {
        password_min_length: await AppSettingModel.getNumber('security.password_min_length', 8),
        password_require_number: await AppSettingModel.getNumber('security.password_require_number', 1),
        password_require_special: await AppSettingModel.getNumber('security.password_require_special', 0),
        max_failed_login_attempts: await AppSettingModel.getNumber('security.max_failed_login_attempts', 5),
        lockout_window_minutes: await AppSettingModel.getNumber('security.lockout_window_minutes', 15),
        lockout_duration_minutes: await AppSettingModel.getNumber('security.lockout_duration_minutes', 15)
      };

      return res.render('admin/security', {
        title: 'Security Center',
        sessions,
        failedLogins,
        settings
      });
    } catch (error) {
      return res.status(500).render('error', { message: error.message });
    }
  },

  postForceLogout: async (req, res) => {
    try {
      const sid = String(req.body.sid || '').trim();
      if (!sid) return res.redirect('/admin/security?error=Missing session id');
      await deleteSessionBySid(sid);
      await logAudit(req, 'SESSION_FORCED_LOGOUT', 'session', sid, {});
      return res.redirect('/admin/security?success=Session terminated');
    } catch (error) {
      return res.redirect(`/admin/security?error=${encodeURIComponent(error.message)}`);
    }
  },

  postSecuritySettings: async (req, res) => {
    try {
      await AppSettingModel.set('security.password_min_length', Number(req.body.password_min_length || 8));
      await AppSettingModel.set('security.password_require_number', parseBool(req.body.password_require_number) ? 1 : 0);
      await AppSettingModel.set('security.password_require_special', parseBool(req.body.password_require_special) ? 1 : 0);
      await AppSettingModel.set('security.max_failed_login_attempts', Number(req.body.max_failed_login_attempts || 5));
      await AppSettingModel.set('security.lockout_window_minutes', Number(req.body.lockout_window_minutes || 15));
      await AppSettingModel.set('security.lockout_duration_minutes', Number(req.body.lockout_duration_minutes || 15));
      await logAudit(req, 'SECURITY_SETTINGS_UPDATED', 'app_settings', 'security', {});
      return res.redirect('/admin/security?success=Security settings saved');
    } catch (error) {
      return res.redirect(`/admin/security?error=${encodeURIComponent(error.message)}`);
    }
  }
};

module.exports = adminController;
