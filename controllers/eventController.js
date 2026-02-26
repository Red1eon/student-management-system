const EventModel = require('../models/eventModel');
const { getJapanSchoolStatus } = require('../utils/japanSchoolCalendar');

function canManageEvents(user) {
  const role = user?.userType || user?.user_type;
  return ['admin', 'staff'].includes(role);
}

const eventController = {
  getAllEvents: async (req, res) => {
    try {
      const events = await EventModel.getAll(req.query);
      const schoolStatus = getJapanSchoolStatus();
      res.render('events/index', {
        title: 'Events',
        events,
        filters: req.query,
        schoolStatus,
        canManageEvents: canManageEvents(req.session.user)
      });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getCreateEvent: (req, res) => {
    res.render('events/create', { title: 'Create Event', formData: {} });
  },

  postCreateEvent: async (req, res) => {
    try {
      const eventData = {
        ...req.body,
        organizer_id: req.session.user.id
      };
      
      await EventModel.create(eventData);
      res.redirect('/events?success=Event created successfully');
    } catch (error) {
      res.render('events/create', { title: 'Create Event', error: error.message, formData: req.body });
    }
  },

  getEventDetail: async (req, res) => {
    try {
      const event = await EventModel.findById(req.params.id);
      if (!event) return res.status(404).render('404', { title: 'Page Not Found' });
      
      res.render('events/detail', { title: event.event_name, event });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getCalendar: async (req, res) => {
    try {
      const month = String(req.query.month || (new Date().getMonth() + 1)).padStart(2, '0');
      const year = String(req.query.year || new Date().getFullYear());
      
      const events = await EventModel.getCalendarData(month, year);
      const schoolStatus = getJapanSchoolStatus();
      
      res.render('events/calendar', {
        title: 'Event Calendar',
        events,
        month,
        year,
        schoolStatus,
        canManageEvents: canManageEvents(req.session.user)
      });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  postUpdateEvent: async (req, res) => {
    try {
      await EventModel.update(req.params.id, req.body);
      res.redirect(`/events/${req.params.id}?success=Event updated`);
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  deleteEvent: async (req, res) => {
    try {
      await EventModel.delete(req.params.id);
      res.redirect('/events?success=Event deleted');
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  }
};

module.exports = eventController;
