const FeeModel = require('../models/feeModel');
const FeePaymentModel = require('../models/feePaymentModel');
const StudentModel = require('../models/studentModel');
const ClassModel = require('../models/classModel');
const { logAudit } = require('../utils/auditLogger');
const VALID_FEE_TYPES = new Set(['tuition', 'admission', 'exam', 'library', 'sports', 'other']);
const VALID_FREQUENCIES = new Set(['one-time', 'monthly', 'quarterly', 'yearly']);
const { allQuery } = require('../config/database');

const pickAllowed = (value, allowed, fallback = null) => (allowed.has(value) ? value : fallback);
const parseOptionalInt = (value) => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};
const parseAmount = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};
const normalizeText = (value) => {
  const text = String(value || '').trim();
  return text || null;
};
const resolveReturnTo = (value, fallback = '/fees/structure') => {
  const target = String(value || '').trim();
  if (!target) return fallback;
  if (!target.startsWith('/')) return fallback;
  if (target.startsWith('//')) return fallback;
  return target;
};
const normalizeFeePayload = (body = {}) => {
  const payload = {
    fee_name: String(body.fee_name || '').trim(),
    class_id: parseOptionalInt(body.class_id),
    amount: parseAmount(body.amount),
    fee_type: pickAllowed(String(body.fee_type || ''), VALID_FEE_TYPES, 'other'),
    frequency: pickAllowed(String(body.frequency || ''), VALID_FREQUENCIES, 'one-time'),
    academic_year: String(body.academic_year || '').trim(),
    due_date: normalizeText(body.due_date),
    is_mandatory: String(body.is_mandatory) === '0' ? 0 : 1,
    description: normalizeText(body.description)
  };

  if (!payload.fee_name) throw new Error('Fee name is required.');
  if (!payload.academic_year) throw new Error('Academic year is required.');
  return payload;
};

