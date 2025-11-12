const express = require('express');
const router = express.Router();
const insuranceRepository = require('../repositories/InsuranceRepository');
const { authenticate, checkPermission } = require('../middleware/auth');
const { auditLogger, AUDIT_ACTIONS } = require('../middleware/auditLogger');
const { findPatientByUserId, findPatientById } = require('../repositories/MedicalRecordRepository');

// ==================== INSURANCE ROUTES ====================

/**
 * @route   POST /api/insurance
 * @desc    Create a new insurance record
 * @access  Patients (own records), Clinic Staff, Clinic Admin, Doctors
 */
router.post('/',
  authenticate,
  auditLogger(AUDIT_ACTIONS.CREATE, 'INSURANCE'),
  async (req, res) => {
    try {
      const {
        patientId,
        insuranceProvider,
        policyNumber,
        groupNumber,
        subscriberName,
        subscriberRelationship,
        subscriberDateOfBirth,
        effectiveDate,
        expirationDate,
        planType,
        coverageType,
        copay,
        deductible,
        deductibleMet,
        outOfPocketMax,
        outOfPocketMet,
        coveragePercentage,
        priorAuthRequired,
        insurancePhone,
        insuranceAddress,
        claimsAddress,
        rxBin,
        rxPcn,
        rxGroup,
        notes
      } = req.body;

      // Access control: Patients can only create for themselves
      const isStaff = ['doctor', 'clinic_staff', 'clinic_admin'].includes(req.user.role);
      let finalPatientId = patientId;

      if (req.user.role === 'patient') {
        // For patients, auto-fill their patient ID
        const patientRecord = findPatientByUserId(req.user.userId);
        if (!patientRecord) {
          return res.status(404).json({ error: 'Patient record not found' });
        }
        finalPatientId = patientRecord.id;
      } else {
        // For staff, patientId is required
        if (!patientId) {
          return res.status(400).json({
            error: 'Missing required field: patientId'
          });
        }
      }

      // Validation
      if (!insuranceProvider || !policyNumber) {
        return res.status(400).json({
          error: 'Missing required fields: insuranceProvider, policyNumber'
        });
      }

      // Get patient name
      const patient = await findPatientById(finalPatientId);
      const patientName = patient ? `${patient.firstName} ${patient.lastName}` : null;

      const insurance = await insuranceRepository.createInsurance({
        patientId: finalPatientId,
        patientName,
        insuranceProvider,
        policyNumber,
        groupNumber,
        subscriberName,
        subscriberRelationship,
        subscriberDateOfBirth,
        effectiveDate,
        expirationDate,
        planType,
        coverageType,
        copay,
        deductible,
        deductibleMet,
        outOfPocketMax,
        outOfPocketMet,
        coveragePercentage,
        priorAuthRequired,
        verificationStatus: isStaff ? 'pending' : 'pending', // Always starts as pending
        insurancePhone,
        insuranceAddress,
        claimsAddress,
        rxBin,
        rxPcn,
        rxGroup,
        status: 'active',
        notes,
        createdBy: req.user.userId
      });

      res.status(201).json(insurance);
    } catch (error) {
      console.error('Error creating insurance:', error);
      res.status(500).json({ error: 'Failed to create insurance record' });
    }
  }
);

/**
 * @route   GET /api/insurance
 * @desc    Get all insurance records with filters
 * @access  Doctors, Clinic Staff, Clinic Admin, Patient (own only)
 */
router.get('/',
  authenticate,
  async (req, res) => {
    try {
      const { patientId, status, verificationStatus, coverageType, search } = req.query;

      // Check permissions
      const isStaff = ['doctor', 'clinic_staff', 'clinic_admin'].includes(req.user.role);
      const isPatient = req.user.role === 'patient';

      if (!isStaff && !isPatient) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      // Build filters
      const filters = {};

      if (isPatient) {
        // Patients: only show their own insurance
        const patientRecord = findPatientByUserId(req.user.userId);
        if (!patientRecord) {
          return res.json([]); // No patient record, no insurance
        }
        filters.patientId = patientRecord.id;
      } else if (isStaff) {
        // Staff: can filter by patient
        if (patientId) filters.patientId = patientId;
      }

      if (status) filters.status = status;
      if (verificationStatus) filters.verificationStatus = verificationStatus;
      if (coverageType) filters.coverageType = coverageType;
      if (search) filters.search = search;

      const insuranceRecords = await insuranceRepository.getAllInsurance(filters);

      res.json(insuranceRecords);
    } catch (error) {
      console.error('Error fetching insurance:', error);
      res.status(500).json({ error: 'Failed to fetch insurance records' });
    }
  }
);

