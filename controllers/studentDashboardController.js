const StudentModel = require('../models/studentModel');
const AttendanceModel = require('../models/AttendanceModel');
const ClassModel = require('../models/ClassModel');
const TimetableModel = require('../models/TimetableModel');
const FeeModel = require('../models/feeModel');
const FeePaymentModel = require('../models/feePaymentModel');

const studentDashboardController = {
  
  // ==================== DASHBOARD ====================
  getDashboard: async (req, res) => {
    try {
      const user = req.session.user;
      let student = null;
      let stats = { attendance_percentage: 0, total_subjects: 0, pending_fees: 0 };
      
      if (user.user_type === 'student') {
        student = await StudentModel.findByUserId(user.user_id);
        if (student) {
          req.session.user.student_id = student.student_id;
          // Get attendance stats for current month
          const now = new Date();
          const attendanceStats = await AttendanceModel.getMonthlyStats(
            student.student_id, 
            String(now.getMonth() + 1).padStart(2, '0'), 
            now.getFullYear()
          );
          const present = attendanceStats.find(s => s.status === 'present')?.count || 0;
          const total = attendanceStats.reduce((sum, s) => sum + s.count, 0);
          stats.attendance_percentage = total > 0 ? Math.round((present / total) * 100) : 0;
        }
      }

      res.render('students/dashboard', {
        title: 'Student Dashboard',
        user: req.session.user,
        student: student,
        stats: stats
      });
    } catch (error) {
      console.error('Student dashboard error:', error);
      res.status(500).render('error', { message: 'Error loading dashboard', error: error.message });
    }
  },

  // ==================== MY ATTENDANCE ====================
  getMyAttendance: async (req, res) => {
    try {
      let studentId = req.session.user?.student_id;
      
      if (!studentId) {
        const student = await StudentModel.findByUserId(req.session.user.user_id);
        if (student) {
          studentId = student.student_id;
          req.session.user.student_id = studentId;
        } else {
          return res.render('students/my-attendance', {
            title: 'My Attendance',
            attendance: [],
            error: 'Student profile not found'
          });
        }
      }

      const { month, year } = req.query;
      const now = new Date();
      const queryMonth = month || String(now.getMonth() + 1).padStart(2, '0');
      const queryYear = year || now.getFullYear();

      const attendance = await AttendanceModel.getByStudent(studentId, queryMonth, queryYear);
      const stats = await AttendanceModel.getMonthlyStats(studentId, queryMonth, queryYear);

      res.render('students/my-attendance', {
        title: 'My Attendance',
        attendance: attendance || [],
        stats: stats || [],
        month: queryMonth,
        year: queryYear,
        user: req.session.user
      });
    } catch (error) {
      console.error('My attendance error:', error);
      res.status(500).render('error', { message: 'Error loading attendance', error: error.message });
    }
  },

  // ==================== MY RESULTS ====================
  getMyResults: async (req, res) => {
    try {
      let studentId = req.session.user?.student_id;

      if (!studentId) {
        const student = await StudentModel.findByUserId(req.session.user.user_id);
        if (student) {
          studentId = student.student_id;
          req.session.user.student_id = studentId;
        } else {
          return res.render('students/my-results', {
            title: 'My Results',
            results: [],
            error: 'Student profile not found'
          });
        }
      }

      const results = await StudentModel.getResults(studentId);

      res.render('students/my-results', {
        title: 'My Results',
        results: results || [],
        user: req.session.user
      });
    } catch (error) {
      console.error('My results error:', error);
      res.status(500).render('error', { message: 'Error loading results', error: error.message });
    }
  },

  // ==================== MY TIMETABLE ====================
  getMyTimetable: async (req, res) => {
    try {
      const student = await StudentModel.findByUserId(req.session.user.user_id);
      
      if (!student || !student.current_class_id) {
        return res.render('students/my-timetable', {
          title: 'My Timetable',
          timetable: {},
          className: null,
          error: 'Not assigned to any class'
        });
      }

      const timetable = await TimetableModel.getByClass(student.current_class_id);

      const groupedTimetable = {
        Monday: [],
        Tuesday: [],
        Wednesday: [],
        Thursday: [],
        Friday: [],
        Saturday: []
      };

      if (timetable && Array.isArray(timetable)) {
        timetable.forEach(item => {
          if (groupedTimetable[item.day_of_week]) {
            groupedTimetable[item.day_of_week].push(item);
          }
        });
      }

      res.render('students/my-timetable', {
        title: 'My Timetable',
        timetable: groupedTimetable,
        className: student.class_name,
        user: req.session.user
      });
    } catch (error) {
      console.error('Student timetable error:', error);
      res.status(500).render('error', { message: 'Error loading timetable', error: error.message });
    }
  },

  // ==================== MY FEES ====================
  getMyFees: async (req, res) => {
    try {
      let studentId = req.session.user?.student_id;

      if (!studentId) {
        const studentProfile = await StudentModel.findByUserId(req.session.user.user_id);
        if (studentProfile) {
          studentId = studentProfile.student_id;
          req.session.user.student_id = studentId;
        } else {
          return res.render('students/my-fees', {
            title: 'My Fees',
            student: null,
            fees: [],
            payments: [],
            balance: { total: 0, paid: 0, balance: 0 },
            error: 'Student profile not found',
            user: req.session.user
          });
        }
      }

      const student = await StudentModel.findById(studentId);
      const fees = await FeeModel.getByStudent(studentId);
      const payments = await FeePaymentModel.getByStudent(studentId);
      const balance = await StudentModel.getFeeBalance(studentId);

      res.render('students/my-fees', {
        title: 'My Fees',
        student: student || null,
        fees: fees || [],
        payments: payments || [],
        balance: balance || { total: 0, paid: 0, balance: 0 },
        user: req.session.user
      });
    } catch (error) {
      console.error('My fees error:', error);
      res.status(500).render('error', { message: 'Error loading fees', error: error.message });
    }
  },

  // ==================== MY PROFILE ====================
  getMyProfile: async (req, res) => {
    try {
      const student = await StudentModel.findByUserId(req.session.user.user_id);
      
      res.render('students/my-profile', {
        title: 'My Profile',
        student: student,
        user: req.session.user
      });
    } catch (error) {
      console.error('My profile error:', error);
      res.status(500).render('error', { message: 'Error loading profile', error: error.message });
    }
  }
};

module.exports = studentDashboardController;
