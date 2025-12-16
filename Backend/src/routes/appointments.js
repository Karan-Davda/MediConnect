const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const AppointmentRepository = require('../repositories/AppointmentRepository');
const PatientRepository = require('../repositories/PatientRepository');
const DoctorRepository = require('../repositories/DoctorRepository');
const { logAccess, AUDIT_ACTIONS } = require('../middleware/auditLogger');
const { query } = require('../db/connection');
const router = express.Router();

// Test endpoint to verify route is registered
router.get('/test', (req, res) => {
  res.json({ message: 'Appointments route is working!' });
});

/**
 * Get all doctors for dropdown (used in Book Appointment)
 * GET /api/appointments/doctors
 */
router.get('/doctors', authenticate, async (req, res) => {
  try {
    console.log('[DEBUG] Fetching all doctors for dropdown');
    const doctors = await DoctorRepository.getAll();
    
    console.log(`[DEBUG] Found ${doctors.length} doctors in database`);
    
    // Get clinic information if available
    const ClinicRepository = require('../repositories/ClinicRepository');
    const allClinics = await ClinicRepository.getAll();
    const clinicsMap = new Map(allClinics.map(c => [c.clinic_id, c.name]));
    
    // Format doctors for frontend dropdown
    const formattedDoctors = doctors.map(doctor => {
      const fullName = `${doctor.first_name || ''} ${doctor.last_name || ''}`.trim() || 'Unknown Doctor';
      const location = doctor.city && doctor.state 
        ? `${doctor.city}, ${doctor.state}` 
        : doctor.city || doctor.state || 'Location not specified';
      
      const clinicName = doctor.clinic_id && clinicsMap.has(doctor.clinic_id)
        ? clinicsMap.get(doctor.clinic_id)
        : 'Not specified';
      
      return {
        id: `doctor_${doctor.doctor_id}`,
        doctor_id: doctor.doctor_id,
        name: fullName,
        specialty: doctor.speciality_name || 'General Practice',
        location: location,
        clinic: clinicName,
        clinic_id: doctor.clinic_id || null,
        email: doctor.email || '',
        phone: doctor.phone_number || '',
        city: doctor.city || '',
        state: doctor.state || '',
        fees: doctor.fees || 120
      };
    });

    console.log(`[DEBUG] Formatted ${formattedDoctors.length} doctors for frontend`);

    res.json({
      count: formattedDoctors.length,
      doctors: formattedDoctors
    });
  } catch (error) {
    console.error('[ERROR] Error fetching doctors:', error);
    console.error('[ERROR] Stack:', error.stack);
    res.status(500).json({ error: error.message || 'Failed to fetch doctors' });
  }
});

/**
 * Get user's appointments (works for patient, doctor, and clinic_staff)
 * GET /api/appointments/my-appointments
 * Query params: startDate, endDate, upcomingOnly (default: true - only show future appointments)
 */
