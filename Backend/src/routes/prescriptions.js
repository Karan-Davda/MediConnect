const express = require('express');
const router = express.Router();
const prescriptionRepository = require('../repositories/PrescriptionRepository');
const { authenticate, checkPermission } = require('../middleware/auth');
const { auditLogger, AUDIT_ACTIONS } = require('../middleware/auditLogger');
const { findPatientByUserId, findPatientById } = require('../repositories/MedicalRecordRepository');

// ==================== PRESCRIPTION ROUTES ====================

/**
 * @route   POST /api/prescriptions
 * @desc    Create a new prescription
 * @access  Doctors only (requires write_prescriptions permission)
 */
router.post('/',
  authenticate,
  checkPermission('write_prescriptions'),
  auditLogger(AUDIT_ACTIONS.CREATE, 'PRESCRIPTION'),
  async (req, res) => {
    try {
      const {
        patientId,
        medicalRecordId,
        medicationName,
        medicationCode,
        dosage,
        dosageUnit,
        form,
        frequency,
        route,
        duration,
        quantity,
        refills,
        startDate,
        endDate,
        instructions,
        indication,
        pharmacyId,
        notes,
        priority,
        substitutionAllowed,
        daw
      } = req.body;

      // Validation
      if (!patientId || !medicationName || !dosage || !frequency || !duration || !quantity) {
        return res.status(400).json({
          error: 'Missing required fields: patientId, medicationName, dosage, frequency, duration, quantity'
        });
      }

      // Get patient name
      const patient = await findPatientById(patientId);
      const patientName = patient ? `${patient.firstName} ${patient.lastName}` : null;

      // Get pharmacy name if pharmacyId provided
      let pharmacyName = null;
      if (pharmacyId) {
        const pharmacy = await prescriptionRepository.getPharmacyById(pharmacyId);
        if (pharmacy) {
          pharmacyName = pharmacy.name;
        }
      }

      const prescription = await prescriptionRepository.createPrescription({
        patientId,
        patientName,
        medicalRecordId,
        providerId: req.user.userId,
        providerName: req.user.name,
        clinicId: req.user.clinicId,
        medicationName,
        medicationCode,
        dosage,
        dosageUnit,
        form,
        frequency,
        route,
        duration,
        quantity,
        refills: refills || 0,
        startDate,
        endDate,
        instructions,
        indication,
        status: 'pending',
        pharmacyId,
        pharmacyName,
        notes,
        priority: priority || 'routine',
        substitutionAllowed: substitutionAllowed !== undefined ? substitutionAllowed : true,
        daw: daw || false,
        createdBy: req.user.userId
      });

      res.status(201).json(prescription);
    } catch (error) {
      console.error('Error creating prescription:', error);
      res.status(500).json({ error: 'Failed to create prescription' });
    }
  }
);

/**
 * @route   GET /api/prescriptions
 * @desc    Get all prescriptions with filters
 * @access  Doctors, Clinic Staff, Clinic Admin, Patient (own only)
 */
router.get('/',
  authenticate,
  async (req, res) => {
    try {
      const { patientId, providerId, status, startDate, endDate, search } = req.query;

      // Check permissions
      const isStaff = ['doctor', 'clinic_staff', 'clinic_admin'].includes(req.user.role);
      const isPatient = req.user.role === 'patient';

      if (!isStaff && !isPatient) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      // Build filters
      const filters = {};

      // Staff: filter by their clinic
      if (isStaff) {
        filters.clinicId = req.user.clinicId;
        if (patientId) filters.patientId = patientId;
        if (providerId) filters.providerId = providerId;
      } else if (isPatient) {
        // Patients: only show their own prescriptions
        const patientRecord = findPatientByUserId(req.user.userId);
        if (!patientRecord) {
          return res.json([]); // No patient record, no prescriptions
        }
        filters.patientId = patientRecord.id;
      }

      if (status) filters.status = status;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (search) filters.search = search;

      const prescriptions = await prescriptionRepository.getAllPrescriptions(filters);

      res.json(prescriptions);
    } catch (error) {
      console.error('Error fetching prescriptions:', error);
      res.status(500).json({ error: 'Failed to fetch prescriptions' });
    }
  }
);

