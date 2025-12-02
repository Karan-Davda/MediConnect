const express = require('express');
const path = require('path');
const { authenticate, requireRole } = require('../middleware/auth');
const { PERMISSIONS, hasPermission } = require('../models/Role');
const { logAccess, AUDIT_ACTIONS } = require('../middleware/auditLogger');
const upload = require('../middleware/upload');
const {
  createPatient,
  findPatientById,
  findPatientByUserId,
  findAllPatients,
  updatePatient,
  createMedicalRecord,
  findMedicalRecordById,
  findMedicalRecordsByPatientId,
  findAllMedicalRecords,
  updateMedicalRecord,
  deleteMedicalRecord,
  getPatientMedicalHistory
} = require('../repositories/MedicalRecordRepository');
const PatientRepository = require('../repositories/PatientRepository');
const { sendNotification } = require('../services/notificationService');

const router = express.Router();

// ============================================
// MIDDLEWARE: Check if user can manage medical records
// ============================================
function canManageMedicalRecords(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Allow: Doctors, Clinic Staff, Clinic Admins
  const allowedRoles = ['doctor', 'clinic_staff', 'clinic_admin'];
  if (allowedRoles.includes(req.user.role)) {
    return next();
  }

  // Check permissions as fallback
  if (hasPermission(req.user.role, PERMISSIONS.EDIT_PATIENT_RECORDS)) {
    return next();
  }

  return res.status(403).json({ 
    error: 'Insufficient permissions',
    message: 'Only doctors, clinic staff, and clinic administrators can manage medical records'
  });
}

function canViewMedicalRecords(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Allow: Doctors, Clinic Staff, Clinic Admins, Patients (own records)
  const allowedRoles = ['doctor', 'clinic_staff', 'clinic_admin'];
  if (allowedRoles.includes(req.user.role)) {
    return next();
  }

  // Patients can view their own records
  if (req.user.role === 'patient') {
    return next();
  }

  // Check permissions as fallback
  if (hasPermission(req.user.role, PERMISSIONS.VIEW_PATIENT_RECORDS) || 
      hasPermission(req.user.role, PERMISSIONS.VIEW_OWN_MEDICAL_RECORDS)) {
    return next();
  }

  return res.status(403).json({ 
    error: 'Insufficient permissions',
    message: 'You do not have permission to view medical records'
  });
}

// ============================================
// PATIENT ROUTES
// ============================================

/**
 * POST /api/medical-records/patients
 * Create a new patient
 */
