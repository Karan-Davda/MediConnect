const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const AppointmentRepository = require('../repositories/AppointmentRepository');
const PatientRepository = require('../repositories/PatientRepository');
const DoctorRepository = require('../repositories/DoctorRepository');
const { logAccess, AUDIT_ACTIONS } = require('../middleware/auditLogger');
const { sendNotification } = require('../services/notificationService');
const router = express.Router();

/**
 * Book appointment (patients only)
 * POST /api/appointments
 */
router.post('/', authenticate, requireRole('patient'), async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get patient_id from user_id
    const patient = await PatientRepository.findByUserId(userId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient profile not found. Please complete your profile first.' });
    }

    const {
      doctor_id,
      speciality_id,
      start_time,
      end_time,
      duration_minutes = 30,
      appointment_type = 'in_person',
      reason,
      notes
    } = req.body;

    // Validate required fields
    if (!doctor_id || !start_time) {
      return res.status(400).json({ error: 'doctor_id and start_time are required' });
    }

    // Calculate end_time if not provided
    const startTime = new Date(start_time);
    const endTime = end_time ? new Date(end_time) : new Date(startTime.getTime() + duration_minutes * 60000);

    // Verify doctor exists
    const doctor = await DoctorRepository.findById(doctor_id);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const appointmentData = {
      patient_id: patient.patient_id,
      doctor_id: parseInt(doctor_id),
      speciality_id: speciality_id ? parseInt(speciality_id) : null,
      start_time: startTime,
      end_time: endTime,
      duration_minutes: parseInt(duration_minutes),
      appointment_type,
      reason: reason || null,
      notes: notes || null,
      created_by: userId
    };

    // Create appointment (this will check for double booking)
    const appointment = await AppointmentRepository.create(appointmentData);

    // Log appointment creation
    logAccess(req, AUDIT_ACTIONS.CREATE, {
      resourceType: 'APPOINTMENT',
      resourceId: appointment.appt_id,
      details: `Booked appointment with doctor ${doctor_id} on ${startTime.toISOString()}`
    });

    // Send confirmation notification (async - don't wait)
    (async () => {
      try {
        // Get patient and doctor details for notification
        const UserRepository = require('../repositories/UserRepository');
        const patientUser = await UserRepository.findById(patient.user_id);
        const doctorUser = await UserRepository.findById(doctor.user_id);
        
        if (!patientUser || !patientUser.email) {
          console.warn('Cannot send appointment confirmation: patient email not found');
          return;
        }

        // Create notification record
        const notifRecord = await AppointmentRepository.createNotification({
          appt_id: appointment.appt_id,
          notification_type: 'confirmation',
          channel: 'email',
          status: 'pending'
        });

        // Send email notification using Resend
        const { Resend } = require('resend');
        if (process.env.RESEND_API_KEY) {
          const resend = new Resend(process.env.RESEND_API_KEY);
          const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
          
          const subject = `Appointment Confirmation - ${startTime.toLocaleDateString()}`;
          const htmlContent = `
            <h2>Appointment Confirmed</h2>
            <p>Dear ${patientUser.first_name} ${patientUser.last_name},</p>
            <p>Your appointment has been confirmed:</p>
            <ul>
              <li><strong>Doctor:</strong> ${doctorUser.first_name} ${doctorUser.last_name}</li>
              <li><strong>Date & Time:</strong> ${startTime.toLocaleString()}</li>
              <li><strong>Type:</strong> ${appointment_type}</li>
              ${reason ? `<li><strong>Reason:</strong> ${reason}</li>` : ''}
            </ul>
            <p>Please arrive 15 minutes early for your appointment.</p>
            <p>If you need to cancel or reschedule, please contact us at least 24 hours in advance.</p>
          `;

          const { data, error } = await resend.emails.send({
            from: fromEmail,
            to: [patientUser.email],
            subject: subject,
            html: htmlContent,
          });

          if (error) {
            console.error('Failed to send appointment confirmation email:', error);
            await AppointmentRepository.updateNotificationStatus(notifRecord.notification_id, 'failed', error.message);
          } else {
            console.log('Appointment confirmation email sent:', data);
            await AppointmentRepository.updateNotificationStatus(notifRecord.notification_id, 'sent');
            await AppointmentRepository.markConfirmationSent(appointment.appt_id);
          }
        } else {
          console.warn('RESEND_API_KEY not configured, skipping email notification');
          await AppointmentRepository.updateNotificationStatus(notifRecord.notification_id, 'failed', 'Email service not configured');
        }
      } catch (notifError) {
        console.error('Notification error (non-blocking):', notifError);
      }
    })();

    res.status(201).json({
      message: 'Appointment booked successfully',
      appointment
    });
  } catch (error) {
    console.error('Appointment booking error:', error);
    res.status(400).json({ error: error.message || 'Failed to book appointment' });
  }
});

/**
 * Get patient's appointments
 * GET /api/appointments/my-appointments
 */
router.get('/my-appointments', authenticate, requireRole('patient'), async (req, res) => {
  try {
    const userId = req.user.userId;
    const { startDate, endDate } = req.query;
    
    const patient = await PatientRepository.findByUserId(userId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient profile not found' });
    }

    const appointments = await AppointmentRepository.findByPatientId(
      patient.patient_id,
      startDate ? new Date(startDate) : null,
      endDate ? new Date(endDate) : null
    );

    res.json({ appointments });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch appointments' });
  }
});