/**
 * @route   GET /api/prescriptions/:id
 * @desc    Get prescription by ID
 * @access  Doctors, Clinic Staff, Clinic Admin, Patient (own records)
 */
router.get('/:id',
  authenticate,
  auditLogger(AUDIT_ACTIONS.VIEW, 'PRESCRIPTION'),
  async (req, res) => {
    try {
      const prescription = await prescriptionRepository.getPrescriptionById(req.params.id);

      if (!prescription) {
        return res.status(404).json({ error: 'Prescription not found' });
      }

      // Check access: Staff can view their clinic's prescriptions, patients can view their own
      const isStaff = ['doctor', 'clinic_staff', 'clinic_admin'].includes(req.user.role);
      const isOwnPrescription = prescription.patientId === req.user.userId;

      if (!isStaff && !isOwnPrescription) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (isStaff && prescription.clinicId !== req.user.clinicId) {
        return res.status(403).json({ error: 'Access denied - different clinic' });
      }

      res.json(prescription);
    } catch (error) {
      console.error('Error fetching prescription:', error);
      res.status(500).json({ error: 'Failed to fetch prescription' });
    }
  }
);

/**
 * @route   GET /api/prescriptions/patient/:patientId
 * @desc    Get all prescriptions for a patient
 * @access  Doctors, Clinic Staff, Clinic Admin, Patient (own records)
 */
router.get('/patient/:patientId',
  authenticate,
  auditLogger(AUDIT_ACTIONS.VIEW, 'PRESCRIPTION'),
  async (req, res) => {
    try {
      const { patientId } = req.params;

      // Check access
      const isStaff = ['doctor', 'clinic_staff', 'clinic_admin'].includes(req.user.role);

      // For patients, check if they're accessing their own records
      // patientId in URL is the Patient record ID, need to check if it matches their user ID
      let isOwnRecords = false;
      if (req.user.role === 'patient') {
        const patientRecord = findPatientByUserId(req.user.userId);
        isOwnRecords = patientRecord && patientRecord.id === patientId;
      }

      if (!isStaff && !isOwnRecords) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const prescriptions = await prescriptionRepository.getPrescriptionsByPatient(patientId);

      // Filter by clinic for staff
      let filteredPrescriptions = prescriptions;
      if (isStaff) {
        filteredPrescriptions = prescriptions.filter(p => p.clinicId === req.user.clinicId);
      }

      res.json(filteredPrescriptions);
    } catch (error) {
      console.error('Error fetching patient prescriptions:', error);
      res.status(500).json({ error: 'Failed to fetch patient prescriptions' });
    }
  }
);

/**
 * @route   GET /api/prescriptions/medical-record/:medicalRecordId
 * @desc    Get all prescriptions for a medical record
 * @access  Doctors, Clinic Staff, Clinic Admin
 */
router.get('/medical-record/:medicalRecordId',
  authenticate,
  checkPermission('view_patient_records'),
  async (req, res) => {
    try {
      const prescriptions = await prescriptionRepository.getPrescriptionsByMedicalRecord(
        req.params.medicalRecordId
      );

      // Filter by clinic
      const filteredPrescriptions = prescriptions.filter(p => p.clinicId === req.user.clinicId);

      res.json(filteredPrescriptions);
    } catch (error) {
      console.error('Error fetching medical record prescriptions:', error);
      res.status(500).json({ error: 'Failed to fetch medical record prescriptions' });
    }
  }
);

/**
 * @route   PUT /api/prescriptions/:id
 * @desc    Update prescription
 * @access  Doctors only (requires write_prescriptions permission)
 */
