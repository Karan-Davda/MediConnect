const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { PERMISSIONS, hasPermission } = require('../models/Role');
const { logAccess, AUDIT_ACTIONS } = require('../middleware/auditLogger');
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
 * Get all patients (with optional search/filters)
 */
router.get('/patients', authenticate, canViewMedicalRecords, async (req, res) => {
  try {
    const filters = {
      search: req.query.search,
      clinicId: req.query.clinicId
    };

    const patients = findAllPatients(filters);

    logAccess(req, AUDIT_ACTIONS.VIEW, {
      resourceType: 'PATIENT',
      details: `Viewed ${patients.length} patients`
    });

    res.json({
      count: patients.length,
      patients: patients.map(p => p.toJSON())
    });
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

    // Verify patient exists
    const patient = findPatientById(recordData.patientId);
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

module.exports = router;

