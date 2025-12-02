const { query, transaction } = require('../db/connection');

class AppointmentRepository {
  /**
   * Check if appointment time slot is available (no double booking)
   * @param {number} doctorId
   * @param {Date} startTime
   * @param {Date} endTime
   * @param {number|null} excludeApptId - Appointment ID to exclude from check (for updates)
   * @returns {Promise<boolean>}
   */
  static async isTimeSlotAvailable(doctorId, startTime, endTime, excludeApptId = null) {
    const result = await query(
      `SELECT check_appointment_overlap($1, $2, $3, $4) as is_available`,
      [doctorId, startTime, endTime, excludeApptId]
    );
    return result.rows[0].is_available;
  }

  /**
   * Check if doctor is available (has schedule and not blocked)
   * @param {number} doctorId
   * @param {Date} appointmentTime
   * @returns {Promise<boolean>}
   */
  static async isDoctorAvailable(doctorId, appointmentTime) {
    const result = await query(
      `SELECT check_doctor_available($1, $2) as is_available`,
      [doctorId, appointmentTime]
    );
    return result.rows[0].is_available;
  }

  /**
   * Create a new appointment
   * @param {Object} appointmentData
   * @returns {Promise<Object>}
   */
  static async create(appointmentData) {
    const {
      patient_id,
      doctor_id,
      speciality_id,
      start_time,
      end_time,
      duration_minutes = 30,
      appointment_type = 'in_person',
      reason,
      notes,
      created_by
    } = appointmentData;

    // Validate time slot availability
    const isAvailable = await this.isTimeSlotAvailable(doctor_id, start_time, end_time);
    if (!isAvailable) {
      throw new Error('Time slot is not available - double booking prevented');
    }

    // Check doctor availability
    const doctorAvailable = await this.isDoctorAvailable(doctor_id, start_time);
    if (!doctorAvailable) {
      throw new Error('Doctor is not available at this time');
    }

    const result = await query(
      `INSERT INTO appointments (
        patient_id, doctor_id, speciality_id, start_time, end_time,
        duration_minutes, appointment_type, reason, notes, created_by, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'scheduled')
      RETURNING *`,
      [
        patient_id, doctor_id, speciality_id, start_time, end_time,
        duration_minutes, appointment_type, reason, notes, created_by
      ]
    );

    return result.rows[0];
  }

  /**
   * Get appointment by ID
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
        s.speciality_name,
        pu.first_name || ' ' || pu.last_name AS patient_name,
        pu.email AS patient_email
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.doctor_id
      JOIN users u ON d.user_id = u.user_id
      JOIN patients p ON a.patient_id = p.patient_id
      JOIN users pu ON p.user_id = pu.user_id
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
   * @returns {Promise<Array>}
   */
  static async findByPatientId(patientId, startDate = null, endDate = null) {
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
    const params = [patientId];

    if (startDate) {
      queryStr += ` AND a.start_time >= $${params.length + 1}`;
      params.push(startDate);
    }
    if (endDate) {
      queryStr += ` AND a.start_time <= $${params.length + 1}`;
      params.push(endDate);
    }

    queryStr += ` ORDER BY a.start_time DESC`;

    const result = await query(queryStr, params);
    return result.rows;
  }