/**
 * @route   GET /api/insurance/:id
 * @desc    Get insurance by ID
 * @access  Doctors, Clinic Staff, Clinic Admin, Patient (own records)
 */
router.get('/:id',
  authenticate,
  auditLogger(AUDIT_ACTIONS.VIEW, 'INSURANCE'),
  async (req, res) => {
    try {
      const insurance = await insuranceRepository.getInsuranceById(req.params.id);

      if (!insurance) {
        return res.status(404).json({ error: 'Insurance record not found' });
      }

      // Check access
      const isStaff = ['doctor', 'clinic_staff', 'clinic_admin'].includes(req.user.role);

      if (req.user.role === 'patient') {
        const patientRecord = findPatientByUserId(req.user.userId);
        const isOwnRecord = patientRecord && patientRecord.id === insurance.patientId;

        if (!isOwnRecord) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      res.json(insurance);
    } catch (error) {
      console.error('Error fetching insurance:', error);
      res.status(500).json({ error: 'Failed to fetch insurance record' });
    }
  }
);

/**
 * @route   GET /api/insurance/patient/:patientId
 * @desc    Get all insurance records for a patient
 * @access  Doctors, Clinic Staff, Clinic Admin, Patient (own records)
 */
router.get('/patient/:patientId',
  authenticate,
  auditLogger(AUDIT_ACTIONS.VIEW, 'INSURANCE'),
  async (req, res) => {
    try {
      const { patientId } = req.params;

      // Check access
      const isStaff = ['doctor', 'clinic_staff', 'clinic_admin'].includes(req.user.role);

      if (req.user.role === 'patient') {
        const patientRecord = findPatientByUserId(req.user.userId);
        const isOwnRecords = patientRecord && patientRecord.id === patientId;

        if (!isOwnRecords) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      const insuranceRecords = await insuranceRepository.getInsuranceByPatient(patientId);

      res.json(insuranceRecords);
    } catch (error) {
      console.error('Error fetching patient insurance:', error);
      res.status(500).json({ error: 'Failed to fetch patient insurance records' });
    }
  }
);

/**
 * @route   GET /api/insurance/patient/:patientId/primary
 * @desc    Get primary insurance for a patient
 * @access  Doctors, Clinic Staff, Clinic Admin, Patient (own records)
 */
router.get('/patient/:patientId/primary',
  authenticate,
  async (req, res) => {
    try {
      const { patientId } = req.params;

      // Check access
      const isStaff = ['doctor', 'clinic_staff', 'clinic_admin'].includes(req.user.role);

      if (req.user.role === 'patient') {
        const patientRecord = findPatientByUserId(req.user.userId);
        const isOwnRecords = patientRecord && patientRecord.id === patientId;

        if (!isOwnRecords) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      const primaryInsurance = await insuranceRepository.getPrimaryInsurance(patientId);

      if (!primaryInsurance) {
        return res.status(404).json({ error: 'No primary insurance found for patient' });
      }

      res.json(primaryInsurance);
    } catch (error) {
      console.error('Error fetching primary insurance:', error);
      res.status(500).json({ error: 'Failed to fetch primary insurance' });
    }
  }
);

/**
 * @route   PUT /api/insurance/:id
 * @desc    Update insurance record
 * @access  Patients (own records), Doctors, Clinic Staff, Clinic Admin
 */
router.put('/:id',
  authenticate,
  auditLogger(AUDIT_ACTIONS.UPDATE, 'INSURANCE'),
  async (req, res) => {
    try {
      const insurance = await insuranceRepository.getInsuranceById(req.params.id);

      if (!insurance) {
        return res.status(404).json({ error: 'Insurance record not found' });
      }

      // Check access
      const isStaff = ['doctor', 'clinic_staff', 'clinic_admin'].includes(req.user.role);

      if (req.user.role === 'patient') {
        const patientRecord = findPatientByUserId(req.user.userId);
        const isOwnRecord = patientRecord && patientRecord.id === insurance.patientId;

        if (!isOwnRecord) {
          return res.status(403).json({ error: 'Access denied' });
        }

        // Patients cannot update verification status
        if (req.body.verificationStatus || req.body.verifiedDate || req.body.verifiedBy) {
          return res.status(403).json({ error: 'Access denied - cannot update verification status' });
        }
      }

      const updates = {
        ...req.body,
        updatedBy: req.user.userId
      };

      const updatedInsurance = await insuranceRepository.updateInsurance(
        req.params.id,
        updates
      );

      res.json(updatedInsurance);
    } catch (error) {
      console.error('Error updating insurance:', error);
      res.status(500).json({ error: 'Failed to update insurance record' });
    }
  }
);

/**
 * @route   PUT /api/insurance/:id/verify
 * @desc    Verify insurance
 * @access  Doctors, Clinic Staff, Clinic Admin only
 */
router.put('/:id/verify',
  authenticate,
  checkPermission('view_patient_records'),
  auditLogger(AUDIT_ACTIONS.UPDATE, 'INSURANCE'),
  async (req, res) => {
    try {
      const { status, notes } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'Verification status is required' });
      }

      const validStatuses = ['verified', 'failed', 'expired'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid verification status' });
      }

      const insurance = await insuranceRepository.getInsuranceById(req.params.id);

      if (!insurance) {
        return res.status(404).json({ error: 'Insurance record not found' });
      }

      const verifiedInsurance = await insuranceRepository.verifyInsurance(req.params.id, {
        status,
        verifiedBy: req.user.userId,
        notes
      });

      res.json({
        message: `Insurance ${status} successfully`,
        insurance: verifiedInsurance
      });
    } catch (error) {
      console.error('Error verifying insurance:', error);
      res.status(500).json({ error: error.message || 'Failed to verify insurance' });
    }
  }
);

