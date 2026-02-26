const AttendanceModel = require('../models/attendanceModel');
const AttendancePeriodModel = require('../models/attendancePeriodModel');
const AttendanceCorrectionModel = require('../models/attendanceCorrectionModel');
const ClassModel = require('../models/classModel');
const StudentModel = require('../models/studentModel');
const SubjectModel = require('../models/subjectModel');
const TeacherModel = require('../models/teacherModel');
const NotificationModel = require('../models/notificationModel');
const { evaluateAttendanceRisks } = require('../utils/attendanceRiskService');
const { getJapanSchoolStatus, getJapaneseHolidays } = require('../utils/japanSchoolCalendar');
const { logAudit } = require('../utils/auditLogger');
const { allQuery } = require('../config/database');

const VALID_STATUSES = new Set(['present', 'absent', 'late', 'excused']);

function buildMonthDates(monthValue) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(monthValue || ''));
  if (!match) return [];
  const year = Number(match[1]);
  const month = Number(match[2]);
  const lastDay = new Date(year, month, 0).getDate();
  const dates = [];
  const holidays = getJapaneseHolidays(year);

  for (let day = 1; day <= lastDay; day += 1) {
    const date = new Date(year, month - 1, day);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue; // Skip weekends
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (holidays.has(iso)) continue; // Skip Japanese holidays
    dates.push(iso);
  }
  return dates;
}

function normalizeMonth(month, year) {
  if (month && year) return `${year}-${String(month).padStart(2, '0')}`;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function parseMonthParts(monthValue) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(monthValue || ''));
  if (!match) {
    const now = new Date();
    return { year: String(now.getFullYear()), month: String(now.getMonth() + 1).padStart(2, '0') };
  }
  return { year: match[1], month: match[2] };
}

function normalizePeriodLabel(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '';
  if (/^P\d+$/.test(raw)) return raw;
  if (/^\d+$/.test(raw)) return `P${raw}`;
  return raw.replace(/\s+/g, '_');
}

function deriveDailyStatusFromPeriods(periodStatuses = {}) {
  const values = Object.values(periodStatuses).map((v) => String(v || '').toLowerCase());
  if (values.includes('absent')) return 'absent';
  if (values.includes('late')) return 'late';
  if (values.includes('excused')) return 'excused';
  if (values.includes('present')) return 'present';
  return '';
}

