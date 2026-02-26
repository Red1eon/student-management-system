const express = require('express');
const router = express.Router();
const feeController = require('../controllers/feeController');
const { requireAuth, requireRole, requireStudentAccess } = require('../middleware/authMiddleware');

router.get('/', requireAuth, requireRole(['admin', 'staff', 'accountant']), feeController.getFeeDashboard);
router.get('/structure', requireAuth, requireRole(['admin', 'staff', 'accountant']), feeController.getFeeStructure);
router.get('/add', requireAuth, requireRole(['admin', 'staff']), feeController.getAddFee);
router.post('/add', requireAuth, requireRole(['admin', 'staff']), feeController.postAddFee);
router.get('/structure/:feeId/edit', requireAuth, requireRole(['admin', 'staff']), feeController.getEditFee);
router.post('/structure/:feeId/edit', requireAuth, requireRole(['admin', 'staff']), feeController.postEditFee);
router.get('/record', requireAuth, requireRole(['admin', 'staff', 'accountant']), feeController.getRecordPayment);
router.get('/record/options/:studentId', requireAuth, requireRole(['admin', 'staff', 'accountant']), feeController.getRecordPaymentOptions);
router.post('/record', requireAuth, requireRole(['admin', 'staff', 'accountant']), feeController.postRecordPayment);
router.get('/payment/:paymentId/edit', requireAuth, requireRole(['admin', 'staff', 'accountant']), feeController.getEditPayment);
router.post('/payment/:paymentId/edit', requireAuth, requireRole(['admin', 'staff', 'accountant']), feeController.postUpdatePayment);
router.get('/receipt/:receiptNumber', requireAuth, feeController.getReceipt);
router.get('/student/:studentId', requireAuth, requireStudentAccess('studentId', ['admin', 'staff', 'accountant']), feeController.getStudentFees);

module.exports = router;
