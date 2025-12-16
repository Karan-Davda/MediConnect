const Notification = require('../models/Notification');
const { query } = require('../db/connection');

/**
 * Create a new notification
 * @param {Object} notificationData
 * @returns {Promise<Notification>}
 */
async function createNotification(notificationData) {
  const {
    patientId,
    userId,
    type,
    title,
    message,
    medicalRecordId,
    appointmentId,
    prescriptionId,
    data,
    priority = 'normal'
  } = notificationData;

  // Extract patient_id number
  let patientIdNum = patientId;
  if (typeof patientIdNum === 'string' && patientIdNum.startsWith('patient_')) {
    patientIdNum = parseInt(patientIdNum.replace('patient_', ''));
  }

  // Extract user_id if provided
  let userIdNum = userId;
  if (userIdNum && typeof userIdNum === 'string') {
    userIdNum = parseInt(userIdNum);
  }

  // Extract medical_record_id
  let medicalRecordIdNum = medicalRecordId;
  if (medicalRecordIdNum) {
    if (typeof medicalRecordIdNum === 'string' && medicalRecordIdNum.startsWith('record_')) {
      medicalRecordIdNum = parseInt(medicalRecordIdNum.replace('record_', ''));
    }
  }

  // Extract appointment_id
  let appointmentIdNum = appointmentId;
  if (appointmentIdNum) {
    if (typeof appointmentIdNum === 'string' && appointmentIdNum.startsWith('appt_')) {
      appointmentIdNum = parseInt(appointmentIdNum.replace('appt_', ''));
    }
  }

  // Extract prescription_id
  let prescriptionIdNum = prescriptionId;
  if (prescriptionIdNum) {
    if (typeof prescriptionIdNum === 'string' && prescriptionIdNum.startsWith('prescription_')) {
      prescriptionIdNum = parseInt(prescriptionIdNum.replace('prescription_', ''));
    }
  }

  const result = await query(
    `INSERT INTO notifications (
      patient_id, user_id, type, title, message,
      medical_record_id, appointment_id, prescription_id, data, priority
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      patientIdNum,
      userIdNum || null,
      type,
      title,
      message,
      medicalRecordIdNum || null,
      appointmentIdNum || null,
      prescriptionIdNum || null,
      data ? JSON.stringify(data) : null,
      priority
    ]
  );

  return mapRowToNotification(result.rows[0]);
}

/**
 * Find notification by ID
 * @param {string|number} notificationId
 * @returns {Promise<Notification|null>}
 */
async function findNotificationById(notificationId) {
  let notificationIdNum = notificationId;
  if (typeof notificationIdNum === 'string' && notificationIdNum.startsWith('notification_')) {
    notificationIdNum = parseInt(notificationIdNum.replace('notification_', ''));
  }

  const result = await query(
    `SELECT * FROM notifications WHERE notification_id = $1`,
    [notificationIdNum]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapRowToNotification(result.rows[0]);
}

/**
 * Find all notifications for a patient
 * @param {string|number} patientId
 * @param {Object} options
 * @returns {Promise<Array<Notification>>}
 */
async function findNotificationsByPatientId(patientId, options = {}) {
  let patientIdNum = patientId;
  if (typeof patientIdNum === 'string' && patientIdNum.startsWith('patient_')) {
    patientIdNum = parseInt(patientIdNum.replace('patient_', ''));
  }

  let queryStr = `SELECT * FROM notifications WHERE patient_id = $1`;
  const params = [patientIdNum];
  let paramCount = 2;

  if (options.status) {
    queryStr += ` AND status = $${paramCount}`;
    params.push(options.status);
    paramCount++;
  }

  queryStr += ` ORDER BY created_at DESC`;

  if (options.limit) {
    queryStr += ` LIMIT $${paramCount}`;
    params.push(options.limit);
  }

  const result = await query(queryStr, params);
  return result.rows.map(row => mapRowToNotification(row));
}

/**
 * Get unread count for a patient
 * @param {string|number} patientId
 * @returns {Promise<number>}
 */
async function getUnreadCount(patientId) {
  let patientIdNum = patientId;
  if (typeof patientIdNum === 'string' && patientIdNum.startsWith('patient_')) {
    patientIdNum = parseInt(patientIdNum.replace('patient_', ''));
  }

  const result = await query(
    `SELECT COUNT(*) as count 
     FROM notifications 
     WHERE patient_id = $1 AND status = 'unread'`,
    [patientIdNum]
  );

  return parseInt(result.rows[0].count);
}

/**
 * Mark notification as read
 * @param {string|number} notificationId
 * @returns {Promise<Notification|null>}
 */
async function markAsRead(notificationId) {
  let notificationIdNum = notificationId;
  if (typeof notificationIdNum === 'string' && notificationIdNum.startsWith('notification_')) {
    notificationIdNum = parseInt(notificationIdNum.replace('notification_', ''));
  }

  const result = await query(
    `UPDATE notifications 
     SET status = 'read', read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE notification_id = $1 AND status = 'unread'
     RETURNING *`,
    [notificationIdNum]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapRowToNotification(result.rows[0]);
}

/**
 * Mark all notifications as read for a patient
 * @param {string|number} patientId
 * @returns {Promise<number>}
 */
async function markAllAsRead(patientId) {
  let patientIdNum = patientId;
  if (typeof patientIdNum === 'string' && patientIdNum.startsWith('patient_')) {
    patientIdNum = parseInt(patientIdNum.replace('patient_', ''));
  }

  const result = await query(
    `UPDATE notifications 
     SET status = 'read', read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE patient_id = $1 AND status = 'unread'
     RETURNING notification_id`,
    [patientIdNum]
  );

  return result.rows.length;
}

/**
 * Delete notification
 * @param {string|number} notificationId
 * @returns {Promise<boolean>}
 */
async function deleteNotification(notificationId) {
  let notificationIdNum = notificationId;
  if (typeof notificationIdNum === 'string' && notificationIdNum.startsWith('notification_')) {
    notificationIdNum = parseInt(notificationIdNum.replace('notification_', ''));
  }

  const result = await query(
    `DELETE FROM notifications WHERE notification_id = $1 RETURNING notification_id`,
    [notificationIdNum]
  );

  return result.rows.length > 0;
}

/**
 * Map database row to Notification model
 * @param {Object} row
 * @returns {Notification}
 */
function mapRowToNotification(row) {
  // Parse data JSONB
  let data = null;
  if (row.data) {
    try {
      data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    } catch (e) {
      data = row.data;
    }
  }

  // Extract labResult from data if type is test_result
  let labResult = null;
  if (row.type === 'test_result' && data && data.labResult) {
    labResult = data.labResult;
  }

  return new Notification({
    id: `notification_${row.notification_id}`,
    patientId: `patient_${row.patient_id}`,
    type: row.type,
    title: row.title,
    message: row.message,
    labResult: labResult,
    medicalRecordId: row.medical_record_id ? `record_${row.medical_record_id}` : null,
    status: row.status,
    createdAt: row.created_at,
    readAt: row.read_at
  });
}

module.exports = {
  createNotification,
  findNotificationById,
  findNotificationsByPatientId,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification
};
