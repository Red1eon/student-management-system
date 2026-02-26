const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { requireAuth, requireRole, requireStudentAccess } = require('../middleware/authMiddleware');

router.get('/', requireAuth, attendanceController.getAttendanceDashboard);
router.get('/mark', requireAuth, requireRole(['admin', 'teacher', 'staff']), attendanceController.getMarkAttendance);
router.post('/mark', requireAuth, requireRole(['admin', 'teacher', 'staff']), attendanceController.postMarkAttendance);
router.post('/mark/periods/add', requireAuth, requireRole(['admin', 'teacher', 'staff']), attendanceController.postAddPeriod);
router.post('/mark/periods/delete', requireAuth, requireRole(['admin', 'teacher', 'staff']), attendanceController.postDeletePeriod);
router.get('/period', requireAuth, requireRole(['admin', 'teacher', 'staff']), attendanceController.getPeriodAttendance);
router.post('/period', requireAuth, requireRole(['admin', 'teacher', 'staff']), attendanceController.postPeriodAttendance);
router.get('/student/:studentId', requireAuth, requireStudentAccess('studentId', ['admin', 'staff', 'teacher']), attendanceController.getStudentAttendance);
router.get('/report', requireAuth, requireRole(['admin', 'staff', 'teacher']), attendanceController.getAttendanceReport);
router.get('/report/export', requireAuth, requireRole(['admin', 'staff', 'teacher']), attendanceController.exportAttendanceCsv);
router.get('/corrections', requireAuth, attendanceController.getCorrections);
router.post('/corrections/request', requireAuth, attendanceController.postCorrectionRequest);
router.post('/corrections/:id/review', requireAuth, requireRole(['admin', 'staff', 'teacher']), attendanceController.postReviewCorrection);
router.post('/run-risk-check', requireAuth, requireRole(['admin', 'staff', 'teacher']), attendanceController.postRunRiskCheck);
router.get('/integrity', requireAuth, requireRole(['admin', 'staff', 'teacher']), attendanceController.getIntegrityReport);

module.exports = router;
