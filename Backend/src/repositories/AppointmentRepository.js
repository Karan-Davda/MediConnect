const { query } = require('../db/connection');

class AppointmentRepository {
  /**
   * Find appointment by ID
   * @param {number} apptId
   * @returns {Promise<Object|null>}
   */
  static async findById(apptId) {
    const result = await query(
      `SELECT 
        a.*,
        d.doctor_id,
        u.first_name || ' ' || u.last_name AS doctor_name,
        u.email AS doctor_email,
        s.speciality_name
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.doctor_id
      JOIN users u ON d.user_id = u.user_id
      LEFT JOIN speciality s ON a.speciality_id = s.speciality_id
      WHERE a.appt_id = $1`,
      [apptId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get appointments by patient
   * @param {number} patientId
   * @param {Date|null} startDate
   * @param {Date|null} endDate
   * @param {boolean} upcomingOnly - If true, only return future appointments
   * @returns {Promise<Array>}
   */
  static async findByPatientId(patientId, startDate = null, endDate = null, upcomingOnly = false) {
    console.log(`[DEBUG] findByPatientId called with: patientId=${patientId}, upcomingOnly=${upcomingOnly}`);
    
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
        AND a.status IN ('scheduled', 'confirmed')
    `;
    const params = [patientId];

    // Filter out past appointments if upcomingOnly is true
    if (upcomingOnly) {
      queryStr += ` AND a.start_time >= NOW()`;
    }

    if (startDate) {
      queryStr += ` AND a.start_time >= $${params.length + 1}`;
      params.push(startDate);
    }
    if (endDate) {
      queryStr += ` AND a.start_time <= $${params.length + 1}`;
      params.push(endDate);
    }

    queryStr += ` ORDER BY a.start_time ASC`;

    console.log(`[DEBUG] Query: ${queryStr}`);
    console.log(`[DEBUG] Params:`, params);

    const result = await query(queryStr, params);
    console.log(`[DEBUG] Query returned ${result.rows.length} rows`);
    
    // Also check what appointments exist without status filter for debugging
    const allApptsResult = await query(
      `SELECT a.appt_id, a.patient_id, a.status, a.start_time 
       FROM appointments a 
       WHERE a.patient_id = $1 
       ORDER BY a.start_time DESC 
       LIMIT 5`,
      [patientId]
    );
    console.log(`[DEBUG] All appointments for patient ${patientId} (first 5):`, 
      allApptsResult.rows.map(r => ({ 
        appt_id: r.appt_id, 
        status: r.status, 
        start_time: r.start_time 
      }))
    );
    
    return result.rows;
  }

  /**
   * Get appointments by doctor
   * @param {number} doctorId
   * @param {Date|null} startDate
   * @param {Date|null} endDate
   * @param {boolean} upcomingOnly - If true, only return future appointments
   * @returns {Promise<Array>}
   */
  static async findByDoctorId(doctorId, startDate = null, endDate = null, upcomingOnly = false) {
    console.log(`[DEBUG] findByDoctorId called with: doctorId=${doctorId}, upcomingOnly=${upcomingOnly}`);
    
    let queryStr = `
      SELECT 
        a.*,
        p.patient_id,
        pu.first_name || ' ' || pu.last_name AS patient_name,
        pu.email AS patient_email,
        s.speciality_name
      FROM appointments a
      JOIN patients p ON a.patient_id = p.patient_id
      JOIN users pu ON p.user_id = pu.user_id
      LEFT JOIN speciality s ON a.speciality_id = s.speciality_id
      WHERE a.doctor_id = $1
        AND a.status IN ('scheduled', 'confirmed')
    `;
    const params = [doctorId];

    // Filter out past appointments if upcomingOnly is true
    if (upcomingOnly) {
      queryStr += ` AND a.start_time >= NOW()`;
    }

    if (startDate) {
      queryStr += ` AND a.start_time >= $${params.length + 1}`;
      params.push(startDate);
    }
    if (endDate) {
      queryStr += ` AND a.start_time <= $${params.length + 1}`;
      params.push(endDate);
    }

    queryStr += ` ORDER BY a.start_time ASC`;

    console.log(`[DEBUG] Query: ${queryStr}`);
    console.log(`[DEBUG] Params:`, params);

    const result = await query(queryStr, params);
    console.log(`[DEBUG] Query returned ${result.rows.length} rows`);
    
    return result.rows;
  }

  /**
   * Update appointment status
   * @param {number} apptId
   * @param {string} status
   * @param {number|null} cancelledBy
   * @param {string|null} cancellationReason
   * @returns {Promise<Object>}
   */
  static async updateStatus(apptId, status, cancelledBy = null, cancellationReason = null) {
    const updates = { status };
    if (status === 'cancelled') {
      updates.cancelled_at = new Date();
      updates.cancelled_by = cancelledBy;
      updates.cancellation_reason = cancellationReason;
    }

    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');

    const result = await query(
      `UPDATE appointments 
       SET ${setClause}, updated_at = CURRENT_TIMESTAMP
       WHERE appt_id = $1
       RETURNING *`,
      [apptId, ...Object.values(updates)]
    );

    return result.rows[0];
  }

  /**
   * Get available time slots for a doctor on a specific date
   * @param {number} doctorId
   * @param {Date} date
   * @param {number} durationMinutes - Duration of appointment in minutes
   * @returns {Promise<Object>} Object with slots array
   */
  static async getAvailableSlots(doctorId, date, durationMinutes = 30) {
    const dateStr = date.toISOString().split('T')[0];
    const now = new Date();
    const isToday = dateStr === now.toISOString().split('T')[0];
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

    console.log(`[DEBUG] getAvailableSlots: doctorId=${doctorId}, date=${dateStr}, duration=${durationMinutes}, isToday=${isToday}, currentTime=${currentTime}`);

    // Get availability slots for this doctor and date
    const availabilityResult = await query(
      `SELECT 
        da.start_time,
        da.end_time,
        da.availability_id,
        da.slot_date,
        da.status
      FROM doctor_availability da
      WHERE da.doctor_id = $1
        AND da.is_available = true
        AND da.status = 'open'
        AND (
          da.slot_date = $2::date
          OR (
            da.slot_date IS NULL
            AND da.day_of_week = EXTRACT(DOW FROM $2::date)
          )
        )
      ORDER BY da.slot_date NULLS LAST, da.start_time`,
      [doctorId, dateStr]
    );

    console.log(`[DEBUG] Found ${availabilityResult.rows.length} availability slots`);

    const slots = [];
    availabilityResult.rows.forEach(avail => {
      let availStartTime = avail.start_time;
      let availEndTime = avail.end_time;

      // Parse time strings (format: "HH:mm:ss")
      const [startHour, startMin] = availStartTime.split(':').map(Number);
      const [endHour, endMin] = availEndTime.split(':').map(Number);

      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      // Generate slots within this availability window
      let currentMinutes = startMinutes;
      while (currentMinutes + durationMinutes <= endMinutes) {
        const slotHour = Math.floor(currentMinutes / 60);
        const slotMin = currentMinutes % 60;
        const slotTime = `${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`;

        // Filter out past slots if the date is today
        if (isToday && availStartTime < currentTime) {
          currentMinutes += durationMinutes;
          continue; // Skip this slot
        }

        slots.push(slotTime);
        currentMinutes += durationMinutes;
      }
    });

    // Remove duplicates and sort
    const uniqueSlots = [...new Set(slots)].sort();

    console.log(`[DEBUG] Generated ${uniqueSlots.length} available time slots`);

    return { slots: uniqueSlots };
  }

  /**
   * Create a new appointment
   * @param {Object} appointmentData
   * @returns {Promise<Object>} Created appointment
   */
  static async create(appointmentData) {
    const {
      patient_id,
      doctor_id,
      speciality_id,
      start_time,
      end_time,
      duration_minutes,
      appointment_type,
      reason,
      notes,
      created_by
    } = appointmentData;

    console.log(`[DEBUG] Creating appointment:`, {
      patient_id,
      doctor_id,
      start_time,
      end_time
    });

    // Check for double booking
    const existingAppt = await query(
      `SELECT appt_id FROM appointments 
       WHERE doctor_id = $1 
         AND start_time = $2 
         AND status IN ('scheduled', 'confirmed')`,
      [doctor_id, start_time]
    );

    if (existingAppt.rows.length > 0) {
      throw new Error('This time slot is already booked');
    }

    // Extract appointment date from start_time
    const appointmentDate = new Date(start_time);
    const appointmentDateStr = appointmentDate.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Insert appointment
    const result = await query(
      `INSERT INTO appointments 
       (patient_id, doctor_id, speciality_id, start_time, end_time, 
        duration_minutes, appointment_type, reason, notes, status, created_by, appointment_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'scheduled', $10, $11)
       RETURNING *`,
      [
        patient_id,
        doctor_id,
        speciality_id,
        start_time,
        end_time,
        duration_minutes,
        appointment_type,
        reason,
        notes,
        created_by,
        appointmentDateStr
      ]
    );

    const appointment = result.rows[0];

    // Update the slot status to 'booked' in doctor_availability table
    // Extract date and time from appointment timestamps
    try {
      const apptStart = new Date(start_time);
      const apptEnd = new Date(end_time);
      
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

      console.log(`[DEBUG] Attempting to update slot status to 'booked' for doctor ${doctor_id}, date: ${slotDateStr}, time: ${apptStartTimeStr}-${apptEndTimeStr}`);

      // Update slot status to 'booked' - try exact match first
      let slotUpdateResult = await query(
        `UPDATE doctor_availability
         SET status = 'booked'
         WHERE doctor_id = $1
           AND slot_date = $2::date
           AND start_time::TIME = $3::TIME
           AND end_time::TIME = $4::TIME
           AND status = 'open'
         RETURNING availability_id, start_time, end_time, slot_date`,
        [doctor_id, slotDateStr, apptStartTimeStr, apptEndTimeStr]
      );

      if (slotUpdateResult.rows.length === 0) {
        // Try a more flexible match - where appointment time falls within slot time range
        console.log(`[DEBUG] No exact slot match found. Trying flexible match`);
        slotUpdateResult = await query(
          `UPDATE doctor_availability
           SET status = 'booked'
           WHERE doctor_id = $1
             AND slot_date = $2::date
             AND start_time::TIME <= $3::TIME
             AND end_time::TIME >= $4::TIME
             AND status = 'open'
           RETURNING availability_id, start_time, end_time, slot_date`,
          [doctor_id, slotDateStr, apptStartTimeStr, apptEndTimeStr]
        );
      }

      if (slotUpdateResult.rows.length > 0) {
        console.log(`[SUCCESS] Updated ${slotUpdateResult.rows.length} slot(s) to 'booked' status:`, 
          slotUpdateResult.rows.map(r => ({ id: r.availability_id, start: r.start_time, end: r.end_time, date: r.slot_date })));
      } else {
        console.warn(`[WARN] No matching open slot found to mark as booked for doctor ${doctor_id} on ${slotDateStr} at ${apptStartTimeStr}-${apptEndTimeStr}`);
      }
    } catch (slotUpdateError) {
      console.error('[ERROR] Could not update slot status to booked:', slotUpdateError.message);
      // Don't fail the appointment creation if slot update fails
    }

    return appointment;
  }

  /**
   * Reschedule an appointment
   * @param {number} apptId - Appointment ID to reschedule
   * @param {Date} newStartTime - New start time
   * @param {Date} newEndTime - New end time
   * @returns {Promise<Object>} Updated appointment
   */
  static async reschedule(apptId, newStartTime, newEndTime) {
    console.log(`[DEBUG] Rescheduling appointment ${apptId} to ${newStartTime}`);
    
    // Get current appointment details
    const currentAppt = await this.findById(apptId);
    if (!currentAppt) {
      throw new Error('Appointment not found');
    }

    console.log(`[DEBUG] Current appointment:`, {
      appt_id: currentAppt.appt_id,
      doctor_id: currentAppt.doctor_id,
      current_start: currentAppt.start_time,
      current_end: currentAppt.end_time
    });

    // Check if new time slot is available (exclude current appointment from check)
    const conflictingAppt = await query(
      `SELECT appt_id FROM appointments 
       WHERE doctor_id = $1 
         AND start_time = $2 
         AND status IN ('scheduled', 'confirmed')
         AND appt_id != $3`,  // Exclude current appointment
      [currentAppt.doctor_id, newStartTime, apptId]
    );

    if (conflictingAppt.rows.length > 0) {
      throw new Error('This time slot is already booked');
    }

    // Store old time for slot update
    const oldStartTime = new Date(currentAppt.start_time);
    const oldEndTime = new Date(currentAppt.end_time);

    // Extract appointment date from new start_time
    const appointmentDate = new Date(newStartTime);
    const appointmentDateStr = appointmentDate.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Update appointment with new time and date
    const result = await query(
      `UPDATE appointments 
       SET start_time = $1, 
           end_time = $2, 
           appointment_date = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE appt_id = $4
       RETURNING *`,
      [newStartTime, newEndTime, appointmentDateStr, apptId]
    );

    const updatedAppt = result.rows[0];
    console.log(`[DEBUG] Appointment updated successfully`);

    // Update slots: free old slot, book new slot
    try {
      // Free the old slot
      const oldSlotDateStr = oldStartTime.getFullYear() + '-' + 
                            String(oldStartTime.getMonth() + 1).padStart(2, '0') + '-' + 
                            String(oldStartTime.getDate()).padStart(2, '0');
      const oldStartTimeStr = String(oldStartTime.getHours()).padStart(2, '0') + ':' +
                             String(oldStartTime.getMinutes()).padStart(2, '0') + ':' +
                             String(oldStartTime.getSeconds()).padStart(2, '0');
      const oldEndTimeStr = String(oldEndTime.getHours()).padStart(2, '0') + ':' +
                           String(oldEndTime.getMinutes()).padStart(2, '0') + ':' +
                           String(oldEndTime.getSeconds()).padStart(2, '0');

      console.log(`[DEBUG] Freeing old slot: doctor ${currentAppt.doctor_id}, date ${oldSlotDateStr}, time ${oldStartTimeStr}-${oldEndTimeStr}`);

      const oldSlotUpdate = await query(
        `UPDATE doctor_availability
         SET status = 'open'
         WHERE doctor_id = $1
           AND slot_date = $2::date
           AND start_time::TIME = $3::TIME
           AND end_time::TIME = $4::TIME
           AND status = 'booked'`,
        [currentAppt.doctor_id, oldSlotDateStr, oldStartTimeStr, oldEndTimeStr]
      );

      if (oldSlotUpdate.rows.length > 0) {
        console.log(`[SUCCESS] Freed ${oldSlotUpdate.rows.length} old slot(s)`);
      } else {
        // Try flexible match for old slot
        const oldSlotFlexible = await query(
          `UPDATE doctor_availability
           SET status = 'open'
           WHERE doctor_id = $1
             AND slot_date = $2::date
             AND start_time::TIME <= $3::TIME
             AND end_time::TIME >= $4::TIME
             AND status = 'booked'`,
          [currentAppt.doctor_id, oldSlotDateStr, oldStartTimeStr, oldEndTimeStr]
        );
        if (oldSlotFlexible.rows.length > 0) {
          console.log(`[SUCCESS] Freed ${oldSlotFlexible.rows.length} old slot(s) (flexible match)`);
        }
      }

      // Book the new slot
      const newSlotDateStr = newStartTime.getFullYear() + '-' + 
                            String(newStartTime.getMonth() + 1).padStart(2, '0') + '-' + 
                            String(newStartTime.getDate()).padStart(2, '0');
      const newStartTimeStr = String(newStartTime.getHours()).padStart(2, '0') + ':' +
                             String(newStartTime.getMinutes()).padStart(2, '0') + ':' +
                             String(newStartTime.getSeconds()).padStart(2, '0');
      const newEndTimeStr = String(newEndTime.getHours()).padStart(2, '0') + ':' +
                           String(newEndTime.getMinutes()).padStart(2, '0') + ':' +
                           String(newEndTime.getSeconds()).padStart(2, '0');

      console.log(`[DEBUG] Booking new slot: doctor ${currentAppt.doctor_id}, date ${newSlotDateStr}, time ${newStartTimeStr}-${newEndTimeStr}`);

      let slotUpdateResult = await query(
        `UPDATE doctor_availability
         SET status = 'booked'
         WHERE doctor_id = $1
           AND slot_date = $2::date
           AND start_time::TIME = $3::TIME
           AND end_time::TIME = $4::TIME
           AND status = 'open'`,
        [currentAppt.doctor_id, newSlotDateStr, newStartTimeStr, newEndTimeStr]
      );

      if (slotUpdateResult.rows.length === 0) {
        // Try flexible match
        console.log(`[DEBUG] No exact match for new slot, trying flexible match`);
        slotUpdateResult = await query(
          `UPDATE doctor_availability
           SET status = 'booked'
           WHERE doctor_id = $1
             AND slot_date = $2::date
             AND start_time::TIME <= $3::TIME
             AND end_time::TIME >= $4::TIME
             AND status = 'open'`,
          [currentAppt.doctor_id, newSlotDateStr, newStartTimeStr, newEndTimeStr]
        );
      }

      if (slotUpdateResult.rows.length > 0) {
        console.log(`[SUCCESS] Booked ${slotUpdateResult.rows.length} new slot(s)`);
      } else {
        console.warn(`[WARN] No matching open slot found to book for rescheduled appointment`);
      }
    } catch (slotError) {
      console.error('[ERROR] Could not update slot status during reschedule:', slotError.message);
      // Don't fail the reschedule if slot update fails
    }

    return updatedAppt;
  }
}

module.exports = AppointmentRepository;
