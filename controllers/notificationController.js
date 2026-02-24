const NotificationModel = require('../models/notificationModel');
const UserNotificationModel = require('../models/userNotificationModel');
const ClassModel = require('../models/ClassModel');

const notificationController = {
  getNotifications: async (req, res) => {
    try {
      const notifications = await UserNotificationModel.getByUser(req.session.user.id);
      const unreadCount = await NotificationModel.getUnreadCount(req.session.user.id);
      
      res.render('notifications/index', {
        title: 'Notifications',
        notifications,
        unreadCount
      });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getCreateNotification: async (req, res) => {
    const classes = await ClassModel.getAll();
    res.render('notifications/create', { title: 'Send Notification', classes });
  },

  postCreateNotification: async (req, res) => {
    try {
      const notificationData = {
        ...req.body,
        sent_by: req.session.user.id
      };
      
      await NotificationModel.create(notificationData);
      res.redirect('/notifications?success=Notification sent');
    } catch (error) {
      const classes = await ClassModel.getAll();
      res.render('notifications/create', { title: 'Send Notification', classes, error: error.message });
    }
  },

  postMarkAsRead: async (req, res) => {
    try {
      await UserNotificationModel.markAsRead(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  postMarkAllAsRead: async (req, res) => {
    try {
      await UserNotificationModel.markAllAsRead(req.session.user.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getUnreadCount: async (req, res) => {
    try {
      const count = await NotificationModel.getUnreadCount(req.session.user.id);
      res.json({ success: true, count });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

module.exports = notificationController;