function toIsoDateOnly(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function canModifyAttendanceDate(dateStr, role) {
  if (['admin', 'staff'].includes(String(role || '').toLowerCase())) return true;
  const target = toIsoDateOnly(dateStr);
  if (!target) return false;
  const today = new Date();
  const todayIso = toIsoDateOnly(today);
  const windowDays = Number(process.env.ATTENDANCE_EDIT_WINDOW_DAYS || 1);
  const minDate = new Date(todayIso);
  minDate.setDate(minDate.getDate() - windowDays);
  const minIso = toIsoDateOnly(minDate);
  return target >= minIso;
}

async function enforceTeacherClassAccess(req, classIdNum) {
  const role = req.session.user.userType || req.session.user.user_type;
  if (role !== 'teacher') return true;
  let teacherId = req.session.user.teacher_id;
  if (!teacherId) {
    const teacher = await TeacherModel.findByUserId(req.session.user.user_id || req.session.user.id);
    teacherId = teacher?.teacher_id;
    if (teacherId) req.session.user.teacher_id = teacherId;
  }
  if (!teacherId) return false;
  const classes = await TeacherModel.getClasses(teacherId);
  return classes.some((c) => Number(c.class_id) === Number(classIdNum));
}

async function createAttendanceAlerts({ records, markerUserId }) {
  if (!Array.isArray(records) || !records.length) return;
  const alertRecords = records.filter((r) => ['absent', 'late'].includes(String(r.status || '').toLowerCase()));
  if (!alertRecords.length) return;

  const contacts = await StudentModel.getContactUsersByStudentIds(alertRecords.map((r) => r.student_id));
  const contactMap = new Map(contacts.map((c) => [Number(c.student_id), c]));

  for (const record of alertRecords) {
    const contact = contactMap.get(Number(record.student_id));
    if (!contact) continue;
    const userIds = [contact.student_user_id, contact.parent_id].filter(Boolean);
    if (!userIds.length) continue;
    const status = String(record.status).toLowerCase();
    const studentName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
    await NotificationModel.createForUserIds({
      title: `Attendance Alert: ${studentName || 'Student'}`,
      message: `${studentName || 'Student'} was marked ${status} on ${record.date}.`,
      notification_type: 'academic',
      sent_by: markerUserId || null,
      userIds
    });
  }
}

async function getAttendanceIntegrityIssues() {
  const invalidAttendanceStatus = await allQuery(
    `SELECT attendance_id, student_id, class_id, date, status
     FROM attendance
     WHERE lower(status) NOT IN ('present', 'absent', 'late', 'excused')`
  );
  const periodWithoutDaily = await allQuery(
    `SELECT apr.period_attendance_id, apr.student_id, apr.class_id, apr.date, apr.period_label, apr.status
     FROM attendance_period_records apr
     LEFT JOIN attendance a
       ON a.student_id = apr.student_id AND a.class_id = apr.class_id AND a.date = apr.date
     WHERE a.attendance_id IS NULL`
  );
  return {
    invalidAttendanceStatus,
    periodWithoutDaily,
    totalIssues: invalidAttendanceStatus.length + periodWithoutDaily.length
  };
}

const attendanceController = {
  getAttendanceDashboard: async (req, res) => {
    try {
      const classes = await ClassModel.getAll();
      const classId = req.query.class_id;
      const threshold = Number(req.query.threshold || 75);
      const alerts = classId
        ? await evaluateAttendanceRisks({
          classId: parseInt(classId, 10),
          threshold,
          notify: true,
          createGuidance: true
        })
        : [];
      const analytics = { notice: 0, warning: 0, danger: 0, total: alerts.length };
      alerts.forEach((a) => {
        if (a.level === 'notice') analytics.notice += 1;
        else if (a.level === 'warning') analytics.warning += 1;
        else if (a.level === 'danger') analytics.danger += 1;
      });
      const integrity = req.query.integrity === '1' ? await getAttendanceIntegrityIssues() : null;

      res.render('attendance/index', {
        title: 'Attendance',
        classes,
        alerts,
        analytics,
        integrity,
        filters: { class_id: classId, threshold, consecutive: Number(req.query.consecutive || 3) },
        query: req.query
      });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getMarkAttendance: async (req, res) => {
    try {
      const { class_id, date } = req.query;
      const mode = req.query.mode === 'month' ? 'month' : 'day';
      const month = req.query.month || normalizeMonth();
      const { year: monthYear, month: monthNumber } = parseMonthParts(month);
      const classes = await ClassModel.getAll();
      const monthDates = mode === 'month' ? buildMonthDates(month) : [];
      const schoolStatus = getJapanSchoolStatus();
      const role = req.session.user.userType || req.session.user.user_type;
      const selectedDateIso = mode === 'day' ? (toIsoDateOnly(date) || toIsoDateOnly(new Date())) : '';
      const dayQueryDate = selectedDateIso;
      const dateEditable = mode === 'month' ? true : canModifyAttendanceDate(selectedDateIso, role);

      let students = [];
      let existingAttendance = [];
      let periodLabels = ['P1', 'P2', 'P3', 'P4'];
      let periodAttendanceByStudent = {};

      if (class_id && ((mode === 'day' && dayQueryDate) || (mode === 'month' && month))) {
        if (!(await enforceTeacherClassAccess(req, parseInt(class_id, 10)))) {
          return res.redirect(`/attendance/mark?mode=${mode}&error=You can only access your assigned classes`);
        }
        students = await StudentModel.getAll({ class_id });
        if (mode === 'day') {
          existingAttendance = await AttendanceModel.getByClass(class_id, dayQueryDate);
          periodLabels = await AttendancePeriodModel.getActivePeriodsForClass(class_id);
          const periodRows = await AttendancePeriodModel.getByClassDate(class_id, dayQueryDate);
          periodAttendanceByStudent = {};
          periodRows.forEach((row) => {
            const sid = String(row.student_id);
            const label = String(row.period_label || '').toUpperCase();
            const normalizedLabel = normalizePeriodLabel(label);
            if (!periodAttendanceByStudent[sid]) periodAttendanceByStudent[sid] = {};
            const status = String(row.status || '').toLowerCase();
            periodAttendanceByStudent[sid][label] = status;
            periodAttendanceByStudent[sid][normalizedLabel] = status;
          });
        } else {
          existingAttendance = await AttendanceModel.getByClassMonth(class_id, monthNumber, monthYear);
        }
      }

      const existingByStudent = {};
      existingAttendance.forEach((row) => {
        const sid = String(row.student_id);
        if (!existingByStudent[sid]) existingByStudent[sid] = {};
        existingByStudent[sid][row.date] = String(row.status || '').toLowerCase();
      });

      const monthlySummaries = {};
      if (mode === 'month') {
        students.forEach((student) => {
          const sid = String(student.student_id);
          const summary = { present: 0, absent: 0, late: 0, excused: 0, marked: 0, rate: 0, effectiveAbsent: 0 };
          const row = existingByStudent[sid] || {};

          monthDates.forEach((d) => {
            const status = String(row[d] || '').toLowerCase();
            if (!VALID_STATUSES.has(status)) return;
            summary.marked += 1;
            if (status === 'present') summary.present += 1;
            else if (status === 'absent') summary.absent += 1;
            else if (status === 'late') summary.late += 1;
            else if (status === 'excused') summary.excused += 1;
          });

          // Calculate attendance rate: 3 late days = 1 absent day
          // Formula: effectiveAbsent = absent + floor(late / 3)
          // effectivePresent = present + excused + (late % 3)
          // rate = effectivePresent / totalMarked * 100
          const lateToAbsent = Math.floor(summary.late / 3);
          const remainingLate = summary.late % 3;
          summary.effectiveAbsent = summary.absent + lateToAbsent;
          const effectivePresent = summary.present + summary.excused + remainingLate;
          
          if (summary.marked > 0) {
            summary.rate = Math.round((effectivePresent / summary.marked) * 100);
          } else {
            summary.rate = 0;
          }
          
          monthlySummaries[sid] = summary;
        });
      }

      res.render('attendance/mark', {
        title: 'Mark Attendance',
        classes,
        students,
        existingAttendance,
        existingByStudent,
        monthlySummaries,
        monthDates,
        periodLabels,
        periodAttendanceByStudent,
        schoolStatus,
        dateEditable,
        selectedDateIso,
        selectedClass: class_id,
        selectedDate: dayQueryDate,
        selectedMonth: month,
        mode,
        query: req.query
      });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  postMarkAttendance: async (req, res) => {
    try {
      const { class_id, date, attendance } = req.body;
      const mode = req.body.mode === 'month' ? 'month' : 'day';
      const month = req.body.month || normalizeMonth();
      const classIdNum = parseInt(class_id, 10);
      if (!classIdNum) {
        return res.redirect(`/attendance/mark?mode=${mode}&error=Invalid class selected`);
      }
      const role = req.session.user.userType || req.session.user.user_type;
      const effectiveDate = mode === 'day' ? (toIsoDateOnly(date) || toIsoDateOnly(new Date())) : '';
      if (!(await enforceTeacherClassAccess(req, classIdNum))) {
        return res.redirect(`/attendance/mark?mode=${mode}&class_id=${classIdNum}&error=You can only mark attendance for your assigned classes`);
      }
      if (mode === 'day') {
        if (!effectiveDate) {
          return res.redirect(`/attendance/mark?mode=day&class_id=${classIdNum}&error=Invalid date`);
        }
        if (!canModifyAttendanceDate(effectiveDate, role)) {
          return res.redirect(`/attendance/mark?mode=day&class_id=${classIdNum}&date=${effectiveDate}&error=Attendance for this date is locked. Submit a correction request.`);
        }
      }
      const marker = req.session.user.id || req.session.user.user_id;
      let records = [];
      let dayPeriodRecords = [];
      const attendanceEntries = attendance && typeof attendance === 'object' ? Object.keys(attendance) : [];
      if (attendanceEntries.length === 0) {
        return res.redirect(`/attendance/mark?mode=${mode}&class_id=${classIdNum}&${mode === 'month' ? `month=${month}` : `date=${effectiveDate}`}&error=No attendance entries submitted`);
      }

      if (mode === 'month') {
        const dates = buildMonthDates(month);
        records = Object.entries(attendance || {}).flatMap(([student_id, data]) => {
          if (!data) return [];
          const remarks = data.remarks || '';
          const dateStatusMap = data.dates && typeof data.dates === 'object' ? data.dates : null;

          if (dateStatusMap) {
            return Object.entries(dateStatusMap).map(([d, status]) => ({
              student_id: parseInt(student_id, 10),
              class_id: classIdNum,
              date: d,
              status: String(status || '').toLowerCase(),
              remarks,
              marked_by: marker
            }));
          }

          if (!data.status) return [];
          return dates.map((d) => ({
            student_id: parseInt(student_id, 10),
            class_id: classIdNum,
            date: d,
            status: String(data.status).toLowerCase(),
            remarks,
            marked_by: marker
          }));
        });
      } else {
        const periodLabels = await AttendancePeriodModel.getActivePeriodsForClass(classIdNum);
        const selectedPeriodRaw = String(req.body.submit_period || periodLabels[0] || 'P1');
        const selectedPeriod = normalizePeriodLabel(selectedPeriodRaw) || normalizePeriodLabel(periodLabels[0] || 'P1');
        const periodRecords = [];

        records = Object.entries(attendance || {}).map(([student_id, data]) => {
          const sid = parseInt(student_id, 10);
          const remarks = data?.remarks || '';
          const periodMap = data?.periods && typeof data.periods === 'object' ? data.periods : null;
          const normalizedPeriodMap = {};

          if (periodMap) {
            Object.entries(periodMap).forEach(([periodLabel, rawStatus]) => {
              const period = normalizePeriodLabel(periodLabel);
              const status = String(rawStatus || '').toLowerCase();
              if (!sid || !period || !status) return;
              if (!VALID_STATUSES.has(status)) return;
              normalizedPeriodMap[period] = status;
              periodRecords.push({
                student_id: sid,
                class_id: classIdNum,
                subject_id: null,
                date: effectiveDate,
                period_label: period,
                status,
                remarks,
                marked_by: marker
              });
            });
          }

          const selectedStatusFromPeriod = periodMap
            ? String(
              normalizedPeriodMap[selectedPeriod]
              || deriveDailyStatusFromPeriods(normalizedPeriodMap)
              || ''
            ).toLowerCase()
            : '';

          const selectedStatus = selectedStatusFromPeriod || String(data?.status || '').toLowerCase();

          return {
            student_id: sid,
            class_id: classIdNum,
            date: effectiveDate,
            status: selectedStatus,
            remarks,
            marked_by: marker
          };
        });

        dayPeriodRecords = periodRecords;
      }

      records = records.filter((r) => r.student_id && r.class_id && r.date && r.status);
      const invalid = records.find((r) => !VALID_STATUSES.has(String(r.status).toLowerCase()));
      if (invalid) {
        return res.redirect(`/attendance/mark?mode=${mode}&class_id=${class_id}&${mode === 'month' ? `month=${month}` : `date=${date}`}&error=Invalid attendance status`);
      }
      if (records.length === 0) {
        return res.redirect(`/attendance/mark?mode=${mode}&class_id=${classIdNum}&${mode === 'month' ? `month=${month}` : `date=${effectiveDate}`}&error=No attendance entries submitted`);
      }
      
      let existingByStudent = new Map();
      if (mode === 'day') {
        const existing = await AttendanceModel.getByClass(classIdNum, effectiveDate);
        existingByStudent = new Map(existing.map((row) => [Number(row.student_id), String(row.status || '').toLowerCase()]));
      }
      if (mode === 'day' && dayPeriodRecords.length > 0) {
        await AttendancePeriodModel.bulkCreate(dayPeriodRecords);
      }
      await AttendanceModel.bulkCreate(records);
      if (mode === 'day') {
        for (const row of records) {
          const sid = Number(row.student_id);
          const prev = existingByStudent.get(sid) || null;
          const next = String(row.status || '').toLowerCase();
          if (prev !== next) {
            await logAudit(req, 'attendance_status_changed', 'attendance', `${row.class_id}:${row.date}:${sid}`, {
              class_id: row.class_id,
              date: row.date,
              student_id: sid,
              previous_status: prev,
              new_status: next
            });
          }
        }
        await createAttendanceAlerts({ records, markerUserId: marker });
      }
      if (mode === 'month') {
        return res.redirect(`/attendance/mark?mode=month&class_id=${class_id}&month=${month}&success=Monthly attendance saved`);
      }
      res.redirect(`/attendance/mark?mode=day&class_id=${class_id}&date=${effectiveDate}&success=Attendance saved`);
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getPeriodAttendance: async (req, res) => {
    try {
      const { class_id } = req.query;
      const date = toIsoDateOnly(req.query.date) || '';
      const period = req.query.period || 'P1';
      const classes = await ClassModel.getAll();
      const subjects = await SubjectModel.getAll();
      let students = [];
      let existing = [];

      if (class_id && date) {
        if (!(await enforceTeacherClassAccess(req, parseInt(class_id, 10)))) {
          return res.redirect(`/attendance/period?error=You can only access your assigned classes`);
        }
        students = await StudentModel.getAll({ class_id });
        existing = await AttendancePeriodModel.getByClassDatePeriod(class_id, date, period);
      }

      res.render('attendance/period', {
        title: 'Period Attendance',
        classes,
        subjects,
        students,
        existing,
        selectedClass: class_id,
        selectedDate: date,
        selectedPeriod: period,
        query: req.query
      });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  postPeriodAttendance: async (req, res) => {
    try {
      const { class_id, period_label, subject_id, attendance } = req.body;
      const date = toIsoDateOnly(req.body.date);
      const classIdNum = parseInt(class_id, 10);
      if (!classIdNum) return res.redirect(`/attendance/period?error=Invalid class`);
      if (!date) return res.redirect(`/attendance/period?class_id=${classIdNum}&error=Invalid date`);
      if (!(await enforceTeacherClassAccess(req, classIdNum))) {
        return res.redirect(`/attendance/period?class_id=${classIdNum}&date=${date}&period=${period_label}&error=You can only mark attendance for your assigned classes`);
      }
      const role = req.session.user.userType || req.session.user.user_type;
      if (!canModifyAttendanceDate(date, role)) {
        return res.redirect(`/attendance/period?class_id=${classIdNum}&date=${date}&period=${period_label}&error=Attendance for this date is locked`);
      }
      const marker = req.session.user.id || req.session.user.user_id;
      const records = Object.entries(attendance || {}).map(([student_id, data]) => ({
        student_id: parseInt(student_id, 10),
        class_id: classIdNum,
        subject_id: subject_id ? parseInt(subject_id, 10) : null,
        date,
        period_label,
        status: data.status,
        remarks: data.remarks || '',
        marked_by: marker
      })).filter((r) => r.student_id && r.class_id && r.date && r.period_label && VALID_STATUSES.has(String(r.status).toLowerCase()));

      if (!records.length) {
        return res.redirect(`/attendance/period?class_id=${class_id}&date=${date}&period=${period_label}&error=No valid entries`);
      }

      await AttendancePeriodModel.bulkCreate(records);
      await logAudit(req, 'period_attendance_saved', 'attendance_period_records', `${classIdNum}:${date}:${period_label}`, {
        class_id: classIdNum,
        date,
        period_label,
        count: records.length
      });
      res.redirect(`/attendance/period?class_id=${class_id}&date=${date}&period=${period_label}&success=Period attendance saved`);
    } catch (error) {
      res.redirect(`/attendance/period?error=${encodeURIComponent(error.message)}`);
    }
  },

  getStudentAttendance: async (req, res) => {
    try {
      const student = await StudentModel.findById(req.params.studentId);
      if (!student) return res.status(404).render('404', { title: 'Page Not Found' });

      const month = String(req.query.month || (new Date().getMonth() + 1)).padStart(2, '0');
      const year = String(req.query.year || new Date().getFullYear());
      const scope = req.query.scope === 'overall' ? 'overall' : 'month';
      
      const attendance = scope === 'overall'
        ? await AttendanceModel.getByStudentAll(req.params.studentId)
        : await AttendanceModel.getByStudent(req.params.studentId, month, year);
      const monthlyStats = await AttendanceModel.getMonthlyStats(req.params.studentId, month, year);
      const overallStats = await AttendanceModel.getOverallStats(req.params.studentId);
      const stats = scope === 'overall' ? overallStats : monthlyStats;
      const summary = AttendanceModel.summarizeStatsRows(stats);
      
      res.render('attendance/student', {
        title: 'Student Attendance',
        student,
        attendance,
        stats,
        summary,
        month,
        year,
        scope
      });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getAttendanceReport: async (req, res) => {
    try {
      const { class_id, month, year } = req.query;
      const scope = req.query.scope === 'overall' ? 'overall' : 'month';
      const threshold = Number(req.query.threshold || 75);
      const consecutiveLimit = Number(req.query.consecutive || 3);
      const classes = await ClassModel.getAll();
      
      let report = null;
      const monthReady = month && year;
      if (class_id && (scope === 'overall' || monthReady)) {
        const students = await StudentModel.getAll({ class_id });
        report = await Promise.all(students.map(async (s) => {
          const statsRows = scope === 'overall'
            ? await AttendanceModel.getOverallStats(s.student_id)
            : await AttendanceModel.getMonthlyStats(s.student_id, month, year);
          const summary = AttendanceModel.summarizeStatsRows(statsRows);
          const consecutiveAbsences = await AttendanceModel.getCurrentConsecutiveAbsences(s.student_id);
          return {
            ...s,
            stats: statsRows,
            summary,
            consecutiveAbsences,
            lowAttendance: summary.attendance_rate > 0 && summary.attendance_rate < threshold,
            riskConsecutive: consecutiveAbsences >= consecutiveLimit
          };
        }));
      }
      
      res.render('attendance/report', {
        title: 'Attendance Report',
        classes,
        report,
        filters: { class_id, month, year, scope, threshold, consecutive: consecutiveLimit }
      });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  exportAttendanceCsv: async (req, res) => {
    try {
      const { class_id, month, year } = req.query;
      const scope = req.query.scope === 'overall' ? 'overall' : 'month';
      if (!class_id) return res.status(400).send('class_id is required');
      if (scope === 'month' && !(month && year)) return res.status(400).send('month and year required for month scope');

      const students = await StudentModel.getAll({ class_id });
      const rows = await Promise.all(students.map(async (s) => {
        const statsRows = scope === 'overall'
          ? await AttendanceModel.getOverallStats(s.student_id)
          : await AttendanceModel.getMonthlyStats(s.student_id, month, year);
        const summary = AttendanceModel.summarizeStatsRows(statsRows);
        const consecutiveAbsences = await AttendanceModel.getCurrentConsecutiveAbsences(s.student_id);
        return {
          name: `${s.first_name} ${s.last_name}`,
          admission_number: s.admission_number,
          present: summary.present,
          absent: summary.absent,
          late: summary.late,
          excused: summary.excused,
          attendance_rate: summary.attendance_rate,
          consecutive_absences: consecutiveAbsences
        };
      }));

      const header = ['Student', 'AdmissionNumber', 'Present', 'Absent', 'Late', 'Excused', 'AttendanceRate', 'ConsecutiveAbsences'];
      const csv = [header.join(',')].concat(
        rows.map((r) => [r.name, r.admission_number, r.present, r.absent, r.late, r.excused, r.attendance_rate, r.consecutive_absences]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="attendance-report-${class_id}-${scope}.csv"`);
      res.send(csv);
    } catch (error) {
      res.status(500).send(error.message);
    }
  },

  getCorrections: async (req, res) => {
    try {
      const role = req.session.user.userType || req.session.user.user_type;
      const userId = req.session.user.id || req.session.user.user_id;
      const filters = { status: req.query.status || '' };
      let corrections = [];
      if (role === 'student') {
        filters.requested_by = userId;
        corrections = await AttendanceCorrectionModel.getAll(filters);
      } else if (role === 'parent') {
        const children = await StudentModel.getByParentUserId(userId);
        const childIds = new Set(children.map((c) => Number(c.student_id)));
        corrections = await AttendanceCorrectionModel.getAll(filters);
        corrections = corrections.filter((c) => childIds.has(Number(c.student_id)));
      } else {
        corrections = await AttendanceCorrectionModel.getAll(filters);
      }
      const now = Date.now();
      const SLA_DAYS = Number(process.env.ATTENDANCE_CORRECTION_SLA_DAYS || 3);
      corrections = (corrections || []).map((c) => {
        const created = new Date(c.created_at || c.requested_at || Date.now()).getTime();
        const ageDays = Math.floor((now - created) / (24 * 60 * 60 * 1000));
        return { ...c, ageDays, slaBreached: c.status === 'pending' && ageDays > SLA_DAYS };
      });
      res.render('attendance/corrections', { title: 'Attendance Corrections', corrections, query: req.query, role });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  postCorrectionRequest: async (req, res) => {
    try {
      const requestedStatus = String(req.body.requested_status || '').toLowerCase();
      if (!VALID_STATUSES.has(requestedStatus)) {
        return res.redirect('/attendance/corrections?error=Invalid requested status');
      }
      const userId = req.session.user.id || req.session.user.user_id;
      const role = req.session.user.userType || req.session.user.user_type;
      const studentId = parseInt(req.body.student_id, 10);
      const attendanceId = parseInt(req.body.attendance_id, 10);

      const student = await StudentModel.findById(studentId);
      const attendance = await AttendanceModel.findById(attendanceId);
      if (!student || !attendance || Number(attendance.student_id) !== Number(studentId)) {
        return res.redirect('/attendance/corrections?error=Invalid correction target');
      }

      const isStudentOwner = role === 'student' && Number(student.user_id) === Number(userId);
      const isParentOwner = role === 'parent' && Number(student.parent_id) === Number(userId);
      const isStaff = ['admin', 'staff', 'teacher'].includes(role);
      if (!(isStudentOwner || isParentOwner || isStaff)) {
        return res.redirect('/attendance/corrections?error=Access denied');
      }

      await AttendanceCorrectionModel.create({
        attendance_id: attendanceId,
        student_id: studentId,
        requested_by: userId,
        requested_status: requestedStatus,
        reason: req.body.reason || 'No reason provided'
      });
      res.redirect('/attendance/corrections?success=Correction request submitted');
    } catch (error) {
      res.redirect(`/attendance/corrections?error=${encodeURIComponent(error.message)}`);
    }
  },

  postReviewCorrection: async (req, res) => {
    try {
      const decision = req.body.decision === 'approve' ? 'approved' : 'rejected';
      const reviewBy = req.session.user.id || req.session.user.user_id;
      const correction = await AttendanceCorrectionModel.findById(req.params.id);
      if (!correction) return res.redirect('/attendance/corrections?error=Correction request not found');

      await AttendanceCorrectionModel.review(req.params.id, {
        status: decision,
        reviewed_by: reviewBy,
        review_comment: req.body.review_comment || ''
      });

      if (decision === 'approved') {
        await AttendanceModel.update(correction.attendance_id, { status: correction.requested_status });
      }
      res.redirect('/attendance/corrections?success=Correction request reviewed');
    } catch (error) {
      res.redirect(`/attendance/corrections?error=${encodeURIComponent(error.message)}`);
    }
  },

  postRunRiskCheck: async (req, res) => {
    try {
      const classId = req.body.class_id ? parseInt(req.body.class_id, 10) : null;
      const threshold = Number(req.body.threshold || 75);
      const alerts = await evaluateAttendanceRisks({ classId, threshold, notify: true, createGuidance: true });
      res.redirect(`/attendance?class_id=${classId || ''}&threshold=${threshold}&success=Risk check completed (${alerts.length} alert(s))`);
    } catch (error) {
      res.redirect(`/attendance?error=${encodeURIComponent(error.message)}`);
    }
  },

  getIntegrityReport: async (req, res) => {
    try {
      const integrity = await getAttendanceIntegrityIssues();
      res.render('attendance/index', {
        title: 'Attendance',
        classes: await ClassModel.getAll(),
        alerts: [],
        analytics: { notice: 0, warning: 0, danger: 0, total: 0 },
        integrity,
        filters: { class_id: '', threshold: 75, consecutive: 3 },
        query: req.query
      });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  postAddPeriod: async (req, res) => {
    try {
      const classId = parseInt(req.body.class_id, 10);
      const date = toIsoDateOnly(req.body.date) || toIsoDateOnly(new Date());
      const periodLabel = normalizePeriodLabel(req.body.period_label);
      if (!classId || !periodLabel) {
        return res.redirect(`/attendance/mark?mode=day&class_id=${classId || ''}&date=${date}&error=Invalid period`);
      }
      const existing = await AttendancePeriodModel.getActivePeriodsForClass(classId);
      if (existing.includes(periodLabel)) {
        return res.redirect(`/attendance/mark?mode=day&class_id=${classId}&date=${date}&error=Period already exists`);
      }
      await AttendancePeriodModel.addPeriod(classId, periodLabel);
      const updated = await AttendancePeriodModel.getActivePeriodsForClass(classId);
      if (!updated.includes(periodLabel)) {
        throw new Error('Period add verification failed');
      }
      res.redirect(`/attendance/mark?mode=day&class_id=${classId}&date=${date}&success=Period ${periodLabel} added`);
    } catch (error) {
      res.redirect(`/attendance/mark?mode=day&class_id=${req.body.class_id || ''}&date=${req.body.date || ''}&error=${encodeURIComponent(error.message)}`);
    }
  },

  postDeletePeriod: async (req, res) => {
    try {
      const classId = parseInt(req.body.class_id, 10);
      const date = toIsoDateOnly(req.body.date) || toIsoDateOnly(new Date());
      const periodLabel = normalizePeriodLabel(req.body.period_label);
      if (!classId || !periodLabel) {
        return res.redirect(`/attendance/mark?mode=day&class_id=${classId || ''}&date=${date}&error=Invalid period`);
      }
      const existing = await AttendancePeriodModel.getActivePeriodsForClass(classId);
      if (!existing.includes(periodLabel)) {
        return res.redirect(`/attendance/mark?mode=day&class_id=${classId}&date=${date}&error=Period not found`);
      }
      await AttendancePeriodModel.deletePeriod(classId, periodLabel);
      const updated = await AttendancePeriodModel.getActivePeriodsForClass(classId);
      if (updated.includes(periodLabel)) {
        throw new Error('Period delete verification failed');
      }
      res.redirect(`/attendance/mark?mode=day&class_id=${classId}&date=${date}&success=Period ${periodLabel} deleted`);
    } catch (error) {
      res.redirect(`/attendance/mark?mode=day&class_id=${req.body.class_id || ''}&date=${req.body.date || ''}&error=${encodeURIComponent(error.message)}`);
    }
  }
};

module.exports = attendanceController;
