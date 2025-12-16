const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const AppointmentRepository = require('../repositories/AppointmentRepository');
const PatientRepository = require('../repositories/PatientRepository');
const DoctorRepository = require('../repositories/DoctorRepository');
const UserRepository = require('../repositories/UserRepository');
const { logAccess, AUDIT_ACTIONS } = require('../middleware/auditLogger');
const { sendAppointmentConfirmationEmail } = require('../services/notificationService');
const { query } = require('../db/connection');
const router = express.Router();

// Test endpoint to verify route is registered
router.get('/test', (req, res) => {
  res.json({ message: 'Appointments route is working!' });
});

// Test availability route
router.get('/availability/test', (req, res) => {
  res.json({ message: 'Availability routes are working!' });
});

/**
 * Get all doctors for dropdown (used in Book Appointment)
 * GET /api/appointments/doctors
 */
router.get('/doctors', authenticate, async (req, res) => {
  try {
    console.log('[DEBUG] Fetching all doctors for dropdown');
    // Use default clinic_id = 1 for single-clinic mode
    const defaultClinicId = 1;
    const doctors = await DoctorRepository.getAll(defaultClinicId);
    
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

// ==================== AVAILABILITY MANAGEMENT ROUTES ====================
// NOTE: These must come BEFORE /:apptId route to avoid route conflicts

/**
 * Save slots for a specific date
 * POST /api/appointments/availability/:doctorId/save-slots-for-date
 * Body: { date: 'YYYY-MM-DD', day_of_week: 1-7 (ISO: Monday=1, Tuesday=2, ..., Sunday=7), slots: [{ fromTime, toTime, duration }] }
 */
router.post('/availability/:doctorId/save-slots-for-date', authenticate, requireRole('doctor'), async (req, res) => {
  console.log('[DEBUG] POST /availability/:doctorId/save-slots-for-date hit');
  console.log('[DEBUG] Params:', req.params);
  console.log('[DEBUG] Body:', req.body);
  try {
    const { doctorId } = req.params;
    const { date, day_of_week, slots } = req.body;

    if (!date || !slots || !Array.isArray(slots) || slots.length === 0) {
      return res.status(400).json({ error: 'date and slots array are required' });
    }

    const doctorIdNum = parseInt(doctorId, 10);
    if (isNaN(doctorIdNum)) {
      return res.status(400).json({ error: 'Invalid doctor ID' });
    }

    // Verify doctor exists and matches the logged-in user
    const doctor = await DoctorRepository.findByUserId(req.user.userId);
    if (!doctor || doctor.doctor_id !== doctorIdNum) {
      return res.status(403).json({ error: 'Access denied. You can only manage your own availability.' });
    }

    const { query } = require('../db/connection');
    let savedCount = 0;
    const errors = [];

    // Insert each slot
    for (const slot of slots) {
      try {
        const { fromTime, toTime, duration } = slot;
        
        if (!fromTime || !toTime) {
          errors.push(`Slot missing fromTime or toTime: ${JSON.stringify(slot)}`);
          continue;
        }

        // Insert slot - matching exact schema columns
        // Schema: availability_id (auto), doctor_id, day_of_week, start_time, end_time, 
        //         is_available, created_at (default), updated_at (default), slot_date, status
        const result = await query(
          `INSERT INTO doctor_availability (
            doctor_id, slot_date, day_of_week, start_time, end_time, 
            is_available, status
          ) VALUES ($1, $2::date, $3, $4::time, $5::time, $6, $7)
          RETURNING availability_id`,
          [doctorIdNum, date, day_of_week || null, fromTime, toTime, true, 'open']
        );

        if (result.rows.length > 0) {
          savedCount++;
        }
      } catch (slotError) {
        console.error(`Error saving slot ${JSON.stringify(slot)}:`, slotError);
        errors.push(`Failed to save slot ${slot.fromTime}-${slot.toTime}: ${slotError.message}`);
      }
    }

    if (savedCount === 0 && errors.length > 0) {
      return res.status(400).json({ 
        error: 'Failed to save any slots', 
        details: errors 
      });
    }

    res.json({
      message: `Successfully saved ${savedCount} slot(s) for ${date}`,
      saved: savedCount,
      total: slots.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error saving slots:', error);
    res.status(500).json({ error: error.message || 'Failed to save slots' });
  }
});

/**
 * Get slots by date range
 * GET /api/appointments/availability/:doctorId/by-date-range?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD&dayOfWeek=1,2,3 (ISO: Monday=1, Tuesday=2, ..., Sunday=7)
 */
router.get('/availability/:doctorId/by-date-range', authenticate, async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { fromDate, toDate, dayOfWeek } = req.query;

    if (!fromDate || !toDate) {
      return res.status(400).json({ error: 'fromDate and toDate are required (YYYY-MM-DD format)' });
    }

    const doctorIdNum = parseInt(doctorId, 10);
    if (isNaN(doctorIdNum)) {
      return res.status(400).json({ error: 'Invalid doctor ID' });
    }

    const { query } = require('../db/connection');
    
    let queryStr = `
      SELECT 
        availability_id,
        slot_date,
        start_time,
        end_time,
        status,
        day_of_week
      FROM doctor_availability
      WHERE doctor_id = $1
        AND slot_date >= $2::date
        AND slot_date <= $3::date
        AND is_available = true
    `;
    
    const params = [doctorIdNum, fromDate, toDate];
    let paramCount = 4;

    // Filter by day of week if provided
    if (dayOfWeek) {
      const dayNumbers = dayOfWeek.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));
      if (dayNumbers.length > 0) {
        queryStr += ` AND day_of_week = ANY($${paramCount}::int[])`;
        params.push(dayNumbers);
        paramCount++;
      }
    }

    queryStr += ` ORDER BY slot_date ASC, start_time ASC`;

    const result = await query(queryStr, params);

    res.json({
      count: result.rows.length,
      slots: result.rows.map(row => {
        // Calculate duration from start_time and end_time
        const start = new Date(`2000-01-01T${row.start_time}`);
        const end = new Date(`2000-01-01T${row.end_time}`);
        const durationMinutes = Math.round((end - start) / (1000 * 60));
        
        return {
          availability_id: row.availability_id,
          date: row.slot_date,
          start_time: row.start_time,
          end_time: row.end_time,
          duration_minutes: durationMinutes,
          status: row.status,
          day_of_week: row.day_of_week
        };
      })
    });
  } catch (error) {
    console.error('Error fetching slots by date range:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch slots' });
  }
});

