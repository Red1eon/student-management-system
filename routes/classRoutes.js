const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { validateClassCreate, handleValidationErrors } = require('../middleware/validationMiddleware');

router.get('/', requireAuth, classController.getAllClasses);
router.get('/add', requireAuth, requireRole(['admin', 'staff']), classController.getAddClass);
router.post('/add', requireAuth, requireRole(['admin', 'staff']), validateClassCreate, handleValidationErrors, classController.postAddClass);
router.get('/:id/edit', requireAuth, requireRole(['admin', 'staff']), classController.getEditClass);
router.post('/:id/edit', requireAuth, requireRole(['admin', 'staff']), validateClassCreate, handleValidationErrors, classController.postEditClass);
router.post('/:id/promote', requireAuth, requireRole(['admin', 'staff']), classController.postPromoteStudents);
router.post('/:id/timetable', requireAuth, requireRole(['admin', 'staff']), classController.postAddTimetable);
router.delete('/:id/timetable/:timetableId', requireAuth, requireRole(['admin', 'staff']), classController.deleteTimetable);
router.delete('/:id', requireAuth, requireRole(['admin']), classController.deleteClass);
router.get('/:id', requireAuth, classController.getClassDetail);

module.exports = router;
