const ExamModel = require('../models/examModel');
const ExamResultModel = require('../models/examResultModel');
const ClassModel = require('../models/classModel');
const SubjectModel = require('../models/subjectModel');
const StudentModel = require('../models/studentModel');
const { calculateGrade } = require('../utils/helpers');

const NONE_VALUES = new Set(['none', 'なし', 'n/a', 'na', 'null', '-']);

function isNoneValue(value) {
  if (value === undefined || value === null) return true;
  return NONE_VALUES.has(String(value).trim().toLowerCase());
}

function toNullableText(value) {
  if (isNoneValue(value)) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

function toNullableId(value) {
  if (isNoneValue(value)) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function pickInputValue(primary, secondary) {
  const first = toNullableText(primary);
  if (first !== null) return first;
  return secondary;
}

async function resolveClassId(classInput) {
  const classId = toNullableId(classInput);
  if (classId !== null) {
    const existingById = await ClassModel.findById(classId);
    if (!existingById) throw new Error('Selected class does not exist');
    return classId;
  }

  const classText = toNullableText(classInput);
  if (!classText) return null;

  const classes = await ClassModel.getAll();
  const normalized = classText.toLowerCase();
  const existing = classes.find((c) => {
    const byName = String(c.class_name || '').toLowerCase() === normalized;
    const byCode = String(c.class_code || '').toLowerCase() === normalized;
    const byFull = `${c.class_name || ''} ${c.section || ''}`.trim().toLowerCase() === normalized;
    return byName || byCode || byFull;
  });

  if (existing) return existing.class_id;

  const codePrefix = classText.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 5) || 'CLASS';
  let classCode = `${codePrefix}${Date.now().toString().slice(-5)}`;

  while (await ClassModel.findByCode(classCode)) {
    classCode = `${codePrefix}${Math.floor(10000 + Math.random() * 90000)}`;
  }

  return await ClassModel.create({
    class_name: classText,
    class_code: classCode,
    section: 'A',
    academic_year: String(new Date().getFullYear()),
    class_teacher_id: null,
    capacity: 30,
    room_number: null
  });
}

async function resolveSubjectId(subjectInput) {
  const subjectId = toNullableId(subjectInput);
  if (subjectId !== null) {
    const existingById = await SubjectModel.findById(subjectId);
    if (!existingById) throw new Error('Selected subject does not exist');
    return subjectId;
  }

  const subjectText = toNullableText(subjectInput);
  if (!subjectText) return null;

  const subjects = await SubjectModel.getAll();
  const normalized = subjectText.toLowerCase();
  const existing = subjects.find((s) => {
    const byName = String(s.subject_name || '').toLowerCase() === normalized;
    const byCode = String(s.subject_code || '').toLowerCase() === normalized;
    return byName || byCode;
  });

  if (existing) return existing.subject_id;

  const codePrefix = subjectText.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 5) || 'SUBJ';
  let subjectCode = `${codePrefix}${Date.now().toString().slice(-5)}`;

  while (await SubjectModel.findByCode(subjectCode)) {
    subjectCode = `${codePrefix}${Math.floor(10000 + Math.random() * 90000)}`;
  }

  return await SubjectModel.create({
    subject_name: subjectText,
    subject_code: subjectCode,
    description: null,
    credits: 3,
    department_id: null
  });
}

const examController = {
  getAllExams: async (req, res) => {
    try {
      const exams = await ExamModel.getAll(req.query);
      const classes = await ClassModel.getAll();
      res.render('exams/index', { title: 'Exams', exams, classes, filters: req.query });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getCreateExam: async (req, res) => {
    const classes = await ClassModel.getAll();
    const subjects = await SubjectModel.getAll();
    res.render('exams/create', { title: 'Create Exam', classes, subjects });
  },

  postCreateExam: async (req, res) => {
    try {
      const classes = await ClassModel.getAll();
      const subjects = await SubjectModel.getAll();

      const classInput = pickInputValue(req.body.class_id_text, req.body.class_id);
      const subjectInput = pickInputValue(req.body.subject_id_text, req.body.subject_id);
      const classId = await resolveClassId(classInput);
      const subjectId = await resolveSubjectId(subjectInput);

      if (!classId) throw new Error('Class cannot be none. Please select or type a class.');
      if (!subjectId) throw new Error('Subject cannot be none. Please select or type a subject.');

      const totalMarks = Number(req.body.total_marks);
      const passingMarks = Number(req.body.passing_marks);

      const examData = {
        exam_name: toNullableText(req.body.exam_name) || 'なし',
        exam_type: toNullableText(req.body.exam_type) || 'quiz',
        class_id: classId,
        subject_id: subjectId,
        academic_year: toNullableText(req.body.academic_year) || String(new Date().getFullYear()),
        term: toNullableText(req.body.term),
        total_marks: Number.isFinite(totalMarks) && totalMarks > 0 ? totalMarks : 100,
        passing_marks: Number.isFinite(passingMarks) && passingMarks > 0 ? passingMarks : 40,
        exam_date: toNullableText(req.body.exam_date),
        start_time: toNullableText(req.body.start_time),
        end_time: toNullableText(req.body.end_time),
        room_number: toNullableText(req.body.room_number)
      };

      await ExamModel.create(examData);
      res.redirect('/exams?success=Exam created successfully');
    } catch (error) {
      const classes = await ClassModel.getAll();
      const subjects = await SubjectModel.getAll();
      res.render('exams/create', { title: 'Create Exam', classes, subjects, error: error.message, formData: req.body });
    }
  },

  getExamDetail: async (req, res) => {
    try {
      const exam = await ExamModel.findById(req.params.id);
      if (!exam) return res.status(404).render('404', { title: 'Page Not Found' });
      
      const results = await ExamResultModel.getByExam(req.params.id);
      const students = await StudentModel.getAll({ class_id: exam.class_id });
      
      res.render('exams/detail', { title: exam.exam_name, exam, results, students });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  postEnterResults: async (req, res) => {
    try {
      const { exam_id, results } = req.body;
      const exam = await ExamModel.findById(exam_id);
      
      const processedResults = results.map(r => ({
        exam_id: parseInt(exam_id),
        student_id: parseInt(r.student_id),
        marks_obtained: parseFloat(r.marks_obtained),
        grade: calculateGrade(r.marks_obtained, exam.total_marks),
        remarks: r.remarks || '',
        checked_by: req.session.user.id
      }));
      
      await ExamResultModel.bulkCreate(processedResults);
      res.redirect(`/exams/${exam_id}?success=Results saved successfully`);
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getStudentResults: async (req, res) => {
    try {
      const student = await StudentModel.findById(req.params.studentId);
      if (!student) return res.status(404).render('404', { title: 'Page Not Found' });
      const results = await ExamResultModel.getByStudent(req.params.studentId);
      
      res.render('exams/student-results', { title: 'Student Results', student, results });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  }
};

module.exports = examController;
