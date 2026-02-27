const { allQuery, getQuery, runQuery } = require('../config/database');
const AttendanceModel = require('../models/attendanceModel');
const NotificationModel = require('../models/notificationModel');
const GuidanceRecordModel = require('../models/guidanceRecordModel');
const TeacherModel = require('../models/teacherModel');

function classifyRisk(attendanceRate, consecutiveAbsences, threshold = 75) {
  if (attendanceRate > 0 && (attendanceRate < threshold - 10 || consecutiveAbsences >= 5)) return 'danger';
  if ((attendanceRate > 0 && attendanceRate < threshold) || consecutiveAbsences >= 3) return 'warning';
  if ((attendanceRate > 0 && attendanceRate < threshold + 5) || consecutiveAbsences >= 2) return 'notice';
  return null;
}

async function alreadyLoggedToday(studentId, level, reason) {
  const today = new Date().toISOString().slice(0, 10);
  const row = await getQuery(
    `SELECT alert_log_id FROM attendance_alert_notifications
     WHERE alert_date = ? AND student_id = ? AND level = ? AND reason = ?`,
    [today, studentId, level, reason]
  );
  return Boolean(row);
}

async function logToday(studentId, level, reason) {
  const today = new Date().toISOString().slice(0, 10);
  await runQuery(
    `INSERT OR IGNORE INTO attendance_alert_notifications (alert_date, student_id, level, reason)
     VALUES (?, ?, ?, ?)`,
    [today, studentId, level, reason]
  );
}

async function createGuidanceFollowup(studentId, classTeacherUserId, level, reason) {
  const existing = await getQuery(
    `SELECT guidance_id FROM guidance_records
     WHERE student_id = ? AND category = 'attendance' AND guidance_date = ? AND notes = ?`,
    [studentId, new Date().toISOString().slice(0, 10), `[AUTO:${level}] ${reason}`]
  );
  if (existing) return;

  let teacherId = null;
  if (classTeacherUserId) {
    const teacher = await TeacherModel.findByUserId(classTeacherUserId);
    teacherId = teacher ? teacher.teacher_id : null;
  }

  await GuidanceRecordModel.create({
    student_id: studentId,
    teacher_id: teacherId,
    guidance_date: new Date().toISOString().slice(0, 10),
    category: 'attendance',
    notes: `[AUTO:${level}] ${reason}`,
    follow_up: 'Please contact the student/guardian and record intervention.',
    created_by: classTeacherUserId || 1
  });
}

async function evaluateAttendanceRisks({ classId = null, threshold = 75, notify = true, createGuidance = true } = {}) {
  let sql = `
    SELECT s.student_id, s.parent_id, s.user_id AS student_user_id,
           u.first_name, u.last_name, c.class_id, c.class_name, c.section, c.class_teacher_id
    FROM students s
    JOIN users u ON s.user_id = u.user_id
    LEFT JOIN classes c ON s.current_class_id = c.class_id
    WHERE u.is_active = 1
  `;
  const params = [];
  if (classId) {
    sql += ' AND s.current_class_id = ?';
    params.push(classId);
  }

  const students = await allQuery(sql, params);
  const alerts = [];

  for (const student of students) {
    const overallRows = await AttendanceModel.getOverallStats(student.student_id);
    const summary = AttendanceModel.summarizeStatsRows(overallRows);
    const consecutiveAbsences = await AttendanceModel.getCurrentConsecutiveAbsences(student.student_id);
    const level = classifyRisk(summary.attendance_rate, consecutiveAbsences, threshold);
    if (!level) continue;

    const reason = `Attendance ${summary.attendance_rate}% | Consecutive absences ${consecutiveAbsences}`;
    alerts.push({
      student_id: student.student_id,
      student_name: `${student.first_name} ${student.last_name}`,
      class_name: `${student.class_name || ''} ${student.section || ''}`.trim(),
      level,
      attendance_rate: summary.attendance_rate,
      consecutive_absences: consecutiveAbsences,
      reason
    });

    if (notify || createGuidance) {
      const logged = await alreadyLoggedToday(student.student_id, level, reason);
      if (logged) continue;
      await logToday(student.student_id, level, reason);

      if (notify) {
        const recipients = [student.student_user_id, student.parent_id, student.class_teacher_id].filter(Boolean);
        await NotificationModel.createForUserIds({
          title: `Attendance ${level.toUpperCase()} Alert`,
          message: `${student.first_name} ${student.last_name}: ${reason}`,
          notification_type: 'academic',
          sent_by: null,
          userIds: recipients
        });
      }

      if (createGuidance) {
        await createGuidanceFollowup(student.student_id, student.class_teacher_id, level, reason);
      }
    }
  }

  return alerts;
}

module.exports = { 
  evaluateAttendanceRisks,
  classifyRisk,
  alreadyLoggedToday,
  logToday,
  createGuidanceFollowup
};