/**
 * Delete a slot
 * DELETE /api/appointments/availability/:doctorId/slots?availability_id=123
 */
router.delete('/availability/:doctorId/slots', authenticate, requireRole('doctor'), async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { availability_id } = req.query;

    if (!availability_id) {
      return res.status(400).json({ error: 'availability_id is required' });
    }

    const doctorIdNum = parseInt(doctorId, 10);
    const availabilityIdNum = parseInt(availability_id, 10);

    if (isNaN(doctorIdNum) || isNaN(availabilityIdNum)) {
      return res.status(400).json({ error: 'Invalid doctor ID or availability ID' });
    }

    // Verify doctor exists and matches the logged-in user
    const doctor = await DoctorRepository.findByUserId(req.user.userId);
    if (!doctor || doctor.doctor_id !== doctorIdNum) {
      return res.status(403).json({ error: 'Access denied. You can only manage your own availability.' });
    }

    const { query } = require('../db/connection');
    
    // Check if slot is booked
    const slotCheck = await query(
      `SELECT status FROM doctor_availability 
       WHERE availability_id = $1 AND doctor_id = $2`,
      [availabilityIdNum, doctorIdNum]
    );

    if (slotCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Slot not found' });
    }

    if (slotCheck.rows[0].status === 'booked') {
      return res.status(400).json({ error: 'Cannot delete a booked slot. Please cancel the appointment first.' });
    }

    // Delete the slot
    const result = await query(
      `DELETE FROM doctor_availability 
       WHERE availability_id = $1 AND doctor_id = $2
       RETURNING availability_id`,
      [availabilityIdNum, doctorIdNum]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Slot not found or already deleted' });
    }

    res.json({
      message: 'Slot deleted successfully',
      availability_id: availabilityIdNum
    });
  } catch (error) {
    console.error('Error deleting slot:', error);
    res.status(500).json({ error: error.message || 'Failed to delete slot' });
  }
});

/**
 * Get appointments for a specific patient (for providers creating medical records)
 * GET /api/appointments/patient/:patientId
 * Query params: upcomingOnly (default: false - show all appointments)
 */