router.post('/patients', authenticate, canManageMedicalRecords, async (req, res) => {
  try {
    const patientData = req.body;
    
    // Validate required fields
    if (!patientData.firstName || !patientData.lastName) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['firstName', 'lastName']
      });
    }

    // Check if patient already exists by userId
    if (patientData.userId) {
      const existing = findPatientByUserId(patientData.userId);
      if (existing) {
        return res.status(400).json({ error: 'Patient with this user ID already exists' });
      }
    }

    const patient = createPatient(patientData);

    logAccess(req, AUDIT_ACTIONS.CREATE, {
      resourceType: 'PATIENT',
      resourceId: patient.id,
      details: `Created patient: ${patient.fullName}`
    });

    res.status(201).json({
      message: 'Patient created successfully',
      patient: patient.toJSON()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/medical-records/patients
 * Get all patients from database (with email) for dropdowns
 */
router.get('/patients', authenticate, canViewMedicalRecords, async (req, res) => {
  try {
    // First, try to get from database
    try {
      const dbPatients = await PatientRepository.getAll();
      
      // Format patients for frontend: include email and use patient_id as id
      const formattedPatients = dbPatients.map(p => ({
        id: `patient_${p.patient_id}`, // Use consistent ID format
        patient_id: p.patient_id, // Keep database ID
        userId: p.user_id.toString(),
        firstName: p.first_name || '',
        lastName: p.last_name || '',
        fullName: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown',
        email: p.email || '',
        phoneNumber: p.phone_number || '',
        dateOfBirth: p.dob || null,
        gender: p.gender || null
      }));

    logAccess(req, AUDIT_ACTIONS.VIEW, {
      resourceType: 'PATIENT',
        details: `Viewed ${formattedPatients.length} patients from database`
    });

      return res.json({
        count: formattedPatients.length,
        patients: formattedPatients
      });
    } catch (dbError) {
      // Database query failed - return empty list instead of fallback to static data
      console.error('Database query failed:', dbError.message);
      
      logAccess(req, AUDIT_ACTIONS.VIEW, {
        resourceType: 'PATIENT',
        details: 'Failed to load patients from database'
      });

      // Return empty list - no fallback to static patients
    res.json({
        count: 0,
        patients: []
    });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/medical-records/patients/:id
 * Get patient by ID
 */
router.get('/patients/:id', authenticate, canViewMedicalRecords, async (req, res) => {
  try {
    const patient = findPatientById(req.params.id);

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Patients can only view their own records
    if (req.user.role === 'patient') {
      const patientUser = findPatientByUserId(req.user.userId);
      if (!patientUser || patientUser.id !== patient.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    logAccess(req, AUDIT_ACTIONS.VIEW, {
      resourceType: 'PATIENT',
      resourceId: patient.id
    });

    res.json(patient.toJSON());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/medical-records/patients/:id
 * Update patient information
 */
router.put('/patients/:id', authenticate, canManageMedicalRecords, async (req, res) => {
  try {
    const patient = updatePatient(req.params.id, req.body);

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    logAccess(req, AUDIT_ACTIONS.UPDATE, {
      resourceType: 'PATIENT',
      resourceId: patient.id,
      details: 'Updated patient information'
    });

    res.json({
      message: 'Patient updated successfully',
      patient: patient.toJSON()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// MEDICAL RECORD ROUTES
// ============================================

/**
 * POST /api/medical-records
 * Create a new medical record
 */
router.post('/', authenticate, canManageMedicalRecords, async (req, res) => {
  try {
    const recordData = req.body;

    // Validate required fields
    if (!recordData.patientId) {
      return res.status(400).json({ error: 'patientId is required' });
    }

    // Find patient - check both in-memory and database
    let patient = findPatientById(recordData.patientId);
    
    // If not found in-memory, try database (patientId format: "patient_123")
    if (!patient && recordData.patientId.startsWith('patient_')) {
      const patientIdNum = parseInt(recordData.patientId.replace('patient_', ''));
      if (!isNaN(patientIdNum)) {
        try {
          const dbPatient = await PatientRepository.findById(patientIdNum);
          if (dbPatient) {
            // Create patient in in-memory storage for notifications
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
            // Add email for notifications - CRITICAL for email notifications to work
            patient.email = dbPatient.email;
            // Update ID to match the format used by frontend
            patient.id = recordData.patientId;
            
            console.log('📋 Patient synced from database for medical record:', {
              patientId: patient.id,
              name: patient.fullName,
              email: patient.email || 'MISSING',
              userId: patient.userId,
              dbPatientHasEmail: !!dbPatient.email
            });
            
            // If email is still missing, try to get from UserRepository
            if (!patient.email && patient.userId) {
              console.log('⚠️  Patient email missing, fetching from UserRepository...');
              try {
                const UserRepository = require('../repositories/UserRepository');
                const user = await UserRepository.findById(parseInt(patient.userId));
                if (user && user.email) {
                  patient.email = user.email;
                  console.log('✅ Email fetched from UserRepository:', user.email);
                } else {
                  console.warn('❌ User found but no email in UserRepository');
                }
              } catch (error) {
                console.error('❌ Could not fetch patient email from user:', error.message);
              }
            }
            
            if (!patient.email) {
              console.error('❌ CRITICAL: Patient email is still missing after all attempts!', {
                patientId: patient.id,
                userId: patient.userId
              });
            }
          }
        } catch (dbError) {
          console.warn('Database lookup failed:', dbError.message);
        }
      }
    }
    
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Add provider information from authenticated user
    recordData.providerId = req.user.userId;
    recordData.providerName = req.user.name || 'Unknown Provider';
    recordData.clinicId = req.user.clinicId || null;
    recordData.createdBy = req.user.userId;
    recordData.updatedBy = req.user.userId;

    const record = createMedicalRecord(recordData);

    logAccess(req, AUDIT_ACTIONS.CREATE, {
      resourceType: 'MEDICAL_RECORD',
      resourceId: record.id,
      details: `Created medical record for patient: ${patient.fullName}`
    });

    // Check for critical/abnormal lab results and trigger automatic notifications
    const labResults = record.labResults || [];
    const criticalOrAbnormalResults = labResults.filter(lr => 
      lr.status === 'critical' || lr.status === 'abnormal'
    );

    if (criticalOrAbnormalResults.length > 0) {
      // Get notification preferences from request body or use defaults
      const preferences = req.body.notificationPreferences || {
        emailReminders: true,
        smsReminders: false
      };

      // Send notifications asynchronously (don't block the response)
      Promise.all(
        criticalOrAbnormalResults.map(labResult =>
          sendNotification(patient, labResult, record, preferences).catch(error => {
            console.error(`Failed to send notification for lab result ${labResult.testName}:`, error);
            // Don't throw - we still want to return success for the record creation
          })
        )
      ).catch(error => {
        console.error('Error sending notifications:', error);
      });
    }

    res.status(201).json({
      message: 'Medical record added successfully',
      record: record.toJSON()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/medical-records
 * Get all medical records (with optional filters)
 */
router.get('/', authenticate, canViewMedicalRecords, async (req, res) => {
  try {
    const filters = {
      patientId: req.query.patientId,
      providerId: req.query.providerId,
      clinicId: req.query.clinicId || (req.user.role === 'patient' ? null : req.user.clinicId),
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      visitType: req.query.visitType
    };

    // Patients can only view their own records
    if (req.user.role === 'patient') {
      const patient = findPatientByUserId(req.user.userId);
      if (patient) {
        filters.patientId = patient.id;
      } else {
        return res.json({ count: 0, records: [] });
      }
    }

    const records = findAllMedicalRecords(filters);

    logAccess(req, AUDIT_ACTIONS.VIEW, {
      resourceType: 'MEDICAL_RECORD',
      details: `Viewed ${records.length} medical records`
    });

    res.json({
      count: records.length,
      records: records.map(r => r.toJSON())
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/medical-records/:id
 * Get medical record by ID
 */
router.get('/:id', authenticate, canViewMedicalRecords, async (req, res) => {
  try {
    const record = findMedicalRecordById(req.params.id);

    if (!record) {
      return res.status(404).json({ error: 'Medical record not found' });
    }

    // Patients can only view their own records
    if (req.user.role === 'patient') {
      const patient = findPatientByUserId(req.user.userId);
      if (!patient || record.patientId !== patient.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Clinic staff can only view records from their clinic
    if (req.user.role === 'clinic_staff' || req.user.role === 'doctor') {
      if (req.user.clinicId && record.clinicId !== req.user.clinicId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    logAccess(req, AUDIT_ACTIONS.VIEW, {
      resourceType: 'MEDICAL_RECORD',
      resourceId: record.id
    });

    res.json(record.toJSON());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/medical-records/patient/:patientId
 * Get all medical records for a specific patient
 */
router.get('/patient/:patientId', authenticate, canViewMedicalRecords, async (req, res) => {
  try {
    const { patientId } = req.params;
    const options = {
      sortOrder: req.query.sortOrder || 'desc',
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    };

    // Patients can only view their own records
    if (req.user.role === 'patient') {
      const patient = findPatientByUserId(req.user.userId);
      if (!patient || patient.id !== patientId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const records = findMedicalRecordsByPatientId(patientId, options);

    logAccess(req, AUDIT_ACTIONS.VIEW, {
      resourceType: 'MEDICAL_RECORD',
      resourceId: patientId,
      details: `Viewed ${records.length} records for patient`
    });

    res.json({
      patientId,
      count: records.length,
      records: records.map(r => r.toJSON())
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/medical-records/:id
 * Update medical record
 */
router.put('/:id', authenticate, canManageMedicalRecords, async (req, res) => {
  try {
    const record = findMedicalRecordById(req.params.id);

    if (!record) {
      return res.status(404).json({ error: 'Medical record not found' });
    }

    // Check clinic access
    if (req.user.clinicId && record.clinicId !== req.user.clinicId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Add updater information
    req.body.updatedBy = req.user.userId;

    const updatedRecord = updateMedicalRecord(req.params.id, req.body);

    logAccess(req, AUDIT_ACTIONS.UPDATE, {
      resourceType: 'MEDICAL_RECORD',
      resourceId: updatedRecord.id,
      details: 'Updated medical record'
    });

    // Check for critical/abnormal lab results and trigger automatic notifications
    const labResults = updatedRecord.labResults || [];
    const criticalOrAbnormalResults = labResults.filter(lr => 
      lr.status === 'critical' || lr.status === 'abnormal'
    );

    if (criticalOrAbnormalResults.length > 0) {
      // Find patient for notification - check both in-memory and database
      let patient = findPatientById(updatedRecord.patientId);
      
      // If not found in-memory, try database
      if (!patient && updatedRecord.patientId && updatedRecord.patientId.startsWith('patient_')) {
        const patientIdNum = parseInt(updatedRecord.patientId.replace('patient_', ''));
        if (!isNaN(patientIdNum)) {
          try {
            const dbPatient = await PatientRepository.findById(patientIdNum);
            if (dbPatient) {
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
              patient.email = dbPatient.email;
              patient.id = updatedRecord.patientId;
            }
          } catch (dbError) {
            console.warn('Database lookup failed:', dbError.message);
          }
        }
      }
      
      // Ensure patient has email
      if (patient && !patient.email && patient.userId) {
        try {
          const UserRepository = require('../repositories/UserRepository');
          const user = await UserRepository.findById(parseInt(patient.userId));
          if (user && user.email) {
            patient.email = user.email;
          }
        } catch (error) {
          console.warn('Could not fetch patient email from user:', error.message);
        }
      }
      
      if (patient) {
        // Get notification preferences from request body or use defaults
        const preferences = req.body.notificationPreferences || {
          emailReminders: true,
          smsReminders: false
        };

        // Send notifications asynchronously (don't block the response)
        Promise.all(
          criticalOrAbnormalResults.map(labResult =>
            sendNotification(patient, labResult, updatedRecord, preferences).catch(error => {
              console.error(`Failed to send notification for lab result ${labResult.testName}:`, error);
              // Don't throw - we still want to return success for the record update
            })
          )
        ).catch(error => {
          console.error('Error sending notifications:', error);
        });
      }
    }

    res.json({
      message: 'Medical record updated successfully',
      record: updatedRecord.toJSON()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/medical-records/:id
 * Delete medical record (soft delete - mark as deleted)
 */
router.delete('/:id', authenticate, requireRole('clinic_admin'), async (req, res) => {
  try {
    const record = findMedicalRecordById(req.params.id);

    if (!record) {
      return res.status(404).json({ error: 'Medical record not found' });
    }

    // Check clinic access
    if (req.user.clinicId && record.clinicId !== req.user.clinicId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const deleted = deleteMedicalRecord(req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: 'Medical record not found' });
    }

    logAccess(req, AUDIT_ACTIONS.DELETE, {
      resourceType: 'MEDICAL_RECORD',
      resourceId: req.params.id,
      details: 'Deleted medical record'
    });

    res.json({
      message: 'Medical record deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/medical-records/patient/:patientId/history
 * Get comprehensive medical history for a patient
 */
router.get('/patient/:patientId/history', authenticate, canViewMedicalRecords, async (req, res) => {
  try {
    const { patientId } = req.params;

    // Patients can only view their own history
    if (req.user.role === 'patient') {
      const patient = findPatientByUserId(req.user.userId);
      if (!patient || patient.id !== patientId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const history = getPatientMedicalHistory(patientId);

    if (!history.patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    logAccess(req, AUDIT_ACTIONS.VIEW, {
      resourceType: 'MEDICAL_HISTORY',
      resourceId: patientId,
      details: 'Viewed patient medical history'
    });

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SCAN ATTACHMENT ROUTES
// ============================================

/**
 * POST /api/medical-records/:recordId/attachments
 * Add scan attachment to a medical record (with file upload)
 */
// Error handler for multer
const handleMulterError = (err, req, res, next) => {
  if (err) {
    console.error('Multer error:', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'File too large',
        message: 'File size must be less than 10MB'
      });
    }
    return res.status(400).json({ 
      error: 'File upload error',
      message: err.message || 'Failed to upload file'
    });
  }
  next();
};

router.post('/:recordId/attachments', authenticate, canManageMedicalRecords, upload.single('scanFile'), handleMulterError, async (req, res) => {
  try {
    const { recordId } = req.params;
    const { name, type } = req.body;

    console.log('Upload request received:', {
      recordId,
      name,
      type,
      hasFile: !!req.file,
      fileInfo: req.file ? {
        originalname: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype
      } : null
    });

    // Validate required fields
    if (!name || !type) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['name', 'type']
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No file uploaded',
        message: 'Please select an image file to upload'
      });
    }

    const record = findMedicalRecordById(recordId);
    if (!record) {
      // Delete uploaded file if record not found
      if (req.file) {
        const fs = require('fs');
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ error: 'Medical record not found' });
    }

    // Check clinic access
    if (req.user.clinicId && record.clinicId !== req.user.clinicId) {
      // Delete uploaded file if access denied
      if (req.file) {
        const fs = require('fs');
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({ error: 'Access denied' });
    }

    // Create URL for the uploaded file
    const fileUrl = `/api/medical-records/assets/${req.file.filename}`;

    // Create attachment object
    const attachment = {
      id: `attachment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      type,
      url: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      date: new Date().toISOString()
    };

    // Add attachment to record
    if (!record.attachments) {
      record.attachments = [];
    }
    record.attachments.push(attachment);
    record.updatedAt = new Date();
    record.updatedBy = req.user.userId;

    logAccess(req, AUDIT_ACTIONS.CREATE, {
      resourceType: 'SCAN_ATTACHMENT',
      resourceId: attachment.id,
      details: `Added scan attachment: ${name} to medical record ${recordId}`
    });

    res.status(201).json({
      message: 'Scan attachment added successfully',
      attachment
    });
  } catch (error) {
    // Delete uploaded file if there's an error
    if (req.file) {
      const fs = require('fs');
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/medical-records/assets/:filename
 * Serve uploaded scan images
 */
router.get('/assets/:filename', authenticate, (req, res) => {
  try {
    const { filename } = req.params;
    const path = require('path');
    const fs = require('fs');
    
    const filePath = path.join(__dirname, '../../Assets', filename);
    
    console.log('Serving file:', filePath);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error('File not found:', filePath);
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Set proper content type
    const ext = path.extname(filename).toLowerCase();
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.dcm': 'application/dicom',
      '.dicom': 'application/dicom'
    };
    
    res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
    
    // Send file
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('Error serving file:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/medical-records/:recordId/attachments
 * Get all attachments for a medical record
 */
router.get('/:recordId/attachments', authenticate, canViewMedicalRecords, async (req, res) => {
  try {
    const { recordId } = req.params;

    const record = findMedicalRecordById(recordId);
    if (!record) {
      return res.status(404).json({ error: 'Medical record not found' });
    }

    // Patients can only view their own records
    if (req.user.role === 'patient') {
      const patient = findPatientByUserId(req.user.userId);
      if (!patient || record.patientId !== patient.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Clinic staff can only view records from their clinic
    if (req.user.role === 'clinic_staff' || req.user.role === 'doctor') {
      if (req.user.clinicId && record.clinicId !== req.user.clinicId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    logAccess(req, AUDIT_ACTIONS.VIEW, {
      resourceType: 'SCAN_ATTACHMENT',
      resourceId: recordId,
      details: 'Viewed scan attachments'
    });

    res.json({
      recordId,
      count: record.attachments?.length || 0,
      attachments: record.attachments || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/medical-records/:recordId/attachments/:attachmentId
 * Delete a scan attachment from a medical record
 */
router.delete('/:recordId/attachments/:attachmentId', authenticate, canManageMedicalRecords, async (req, res) => {
  try {
    const { recordId, attachmentId } = req.params;

    const record = findMedicalRecordById(recordId);
    if (!record) {
      return res.status(404).json({ error: 'Medical record not found' });
    }

    // Check clinic access
    if (req.user.clinicId && record.clinicId !== req.user.clinicId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!record.attachments || record.attachments.length === 0) {
      return res.status(404).json({ error: 'No attachments found' });
    }

    const attachmentIndex = record.attachments.findIndex(a => a.id === attachmentId);
    if (attachmentIndex === -1) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const deletedAttachment = record.attachments[attachmentIndex];
    record.attachments.splice(attachmentIndex, 1);
    record.updatedAt = new Date();
    record.updatedBy = req.user.userId;

    logAccess(req, AUDIT_ACTIONS.DELETE, {
      resourceType: 'SCAN_ATTACHMENT',
      resourceId: attachmentId,
      details: `Deleted scan attachment: ${deletedAttachment.name} from medical record ${recordId}`
    });

    res.json({
      message: 'Scan attachment deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/medical-records/:recordId/attachments/:attachmentId/annotations
 * Get annotations for a specific scan attachment
 */
router.get('/:recordId/attachments/:attachmentId/annotations', authenticate, canViewMedicalRecords, async (req, res) => {
  try {
    const { recordId, attachmentId } = req.params;

    const record = findMedicalRecordById(recordId);
    if (!record) {
      return res.status(404).json({ error: 'Medical record not found' });
    }

    // Check clinic access
    if (req.user.clinicId && record.clinicId !== req.user.clinicId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!record.attachments || record.attachments.length === 0) {
      return res.status(404).json({ error: 'No attachments found' });
    }

    const attachment = record.attachments.find(a => a.id === attachmentId);
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    logAccess(req, AUDIT_ACTIONS.VIEW, {
      resourceType: 'SCAN_ANNOTATION',
      resourceId: attachmentId,
      details: 'Viewed scan annotations'
    });

    res.json({
      attachmentId,
      annotations: attachment.annotations || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/medical-records/:recordId/attachments/:attachmentId/annotations
 * Save annotations for a specific scan attachment
 */
router.put('/:recordId/attachments/:attachmentId/annotations', authenticate, canManageMedicalRecords, async (req, res) => {
  try {
    const { recordId, attachmentId } = req.params;
    const { annotations } = req.body;

    if (!Array.isArray(annotations)) {
      return res.status(400).json({ error: 'Annotations must be an array' });
    }

    const record = findMedicalRecordById(recordId);
    if (!record) {
      return res.status(404).json({ error: 'Medical record not found' });
    }

    // Check clinic access
    if (req.user.clinicId && record.clinicId !== req.user.clinicId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!record.attachments || record.attachments.length === 0) {
      return res.status(404).json({ error: 'No attachments found' });
    }

    const attachment = record.attachments.find(a => a.id === attachmentId);
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Validate annotations structure
    const validAnnotations = annotations.filter(ann => {
      return ann.id && ann.type && typeof ann.x === 'number' && typeof ann.y === 'number' && ann.color;
    });

    // Save annotations to attachment
    attachment.annotations = validAnnotations;
    attachment.annotationsUpdatedAt = new Date();
    attachment.annotationsUpdatedBy = req.user.userId;
    record.updatedAt = new Date();
    record.updatedBy = req.user.userId;

    logAccess(req, AUDIT_ACTIONS.UPDATE, {
      resourceType: 'SCAN_ANNOTATION',
      resourceId: attachmentId,
      details: `Saved ${validAnnotations.length} annotations for scan attachment`
    });

    res.json({
      message: 'Annotations saved successfully',
      attachmentId,
      count: validAnnotations.length,
      annotations: validAnnotations
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

