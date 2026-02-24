const express = require('express');
const router = express.Router();
const feeController = require('../controllers/feeController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.get('/', requireAuth, requireRole(['admin', 'staff', 'accountant']), feeController.getFeeDashboard);
router.get('/structure', requireAuth, requireRole(['admin', 'staff', 'accountant']), feeController.getFeeStructure);
router.get('/add', requireAuth, requireRole(['admin', 'staff']), feeController.getAddFee);
router.post('/add', requireAuth, requireRole(['admin', 'staff']), feeController.postAddFee);
router.get('/record', requireAuth, requireRole(['admin', 'staff', 'accountant']), feeController.getRecordPayment);
router.post('/record', requireAuth, requireRole(['admin', 'staff', 'accountant']), feeController.postRecordPayment);
router.get('/receipt/:receiptNumber', requireAuth, feeController.getReceipt);
router.get('/student/:studentId', requireAuth, feeController.getStudentFees);

module.exports = router;