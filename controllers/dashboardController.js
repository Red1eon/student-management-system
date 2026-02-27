const { getQuery, allQuery } = require('../config/database');
const AuditLogModel = require('../models/auditLogModel');

function csvEscape(value) {
  const text = String(value ?? '');
  if (text.includes('"') || text.includes(',') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

const dashboardController = {
  getDashboard: async (req, res) => {
    try {
      const stats = await getQuery(`
        SELECT 
          (SELECT COUNT(*) FROM students s JOIN users u ON s.user_id = u.user_id WHERE u.is_active = 1) as total_students,
          (SELECT COUNT(*) FROM teachers t JOIN users u ON t.user_id = u.user_id WHERE u.is_active = 1) as total_teachers,
          (SELECT COUNT(*) FROM classes) as total_classes,
          (SELECT COUNT(*) FROM attendance WHERE date = date('now') AND status = 'present') as today_attendance
      `);

      const recentActivities = await allQuery(`
        SELECT 'student' as type, u.first_name || ' ' || u.last_name as name, s.created_at as date, 'New student enrolled' as action
        FROM students s JOIN users u ON s.user_id = u.user_id
        ORDER BY s.created_at DESC LIMIT 5
      `);

      res.render('dashboard/index', {
        title: 'Dashboard',
        stats,
        activities: recentActivities,
        user: req.session.user
      });
    } catch (error) {
      console.error('Dashboard error:', error);
      res.render('dashboard/index', { title: 'Dashboard', error: 'Failed to load dashboard' });
    }
  }
  ,

  getAuditLogs: async (req, res) => {
    try {
      const filters = {
        action: String(req.query.action || '').trim(),
        entity_type: String(req.query.entity_type || '').trim(),
        username: String(req.query.username || '').trim(),
        from: String(req.query.from || '').trim(),
        to: String(req.query.to || '').trim(),
        limit: String(req.query.limit || '200').trim()
      };
      const logs = await AuditLogModel.getFiltered(filters);
      res.render('dashboard/audit', {
        title: 'Audit Logs',
        logs,
        filters
      });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  exportAuditCsv: async (req, res) => {
    try {
      const filters = {
        action: String(req.query.action || '').trim(),
        entity_type: String(req.query.entity_type || '').trim(),
        username: String(req.query.username || '').trim(),
        from: String(req.query.from || '').trim(),
        to: String(req.query.to || '').trim(),
        limit: String(req.query.limit || '1000').trim()
      };
      const logs = await AuditLogModel.getFiltered(filters);
      const header = ['created_at', 'username', 'action', 'entity_type', 'entity_id', 'ip_address', 'details'];
      const rows = logs.map((l) => [
        l.created_at,
        l.username || 'System',
        l.action,
        l.entity_type || '',
        l.entity_id || '',
        l.ip_address || '',
        l.details || ''
      ]);
      const csv = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
      const fileName = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(csv);
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  }
};

module.exports = dashboardController;
