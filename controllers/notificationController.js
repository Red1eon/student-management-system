const NotificationModel = require('../models/notificationModel');
const UserNotificationModel = require('../models/userNotificationModel');
const ClassModel = require('../models/classModel');
const NotificationDeliveryModel = require('../models/notificationDeliveryModel');

const TARGET_USER_TYPE_MAP = {
  all: 'all',
  student: 'students',
  students: 'students',
  teacher: 'teachers',
  teachers: 'teachers',
  parent: 'parents',
  parents: 'parents',
  staff: 'staff'
};

function normalizeChannels(rawChannels) {
  const source = Array.isArray(rawChannels) ? rawChannels : [rawChannels];
  const allowed = new Set(['in_app', 'email', 'sms']);
  const channels = source.map((c) => String(c || '').trim()).filter((c) => allowed.has(c));
  return channels.length ? Array.from(new Set(channels)) : ['in_app'];
}

const notificationController = {
  getNotifications: async (req, res) => {
    try {
      const userId = req.session.user?.id || req.session.user?.user_id;
      const notifications = await UserNotificationModel.getByUser(userId);
      const unreadCount = await NotificationModel.getUnreadCount(userId);
      const role = req.session.user?.userType || req.session.user?.user_type;
      const deliveryLogs = ['admin', 'staff'].includes(role)
        ? await NotificationDeliveryModel.getRecent(50)
        : [];
      
      res.render('notifications/index', {
        title: 'Notifications',
        notifications,
        unreadCount,
        deliveryLogs
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
      const normalizedTarget = TARGET_USER_TYPE_MAP[String(req.body.target_user_type || 'all').toLowerCase()] || 'all';
      const channels = normalizeChannels(req.body.channels);
      const notificationData = {
        ...req.body,
        target_user_type: normalizedTarget,
        sent_by: userId
      };
      
      const notificationId = await NotificationModel.create(notificationData);
      const recipientUserIds = await NotificationModel.getRecipientUserIds(notificationId);

      for (const recipientUserId of recipientUserIds) {
        for (const channel of channels) {
          if (channel === 'in_app') {
            await NotificationDeliveryModel.create(notificationId, recipientUserId, channel, 'delivered', null);
          } else {
            await NotificationDeliveryModel.create(notificationId, recipientUserId, channel, 'queued', null);
          }
        }
      }

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
  },

  postRetryDelivery: async (req, res) => {
    try {
      const role = req.session.user?.userType || req.session.user?.user_type;
      if (!['admin', 'staff'].includes(role)) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      const delivery = await NotificationDeliveryModel.findById(req.params.deliveryId);
      if (!delivery) return res.status(404).json({ success: false, error: 'Delivery not found' });

      await NotificationDeliveryModel.incrementRetryAndQueue(delivery.delivery_id);
      await NotificationDeliveryModel.markStatus(delivery.delivery_id, 'delivered', null);
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
};

module.exports = notificationController;
