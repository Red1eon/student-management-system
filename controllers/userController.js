const UserModel = require('../models/userModel');

const userController = {
  getAllUsers: async (req, res) => {
    try {
      const { type } = req.query;
      const users = await UserModel.getAllByType(type);
      res.json({ success: true, users });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getUserById: async (req, res) => {
    try {
      const user = await UserModel.findById(req.params.id);
      if (!user) return res.status(404).json({ success: false, error: 'User not found' });
      res.json({ success: true, user });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  updateUser: async (req, res) => {
    try {
      const updated = await UserModel.update(req.params.id, req.body);
      if (!updated) return res.status(404).json({ success: false, error: 'User not found' });
      res.json({ success: true, message: 'User updated successfully' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  deleteUser: async (req, res) => {
    try {
      const deleted = await UserModel.delete(req.params.id);
      if (!deleted) return res.status(404).json({ success: false, error: 'User not found' });
      res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

module.exports = userController;