// Notification Repository - in-memory storage
const Notification = require('../models/Notification');

// In-memory storage
const notifications = [];
let notificationIdCounter = 1;

/**
 * Create a new notification
 * @param {Object} notificationData - Notification data
 * @returns {Notification} Created notification
 */
function createNotification(notificationData) {
  const notification = new Notification({
    id: `notification_${notificationIdCounter++}`,
    ...notificationData,
    createdAt: new Date()
  });
  notifications.push(notification);
  return notification;
}

/**
 * Find notification by ID
 * @param {string} notificationId - Notification ID
 * @returns {Notification|null} Notification or null
 */
function findNotificationById(notificationId) {
  return notifications.find(n => n.id === notificationId) || null;
}

/**
 * Find all notifications for a patient
 * @param {string} patientId - Patient ID
 * @param {Object} options - Query options (status filter, limit, etc.)
 * @returns {Notification[]} Array of notifications
 */
function findNotificationsByPatientId(patientId, options = {}) {
  let result = notifications.filter(n => n.patientId === patientId);
  
  if (options.status) {
    result = result.filter(n => n.status === options.status);
  }
  
  // Sort by date (newest first)
  result.sort((a, b) => {
    const dateA = new Date(a.createdAt);
    const dateB = new Date(b.createdAt);
    return dateB - dateA;
  });
  
  // Apply limit if specified
  if (options.limit) {
    result = result.slice(0, options.limit);
  }
  
  return result;
}

/**
 * Get unread count for a patient
 * @param {string} patientId - Patient ID
 * @returns {number} Count of unread notifications
 */
function getUnreadCount(patientId) {
  return notifications.filter(n => 
    n.patientId === patientId && n.status === 'unread'
  ).length;
}

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 * @returns {Notification|null} Updated notification or null
 */
function markAsRead(notificationId) {
  const notification = findNotificationById(notificationId);
  if (!notification) return null;
  
  notification.markAsRead();
  return notification;
}

/**
 * Mark all notifications as read for a patient
 * @param {string} patientId - Patient ID
 * @returns {number} Number of notifications marked as read
 */
function markAllAsRead(patientId) {
  const patientNotifications = notifications.filter(n => 
    n.patientId === patientId && n.status === 'unread'
  );
  
  patientNotifications.forEach(n => n.markAsRead());
  return patientNotifications.length;
}

/**
 * Delete notification
 * @param {string} notificationId - Notification ID
 * @returns {boolean} True if deleted, false if not found
 */
function deleteNotification(notificationId) {
  const index = notifications.findIndex(n => n.id === notificationId);
  if (index === -1) return false;
  
  notifications.splice(index, 1);
  return true;
}

module.exports = {
  createNotification,
  findNotificationById,
  findNotificationsByPatientId,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  // Export storage for testing/debugging (remove in production)
  _getStorage: () => ({ notifications })
};

