const NotificationModel = require('../models/notificationModel');
const UserNotificationModel = require('../models/userNotificationModel');
const ClassModel = require('../models/classModel');

const notificationController = {
  getNotifications: async (req, res) => {
    try {
      const userId = req.session.user?.id || req.session.user?.user_id;
      const notifications = await UserNotificationModel.getByUser(userId);
      const unreadCount = await NotificationModel.getUnreadCount(userId);
      
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
      const userId = req.session.user?.id || req.session.user?.user_id;
      const notificationData = {
        ...req.body,
        sent_by: userId
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
      const userId = req.session.user?.id || req.session.user?.user_id;
      await UserNotificationModel.markAllAsRead(userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getUnreadCount: async (req, res) => {
    try {
      const userId = req.session.user?.id || req.session.user?.user_id;
      const count = await NotificationModel.getUnreadCount(userId);
      res.json({ success: true, count });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

module.exports = notificationController;
