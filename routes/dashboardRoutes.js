const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.get('/', requireAuth, dashboardController.getDashboard);
router.get('/audit', requireAuth, requireRole(['admin', 'staff']), dashboardController.getAuditLogs);

module.exports = router;
