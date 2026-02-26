const TeacherModel = require('../models/teacherModel');
const ClassModel = require('../models/classModel');
const StudentModel = require('../models/studentModel');
const AttendanceModel = require('../models/attendanceModel');
const TimetableModel = require('../models/timetableModel');

const teacherDashboardController = {
  
  // ==================== DASHBOARD ====================
  getDashboard: async (req, res) => {
    try {
      const user = req.session.user;
      let teacher = null;
      let stats = { total_classes: 0, total_students: 0, total_subjects: 0 };
      
      if (user.user_type === 'teacher') {
        teacher = await TeacherModel.findByUserId(user.user_id);
        if (teacher) {
          req.session.user.teacher_id = teacher.teacher_id;
          stats = await TeacherModel.getStats(teacher.teacher_id);
        }
      }

      res.render('teachers/dashboard', {
        title: 'Teacher Dashboard',
        user: req.session.user,
        teacher: teacher,
        stats: stats
      });
    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).render('error', { message: 'Error loading dashboard', error: error.message });
    }
  },

  // ==================== MY CLASSES ====================
  getMyClasses: async (req, res) => {
    try {
      let teacherId = req.session.user?.teacher_id;
      
      // If no teacher_id in session, try to get it
      if (!teacherId) {
        const teacher = await TeacherModel.findByUserId(req.session.user.user_id);
        if (teacher) {
          teacherId = teacher.teacher_id;
          req.session.user.teacher_id = teacherId;
        } else {
          return res.render('teachers/my-classes', {
            title: 'My Classes',
            classes: [],
            error: 'No teacher profile found. Please contact administrator.'
          });
        }
      }

      const classes = await TeacherModel.getClasses(teacherId);
      
      res.render('teachers/my-classes', {
        title: 'My Classes',
        classes: classes || [],
        user: req.session.user,
        error: null
      });
    } catch (error) {
      console.error('My classes error:', error);
      res.status(500).render('error', { message: 'Error loading classes', error: error.message });
    }
  },

  // ==================== CLASS STUDENTS ====================
  getClassStudents: async (req, res) => {
    try {
      const { classId } = req.params;
      
      const classDetails = await ClassModel.findById(classId);
      const students = await StudentModel.getByClassId(classId);

      res.render('teacher/class-students', {
        title: `Students - ${classDetails?.class_name || 'Class'}`,
        classId: classId,
        classDetails: classDetails,
        students: students || [],
        user: req.session.user
      });
    } catch (error) {
      console.error('Class students error:', error);
      res.status(500).render('error', { message: 'Error loading students', error: error.message });
    }
  },

  // ==================== ATTENDANCE ====================
  getMarkAttendance: async (req, res) => {
    try {
      const params = new URLSearchParams(req.query);
      if (!params.get('mode')) params.set('mode', 'day');
      if (params.get('mode') === 'day' && !params.get('date')) {
        params.set('date', new Date().toISOString().slice(0, 10));
      }
      if (params.get('mode') === 'month' && !params.get('month')) {
        params.set('month', new Date().toISOString().slice(0, 7));
      }
      res.redirect(`/attendance/mark?${params.toString()}`);
    } catch (error) {
      console.error('Mark attendance error:', error);
      res.status(500).render('error', { message: 'Error loading attendance page', error: error.message });
    }
  },

  postMarkAttendance: async (req, res) => {
    try {
      // ? FIX: Use teacher_id and user_id
      const teacherId = req.session.user?.teacher_id;
      const teacherUserId = req.session.user?.user_id;
      const { class_id, date, attendance } = req.body;

      const subjects = await TeacherModel.getSubjects(teacherId);
      const hasAccess = subjects.some(s => s.class_id == class_id);
      
      if (!hasAccess) {
        return res.status(403).json({ success: false, error: 'You do not teach this class' });
      }

      if (!class_id || !date) {
        return res.status(400).json({ success: false, error: 'Missing required data' });
      }

      if (!attendance || Object.keys(attendance).length === 0) {
        return res.status(400).json({ success: false, error: 'No attendance entries submitted' });
      }

      const records = Object.entries(attendance).map(([student_id, data]) => ({
        student_id: parseInt(student_id),
        class_id: parseInt(class_id),
        date: date,
        status: data.status,
        remarks: data.remarks || '',
        marked_by: teacherUserId
      }));

      await AttendanceModel.bulkCreate(records);
      
      res.json({ 
        success: true, 
        message: `Attendance saved for ${records.length} students`,
        count: records.length
      });
    } catch (error) {
      console.error('Save attendance error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getAttendanceReport: async (req, res) => {
    try {
      const teacherId = req.session.user?.teacher_id;
      const { class_id, month, year } = req.query;
      
      const subjects = await TeacherModel.getSubjects(teacherId);
      const uniqueClasses = [...new Map(subjects.map(s => [s.class_id, s])).values()];

      let report = null;
      let selectedClass = null;

      if (class_id && month && year) {
        const hasAccess = subjects.some(s => s.class_id == class_id);
        if (!hasAccess) {
          return res.status(403).render('error', { message: 'You do not teach this class' });
        }

        selectedClass = await ClassModel.findById(class_id);
        const students = await StudentModel.getByClassId(class_id);
        
        report = await Promise.all(students.map(async (student) => {
          const stats = await AttendanceModel.getMonthlyStats(student.student_id, month, year);
          const present = stats.find(s => s.status === 'present')?.count || 0;
          const absent = stats.find(s => s.status === 'absent')?.count || 0;
          const late = stats.find(s => s.status === 'late')?.count || 0;
          const total = present + absent + late;
          const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
          
          return { ...student, present, absent, late, total, percentage };
        }));
      }

      // ? FIX: Use 'teacher/' not 'teachers/'
      res.render('teacher/attendance-report', {
        title: 'Attendance Report',
        classes: uniqueClasses,
        report,
        selectedClass,
        filters: { class_id, month, year }
      });
    } catch (error) {
      console.error('Attendance report error:', error);
      res.status(500).render('error', { message: 'Error loading attendance report', error: error.message });
    }
  },

  // ==================== RESULTS ====================
  getEnterResults: async (req, res) => {
    try {
      const { examId } = req.params;
      
      const exam = await getQuery(
        `SELECT e.*, s.subject_name, c.class_name, c.class_id
         FROM exams e
         JOIN subjects s ON e.subject_id = s.subject_id
         JOIN classes c ON e.class_id = c.class_id
         WHERE e.exam_id = ?`,
        [examId]
      );

      if (!exam) {
        return res.status(404).render('error', { message: 'Exam not found' });
      }

      const students = await StudentModel.getByClassId(exam.class_id);
      const existingResults = await allQuery('SELECT * FROM exam_results WHERE exam_id = ?', [examId]);

      res.render('teacher/enter-results', {
        title: `Enter Results - ${exam?.exam_name || 'Exam'}`,
        exam: exam,
        students: students || [],
        existingResults: existingResults || [],
        user: req.session.user
      });
    } catch (error) {
      console.error('Enter results error:', error);
      res.status(500).render('error', { message: 'Error loading results page', error: error.message });
    }
  },

  postEnterResults: async (req, res) => {
    try {
      const { examId } = req.params;
      const { results } = req.body;
      const teacherId = req.session.user?.teacher_id || req.session.user?.user_id;

      if (Array.isArray(results)) {
        for (const result of results) {
          await runQuery(
            `INSERT OR REPLACE INTO exam_results 
             (exam_id, student_id, marks_obtained, grade, remarks, checked_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [examId, result.student_id, result.marks, result.grade, result.remarks, teacherId]
          );
        }
      }

      res.redirect('/teacher/dashboard?success=Results saved successfully');
    } catch (error) {
      console.error('Post results error:', error);
      res.status(500).json({ error: 'Failed to save results' });
    }
  },

  // ==================== TIMETABLE ====================
  getMyTimetable: async (req, res) => {
    try {
      let teacherId = req.session.user?.teacher_id;

      if (!teacherId) {
        const teacher = await TeacherModel.findByUserId(req.session.user.user_id);
        if (teacher) {
          teacherId = teacher.teacher_id;
          req.session.user.teacher_id = teacherId;
        } else {
          return res.render('teachers/my-timetable', {
            title: 'My Timetable',
            timetable: {},
            error: 'No teacher profile found'
          });
        }
      }

      const timetable = await TimetableModel.getByTeacher(teacherId);

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

      res.render('teachers/my-timetable', {
        title: 'My Timetable',
        timetable: groupedTimetable,
        rawTimetable: timetable || [],
        user: req.session.user,
        error: null
      });
    } catch (error) {
      console.error('Timetable error:', error);
      res.status(500).render('error', { message: 'Error loading timetable', error: error.message });
    }
  }
};

// Helper functions
async function getQuery(sql, params) {
  const { getQuery: dbGetQuery } = require('../config/database');
  return await dbGetQuery(sql, params);
}

async function allQuery(sql, params) {
  const { allQuery: dbAllQuery } = require('../config/database');
  return await dbAllQuery(sql, params);
}

async function runQuery(sql, params) {
  const { runQuery: dbRunQuery } = require('../config/database');
  return await dbRunQuery(sql, params);
}

module.exports = teacherDashboardController;
