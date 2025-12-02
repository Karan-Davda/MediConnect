const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { logAccess, AUDIT_ACTIONS } = require('../middleware/auditLogger');
const {
  findNotificationsByPatientId,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  findNotificationById
} = require('../repositories/NotificationRepository');
const {
  findPatientById,
  findPatientByUserId,
  findMedicalRecordById
} = require('../repositories/MedicalRecordRepository');
const PatientRepository = require('../repositories/PatientRepository');
const { sendNotification } = require('../services/notificationService');

const router = express.Router();

/**
 * GET /api/notifications
 * Get all notifications for authenticated patient
 */
router.get('/', authenticate, async (req, res) => {
  try {
    // Only patients can view their notifications
    if (req.user.role !== 'patient') {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'Only patients can view notifications'
      });
    }

    // Find patient by user ID
    const patient = findPatientByUserId(req.user.userId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const options = {
      status: req.query.status, // 'unread' or 'read'
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    };

    const notifications = findNotificationsByPatientId(patient.id, options);

    logAccess(req, AUDIT_ACTIONS.VIEW, {
      resourceType: 'NOTIFICATION',
      details: `Viewed ${notifications.length} notifications`
    });

    res.json({
      count: notifications.length,
      notifications: notifications.map(n => n.toJSON())
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/notifications/unread-count
 * Get unread notification count for badge
 */
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    // Only patients can view their notification count
    if (req.user.role !== 'patient') {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'Only patients can view notification count'
      });
    }

    // Find patient by user ID
    const patient = findPatientByUserId(req.user.userId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const count = getUnreadCount(patient.id);

    res.json({ unreadCount: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Mark notification as read
 */
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    // Only patients can mark their notifications as read
    if (req.user.role !== 'patient') {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'Only patients can mark notifications as read'
      });
    }

    const notification = findNotificationById(req.params.id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Find patient by user ID
    const patient = findPatientByUserId(req.user.userId);
    if (!patient || notification.patientId !== patient.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = markAsRead(req.params.id);

    logAccess(req, AUDIT_ACTIONS.UPDATE, {
      resourceType: 'NOTIFICATION',
      resourceId: notification.id,
      details: 'Marked notification as read'
    });

    res.json({
      message: 'Notification marked as read',
      notification: updated.toJSON()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read for authenticated patient
 */
router.put('/read-all', authenticate, async (req, res) => {
  try {
    // Only patients can mark their notifications as read
    if (req.user.role !== 'patient') {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'Only patients can mark notifications as read'
      });
    }

    // Find patient by user ID
    const patient = findPatientByUserId(req.user.userId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const count = markAllAsRead(patient.id);

    logAccess(req, AUDIT_ACTIONS.UPDATE, {
      resourceType: 'NOTIFICATION',
      details: `Marked ${count} notifications as read`
    });

    res.json({
      message: `Marked ${count} notifications as read`,
      count
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/notifications/:recordId/notify
 * Manually trigger notification for a medical record (doctor/staff only)
 */
router.post('/:recordId/notify', authenticate, requireRole('doctor', 'clinic_staff', 'clinic_admin'), async (req, res) => {
  try {
    const { recordId } = req.params;
    const { preferences } = req.body; // Optional: override patient preferences

    // Find medical record
    const medicalRecord = findMedicalRecordById(recordId);
    if (!medicalRecord) {
      return res.status(404).json({ error: 'Medical record not found' });
    }

    // Check clinic access
    if (req.user.clinicId && medicalRecord.clinicId !== req.user.clinicId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Find patient - check both in-memory and database
    let patient = findPatientById(medicalRecord.patientId);
    
    // If not found in-memory, try database (patientId format: "patient_123")
    if (!patient && medicalRecord.patientId && medicalRecord.patientId.startsWith('patient_')) {
      const patientIdNum = parseInt(medicalRecord.patientId.replace('patient_', ''));
      if (!isNaN(patientIdNum)) {
        try {
          const dbPatient = await PatientRepository.findById(patientIdNum);
          if (dbPatient) {
            // Create patient object for notification service
            const { createPatient } = require('../repositories/MedicalRecordRepository');
            patient = createPatient({
              userId: dbPatient.user_id.toString(),
              firstName: dbPatient.first_name || '',
              lastName: dbPatient.last_name || '',
              dateOfBirth: dbPatient.dob || null,
              gender: dbPatient.gender || null,
              phoneNumber: dbPatient.phone_number || '',
              address: dbPatient.address ? (typeof dbPatient.address === 'string' ? JSON.parse(dbPatient.address) : dbPatient.address) : null,
              emergencyContact: dbPatient.emergency_contact ? (typeof dbPatient.emergency_contact === 'string' ? JSON.parse(dbPatient.emergency_contact) : dbPatient.emergency_contact) : null,
              insuranceInfo: null,
              allergies: dbPatient.allergies ? (typeof dbPatient.allergies === 'string' ? JSON.parse(dbPatient.allergies) : dbPatient.allergies) : [],
              medicalHistory: dbPatient.medical_history ? (typeof dbPatient.medical_history === 'string' ? JSON.parse(dbPatient.medical_history) : dbPatient.medical_history) : []
            });
            // Add email for notifications - CRITICAL for email to work
            patient.email = dbPatient.email;
            patient.id = medicalRecord.patientId; // Use the same ID format
            
            console.log('📋 Patient loaded from database for notification:', {
              patientId: patient.id,
              name: patient.fullName,
              email: patient.email,
              userId: patient.userId,
              dbPatientEmail: dbPatient.email
            });
          }
        } catch (dbError) {
          console.error('Database lookup failed:', dbError.message);
        }
      }
    }
    
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    // Ensure patient has email for email notifications
    if (!patient.email && patient.userId) {
      console.log('⚠️  Patient email missing, fetching from UserRepository...', {
        patientId: patient.id,
        userId: patient.userId
      });
      try {
        const UserRepository = require('../repositories/UserRepository');
        const user = await UserRepository.findById(parseInt(patient.userId));
        if (user && user.email) {
          patient.email = user.email;
          console.log('✅ Email fetched from UserRepository:', user.email);
        } else {
          console.warn('❌ User found but no email:', { userId: patient.userId, user });
        }
      } catch (error) {
        console.error('❌ Could not fetch patient email from user:', error.message);
      }
    }
    
    // Final check - log patient email status
    console.log('📧 Final patient email status before sending notification:', {
      patientId: patient.id,
      patientName: patient.fullName,
      hasEmail: !!patient.email,
      email: patient.email || 'MISSING'
    });

    // Get lab results from the record
    const labResults = medicalRecord.labResults || [];
    if (labResults.length === 0) {
      return res.status(400).json({ error: 'No lab results found in this medical record' });
    }

    // Send notification for each lab result
    const results = [];
    for (const labResult of labResults) {
      try {
        // Use provided preferences or default to email enabled
        const notificationPreferences = preferences || { emailReminders: true, smsReminders: false };
        
        const result = await sendNotification(patient, labResult, medicalRecord, notificationPreferences);
        results.push({
          labResult: labResult.testName,
          ...result
        });
      } catch (error) {
        results.push({
          labResult: labResult.testName,
          error: error.message
        });
      }
    }

    logAccess(req, AUDIT_ACTIONS.CREATE, {
      resourceType: 'NOTIFICATION',
      resourceId: recordId,
      details: `Manually triggered notifications for medical record ${recordId}`
    });

    res.json({
      message: 'Notifications sent',
      results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