router.put('/:id',
  authenticate,
  checkPermission('write_prescriptions'),
  auditLogger(AUDIT_ACTIONS.UPDATE, 'PRESCRIPTION'),
  async (req, res) => {
    try {
      const prescription = await prescriptionRepository.getPrescriptionById(req.params.id);

      if (!prescription) {
        return res.status(404).json({ error: 'Prescription not found' });
      }

      // Check clinic access
      if (prescription.clinicId !== req.user.clinicId) {
        return res.status(403).json({ error: 'Access denied - different clinic' });
      }

      // Cannot update prescriptions that are already filled
      if (prescription.status === 'filled') {
        return res.status(400).json({ error: 'Cannot update filled prescriptions' });
      }

      const updates = {
        ...req.body,
        updatedBy: req.user.userId
      };

      // Update pharmacy name if pharmacyId changed
      if (updates.pharmacyId && updates.pharmacyId !== prescription.pharmacyId) {
        const pharmacy = await prescriptionRepository.getPharmacyById(updates.pharmacyId);
        if (pharmacy) {
          updates.pharmacyName = pharmacy.name;
        }
      }

      const updatedPrescription = await prescriptionRepository.updatePrescription(
        req.params.id,
        updates
      );

      res.json(updatedPrescription);
    } catch (error) {
      console.error('Error updating prescription:', error);
      res.status(500).json({ error: 'Failed to update prescription' });
    }
  }
);

/**
 * @route   PUT /api/prescriptions/:id/status
 * @desc    Update prescription status
 * @access  Doctors, Clinic Staff (for status updates like 'filled')
 */
router.put('/:id/status',
  authenticate,
  checkPermission('view_patient_records'),
  auditLogger(AUDIT_ACTIONS.UPDATE, 'PRESCRIPTION'),
  async (req, res) => {
    try {
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }

      const validStatuses = ['pending', 'sent', 'filled', 'cancelled', 'expired'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const prescription = await prescriptionRepository.getPrescriptionById(req.params.id);

      if (!prescription) {
        return res.status(404).json({ error: 'Prescription not found' });
      }

      // Check clinic access
      if (prescription.clinicId !== req.user.clinicId) {
        return res.status(403).json({ error: 'Access denied - different clinic' });
      }

      const updatedPrescription = await prescriptionRepository.updatePrescriptionStatus(
        req.params.id,
        status,
        req.user.userId
      );

      res.json(updatedPrescription);
    } catch (error) {
      console.error('Error updating prescription status:', error);
      res.status(500).json({ error: 'Failed to update prescription status' });
    }
  }
);

/**
 * @route   POST /api/prescriptions/:id/send-to-pharmacy
 * @desc    Send prescription to pharmacy
 * @access  Doctors only
 */
router.post('/:id/send-to-pharmacy',
  authenticate,
  checkPermission('write_prescriptions'),
  auditLogger(AUDIT_ACTIONS.UPDATE, 'PRESCRIPTION'),
  async (req, res) => {
    try {
      const { pharmacyId } = req.body;

      if (!pharmacyId) {
        return res.status(400).json({ error: 'Pharmacy ID is required' });
      }

      const prescription = await prescriptionRepository.getPrescriptionById(req.params.id);

      if (!prescription) {
        return res.status(404).json({ error: 'Prescription not found' });
      }

      // Check clinic access
      if (prescription.clinicId !== req.user.clinicId) {
        return res.status(403).json({ error: 'Access denied - different clinic' });
      }

      // Cannot send cancelled or expired prescriptions
      if (prescription.status === 'cancelled' || prescription.status === 'expired') {
        return res.status(400).json({ error: 'Cannot send cancelled or expired prescriptions' });
      }

      const updatedPrescription = await prescriptionRepository.sendToPharmacy(
        req.params.id,
        pharmacyId,
        req.user.userId
      );

      res.json({
        message: 'Prescription sent to pharmacy successfully',
        prescription: updatedPrescription
      });
    } catch (error) {
      console.error('Error sending prescription to pharmacy:', error);
      res.status(500).json({ error: error.message || 'Failed to send prescription to pharmacy' });
    }
  }
);

