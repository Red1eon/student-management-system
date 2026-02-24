const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.get('/', requireAuth, eventController.getAllEvents);
router.get('/calendar', requireAuth, eventController.getCalendar);
router.get('/create', requireAuth, requireRole(['admin', 'staff']), eventController.getCreateEvent);
router.post('/create', requireAuth, requireRole(['admin', 'staff']), eventController.postCreateEvent);
router.get('/:id', requireAuth, eventController.getEventDetail);
router.post('/:id', requireAuth, requireRole(['admin', 'staff']), eventController.postUpdateEvent);
router.delete('/:id', requireAuth, requireRole(['admin']), eventController.deleteEvent);

module.exports = router;