router.get('/my-appointments', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    const { startDate, endDate, upcomingOnly } = req.query;
    
    console.log(`[DEBUG] Fetching appointments for user ${userId}, role: ${userRole}`);
    
    // Default to showing only upcoming appointments unless explicitly requested
    const showUpcomingOnly = upcomingOnly === 'false' ? false : true;
    console.log(`[DEBUG] upcomingOnly filter: ${showUpcomingOnly}`);

    let appointments = [];

    if (userRole === 'patient') {
      // For patients, get their appointments
      const patient = await PatientRepository.findByUserId(userId);
      if (!patient) {
        console.log(`[DEBUG] Patient not found for user ${userId}`);
        return res.status(404).json({ error: 'Patient profile not found' });
      }

      console.log(`[DEBUG] Found patient: ${patient.patient_id} for user ${userId}`);

      appointments = await AppointmentRepository.findByPatientId(
        patient.patient_id,
        startDate ? new Date(startDate) : null,
        endDate ? new Date(endDate) : null,
        showUpcomingOnly
      );

      console.log(`[DEBUG] Found ${appointments.length} appointments for patient ${patient.patient_id}`);
    } else if (userRole === 'doctor') {
      // For doctors, get appointments where they are the doctor
      const doctor = await DoctorRepository.findByUserId(userId);
      if (!doctor) {
        console.log(`[DEBUG] Doctor not found for user ${userId}`);
        return res.status(404).json({ error: 'Doctor profile not found' });
      }

      console.log(`[DEBUG] Found doctor: ${doctor.doctor_id} for user ${userId}`);

      appointments = await AppointmentRepository.findByDoctorId(
        doctor.doctor_id,
        startDate ? new Date(startDate) : null,
        endDate ? new Date(endDate) : null,
        showUpcomingOnly
      );

      console.log(`[DEBUG] Found ${appointments.length} appointments for doctor ${doctor.doctor_id}`);
    } else if (userRole === 'clinic_staff' || userRole === 'clinic_admin') {
      // For clinic staff, get all appointments for their clinic
      // This would require a clinic_id-based query
      return res.status(400).json({ error: 'Clinic staff appointments endpoint not yet implemented. Please use doctor or patient endpoints.' });
    } else {
      return res.status(403).json({ error: 'Invalid role for accessing appointments' });
    }

    if (appointments.length > 0) {
      console.log(`[DEBUG] Sample appointment:`, {
        appt_id: appointments[0].appt_id,
        status: appointments[0].status,
        start_time: appointments[0].start_time,
        doctor_name: appointments[0].doctor_name
      });
    }

    res.json({ appointments });
  } catch (error) {
    console.error('[ERROR] Error fetching appointments:', error);
    console.error('[ERROR] Stack:', error.stack);
    res.status(500).json({ error: error.message || 'Failed to fetch appointments' });
  }
});

/**
 * Get available time slots for a doctor
 * GET /api/appointments/available-slots/:doctorId
 * NOTE: This must come before /:apptId route to avoid route conflicts
 */
router.get('/available-slots/:doctorId', authenticate, async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date, duration = 30 } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'date parameter is required (YYYY-MM-DD)' });
    }

    // Validate and parse doctorId
    const doctorIdNum = parseInt(doctorId, 10);
    if (isNaN(doctorIdNum)) {
      return res.status(400).json({ error: 'Invalid doctor ID' });
    }

    // Parse date
    const appointmentDate = new Date(date);
    if (isNaN(appointmentDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // Parse duration
    const durationNum = parseInt(duration, 10);
    if (isNaN(durationNum) || durationNum <= 0) {
      return res.status(400).json({ error: 'Invalid duration. Must be a positive number' });
    }

    console.log(`[DEBUG] Fetching slots for doctor ${doctorIdNum}, date: ${date}, duration: ${durationNum}`);

    const slots = await AppointmentRepository.getAvailableSlots(
      doctorIdNum,
      appointmentDate,
      durationNum
    );

    console.log(`[DEBUG] Found ${slots.slots.length} available slots for doctor ${doctorIdNum} on ${date}`);

    res.json({ slots: slots.slots });
  } catch (error) {
    console.error('[ERROR] Error fetching available slots:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch available slots' });
  }
});

/**
 * Get a single appointment by ID
 * GET /api/appointments/:apptId
 * NOTE: This must come after more specific routes like /available-slots/:doctorId
 */
router.get('/:apptId', authenticate, async (req, res) => {
  try {
    const { apptId } = req.params;
    const appointment = await AppointmentRepository.findById(parseInt(apptId));
    
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json({ appointment });
  } catch (error) {
    console.error('[ERROR] Error fetching appointment:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch appointment' });
  }
});

/**
 * Get a single appointment by ID
 * GET /api/appointments/:apptId
 * NOTE: This must come after more specific routes like /available-slots/:doctorId
 */
