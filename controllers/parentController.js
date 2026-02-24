const StudentModel = require('../models/studentModel');
const AttendanceModel = require('../models/attendanceModel');
const ExamResultModel = require('../models/examResultModel');
const FeeModel = require('../models/feeModel');
const FeePaymentModel = require('../models/feePaymentModel');

async function getChildrenForParent(parentUserId) {
  return await StudentModel.getByParentUserId(parentUserId);
}

const parentController = {
  getDashboard: async (req, res) => {
    try {
      const parentId = req.session.user.id;
      const children = await getChildrenForParent(parentId);

      let totalPendingFees = 0;
      let totalRecentResults = 0;

      for (const child of children) {
        const fees = await FeeModel.getByStudent(child.student_id);
        const payments = await FeePaymentModel.getByStudent(child.student_id);
        const required = fees.reduce((sum, f) => sum + Number(f.amount || 0), 0);
        const paid = payments
          .filter((p) => p.payment_status === 'completed')
          .reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
        totalPendingFees += Math.max(required - paid, 0);

        const results = await ExamResultModel.getByStudent(child.student_id);
        totalRecentResults += results.length;
      }

      res.render('parent/dashboard', {
        title: 'Parent Dashboard',
        children,
        stats: {
          total_children: children.length,
          pending_fees: totalPendingFees,
          total_results: totalRecentResults
        }
      });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getMyChildren: async (req, res) => {
    try {
      const children = await getChildrenForParent(req.session.user.id);
      res.render('parent/my-children', { title: 'My Children', children });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getAttendance: async (req, res) => {
    try {
      const parentId = req.session.user.id;
      const children = await getChildrenForParent(parentId);
      const selectedStudent = parseInt(req.query.student_id, 10) || (children[0]?.student_id || null);
      const month = String(req.query.month || (new Date().getMonth() + 1));
      const year = String(req.query.year || new Date().getFullYear());

      let attendance = [];
      let stats = [];

      if (selectedStudent) {
        attendance = await AttendanceModel.getByStudent(selectedStudent, month, year);
        stats = await AttendanceModel.getMonthlyStats(selectedStudent, month, year);
      }

      res.render('parent/attendance', {
        title: 'Children Attendance',
        children,
        selectedStudent,
        month,
        year,
        attendance,
        stats
      });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getResults: async (req, res) => {
    try {
      const children = await getChildrenForParent(req.session.user.id);
      const selectedStudent = parseInt(req.query.student_id, 10) || (children[0]?.student_id || null);
      const results = selectedStudent ? await ExamResultModel.getByStudent(selectedStudent) : [];

      res.render('parent/results', {
        title: 'Children Results',
        children,
        selectedStudent,
        results
      });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getFees: async (req, res) => {
    try {
      const children = await getChildrenForParent(req.session.user.id);
      const selectedStudent = parseInt(req.query.student_id, 10) || (children[0]?.student_id || null);

      let fees = [];
      let payments = [];
      let balance = 0;

      if (selectedStudent) {
        fees = await FeeModel.getByStudent(selectedStudent);
        payments = await FeePaymentModel.getByStudent(selectedStudent);
        const required = fees.reduce((sum, f) => sum + Number(f.amount || 0), 0);
        const paid = payments
          .filter((p) => p.payment_status === 'completed')
          .reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
        balance = Math.max(required - paid, 0);
      }

      res.render('parent/fees', {
        title: 'Children Fees',
        children,
        selectedStudent,
        fees,
        payments,
        balance
      });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  }
};

module.exports = parentController;
