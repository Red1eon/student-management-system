const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

// GET /teachers - Show all teachers
router.get('/', requireAuth, teacherController.getAllTeachers);

// GET /teachers/add - Show add form
router.get('/add', requireAuth, requireRole(['admin', 'staff']), teacherController.getAddTeacher);

// POST /teachers/add - Process add form
router.post('/add', requireAuth, requireRole(['admin', 'staff']), teacherController.postAddTeacher);

// GET /teachers/:id - Show single teacher
router.get('/:id', requireAuth, teacherController.getTeacherDetail);

// POST /teachers/:id/assign-subject - Assign subject to teacher
router.post('/:id/assign-subject', requireAuth, requireRole(['admin', 'staff']), teacherController.assignSubject);

module.exports = router;