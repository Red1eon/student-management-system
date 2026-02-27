const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { requireAuth, requireRole, requirePermission } = require('../middleware/authMiddleware');

router.get('/', requireAuth, notificationController.getNotifications);
router.get('/create', requireAuth, requirePermission('notifications.send', ['admin', 'staff']), notificationController.getCreateNotification);
router.post('/create', requireAuth, requirePermission('notifications.send', ['admin', 'staff']), notificationController.postCreateNotification);
router.post('/:id/read', requireAuth, notificationController.postMarkAsRead);
router.post('/mark-all-read', requireAuth, notificationController.postMarkAllAsRead);
router.get('/unread-count', requireAuth, notificationController.getUnreadCount);
router.post('/deliveries/:deliveryId/retry', requireAuth, requirePermission('notifications.retry_delivery', ['admin', 'staff']), notificationController.postRetryDelivery);

module.exports = router;
