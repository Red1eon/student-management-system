const UserModel = require('../models/userModel');
const StudentModel = require('../models/studentModel');
const TeacherModel = require('../models/teacherModel');
const bcrypt = require('bcryptjs');

const profileController = {
  getEditProfile: async (req, res) => {
    try {
      const dbUser = await UserModel.findById(req.session.user.id || req.session.user.user_id);
      if (!dbUser) {
        return res.status(404).render('error', { message: 'User not found' });
      }
      res.render('profile/edit', { title: 'Edit Profile', user: dbUser, query: req.query });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getChangePassword: (req, res) => {
    res.render('profile/change-password', { title: 'Change Password', query: req.query });
  },

  getProfile: async (req, res) => {
    try {
      const sessionUser = req.session.user || {};
      const dbUser = await UserModel.findById(sessionUser.id || sessionUser.user_id);

      if (!dbUser) {
        return res.status(404).render('error', { message: 'User not found' });
      }

      // Keep one normalized user shape for views (sidebar/header rely on camelCase keys).
      const user = {
        ...sessionUser,
        id: dbUser.user_id,
        user_id: dbUser.user_id,
        username: dbUser.username,
        email: dbUser.email,
        firstName: dbUser.first_name,
        first_name: dbUser.first_name,
        lastName: dbUser.last_name,
        last_name: dbUser.last_name,
        userType: dbUser.user_type,
        user_type: dbUser.user_type,
        phone: dbUser.phone,
        address: dbUser.address,
        profilePicture: dbUser.profile_picture
      };

      req.session.user = user;
      let profileData = null;
      
      if (user.userType === 'student') {
        profileData = await StudentModel.findByUserId(user.user_id);
      } else if (user.userType === 'teacher') {
        profileData = await TeacherModel.findByUserId(user.user_id);
      }
      
      res.render('profile/index', { title: 'My Profile', user, profileData, query: req.query });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  postUpdateProfile: async (req, res) => {
    try {
      const allowedFields = ['first_name', 'last_name', 'phone', 'address', 'email'];
      const updateData = {};
      
      allowedFields.forEach(field => {
        if (req.body[field]) updateData[field] = req.body[field];
      });

      if (Object.keys(updateData).length === 0) {
        return res.redirect('/profile/edit?error=No profile changes were provided');
      }
      
      const userId = req.session.user.id || req.session.user.user_id;
      await UserModel.update(userId, updateData);
      
      // Update session
      req.session.user = { ...req.session.user, ...updateData };
      if (updateData.first_name) req.session.user.firstName = updateData.first_name;
      if (updateData.last_name) req.session.user.lastName = updateData.last_name;
      if (updateData.email) req.session.user.email = updateData.email;
      
      res.redirect('/profile?success=Profile updated successfully');
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  postChangePassword: async (req, res) => {
    try {
      const { current_password, new_password, confirm_password } = req.body;

      if (!current_password || !new_password || !confirm_password) {
        return res.redirect('/profile/change-password?error=All password fields are required');
      }

      if (new_password.length < 6) {
        return res.redirect('/profile/change-password?error=New password must be at least 6 characters');
      }
      
      if (new_password !== confirm_password) {
        return res.redirect('/profile/change-password?error=New passwords do not match');
      }

      const user = await UserModel.findById(req.session.user.id || req.session.user.user_id);
      const isValid = await UserModel.verifyPassword(current_password, user.password_hash);
      
      if (!isValid) {
        return res.redirect('/profile/change-password?error=Current password is incorrect');
      }
      
      const newHash = await bcrypt.hash(new_password, 10);
      await UserModel.update(req.session.user.id || req.session.user.user_id, { password_hash: newHash });
      
      res.redirect('/profile?success=Password changed successfully');
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  postUploadPhoto: async (req, res) => {
    try {
      if (!req.file) {
        return res.redirect('/profile?error=No file uploaded');
      }
      
      const photoPath = `/uploads/${req.file.filename}`;
      await UserModel.update(req.session.user.id || req.session.user.user_id, { profile_picture: photoPath });
      
      req.session.user.profilePicture = photoPath;
      
      res.redirect('/profile?success=Profile photo updated successfully');
    } catch (error) {
      res.redirect(`/profile?error=${encodeURIComponent(error.message)}`);
    }
  }
};

module.exports = profileController;