router.get('/:apptId', authenticate, async (req, res) => {
  try {
    const { apptId } = req.params;
    const appointment = await AppointmentRepository.findById(parseInt(apptId));
    
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json({ appointment });
  } catch (error) {
    console.error('[ERROR] Error fetching appointment:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch appointment' });
  }
});

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

    // Create appointment (this will check for double booking and update slot status)
    const appointment = await AppointmentRepository.create(appointmentData);

    // Log appointment creation
    logAccess(req, AUDIT_ACTIONS.CREATE, {
      resourceType: 'APPOINTMENT',
      resourceId: appointment.appt_id,
      details: `Booked appointment with doctor ${doctor_id} on ${startTime.toISOString()}`
    });

    res.status(201).json({
      message: 'Appointment booked successfully',
      appointment
    });
  } catch (error) {
    console.error('[ERROR] Appointment booking error:', error);
    res.status(400).json({ error: error.message || 'Failed to book appointment' });
  }
});

/**
 * Reschedule appointment
 * PUT /api/appointments/:apptId/reschedule
 */
router.put('/:apptId/reschedule', authenticate, async (req, res) => {
  try {
    const { apptId } = req.params;
    const { start_time, end_time, duration_minutes = 30 } = req.body;
    const userId = req.user.userId;
    const userRole = req.user.role;

    console.log(`[DEBUG] Reschedule request for appointment ${apptId} by user ${userId} (${userRole})`);

    const appointment = await AppointmentRepository.findById(parseInt(apptId));
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Check access: patient can reschedule their own, doctors/staff can reschedule their appointments
    const patient = await PatientRepository.findByUserId(userId);
    
    let canReschedule = false;
    if (userRole === 'patient' && patient && appointment.patient_id === patient.patient_id) {
      canReschedule = true;
    } else if (['doctor', 'clinic_staff', 'clinic_admin'].includes(userRole)) {
      const doctor = await DoctorRepository.findByUserId(userId);
      if (doctor && appointment.doctor_id === doctor.doctor_id) {
        canReschedule = true;
      }
    }

    if (!canReschedule) {
      return res.status(403).json({ error: 'You do not have permission to reschedule this appointment' });
    }

    // Only allow rescheduling of scheduled/confirmed appointments
    if (!['scheduled', 'confirmed'].includes(appointment.status)) {
      return res.status(400).json({ error: `Cannot reschedule appointment with status: ${appointment.status}` });
    }

    if (!start_time) {
      return res.status(400).json({ error: 'start_time is required' });
    }

    const newStartTime = new Date(start_time);
    const newEndTime = end_time ? new Date(end_time) : new Date(newStartTime.getTime() + duration_minutes * 60000);

    // Validate new time is in the future
    if (newStartTime < new Date()) {
      return res.status(400).json({ error: 'Cannot reschedule to a past date/time' });
    }

    // Reschedule the appointment
    const updatedAppointment = await AppointmentRepository.reschedule(
      parseInt(apptId),
      newStartTime,
      newEndTime
    );

    logAccess(req, AUDIT_ACTIONS.UPDATE, {
      resourceType: 'APPOINTMENT',
      resourceId: appointment.appt_id,
      details: `Appointment rescheduled from ${appointment.start_time} to ${newStartTime.toISOString()}`
    });

    res.json({
      message: 'Appointment rescheduled successfully',
      appointment: updatedAppointment
    });
  } catch (error) {
    console.error('[ERROR] Error rescheduling appointment:', error);
    console.error('[ERROR] Stack:', error.stack);
    res.status(400).json({ error: error.message || 'Failed to reschedule appointment' });
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
    const patient = await PatientRepository.findByUserId(userId);
    
    let canCancel = false;
    if (userRole === 'patient' && patient && appointment.patient_id === patient.patient_id) {
      canCancel = true;
    } else if (['doctor', 'clinic_staff', 'clinic_admin'].includes(userRole)) {
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

    // Update appointment status to 'cancelled' (don't delete the record)
    const updatedAppointment = await AppointmentRepository.updateStatus(
      parseInt(apptId),
      'cancelled',
      userId,
      reason || null
    );

    // Update the slot status back to 'open' in doctor_availability table
    try {
      const apptStart = new Date(appointment.start_time);
      const apptEnd = new Date(appointment.end_time);
      
      // Get date in YYYY-MM-DD format (use local date to match slot_date)
      const slotDateStr = apptStart.getFullYear() + '-' + 
                         String(apptStart.getMonth() + 1).padStart(2, '0') + '-' + 
                         String(apptStart.getDate()).padStart(2, '0');
      
      // Get time in HH:mm:ss format (use local time to match database TIME columns)
      const apptStartTimeStr = String(apptStart.getHours()).padStart(2, '0') + ':' +
                               String(apptStart.getMinutes()).padStart(2, '0') + ':' +
                               String(apptStart.getSeconds()).padStart(2, '0');
      const apptEndTimeStr = String(apptEnd.getHours()).padStart(2, '0') + ':' +
                             String(apptEnd.getMinutes()).padStart(2, '0') + ':' +
                             String(apptEnd.getSeconds()).padStart(2, '0');

      console.log(`[DEBUG] Attempting to update slot status to 'open' for doctor ${appointment.doctor_id}, date: ${slotDateStr}, time: ${apptStartTimeStr}-${apptEndTimeStr}`);
      console.log(`[DEBUG] Appointment timestamps - start: ${appointment.start_time}, end: ${appointment.end_time}`);

      // First, check what booked slots exist for debugging
      const checkSlots = await query(
        `SELECT availability_id, start_time, end_time, status, slot_date
         FROM doctor_availability
         WHERE doctor_id = $1
           AND slot_date = $2::date
           AND status = 'booked'`,
        [appointment.doctor_id, slotDateStr]
      );
      console.log(`[DEBUG] Found ${checkSlots.rows.length} booked slots for doctor ${appointment.doctor_id} on ${slotDateStr}:`, 
        checkSlots.rows.map(r => ({ 
          id: r.availability_id, 
          start: r.start_time, 
          end: r.end_time, 
          status: r.status,
          slot_date: r.slot_date 
        })));

      // Update slot status back to 'open' - try exact match first
      let slotUpdateResult = await query(
        `UPDATE doctor_availability
         SET status = 'open'
         WHERE doctor_id = $1
           AND slot_date = $2::date
           AND start_time::TIME = $3::TIME
           AND end_time::TIME = $4::TIME
           AND status = 'booked'
         RETURNING availability_id, start_time, end_time, slot_date`,
        [appointment.doctor_id, slotDateStr, apptStartTimeStr, apptEndTimeStr]
      );

      if (slotUpdateResult.rows.length === 0) {
        // Try a more flexible match - where appointment time falls within slot time range
        console.log(`[DEBUG] No exact slot match found. Trying flexible match for doctor ${appointment.doctor_id} on ${slotDateStr} from ${apptStartTimeStr} to ${apptEndTimeStr}`);
        slotUpdateResult = await query(
          `UPDATE doctor_availability
           SET status = 'open'
           WHERE doctor_id = $1
             AND slot_date = $2::date
             AND start_time::TIME <= $3::TIME
             AND end_time::TIME >= $4::TIME
             AND status = 'booked'
           RETURNING availability_id, start_time, end_time, slot_date`,
          [appointment.doctor_id, slotDateStr, apptStartTimeStr, apptEndTimeStr]
        );
      }

      if (slotUpdateResult.rows.length > 0) {
        console.log(`[SUCCESS] Updated ${slotUpdateResult.rows.length} slot(s) back to 'open' status after cancellation:`, 
          slotUpdateResult.rows.map(r => ({ id: r.availability_id, start: r.start_time, end: r.end_time, date: r.slot_date })));
      } else {
        console.warn(`[WARN] No matching booked slot found to update for cancelled appointment. Doctor: ${appointment.doctor_id}, Date: ${slotDateStr}, Time: ${apptStartTimeStr}-${apptEndTimeStr}`);
        console.warn(`[WARN] Available booked slots were:`, checkSlots.rows.map(r => `${r.start_time}-${r.end_time}`));
      }
    } catch (slotUpdateError) {
      console.error('[ERROR] Could not update slot status to open after cancellation:', slotUpdateError.message);
      console.error('[ERROR] Stack:', slotUpdateError.stack);
      // Don't fail the cancellation if slot update fails
    }

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

module.exports = router;
