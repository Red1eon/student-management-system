const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/', (req, res) => {
  if (req.session.user) {
    const role = req.session.user.userType || req.session.user.user_type;
    if (role === 'teacher') return res.redirect('/teacher/dashboard');
    if (role === 'student') return res.redirect('/student/dashboard');
    if (role === 'parent') return res.redirect('/parent/dashboard');
    return res.redirect('/dashboard');
  }
  res.redirect('/auth/login');
});

// Error pages
router.get('/404', (req, res) => res.status(404).render('404', { title: 'Page Not Found' }));
router.get('/500', (req, res) => res.status(500).render('error', { title: 'Server Error', message: 'Internal server error' }));

module.exports = router;