/**
 * @route   DELETE /api/prescriptions/:id
 * @desc    Cancel prescription
 * @access  Doctors only
 */
router.delete('/:id',
  authenticate,
  checkPermission('write_prescriptions'),
  auditLogger(AUDIT_ACTIONS.DELETE, 'PRESCRIPTION'),
  async (req, res) => {
    try {
      const prescription = await prescriptionRepository.getPrescriptionById(req.params.id);

      if (!prescription) {
        return res.status(404).json({ error: 'Prescription not found' });
      }

      // Check clinic access
      if (prescription.clinicId !== req.user.clinicId) {
        return res.status(403).json({ error: 'Access denied - different clinic' });
      }

      // Cannot cancel filled prescriptions
      if (prescription.status === 'filled') {
        return res.status(400).json({ error: 'Cannot cancel filled prescriptions' });
      }

      await prescriptionRepository.cancelPrescription(req.params.id, req.user.userId);

      res.json({ message: 'Prescription cancelled successfully' });
    } catch (error) {
      console.error('Error cancelling prescription:', error);
      res.status(500).json({ error: 'Failed to cancel prescription' });
    }
  }
);

// ==================== PHARMACY ROUTES ====================

/**
 * @route   GET /api/prescriptions/pharmacies/list
 * @desc    Get all pharmacies
 * @access  Authenticated users
 */
router.get('/pharmacies/list',
  authenticate,
  async (req, res) => {
    try {
      const { search, isActive, deliveryAvailable } = req.query;

      const filters = {};
      if (search) filters.search = search;
      if (isActive !== undefined) filters.isActive = isActive === 'true';
      if (deliveryAvailable !== undefined) filters.deliveryAvailable = deliveryAvailable === 'true';

      const pharmacies = await prescriptionRepository.getAllPharmacies(filters);

      res.json(pharmacies);
    } catch (error) {
      console.error('Error fetching pharmacies:', error);
      res.status(500).json({ error: 'Failed to fetch pharmacies' });
    }
  }
);

/**
 * @route   GET /api/prescriptions/pharmacies/:id
 * @desc    Get pharmacy by ID
 * @access  Authenticated users
 */
router.get('/pharmacies/:id',
  authenticate,
  async (req, res) => {
    try {
      const pharmacy = await prescriptionRepository.getPharmacyById(req.params.id);

      if (!pharmacy) {
        return res.status(404).json({ error: 'Pharmacy not found' });
      }

      res.json(pharmacy);
    } catch (error) {
      console.error('Error fetching pharmacy:', error);
      res.status(500).json({ error: 'Failed to fetch pharmacy' });
    }
  }
);

/**
 * @route   POST /api/prescriptions/pharmacies
 * @desc    Create a new pharmacy
 * @access  Clinic Admin only
 */
router.post('/pharmacies',
  authenticate,
  checkPermission('manage_settings'),
  async (req, res) => {
    try {
      const pharmacy = await prescriptionRepository.createPharmacy(req.body);

      res.status(201).json(pharmacy);
    } catch (error) {
      console.error('Error creating pharmacy:', error);
      res.status(500).json({ error: 'Failed to create pharmacy' });
    }
  }
);

/**
 * @route   GET /api/prescriptions/patient/:patientId/stats
 * @desc    Get prescription statistics for a patient
 * @access  Doctors, Clinic Staff, Clinic Admin, Patient (own stats)
 */
router.get('/patient/:patientId/stats',
  authenticate,
  async (req, res) => {
    try {
      const { patientId } = req.params;

      // Check access
      const isStaff = ['doctor', 'clinic_staff', 'clinic_admin'].includes(req.user.role);
      const isOwnRecords = patientId === req.user.userId;

      if (!isStaff && !isOwnRecords) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const stats = await prescriptionRepository.getPatientPrescriptionStats(patientId);

      res.json(stats);
    } catch (error) {
      console.error('Error fetching prescription stats:', error);
      res.status(500).json({ error: 'Failed to fetch prescription stats' });
    }
  }
);

module.exports = router;
