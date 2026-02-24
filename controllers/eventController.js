const EventModel = require('../models/eventModel');

const eventController = {
  getAllEvents: async (req, res) => {
    try {
      const events = await EventModel.getAll(req.query);
      res.render('events/index', { title: 'Events', events, filters: req.query });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getCreateEvent: (req, res) => {
    res.render('events/create', { title: 'Create Event' });
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
      res.render('events/create', { title: 'Create Event', error: error.message });
    }
  },

  getEventDetail: async (req, res) => {
    try {
      const event = await EventModel.findById(req.params.id);
      if (!event) return res.status(404).render('404');
      
      res.render('events/detail', { title: event.event_name, event });
    } catch (error) {
      res.status(500).render('error', { message: error.message });
    }
  },

  getCalendar: async (req, res) => {
    try {
      const month = req.query.month || new Date().getMonth() + 1;
      const year = req.query.year || new Date().getFullYear();
      
      const events = await EventModel.getCalendarData(month, year);
      
      res.render('events/calendar', { title: 'Event Calendar', events, month, year });
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