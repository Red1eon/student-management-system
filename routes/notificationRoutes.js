const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.get('/', requireAuth, notificationController.getNotifications);
router.get('/create', requireAuth, requireRole(['admin', 'staff']), notificationController.getCreateNotification);
router.post('/create', requireAuth, requireRole(['admin', 'staff']), notificationController.postCreateNotification);
router.post('/:id/read', requireAuth, notificationController.postMarkAsRead);
router.post('/mark-all-read', requireAuth, notificationController.postMarkAllAsRead);
router.get('/unread-count', requireAuth, notificationController.getUnreadCount);

module.exports = router;