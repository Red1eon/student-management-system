const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { requireAuth, requireRole, requireStudentAccess } = require('../middleware/authMiddleware');
const { validateStudentCreate, handleValidationErrors } = require('../middleware/validationMiddleware');

router.get('/', requireAuth, studentController.getAllStudents);
router.get('/add', requireAuth, requireRole(['admin', 'staff']), studentController.getAddStudent);
router.post('/add', requireAuth, requireRole(['admin', 'staff']), validateStudentCreate, handleValidationErrors, studentController.postAddStudent);
router.get('/:id', requireAuth, requireStudentAccess('id', ['admin', 'staff', 'teacher']), studentController.getStudentDetail);
router.get('/:id/edit', requireAuth, requireRole(['admin', 'staff']), studentController.getEditStudent);
router.post('/:id/edit', requireAuth, requireRole(['admin', 'staff']), studentController.postEditStudent);
router.delete('/:id', requireAuth, requireRole(['admin']), studentController.deleteStudent);

module.exports = router;
