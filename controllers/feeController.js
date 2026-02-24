const FeeModel = require('../models/feeModel');
const FeePaymentModel = require('../models/feePaymentModel');
const StudentModel = require('../models/studentModel');
const ClassModel = require('../models/ClassModel');
const { logAudit } = require('../utils/auditLogger');

const feeController = {
  getFeeDashboard: async (req, res) => {
    try {
      const recentPayments = await FeePaymentModel.getRecent(10);
      const pendingPayments = await FeePaymentModel.getPendingPayments();
      const stats = await FeePaymentModel.getPaymentStats(new Date().getFullYear());
      
      res.render('fees/index', {
        title: 'Fee Management',
        recentPayments,
        pendingPayments,
        stats
      });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getFeeStructure: async (req, res) => {
    try {
      const fees = await FeeModel.getAll(req.query);
      const classes = await ClassModel.getAll();
      res.render('fees/structure', { title: 'Fee Structure', fees, classes, filters: req.query });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getAddFee: async (req, res) => {
    const classes = await ClassModel.getAll();
    res.render('fees/add', { title: 'Add Fee Structure', classes });
  },

  postAddFee: async (req, res) => {
    try {
      await FeeModel.create(req.body);
      await logAudit(req, 'FEE_STRUCTURE_CREATED', 'fee_structure', req.body.fee_name, req.body);
      res.redirect('/fees/structure?success=Fee structure created');
    } catch (error) {
      const classes = await ClassModel.getAll();
      res.render('fees/add', { title: 'Add Fee Structure', classes, error: error.message });
    }
  },

  getRecordPayment: async (req, res) => {
    try {
      const students = await StudentModel.getAll();
      const fees = await FeeModel.getAll();
      res.render('fees/record', { title: 'Record Payment', students, fees });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  postRecordPayment: async (req, res) => {
    try {
      const paymentData = {
        ...req.body,
        received_by: req.session.user.id
      };
      
      const result = await FeePaymentModel.create(paymentData);
      await logAudit(req, 'FEE_PAYMENT_RECORDED', 'fee_payment', result.id, {
        student_id: paymentData.student_id,
        fee_id: paymentData.fee_id,
        amount_paid: paymentData.amount_paid
      });
      res.redirect(`/fees/receipt/${result.receipt_number}?success=Payment recorded`);
    } catch (error) {
      const students = await StudentModel.getAll();
      const fees = await FeeModel.getAll();
      res.render('fees/record', { title: 'Record Payment', students, fees, error: error.message });
    }
  },

  getReceipt: async (req, res) => {
    try {
      const payment = await FeePaymentModel.getByReceipt(req.params.receiptNumber);
      if (!payment) return res.status(404).render('404');
      
      res.render('fees/receipt', { title: 'Payment Receipt', payment });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getStudentFees: async (req, res) => {
    try {
      const student = await StudentModel.findById(req.params.studentId);
      const fees = await FeeModel.getByStudent(req.params.studentId);
      const payments = await FeePaymentModel.getByStudent(req.params.studentId);
      const balance = await StudentModel.getFeeBalance(req.params.studentId);
      
      res.render('fees/student', {
        title: 'Student Fees',
        student,
        fees,
        payments,
        balance
      });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  }
};

module.exports = feeController;