router.get('/patient/:patientId', authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;
    const { upcomingOnly } = req.query;
    
    console.log(`[APPOINTMENTS] GET /patient/:patientId - patientId param: ${patientId}`);
    
    // Extract patient_id number from "patient_123" format
    let patientIdNum = patientId;
    if (typeof patientIdNum === 'string' && patientIdNum.startsWith('patient_')) {
      patientIdNum = parseInt(patientIdNum.replace('patient_', ''));
    } else {
      patientIdNum = parseInt(patientIdNum);
    }
    
    console.log(`[APPOINTMENTS] Extracted patient_id: ${patientIdNum}`);
    
    if (isNaN(patientIdNum)) {
      return res.status(400).json({ error: 'Invalid patient ID' });
    }
    
    // Show all appointments by default (not just upcoming) for medical records
    const showUpcomingOnly = upcomingOnly === 'true';
    
    // For medical records, we want ALL appointments (including completed, cancelled, etc.)
    // So we'll query directly instead of using findByPatientId which filters by status
    const { query } = require('../db/connection');
    
    let queryStr = `
      SELECT 
        a.*,
        d.doctor_id,
        u.first_name || ' ' || u.last_name AS doctor_name,
        u.email AS doctor_email,
        s.speciality_name
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.doctor_id
      JOIN users u ON d.user_id = u.user_id
      LEFT JOIN speciality s ON a.speciality_id = s.speciality_id
      WHERE a.patient_id = $1
    `;
    const params = [patientIdNum];
    
    // Filter out past appointments if upcomingOnly is true
    if (showUpcomingOnly) {
      queryStr += ` AND a.start_time >= NOW()`;
    }
    
    queryStr += ` ORDER BY a.start_time DESC`; // Most recent first
    
    console.log(`[APPOINTMENTS] Query: ${queryStr}`);
    console.log(`[APPOINTMENTS] Params: [${params.join(', ')}]`);
    
    const result = await query(queryStr, params);
    const appointments = result.rows;
    
    console.log(`[APPOINTMENTS] Found ${appointments.length} appointments for patient_id ${patientIdNum}`);
    if (appointments.length > 0) {
      console.log(`[APPOINTMENTS] Sample appointment:`, {
        appt_id: appointments[0].appt_id,
        patient_id: appointments[0].patient_id,
        status: appointments[0].status,
        start_time: appointments[0].start_time
      });
    }
    
    // Format appointments for dropdown
    const formattedAppointments = appointments.map(apt => {
      const startTime = new Date(apt.start_time);
      const dateStr = startTime.toISOString().split('T')[0]; // YYYY-MM-DD
      const timeStr = startTime.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
      const dateFormatted = startTime.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      return {
        appt_id: apt.appt_id,
        appointment_date: dateStr, // For form submission
        start_time: apt.start_time,
        end_time: apt.end_time,
        doctor_name: apt.doctor_name || 'Unknown Doctor',
        speciality_name: apt.speciality_name || '',
        status: apt.status,
        display_text: `${dateFormatted} at ${timeStr} - ${apt.doctor_name || 'Unknown Doctor'}${apt.speciality_name ? ` (${apt.speciality_name})` : ''}`
      };
    });
    
    res.json({
      count: formattedAppointments.length,
      appointments: formattedAppointments
    });
  } catch (error) {
    console.error('[ERROR] Error fetching patient appointments:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch appointments' });
  }
});

/**
 * Get a single appointment by ID
 * GET /api/appointments/:apptId
 * NOTE: This must come after more specific routes like /available-slots/:doctorId and /availability/*
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

    // Send appointment confirmation email (don't block response if it fails)
    try {
      console.log('[APPOINTMENT_EMAIL] Starting email send process...');
      console.log('[APPOINTMENT_EMAIL] Patient object:', {
        patient_id: patient.patient_id,
        user_id: patient.user_id,
        email: patient.email,
        first_name: patient.first_name,
        last_name: patient.last_name
      });
      
      // Get user email if not in patient object
      if (!patient.email) {
        console.log('[APPOINTMENT_EMAIL] Patient email not found, fetching from UserRepository...');
        const user = await UserRepository.findById(patient.user_id);
        if (user) {
          patient.email = user.email;
          console.log('[APPOINTMENT_EMAIL] Found user email:', user.email);
        } else {
          console.warn('[APPOINTMENT_EMAIL] User not found for user_id:', patient.user_id);
        }
      }
      
      console.log('[APPOINTMENT_EMAIL] Calling sendAppointmentConfirmationEmail...');
      const emailResult = await sendAppointmentConfirmationEmail(appointment, patient, doctor);
      console.log('[APPOINTMENT_EMAIL] Email send result:', emailResult);
      
      if (!emailResult.success) {
        console.error('[APPOINTMENT_EMAIL] Email send failed:', emailResult.error);
      }
    } catch (emailError) {
      console.error('[ERROR] Failed to send appointment confirmation email:', emailError);
      console.error('[ERROR] Email error stack:', emailError.stack);
      // Don't fail the appointment booking if email fails
    }

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
