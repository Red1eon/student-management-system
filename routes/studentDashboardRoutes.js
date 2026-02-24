const express = require('express');
const router = express.Router();
const studentDashboardController = require('../controllers/studentDashboardController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

// All routes require student role
router.use(requireAuth, requireRole(['student']));

// Dashboard
router.get('/dashboard', studentDashboardController.getDashboard);

// My Attendance
router.get('/my-attendance', studentDashboardController.getMyAttendance);

// My Results
router.get('/my-results', studentDashboardController.getMyResults);

// My Timetable
router.get('/my-timetable', studentDashboardController.getMyTimetable);

// My Fees
router.get('/my-fees', studentDashboardController.getMyFees);

// My Profile
router.get('/my-profile', studentDashboardController.getMyProfile);

module.exports = router;
