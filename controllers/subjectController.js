const SubjectModel = require('../models/subjectModel');
const DepartmentModel = require('../models/departmentModel');

const subjectController = {
  getAllSubjects: async (req, res) => {
    try {
      const subjects = await SubjectModel.getAll(req.query);
      const departments = await DepartmentModel.getAll();
      res.render('subjects/index', { title: 'Subjects', subjects, departments, filters: req.query });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getAddSubject: async (req, res) => {
    const departments = await DepartmentModel.getAll();
    res.render('subjects/add', { title: 'Add Subject', departments });
  },

  postAddSubject: async (req, res) => {
    try {
      await SubjectModel.create(req.body);
      res.redirect('/subjects?success=Subject created successfully');
    } catch (error) {
      const departments = await DepartmentModel.getAll();
      res.render('subjects/add', { title: 'Add Subject', departments, error: error.message });
    }
  },

  getEditSubject: async (req, res) => {
    try {
      const subject = await SubjectModel.findById(req.params.id);
      const departments = await DepartmentModel.getAll();
      res.render('subjects/edit', { title: 'Edit Subject', subject, departments });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  postEditSubject: async (req, res) => {
    try {
      await SubjectModel.update(req.params.id, req.body);
      res.redirect('/subjects?success=Subject updated successfully');
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  deleteSubject: async (req, res) => {
    try {
      await SubjectModel.delete(req.params.id);
      res.redirect('/subjects?success=Subject deleted');
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  }
};

module.exports = subjectController;