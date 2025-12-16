const express = require('express');
const router = express.Router();
const PrescriptionRepository = require('../repositories/PrescriptionRepository');
const { authenticate, checkPermission, requireRole } = require('../middleware/auth');
const { auditLogger, AUDIT_ACTIONS } = require('../middleware/auditLogger');
const PatientRepository = require('../repositories/PatientRepository');

// ==================== PRESCRIPTION ROUTES ====================

/**
 * @route   POST /api/prescriptions
 * @desc    Create a new prescription
 * @access  Doctors only (requires write_prescriptions permission)
 */
router.post('/',
  authenticate,
  requireRole('doctor'),
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

      // Get patient name from database
      let patientName = null;
      try {
        let patientIdNum = patientId;
        if (typeof patientIdNum === 'string' && patientIdNum.startsWith('patient_')) {
          patientIdNum = parseInt(patientIdNum.replace('patient_', ''));
        }
        const patient = await PatientRepository.findById(patientIdNum);
        if (patient) {
          const user = await require('../repositories/UserRepository').findById(patient.user_id);
          patientName = user ? `${user.first_name} ${user.last_name}` : null;
        }
      } catch (err) {
        console.warn('Could not fetch patient name:', err.message);
      }

      // Get pharmacy name if pharmacyId provided
      let pharmacyName = null;
      if (pharmacyId) {
        const pharmacy = await PrescriptionRepository.getPharmacyById(pharmacyId);
        if (pharmacy) {
          pharmacyName = pharmacy.name;
        }
      }

      // Get doctor_id from user_id
      const DoctorRepository = require('../repositories/DoctorRepository');
      const doctor = await DoctorRepository.findByUserId(parseInt(req.user.userId));
      if (!doctor) {
        return res.status(400).json({ error: 'User is not a doctor' });
      }

      const prescription = await PrescriptionRepository.createPrescription({
        patientId,
        patientName,
        medicalRecordId,
        providerId: doctor.doctor_id,
        providerName: req.user.name,
        clinicId: req.user.clinicId || 1,
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
        pharmacyId,
        pharmacyName,
        notes,
        priority: priority || 'routine',
        substitutionAllowed: substitutionAllowed !== undefined ? substitutionAllowed : true,
        daw: daw || false,
        createdBy: req.user.userId
      });

      res.status(201).json(prescription.toJSON());
    } catch (error) {
      console.error('Error creating prescription:', error);
      res.status(500).json({ error: error.message || 'Failed to create prescription' });
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

      console.log('[PRESCRIPTIONS] GET / - Query params:', { patientId, providerId, status, startDate, endDate, search });
      console.log('[PRESCRIPTIONS] User role:', req.user.role, 'User ID:', req.user.userId);

      // Check permissions
      const isStaff = ['doctor', 'clinic_staff', 'clinic_admin'].includes(req.user.role);
      const isPatient = req.user.role === 'patient';

      if (!isStaff && !isPatient) {
        console.log('[PRESCRIPTIONS] Insufficient permissions for role:', req.user.role);
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      // Build filters
      const filters = {};

      // Staff: filter by their clinic
      if (isStaff) {
        filters.clinicId = req.user.clinicId || 1;
        if (patientId) {
          filters.patientId = patientId;
          console.log('[PRESCRIPTIONS] Filtering by patientId:', patientId);
        }
        if (providerId) filters.providerId = providerId;
      } else if (isPatient) {
        // Patients: only show their own prescriptions that are confirmed (sent or filled)
        const patient = await PatientRepository.findByUserId(parseInt(req.user.userId));
        if (!patient) {
          console.log('[PRESCRIPTIONS] No patient record found for user:', req.user.userId);
          return res.json([]); // No patient record, no prescriptions
        }
        filters.patientId = `patient_${patient.patient_id}`;
        // Patients only see confirmed prescriptions (sent to pharmacy or filled)
        // Don't show pending prescriptions to patients
        if (!status) {
          filters.status = ['sent', 'filled']; // Filter for confirmed prescriptions only
        }
        console.log('[PRESCRIPTIONS] Patient filter set to:', filters.patientId);
        console.log('[PRESCRIPTIONS] Patient can only see confirmed prescriptions (sent/filled)');
      }

      if (status && !Array.isArray(status)) {
        filters.status = status;
      }
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (search) filters.search = search;

      console.log('[PRESCRIPTIONS] Filters:', filters);

      const prescriptions = await PrescriptionRepository.getAllPrescriptions(filters);

      console.log('[PRESCRIPTIONS] Found', prescriptions.length, 'prescriptions');

      const jsonPrescriptions = prescriptions.map(p => p.toJSON());
      console.log('[PRESCRIPTIONS] Returning', jsonPrescriptions.length, 'prescriptions');

      res.json(jsonPrescriptions);
    } catch (error) {
      console.error('[PRESCRIPTIONS] Error fetching prescriptions:', error);
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
      const prescription = await PrescriptionRepository.getPrescriptionById(req.params.id);

      if (!prescription) {
        return res.status(404).json({ error: 'Prescription not found' });
      }

      // Check access: Staff can view their clinic's prescriptions, patients can view their own
      const isStaff = ['doctor', 'clinic_staff', 'clinic_admin'].includes(req.user.role);
      
      // For patients, check if prescription belongs to them
      let isOwnPrescription = false;
      if (req.user.role === 'patient') {
        const patient = await PatientRepository.findByUserId(parseInt(req.user.userId));
        if (patient) {
          const prescPatientId = prescription.patientId.replace('patient_', '');
          isOwnPrescription = String(patient.patient_id) === prescPatientId;
        }
      }

      if (!isStaff && !isOwnPrescription) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (isStaff && prescription.clinicId !== (req.user.clinicId || 1)) {
        return res.status(403).json({ error: 'Access denied - different clinic' });
      }

      res.json(prescription.toJSON());
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
      let isOwnRecords = false;
      if (req.user.role === 'patient') {
        const patient = await PatientRepository.findByUserId(parseInt(req.user.userId));
        if (patient) {
          const urlPatientId = patientId.replace('patient_', '');
          isOwnRecords = String(patient.patient_id) === urlPatientId;
        }
      }

      if (!isStaff && !isOwnRecords) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const prescriptions = await PrescriptionRepository.getPrescriptionsByPatient(patientId);

      // Filter by clinic for staff
      let filteredPrescriptions = prescriptions;
      if (isStaff) {
        filteredPrescriptions = prescriptions.filter(p => p.clinicId === (req.user.clinicId || 1));
      }

      res.json(filteredPrescriptions.map(p => p.toJSON()));
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
      const prescriptions = await PrescriptionRepository.getPrescriptionsByMedicalRecord(
        req.params.medicalRecordId
      );

      // Filter by clinic
      const filteredPrescriptions = prescriptions.filter(p => p.clinicId === (req.user.clinicId || 1));

      res.json(filteredPrescriptions.map(p => p.toJSON()));
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
  requireRole('doctor'),
  auditLogger(AUDIT_ACTIONS.UPDATE, 'PRESCRIPTION'),
  async (req, res) => {
    try {
      const prescription = await PrescriptionRepository.getPrescriptionById(req.params.id);

      if (!prescription) {
        return res.status(404).json({ error: 'Prescription not found' });
      }

      // Check clinic access
      if (prescription.clinicId !== (req.user.clinicId || 1)) {
        return res.status(403).json({ error: 'Access denied - different clinic' });
      }

      // Cannot update prescriptions that are already filled
      if (prescription.status === 'filled') {
        return res.status(400).json({ error: 'Cannot update filled prescriptions' });
      }

      const updates = {
        ...req.body,
        updated_by: req.user.userId
      };

      // Update pharmacy name if pharmacyId changed
      if (updates.pharmacyId && updates.pharmacyId !== prescription.pharmacyId) {
        const pharmacy = await PrescriptionRepository.getPharmacyById(updates.pharmacyId);
        if (pharmacy) {
          updates.pharmacy_name = pharmacy.name;
        }
      }

      const updatedPrescription = await PrescriptionRepository.updatePrescription(
        req.params.id,
        updates
      );

      if (!updatedPrescription) {
        return res.status(500).json({ error: 'Failed to update prescription' });
      }

      res.json(updatedPrescription.toJSON());
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

      const prescription = await PrescriptionRepository.getPrescriptionById(req.params.id);

      if (!prescription) {
        return res.status(404).json({ error: 'Prescription not found' });
      }

      // Check clinic access
      if (prescription.clinicId !== (req.user.clinicId || 1)) {
        return res.status(403).json({ error: 'Access denied - different clinic' });
      }

      const updatedPrescription = await PrescriptionRepository.updatePrescriptionStatus(
        req.params.id,
        status,
        req.user.userId
      );

      if (!updatedPrescription) {
        return res.status(500).json({ error: 'Failed to update prescription status' });
      }

      res.json(updatedPrescription.toJSON());
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
  requireRole('doctor'),
  auditLogger(AUDIT_ACTIONS.UPDATE, 'PRESCRIPTION'),
  async (req, res) => {
    try {
      const { pharmacyId } = req.body;

      if (!pharmacyId) {
        return res.status(400).json({ error: 'Pharmacy ID is required' });
      }

      const prescription = await PrescriptionRepository.getPrescriptionById(req.params.id);

      if (!prescription) {
        return res.status(404).json({ error: 'Prescription not found' });
      }

      // Check clinic access
      if (prescription.clinicId !== (req.user.clinicId || 1)) {
        return res.status(403).json({ error: 'Access denied - different clinic' });
      }

      // Cannot send cancelled or expired prescriptions
      if (prescription.status === 'cancelled' || prescription.status === 'expired') {
        return res.status(400).json({ error: 'Cannot send cancelled or expired prescriptions' });
      }

      const updatedPrescription = await PrescriptionRepository.sendToPharmacy(
        req.params.id,
        pharmacyId,
        req.user.userId
      );

      if (!updatedPrescription) {
        return res.status(500).json({ error: 'Failed to send prescription to pharmacy' });
      }

      res.json({
        message: 'Prescription sent to pharmacy successfully',
        prescription: updatedPrescription.toJSON()
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
  requireRole('doctor'),
  auditLogger(AUDIT_ACTIONS.DELETE, 'PRESCRIPTION'),
  async (req, res) => {
    try {
      const prescription = await PrescriptionRepository.getPrescriptionById(req.params.id);

      if (!prescription) {
        return res.status(404).json({ error: 'Prescription not found' });
      }

      // Check clinic access
      if (prescription.clinicId !== (req.user.clinicId || 1)) {
        return res.status(403).json({ error: 'Access denied - different clinic' });
      }

      // Cannot cancel filled prescriptions
      if (prescription.status === 'filled') {
        return res.status(400).json({ error: 'Cannot cancel filled prescriptions' });
      }

      const deleted = await PrescriptionRepository.cancelPrescription(req.params.id, req.user.userId);

      if (!deleted) {
        return res.status(500).json({ error: 'Failed to cancel prescription' });
      }

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

      const pharmacies = await PrescriptionRepository.getAllPharmacies(filters);

      res.json(pharmacies.map(p => p.toJSON()));
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
      const pharmacy = await PrescriptionRepository.getPharmacyById(req.params.id);

      if (!pharmacy) {
        return res.status(404).json({ error: 'Pharmacy not found' });
      }

      res.json(pharmacy.toJSON());
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
      const pharmacy = await PrescriptionRepository.createPharmacy(req.body);

      res.status(201).json(pharmacy.toJSON());
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

      const stats = await PrescriptionRepository.getPatientPrescriptionStats(patientId);

      res.json(stats);
    } catch (error) {
      console.error('Error fetching prescription stats:', error);
      res.status(500).json({ error: 'Failed to fetch prescription stats' });
    }
  }
);

module.exports = router;