  /**
   * Get appointments by doctor
   * @param {number} doctorId
   * @param {Date|null} startDate
   * @param {Date|null} endDate
   * @returns {Promise<Array>}
   */
  static async findByDoctorId(doctorId, startDate = null, endDate = null) {
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
    `;
    const params = [doctorId];

    if (startDate) {
      queryStr += ` AND a.start_time >= $${params.length + 1}`;
      params.push(startDate);
    }
    if (endDate) {
      queryStr += ` AND a.start_time <= $${params.length + 1}`;
      params.push(endDate);
    }

    queryStr += ` ORDER BY a.start_time ASC`;

    const result = await query(queryStr, params);
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
   * Update appointment
   * @param {number} apptId
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  static async update(apptId, updates) {
    // If time is being updated, check for conflicts
    if (updates.start_time || updates.end_time) {
      const appointment = await this.findById(apptId);
      if (!appointment) {
        throw new Error('Appointment not found');
      }

      const startTime = updates.start_time || new Date(appointment.start_time);
      const endTime = updates.end_time || new Date(appointment.end_time);

      const isAvailable = await this.isTimeSlotAvailable(
        appointment.doctor_id,
        startTime,
        endTime,
        apptId
      );

      if (!isAvailable) {
        throw new Error('Time slot is not available - double booking prevented');
      }
    }

    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      fields.push(`${key} = $${paramCount + 1}`);
      values.push(updates[key]);
      paramCount++;
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.unshift(apptId);

    const result = await query(
      `UPDATE appointments 
       SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE appt_id = $1
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Get available time slots for a doctor on a specific date
   * @param {number} doctorId
   * @param {Date} date
   * @param {number} durationMinutes
   * @returns {Promise<Array>}
   */
  static async getAvailableSlots(doctorId, date, durationMinutes = 30) {
    // Get doctor's availability schedule for the day
    const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday
    
    const availabilityResult = await query(
      `SELECT 
        da.start_time,
        da.end_time
      FROM doctor_availability da
      WHERE da.doctor_id = $1
        AND da.is_available = true
        AND da.day_of_week = $2
        AND (da.effective_from IS NULL OR da.effective_from <= $3::DATE)
        AND (da.effective_to IS NULL OR da.effective_to >= $3::DATE)`,
      [doctorId, dayOfWeek, date]
    );

    // Get existing appointments for the day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const appointmentsResult = await query(
      `SELECT start_time, end_time
       FROM appointments
       WHERE doctor_id = $1
         AND start_time >= $2
         AND start_time < $3
         AND status IN ('scheduled', 'confirmed')`,
      [doctorId, startOfDay, endOfDay]
    );

    // Get unavailability blocks
    const unavailabilityResult = await query(
      `SELECT start_time, end_time
       FROM doctor_unavailability
       WHERE doctor_id = $1
         AND start_time < $3
         AND end_time > $2`,
      [doctorId, startOfDay, endOfDay]
    );

    // Calculate available slots (simplified - returns available time ranges)
    // In a real implementation, you'd generate specific time slots
    return {
      availability: availabilityResult.rows,
      booked: appointmentsResult.rows,
      blocked: unavailabilityResult.rows
    };
  }

  /**
   * Create appointment notification record
   * @param {Object} notificationData
   * @returns {Promise<Object>}
   */
  static async createNotification(notificationData) {
    const {
      appt_id,
      notification_type,
      channel,
      status = 'pending'
    } = notificationData;

    const result = await query(
      `INSERT INTO appointment_notifications (
        appt_id, notification_type, channel, status
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [appt_id, notification_type, channel, status]
    );

    return result.rows[0];
  }

  /**
   * Update notification status
   * @param {number} notificationId
   * @param {string} status
   * @param {string|null} errorMessage
   * @returns {Promise<Object>}
   */
  static async updateNotificationStatus(notificationId, status, errorMessage = null) {
    const result = await query(
      `UPDATE appointment_notifications
       SET status = $1, sent_at = CASE WHEN $1 = 'sent' THEN CURRENT_TIMESTAMP ELSE sent_at END,
           error_message = $2, retry_count = retry_count + 1
       WHERE notification_id = $3
       RETURNING *`,
      [status, errorMessage, notificationId]
    );

    return result.rows[0] || null;
  }

  /**
   * Mark appointment confirmation as sent
   * @param {number} apptId
   * @returns {Promise<Object>}
   */
  static async markConfirmationSent(apptId) {
    const result = await query(
      `UPDATE appointments
       SET confirmation_sent = true, confirmation_sent_at = CURRENT_TIMESTAMP
       WHERE appt_id = $1
       RETURNING *`,
      [apptId]
    );

    return result.rows[0] || null;
  }

  /**
   * Mark appointment reminder as sent
   * @param {number} apptId
   * @returns {Promise<Object>}
   */
  static async markReminderSent(apptId) {
    const result = await query(
      `UPDATE appointments
       SET reminder_sent = true, reminder_sent_at = CURRENT_TIMESTAMP
       WHERE appt_id = $1
       RETURNING *`,
      [apptId]
    );

    return result.rows[0] || null;
  }
}

module.exports = AppointmentRepository;