const csvEscape = (value) => {
  const text = String(value ?? '');
  if (text.includes('"') || text.includes(',') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const resolveValidFeeId = async (studentId, requestedFeeId, fallbackFeeId = null) => {
  const candidateFeeId = requestedFeeId || fallbackFeeId;
  if (candidateFeeId) {
    const fee = await FeeModel.findById(candidateFeeId);
    if (fee) return fee.fee_id;
  }

  if (!studentId) return null;

  const studentFees = await FeeModel.getByStudent(studentId);
  if (studentFees && studentFees.length > 0) return studentFees[0].fee_id;

  return null;
};

const createFallbackFeeForStudent = async (studentId, amountPaid) => {
  const student = studentId ? await StudentModel.findById(studentId) : null;
  const classId = student?.current_class_id || null;

  let academicYear = String(new Date().getFullYear());
  if (classId) {
    const cls = await ClassModel.findById(classId);
    if (cls?.academic_year) academicYear = cls.academic_year;
  }

  const feeId = await FeeModel.create({
    fee_name: 'General Fee Payment',
    class_id: classId,
    amount: Number(amountPaid) || 0,
    fee_type: 'other',
    frequency: 'one-time',
    academic_year: academicYear,
    due_date: null,
    is_mandatory: 0,
    description: 'Auto-created to allow direct fee payment recording.'
  });

  return feeId || null;
};

const feeController = {
  getFeeDashboard: async (req, res) => {
    try {
      const recentPayments = await FeePaymentModel.getRecent(10);
      const pendingPayments = await FeePaymentModel.getPendingPayments();
      const stats = await FeePaymentModel.getPaymentStats();
      stats.pending_amount = Math.max(Number(stats.total_expected || 0) - Number(stats.total_collected || 0), 0);
      
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
    const returnTo = resolveReturnTo(req.query.return_to, '/fees/structure');
    const formData = {
      fee_name: req.query.fee_name || '',
      class_id: req.query.class_id || '',
      amount: req.query.amount || '',
      fee_type: req.query.fee_type || 'tuition',
      frequency: req.query.frequency || 'one-time',
      academic_year: req.query.academic_year || '',
      due_date: req.query.due_date || '',
      is_mandatory: req.query.is_mandatory || '1',
      description: req.query.description || '',
      return_to: returnTo
    };
    res.render('fees/add', { title: 'Add Fee Structure', classes, formData, returnTo });
  },

  postAddFee: async (req, res) => {
    try {
      const returnTo = resolveReturnTo(req.body.return_to, '/fees/structure');
      const payload = normalizeFeePayload(req.body);
      const feeId = await FeeModel.create(payload);
      await logAudit(req, 'FEE_STRUCTURE_CREATED', 'fee_structure', feeId, payload);
      const joiner = returnTo.includes('?') ? '&' : '?';
      res.redirect(`${returnTo}${joiner}success=Fee structure created`);
    } catch (error) {
      const classes = await ClassModel.getAll();
      const returnTo = resolveReturnTo(req.body.return_to, '/fees/structure');
      res.render('fees/add', { title: 'Add Fee Structure', classes, formData: req.body, returnTo, error: error.message });
    }
  },

  getEditFee: async (req, res) => {
    try {
      const returnTo = resolveReturnTo(req.query.return_to, '/fees/structure');
      const fee = await FeeModel.findById(req.params.feeId);
      if (!fee) return res.status(404).render('404', { title: 'Page Not Found' });
      const classes = await ClassModel.getAll();
      res.render('fees/edit', { title: 'Edit Fee Structure', fee, classes, returnTo });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  postEditFee: async (req, res) => {
    try {
      const returnTo = resolveReturnTo(req.body.return_to, '/fees/structure');
      const payload = normalizeFeePayload(req.body);
      const updated = await FeeModel.update(req.params.feeId, payload);
      if (!updated) return res.status(404).render('404', { title: 'Page Not Found' });
      await logAudit(req, 'FEE_STRUCTURE_UPDATED', 'fee_structure', req.params.feeId, payload);
      const joiner = returnTo.includes('?') ? '&' : '?';
      res.redirect(`${returnTo}${joiner}success=Fee structure updated`);
    } catch (error) {
      const fee = await FeeModel.findById(req.params.feeId);
      if (!fee) return res.status(404).render('404', { title: 'Page Not Found' });
      const classes = await ClassModel.getAll();
      const returnTo = resolveReturnTo(req.body.return_to, '/fees/structure');
      res.render('fees/edit', { title: 'Edit Fee Structure', fee: { ...fee, ...req.body }, classes, returnTo, error: error.message });
    }
  },

  getRecordPayment: async (req, res) => {
    try {
      const students = await StudentModel.getAll();
      const fees = await FeeModel.getAll();
      res.render('fees/record', { title: 'Record Payment', students, fees, payment: null, isEdit: false });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getRecordPaymentOptions: async (req, res) => {
    try {
      const studentId = Number.parseInt(req.params.studentId, 10);
      if (!Number.isInteger(studentId) || studentId <= 0) {
        return res.status(400).json({ error: 'Invalid student id' });
      }

      const context = await FeeModel.getPaymentContextByStudent(studentId);
      const dueDates = Array.isArray(context.fees)
        ? context.fees.map((f) => f.due_date).filter(Boolean).sort()
        : [];
      const today = new Date().toISOString().split('T')[0];
      const overdueCount = dueDates.filter((date) => date < today).length;

      res.json({
        ...context,
        supportsFlexiblePayment: context.paymentPlan === 'flexible',
        nextDueDate: dueDates[0] || null,
        allDueDates: dueDates,
        overdueCount
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  postRecordPayment: async (req, res) => {
    try {
      let feeId = await resolveValidFeeId(req.body.student_id, req.body.fee_id);
      if (!feeId) feeId = await createFallbackFeeForStudent(req.body.student_id, req.body.amount_paid);
      if (!feeId) throw new Error('Unable to resolve a valid fee record for this payment.');

      const paymentData = {
        ...req.body,
        fee_id: feeId,
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
      res.render('fees/record', { title: 'Record Payment', students, fees, payment: null, isEdit: false, error: error.message });
    }
  },

  getEditPayment: async (req, res) => {
    try {
      const payment = await FeePaymentModel.findById(req.params.paymentId);
      if (!payment) return res.status(404).render('404', { title: 'Page Not Found' });

      const students = await StudentModel.getAll();
      const fees = await FeeModel.getAll();
      res.render('fees/record', {
        title: 'Update Payment',
        students,
        fees,
        payment,
        isEdit: true
      });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  postUpdatePayment: async (req, res) => {
    try {
      const existingPayment = await FeePaymentModel.findById(req.params.paymentId);
      if (!existingPayment) return res.status(404).render('404', { title: 'Page Not Found' });

      const feeId = await resolveValidFeeId(req.body.student_id, req.body.fee_id, existingPayment.fee_id);
      if (!feeId) {
        throw new Error('No valid fee structure found for the selected student. Add a fee structure first.');
      }

      const paymentData = {
        ...req.body,
        fee_id: feeId,
        received_by: req.session.user.id
      };

      const updated = await FeePaymentModel.update(req.params.paymentId, paymentData);
      if (!updated) return res.status(404).render('404', { title: 'Page Not Found' });

      await logAudit(req, 'FEE_PAYMENT_UPDATED', 'fee_payment', req.params.paymentId, {
        student_id: paymentData.student_id,
        fee_id: paymentData.fee_id,
        amount_paid: paymentData.amount_paid
      });

      res.redirect(`/fees/student/${paymentData.student_id}?success=Payment updated`);
    } catch (error) {
      const students = await StudentModel.getAll();
      const fees = await FeeModel.getAll();
      const payment = await FeePaymentModel.findById(req.params.paymentId);
      res.render('fees/record', {
        title: 'Update Payment',
        students,
        fees,
        payment,
        isEdit: true,
        error: error.message
      });
    }
  },

  getReceipt: async (req, res) => {
    try {
      const payment = await FeePaymentModel.getByReceipt(req.params.receiptNumber);
      if (!payment) return res.status(404).render('404', { title: 'Page Not Found' });
      
      res.render('fees/receipt', { title: 'Payment Receipt', payment });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getStudentFees: async (req, res) => {
    try {
      const student = await StudentModel.findById(req.params.studentId);
      if (!student) return res.status(404).render('404', { title: 'Page Not Found' });
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
  },

  exportPaymentsCsv: async (req, res) => {
    try {
      const rows = await allQuery(
        `SELECT fp.payment_id, fp.receipt_number, fp.payment_date, fp.amount_paid, fp.payment_method,
                fp.payment_status, fp.transaction_id, fp.remarks,
                s.student_id, s.admission_number, u.first_name || ' ' || u.last_name AS student_name,
                f.fee_name, f.fee_type
         FROM fee_payments fp
         JOIN students s ON fp.student_id = s.student_id
         JOIN users u ON s.user_id = u.user_id
         JOIN fees_structure f ON fp.fee_id = f.fee_id
         ORDER BY fp.payment_date DESC`
      );

      const header = [
        'payment_id', 'receipt_number', 'payment_date', 'student_id', 'admission_number',
        'student_name', 'fee_name', 'fee_type', 'amount_paid', 'payment_method',
        'payment_status', 'transaction_id', 'remarks'
      ];

      const csv = [header, ...rows.map((r) => [
        r.payment_id, r.receipt_number, r.payment_date, r.student_id, r.admission_number,
        r.student_name, r.fee_name, r.fee_type, r.amount_paid, r.payment_method,
        r.payment_status, r.transaction_id, r.remarks
      ])]
        .map((row) => row.map(csvEscape).join(','))
        .join('\n');

      const fileName = `fees-report-${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.send(csv);
    } catch (error) {
      return res.status(500).render('error', { message: error.message });
    }
  }
};

module.exports = feeController;
