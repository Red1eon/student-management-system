const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { validateCourseCreate, handleValidationErrors } = require('../middleware/validationMiddleware');

router.get('/', requireAuth, requireRole(['admin']), courseController.getCourses);
router.get('/add', requireAuth, requireRole(['admin']), courseController.getAddCourse);
router.post('/add', requireAuth, requireRole(['admin']), validateCourseCreate, handleValidationErrors, courseController.postAddCourse);
router.get('/:id/edit', requireAuth, requireRole(['admin']), courseController.getEditCourse);
router.post('/:id/edit', requireAuth, requireRole(['admin']), validateCourseCreate, handleValidationErrors, courseController.postEditCourse);
router.delete('/:id', requireAuth, requireRole(['admin']), courseController.deleteCourse);

module.exports = router;