/**
 * @route   DELETE /api/insurance/:id
 * @desc    Deactivate insurance record
 * @access  Doctors, Clinic Staff, Clinic Admin
 */
router.delete('/:id',
  authenticate,
  checkPermission('view_patient_records'),
  auditLogger(AUDIT_ACTIONS.DELETE, 'INSURANCE'),
  async (req, res) => {
    try {
      const insurance = await insuranceRepository.getInsuranceById(req.params.id);

      if (!insurance) {
        return res.status(404).json({ error: 'Insurance record not found' });
      }

      await insuranceRepository.deactivateInsurance(req.params.id);

      res.json({ message: 'Insurance record deactivated successfully' });
    } catch (error) {
      console.error('Error deactivating insurance:', error);
      res.status(500).json({ error: 'Failed to deactivate insurance record' });
    }
  }
);

/**
 * @route   GET /api/insurance/patient/:patientId/stats
 * @desc    Get insurance statistics for a patient
 * @access  Doctors, Clinic Staff, Clinic Admin, Patient (own stats)
 */
router.get('/patient/:patientId/stats',
  authenticate,
  async (req, res) => {
    try {
      const { patientId } = req.params;

      // Check access
      const isStaff = ['doctor', 'clinic_staff', 'clinic_admin'].includes(req.user.role);

      if (req.user.role === 'patient') {
        const patientRecord = findPatientByUserId(req.user.userId);
        const isOwnRecords = patientRecord && patientRecord.id === patientId;

        if (!isOwnRecords) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      const stats = await insuranceRepository.getPatientInsuranceStats(patientId);

      res.json(stats);
    } catch (error) {
      console.error('Error fetching insurance stats:', error);
      res.status(500).json({ error: 'Failed to fetch insurance statistics' });
    }
  }
);

module.exports = router;
