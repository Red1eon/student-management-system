const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { requireAuth, requireRole, requirePermission } = require('../middleware/authMiddleware');

router.get('/', requireAuth, dashboardController.getDashboard);
router.get('/audit', requireAuth, requirePermission('audit.view', ['admin', 'staff']), dashboardController.getAuditLogs);
router.get('/audit/export', requireAuth, requirePermission('audit.view', ['admin', 'staff']), dashboardController.exportAuditCsv);

module.exports = router;
