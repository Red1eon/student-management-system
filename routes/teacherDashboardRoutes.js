const express = require('express');
const router = express.Router();
const teacherDashboardController = require('../controllers/teacherDashboardController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

// All routes require teacher role
router.use(requireAuth, requireRole(['teacher']));

// Dashboard
router.get('/dashboard', teacherDashboardController.getDashboard);

// My Classes
router.get('/my-classes', teacherDashboardController.getMyClasses);
router.get('/class/:classId/students', teacherDashboardController.getClassStudents);

// Attendance - KEY FEATURE
router.get('/mark-attendance', teacherDashboardController.getMarkAttendance);
router.post('/mark-attendance', teacherDashboardController.postMarkAttendance);
router.get('/attendance-report', teacherDashboardController.getAttendanceReport);

// Results
router.get('/enter-results/:examId', teacherDashboardController.getEnterResults);
router.post('/enter-results/:examId', teacherDashboardController.postEnterResults);

// Timetable
router.get('/my-timetable', teacherDashboardController.getMyTimetable);

module.exports = router;