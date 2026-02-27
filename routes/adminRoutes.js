const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAuth, requirePermission } = require('../middleware/authMiddleware');

router.use(requireAuth);

router.get('/permissions', requirePermission('security.manage', ['admin']), adminController.getPermissionMatrix);
router.post('/permissions', requirePermission('security.manage', ['admin']), adminController.postPermissionMatrix);

router.get('/reports', requirePermission('reports.export', ['admin']), adminController.getReportsHub);

router.get('/scheduler', requirePermission('scheduler.manage', ['admin']), adminController.getSchedulerDashboard);
router.post('/scheduler/run-now', requirePermission('scheduler.manage', ['admin']), adminController.postSchedulerRunNow);

router.get('/backup', requirePermission('system.backup', ['admin']), adminController.getBackupDashboard);
router.post('/backup/create', requirePermission('system.backup', ['admin']), adminController.postCreateBackup);
router.post('/backup/restore', requirePermission('system.restore', ['admin']), adminController.postRestoreBackup);

router.get('/security', requirePermission('security.manage', ['admin']), adminController.getSecurityDashboard);
router.post('/security/force-logout', requirePermission('security.manage', ['admin']), adminController.postForceLogout);
router.post('/security/settings', requirePermission('security.manage', ['admin']), adminController.postSecuritySettings);

module.exports = router;
