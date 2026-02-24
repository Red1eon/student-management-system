const { getQuery, allQuery } = require('../config/database');
const AuditLogModel = require('../models/auditLogModel');

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
      const logs = await AuditLogModel.getRecent(200);
      res.render('dashboard/audit', {
        title: 'Audit Logs',
        logs
      });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  }
};

module.exports = dashboardController;
