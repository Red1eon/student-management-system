const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.get('/', requireAuth, attendanceController.getAttendanceDashboard);
router.get('/mark', requireAuth, requireRole(['admin', 'teacher', 'staff']), attendanceController.getMarkAttendance);
router.post('/mark', requireAuth, requireRole(['admin', 'teacher', 'staff']), attendanceController.postMarkAttendance);
router.get('/student/:studentId', requireAuth, attendanceController.getStudentAttendance);
router.get('/report', requireAuth, requireRole(['admin', 'staff']), attendanceController.getAttendanceReport);

module.exports = router;