/**
 * Get doctor's appointments
 * GET /api/appointments/doctor/:doctorId
 */
router.get('/doctor/:doctorId', authenticate, requireRole('doctor', 'clinic_staff', 'clinic_admin'), async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { startDate, endDate } = req.query;
    
    const appointments = await AppointmentRepository.findByDoctorId(
      parseInt(doctorId),
      startDate ? new Date(startDate) : null,
      endDate ? new Date(endDate) : null
    );
    
    res.json({ appointments });
  } catch (error) {
    console.error('Error fetching doctor appointments:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch appointments' });
  }
});

/**
 * Get appointment by ID
 * GET /api/appointments/:apptId
 */
router.get('/:apptId', authenticate, async (req, res) => {
  try {
    const { apptId } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    const appointment = await AppointmentRepository.findById(parseInt(apptId));
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Check access: patient can see their own, doctors/staff can see their appointments
    const PatientRepository = require('../repositories/PatientRepository');
    const patient = await PatientRepository.findByUserId(userId);
    
    if (userRole === 'patient') {
      if (patient && appointment.patient_id !== patient.patient_id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    } else if (['doctor', 'clinic_staff', 'clinic_admin'].includes(userRole)) {
      const DoctorRepository = require('../repositories/DoctorRepository');
      const doctor = await DoctorRepository.findByUserId(userId);
      if (doctor && appointment.doctor_id !== doctor.doctor_id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    res.json({ appointment });
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch appointment' });
  }
});

/**
 * Cancel appointment
 * PUT /api/appointments/:apptId/cancel
 */
router.put('/:apptId/cancel', authenticate, async (req, res) => {
  try {
    const { apptId } = req.params;
    const { reason } = req.body;
    const userId = req.user.userId;
    const userRole = req.user.role;

    const appointment = await AppointmentRepository.findById(parseInt(apptId));
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Check access: patient can cancel their own, doctors/staff can cancel their appointments
    const PatientRepository = require('../repositories/PatientRepository');
    const patient = await PatientRepository.findByUserId(userId);
    
    let canCancel = false;
    if (userRole === 'patient' && patient && appointment.patient_id === patient.patient_id) {
      canCancel = true;
    } else if (['doctor', 'clinic_staff', 'clinic_admin'].includes(userRole)) {
      const DoctorRepository = require('../repositories/DoctorRepository');
      const doctor = await DoctorRepository.findByUserId(userId);
      if (doctor && appointment.doctor_id === doctor.doctor_id) {
        canCancel = true;
      }
    }

    if (!canCancel) {
      return res.status(403).json({ error: 'You do not have permission to cancel this appointment' });
    }

    // Only allow cancellation of scheduled/confirmed appointments
    if (!['scheduled', 'confirmed'].includes(appointment.status)) {
      return res.status(400).json({ error: `Cannot cancel appointment with status: ${appointment.status}` });
    }

    const updatedAppointment = await AppointmentRepository.updateStatus(
      parseInt(apptId),
      'cancelled',
      userId,
      reason || null
    );

    logAccess(req, AUDIT_ACTIONS.UPDATE, {
      resourceType: 'APPOINTMENT',
      resourceId: appointment.appt_id,
      details: `Appointment cancelled: ${reason || 'No reason provided'}`
    });

    res.json({
      message: 'Appointment cancelled successfully',
      appointment: updatedAppointment
    });
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    res.status(500).json({ error: error.message || 'Failed to cancel appointment' });
  }
});

/**
 * Update appointment
 * PUT /api/appointments/:apptId
 */
router.put('/:apptId', authenticate, requireRole('doctor', 'clinic_staff', 'clinic_admin'), async (req, res) => {
  try {
    const { apptId } = req.params;
    const updates = req.body;
    const userId = req.user.userId;

    const appointment = await AppointmentRepository.findById(parseInt(apptId));
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Check if user is the doctor for this appointment
    const DoctorRepository = require('../repositories/DoctorRepository');
    const doctor = await DoctorRepository.findByUserId(userId);
    if (!doctor || appointment.doctor_id !== doctor.doctor_id) {
      return res.status(403).json({ error: 'You can only update your own appointments' });
    }

    const updatedAppointment = await AppointmentRepository.update(parseInt(apptId), updates);

    logAccess(req, AUDIT_ACTIONS.UPDATE, {
      resourceType: 'APPOINTMENT',
      resourceId: appointment.appt_id,
      details: 'Appointment updated'
    });

    res.json({
      message: 'Appointment updated successfully',
      appointment: updatedAppointment
    });
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(400).json({ error: error.message || 'Failed to update appointment' });
  }
});

/**
 * Get available time slots for a doctor
 * GET /api/appointments/available-slots/:doctorId
 */
router.get('/available-slots/:doctorId', authenticate, async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date, duration = 30 } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'date parameter is required (YYYY-MM-DD)' });
    }

    const slots = await AppointmentRepository.getAvailableSlots(
      parseInt(doctorId),
      new Date(date),
      parseInt(duration)
    );

    res.json({ slots });
  } catch (error) {
    console.error('Error fetching available slots:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch available slots' });
  }
});

module.exports = router;

