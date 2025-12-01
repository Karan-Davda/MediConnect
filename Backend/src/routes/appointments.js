const express = require('express');
const router = express.Router();
const appointmentRepository = require('../repositories/AppointmentRepository');
const notificationService = require('../services/notificationService');
const reminderScheduler = require('../services/reminderScheduler');
const { authenticate, checkPermission } = require('../middleware/auth');

router.post('/', authenticate, async (req, res) => {
  try {
    const {
      patientId,
      patientName,
      patientEmail,
      patientPhone,
      providerId,
      providerName,
      appointmentDate,
      appointmentTime,
      duration,
      reason,
      type,
      location,
      notes,
      fee
    } = req.body;

    if (!patientId || !providerId || !appointmentDate || !appointmentTime || !reason) {
      return res.status(400).json({
        error: 'Missing required fields: patientId, providerId, appointmentDate, appointmentTime, reason'
      });
    }

    const appointment = await appointmentRepository.create({
      patientId,
      patientName,
      patientEmail,
      patientPhone,
      providerId,
      providerName,
      appointmentDate,
      appointmentTime,
      duration: duration || 30,
      reason,
      type: type || 'In-Person',
      status: 'confirmed',
      location,
      notes,
      fee,
      createdBy: req.user.id
    });

    const preferences = {
      smsNotifications: true,
      emailNotifications: true
    };

    await notificationService.sendAppointmentConfirmation(appointment, preferences);

    res.status(201).json(appointment);
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const { patientId, providerId, status, date, type } = req.query;

    const filters = {};
    if (patientId) filters.patientId = patientId;
    if (providerId) filters.providerId = providerId;
    if (status) filters.status = status;
    if (date) filters.date = date;
    if (type) filters.type = type;

    if (req.user.role === 'patient') {
      filters.patientId = req.user.id;
    } else if (req.user.role === 'doctor') {
      filters.providerId = filters.providerId || req.user.id;
    }

    const appointments = await appointmentRepository.findAll(filters);
    res.json(appointments);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

router.get('/upcoming', authenticate, async (req, res) => {
  try {
    const { patientId, providerId } = req.query;

    const filters = {};
    if (patientId) filters.patientId = patientId;
    if (providerId) filters.providerId = providerId;

    if (req.user.role === 'patient') {
      filters.patientId = req.user.id;
    } else if (req.user.role === 'doctor') {
      filters.providerId = filters.providerId || req.user.id;
    }

    const appointments = await appointmentRepository.findUpcoming(filters);
    res.json(appointments);
  } catch (error) {
    console.error('Error fetching upcoming appointments:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming appointments' });
  }
});

router.get('/statistics', authenticate, async (req, res) => {
  try {
    const { patientId, providerId } = req.query;

    const filters = {};
    if (patientId) filters.patientId = patientId;
    if (providerId) filters.providerId = providerId;

    if (req.user.role === 'patient') {
      filters.patientId = req.user.id;
    } else if (req.user.role === 'doctor') {
      filters.providerId = filters.providerId || req.user.id;
    }

    const stats = await appointmentRepository.getStatistics(filters);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching appointment statistics:', error);
    res.status(500).json({ error: 'Failed to fetch appointment statistics' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const appointment = await appointmentRepository.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (req.user.role === 'patient' && appointment.patientId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (req.user.role === 'doctor' && appointment.providerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(appointment);
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const {
      appointmentDate,
      appointmentTime,
      duration,
      reason,
      type,
      location,
      notes,
      fee
    } = req.body;

    const existingAppointment = await appointmentRepository.findById(req.params.id);
    if (!existingAppointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (existingAppointment.status === 'cancelled') {
      return res.status(400).json({
        error: 'Cannot update cancelled appointment'
      });
    }

    const updates = {
      appointmentDate,
      appointmentTime,
      duration,
      reason,
      type,
      location,
      notes,
      fee,
      updatedBy: req.user.id
    };

    const updatedAppointment = await appointmentRepository.update(req.params.id, updates);

    res.json(updatedAppointment);
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed', 'no-show'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        validStatuses
      });
    }

    const appointment = await appointmentRepository.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const additionalData = {
      updatedBy: req.user.id
    };

    const updatedAppointment = await appointmentRepository.updateStatus(req.params.id, status, additionalData);

    if (status === 'cancelled') {
      const preferences = {
        smsNotifications: true,
        emailNotifications: true
      };
      await notificationService.sendAppointmentCancellation(updatedAppointment, preferences);
    }

    res.json(updatedAppointment);
  } catch (error) {
    console.error('Error updating appointment status:', error);
    res.status(500).json({ error: 'Failed to update appointment status' });
  }
});

router.post('/:id/send-reminder', authenticate, checkPermission('manage_appointments'), async (req, res) => {
  try {
    const results = await reminderScheduler.sendReminderNow(req.params.id);

    res.json({
      message: 'Reminder sent successfully',
      results
    });
  } catch (error) {
    console.error('Error sending reminder:', error);
    res.status(500).json({ error: error.message || 'Failed to send reminder' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const appointment = await appointmentRepository.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    await appointmentRepository.delete(req.params.id);

    res.json({ message: 'Appointment deleted successfully' });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

router.get('/scheduler/status', authenticate, checkPermission('manage_appointments'), (req, res) => {
  try {
    const status = reminderScheduler.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting scheduler status:', error);
    res.status(500).json({ error: 'Failed to get scheduler status' });
  }
});

module.exports = router;
