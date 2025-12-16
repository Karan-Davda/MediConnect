const express = require('express');
const path = require('path');
const { authenticate, requireRole } = require('../middleware/auth');
const { PERMISSIONS, hasPermission } = require('../models/Role');
const { logAccess, AUDIT_ACTIONS } = require('../middleware/auditLogger');
const upload = require('../middleware/upload');
const uploadServiceResult = require('../middleware/uploadServiceResult');
const { uploadToS3, getSignedUrlForFile } = require('../services/s3Service');
const ClinicServiceRepository = require('../repositories/ClinicServiceRepository');
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
const PrescriptionRepository = require('../repositories/PrescriptionRepository');
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

    // Get doctor_id from user_id (required for foreign key constraint)
    let doctorId = null;
    const DoctorRepository = require('../repositories/DoctorRepository');
    try {
      const doctor = await DoctorRepository.findByUserId(parseInt(req.user.userId));
      if (doctor && doctor.doctor_id) {
        doctorId = doctor.doctor_id;
      } else {
        // If user is not a doctor, check if they're clinic staff
        // For clinic staff, we might need to handle differently or use a default doctor
        return res.status(400).json({ 
          error: 'User is not a doctor',
          message: 'Only doctors can create medical records. Please ensure you are logged in as a doctor.'
        });
      }
    } catch (error) {
      console.error('Error fetching doctor:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch doctor information',
        message: error.message 
      });
    }

    // Add provider information from authenticated user
    recordData.providerId = doctorId; // Use doctor_id instead of userId
    recordData.doctor_id = doctorId; // Also set doctor_id directly
    recordData.providerName = req.user.name || 'Unknown Provider';
    recordData.clinicId = req.user.clinicId || null;
    recordData.createdBy = req.user.userId;
    recordData.updatedBy = req.user.userId;

    const record = await createMedicalRecord(recordData);

    logAccess(req, AUDIT_ACTIONS.CREATE, {
      resourceType: 'MEDICAL_RECORD',
      resourceId: record.id,
      details: `Created medical record for patient: ${patient.fullName}`
    });

    // Auto-create prescriptions for medication treatments
    if (recordData.treatments && Array.isArray(recordData.treatments)) {
      const medicationTreatments = recordData.treatments.filter(
        treatment => treatment.type === 'medication' && 
        treatment.name && 
        treatment.name.trim() !== ''
      );

      if (medicationTreatments.length > 0) {
        console.log(`[PRESCRIPTIONS] Found ${medicationTreatments.length} medication treatments, creating prescriptions...`);
        
        const createdPrescriptions = [];
        
        for (const treatment of medicationTreatments) {
          try {
            // Extract dosage and unit (e.g., "400mg" -> dosage: "400", unit: "mg")
            let dosage = treatment.dosage || '';
            let dosageUnit = 'mg'; // default
            if (dosage) {
              const dosageMatch = dosage.match(/^([0-9]+\.?[0-9]*)\s*([a-zA-Z]+)?$/);
              if (dosageMatch) {
                dosage = dosageMatch[1];
                if (dosageMatch[2]) {
                  dosageUnit = dosageMatch[2].toLowerCase();
                }
              }
            }

            // Extract frequency (default to "once daily" if not provided)
            // If frequency is empty or not provided, use a sensible default
            let frequency = treatment.frequency;
            if (!frequency || frequency.trim() === '') {
              frequency = 'once daily';
            }

            // Extract duration (default to "7 days" if not provided)
            // If duration is empty or not provided, use a sensible default
            let duration = treatment.duration;
            if (!duration || duration.trim() === '') {
              duration = '7 days';
            }

            // Calculate quantity based on frequency and duration
            // Simple calculation: if "3 times daily" for "7 days", quantity = 3 * 7 = 21
            let quantity = 1;
            try {
              const freqMatch = frequency.match(/(\d+)/);
              const freqNum = freqMatch ? parseInt(freqMatch[1]) : 1;
              const durationMatch = duration.match(/(\d+)/);
              const durationNum = durationMatch ? parseInt(durationMatch[1]) : 7;
              quantity = freqNum * durationNum;
              // Ensure minimum quantity of 1
              if (quantity < 1) quantity = 1;
            } catch (calcError) {
              console.warn('[PRESCRIPTIONS] Could not calculate quantity, using default:', calcError);
              quantity = 7; // Default to 7
            }

            // Get patient name
            const patientName = patient.fullName || `${patient.firstName || ''} ${patient.lastName || ''}`.trim();

            // Create prescription
            const prescription = await PrescriptionRepository.createPrescription({
              patientId: recordData.patientId,
              patientName: patientName,
              medicalRecordId: record.id, // Link to the medical record
              providerId: doctorId,
              providerName: req.user.name || 'Unknown Provider',
              clinicId: req.user.clinicId || 1,
              medicationName: treatment.name.trim(),
              medicationCode: treatment.code || null,
              dosage: dosage,
              dosageUnit: dosageUnit,
              form: treatment.form || 'tablet',
              frequency: frequency,
              route: treatment.route || 'oral',
              duration: duration,
              quantity: quantity,
              refills: 0, // Default to 0 refills
              startDate: recordData.visitDate || new Date(),
              endDate: null,
              instructions: treatment.instructions || treatment.description || null,
              indication: recordData.chiefComplaint || null,
              pharmacyId: null, // Can be set later
              notes: treatment.notes || null,
              priority: 'routine',
              substitutionAllowed: true,
              daw: false,
              createdBy: req.user.userId
            });

            createdPrescriptions.push(prescription);
            console.log(`[PRESCRIPTIONS] Created prescription ${prescription.id} for medication: ${treatment.name}`);
          } catch (prescriptionError) {
            // Log error but don't fail the medical record creation
            console.error(`[PRESCRIPTIONS] Failed to create prescription for medication "${treatment.name}":`, prescriptionError);
          }
        }

        if (createdPrescriptions.length > 0) {
          console.log(`[PRESCRIPTIONS] Successfully created ${createdPrescriptions.length} prescription(s) for medical record ${record.id}`);
        }
      }
    }

    // Auto-generate invoice if charges are provided
    if (req.body.charges && (req.body.charges.consultation || (req.body.charges.services && req.body.charges.services.length > 0))) {
      try {
        const InvoiceRepository = require('../repositories/InvoiceRepository');
        const ClinicServiceRepository = require('../repositories/ClinicServiceRepository');
        const DoctorRepository = require('../repositories/DoctorRepository');
        
        // Get doctor's consultation fee
        const doctor = await DoctorRepository.findById(doctorId);
        const consultationFee = doctor?.fees || 0;
        
        // Build line items
        const lineItems = [];
        
        // Add consultation fee
        if (req.body.charges.consultation !== false && consultationFee > 0) {
          lineItems.push({
            service_id: null,
            service_code: 'CONSULTATION',
            description: 'Primary Care Consultation',
            quantity: 1,
            unit_price: consultationFee,
            total: consultationFee,
            service_type: 'consultation'
          });
        }
        
        // Add clinic services
        if (req.body.charges.services && Array.isArray(req.body.charges.services)) {
          for (const serviceItem of req.body.charges.services) {
            const service = await ClinicServiceRepository.findById(serviceItem.service_id);
            if (service && service.is_active) {
              const quantity = serviceItem.quantity || 1;
              const total = parseFloat(service.unit_price) * quantity;
              lineItems.push({
                service_id: service.service_id,
                service_code: service.service_code,
                description: service.service_name,
                quantity: quantity,
                unit_price: parseFloat(service.unit_price),
                total: total,
                service_type: service.service_type
              });
            }
          }
        }
        
        // Calculate totals
        const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
        const tax = req.body.charges.tax || 0;
        const discount = req.body.charges.discount || 0;
        const totalAmount = subtotal + tax - discount;
        
        // Get patient's insurance if available
        let insuranceId = null;
        let insuranceCoveragePercent = 0;
        if (patient.insurance_id) {
          const InsuranceRepository = require('../repositories/InsuranceRepository');
          // Note: InsuranceRepository might be in-memory, adjust as needed
          insuranceId = patient.insurance_id;
          // You may want to fetch insurance details to get coverage_percentage
        }
        
        // Create invoice
        if (lineItems.length > 0 && totalAmount > 0) {
          const invoice = await InvoiceRepository.create({
            patient_id: patient.patient_id,
            appointment_id: recordData.appointmentId || recordData.appt_id || null,
            medical_record_id: parseInt(record.id.replace('record_', '')),
            doctor_id: doctorId,
            clinic_id: req.user.clinicId || 1, // Default clinic
            service_date: recordData.visitDate || new Date(),
            line_items: lineItems,
            subtotal: subtotal,
            tax: tax,
            discount: discount,
            total_amount: totalAmount,
            insurance_id: insuranceId,
            insurance_coverage_percent: insuranceCoveragePercent,
            notes: req.body.charges.notes || null,
            created_by: req.user.userId
          });
          
          console.log(`[INFO] Auto-generated invoice ${invoice.invoice_number} for medical record ${record.id}`);
        }
      } catch (invoiceError) {
        // Log error but don't fail the medical record creation
        console.error('[ERROR] Failed to auto-generate invoice:', invoiceError);
      }
    }

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

    const records = await findAllMedicalRecords(filters);

    // Fetch invoice status for each record
    const InvoiceRepository = require('../repositories/InvoiceRepository');
    const { query } = require('../db/connection');
    
    const recordsWithInvoiceStatus = await Promise.all(records.map(async (record) => {
      const recordJson = record.toJSON();
      
      // Extract record_id number
      let recordIdNum = record.id;
      if (typeof recordIdNum === 'string' && recordIdNum.startsWith('record_')) {
        recordIdNum = parseInt(recordIdNum.replace('record_', ''));
      }
      
      // Check if there's an invoice for this medical record with status PAID
      try {
        const invoiceResult = await query(
          `SELECT status, invoice_id FROM invoices 
           WHERE medical_record_id = $1 AND status = 'PAID' 
           LIMIT 1`,
          [recordIdNum]
        );
        
        if (invoiceResult.rows.length > 0) {
          recordJson.invoiceStatus = 'PAID';
          recordJson.isPaid = true;
        } else {
          recordJson.invoiceStatus = null;
          recordJson.isPaid = false;
        }
      } catch (err) {
        console.error(`[ERROR] Failed to check invoice status for record ${recordIdNum}:`, err);
        recordJson.invoiceStatus = null;
        recordJson.isPaid = false;
      }
      
      return recordJson;
    }));

    logAccess(req, AUDIT_ACTIONS.VIEW, {
      resourceType: 'MEDICAL_RECORD',
      details: `Viewed ${records.length} medical records`
    });

    res.json({
      count: records.length,
      records: recordsWithInvoiceStatus
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
    const record = await findMedicalRecordById(req.params.id);

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

    // Check invoice status
    const { query } = require('../db/connection');
    const recordJson = record.toJSON();
    
    // Extract record_id number
    let recordIdNum = record.id;
    if (typeof recordIdNum === 'string' && recordIdNum.startsWith('record_')) {
      recordIdNum = parseInt(recordIdNum.replace('record_', ''));
    }
    
    // Check if there's an invoice for this medical record with status PAID
    try {
      const invoiceResult = await query(
        `SELECT status, invoice_id FROM invoices 
         WHERE medical_record_id = $1 AND status = 'PAID' 
         LIMIT 1`,
        [recordIdNum]
      );
      
      if (invoiceResult.rows.length > 0) {
        recordJson.invoiceStatus = 'PAID';
        recordJson.isPaid = true;
      } else {
        recordJson.invoiceStatus = null;
        recordJson.isPaid = false;
      }
    } catch (err) {
      console.error(`[ERROR] Failed to check invoice status for record ${recordIdNum}:`, err);
      recordJson.invoiceStatus = null;
      recordJson.isPaid = false;
    }

    logAccess(req, AUDIT_ACTIONS.VIEW, {
      resourceType: 'MEDICAL_RECORD',
      resourceId: record.id
    });

    res.json(recordJson);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/medical-records/:id/bill-amount
 * Calculate bill amount for a medical record (doctor consultation fee only)
 */
router.get('/:id/bill-amount', authenticate, canManageMedicalRecords, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Parse record ID (handle "record_123" format)
    let recordIdNum = id;
    if (typeof id === 'string' && id.startsWith('record_')) {
      recordIdNum = parseInt(id.replace('record_', ''));
    } else {
      recordIdNum = parseInt(id);
    }

    const record = await findMedicalRecordById(recordIdNum);

    if (!record) {
      return res.status(404).json({ error: 'Medical record not found' });
    }

    const DoctorRepository = require('../repositories/DoctorRepository');

    // Get doctor's consultation fee
    // Note: record.providerId is actually doctor_id (from doctors table), not user_id
    let consultationFee = 0;
    if (record.providerId) {
      // Parse providerId (which is doctor_id)
      let doctorIdNum = record.providerId;
      if (typeof record.providerId === 'string' && record.providerId.startsWith('doctor_')) {
        doctorIdNum = parseInt(record.providerId.replace('doctor_', ''));
      } else {
        doctorIdNum = parseInt(record.providerId);
      }
      
      // Use findById since providerId is doctor_id
      const doctor = await DoctorRepository.findById(doctorIdNum);
      if (doctor && doctor.fees) {
        consultationFee = parseFloat(doctor.fees) || 0;
      }
      
      console.log(`[DEBUG] Bill calculation - doctorId: ${doctorIdNum}, consultationFee: ${consultationFee}`);
    }

    // Calculate total amount (only consultation fee)
    const totalAmount = consultationFee;
    console.log(`[DEBUG] Bill calculation - consultationFee: ${consultationFee}, totalAmount: ${totalAmount}`);

    res.json({
      consultationFee,
      totalAmount,
      breakdown: {
        consultation: consultationFee > 0 ? {
          description: 'Primary Care Consultation',
          amount: consultationFee
        } : null
      }
    });
  } catch (error) {
    console.error('[ERROR] Error calculating bill amount:', error);
    res.status(500).json({ error: error.message || 'Failed to calculate bill amount' });
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

    const records = await findMedicalRecordsByPatientId(patientId, options);

    // Fetch invoice status for each record
    const { query } = require('../db/connection');
    
    const recordsWithInvoiceStatus = await Promise.all(records.map(async (record) => {
      const recordJson = record.toJSON();
      
      // Extract record_id number
      let recordIdNum = record.id;
      if (typeof recordIdNum === 'string' && recordIdNum.startsWith('record_')) {
        recordIdNum = parseInt(recordIdNum.replace('record_', ''));
      }
      
      // Check if there's an invoice for this medical record with status PAID
      try {
        const invoiceResult = await query(
          `SELECT status, invoice_id FROM invoices 
           WHERE medical_record_id = $1 AND status = 'PAID' 
           LIMIT 1`,
          [recordIdNum]
        );
        
        if (invoiceResult.rows.length > 0) {
          recordJson.invoiceStatus = 'PAID';
          recordJson.isPaid = true;
        } else {
          recordJson.invoiceStatus = null;
          recordJson.isPaid = false;
        }
      } catch (err) {
        console.error(`[ERROR] Failed to check invoice status for record ${recordIdNum}:`, err);
        recordJson.invoiceStatus = null;
        recordJson.isPaid = false;
      }
      
      return recordJson;
    }));

    logAccess(req, AUDIT_ACTIONS.VIEW, {
      resourceType: 'MEDICAL_RECORD',
      resourceId: patientId,
      details: `Viewed ${records.length} records for patient`
    });

    res.json({
      patientId,
      count: records.length,
      records: recordsWithInvoiceStatus
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
    const record = await findMedicalRecordById(req.params.id);

    if (!record) {
      return res.status(404).json({ error: 'Medical record not found' });
    }

    // Check clinic access
    if (req.user.clinicId && record.clinicId !== req.user.clinicId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Add updater information
    req.body.updatedBy = req.user.userId;

    const updatedRecord = await updateMedicalRecord(req.params.id, req.body);

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
    const record = await findMedicalRecordById(req.params.id);

    if (!record) {
      return res.status(404).json({ error: 'Medical record not found' });
    }

    // Check clinic access
    if (req.user.clinicId && record.clinicId !== req.user.clinicId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const deleted = await deleteMedicalRecord(req.params.id);

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

router.post('/:recordId/attachments', authenticate, canManageMedicalRecords, uploadServiceResult.single('file'), handleMulterError, async (req, res) => {
  try {
    const { recordId } = req.params;
    const { name, type, service_id, service_code } = req.body;

    console.log('Upload request received:', {
      recordId,
      name,
      type,
      service_id,
      service_code,
      hasFile: !!req.file,
      fileInfo: req.file ? {
        originalname: req.file.originalname,
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
        message: 'Please select a file to upload'
      });
    }

    const record = await findMedicalRecordById(recordId);
    if (!record) {
      return res.status(404).json({ error: 'Medical record not found' });
    }

    // Check clinic access
    if (req.user.clinicId && record.clinicId !== req.user.clinicId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get service info if service_id provided
    let service = null;
    let serviceName = name; // Default to provided name
    if (service_id) {
      service = await ClinicServiceRepository.findById(parseInt(service_id));
      if (service) {
        serviceName = service.service_name;
      }
    } else if (service_code) {
      service = await ClinicServiceRepository.findByCode(service_code);
      if (service) {
        serviceName = service.service_name;
      }
    }

    // Upload file to S3
    const folder = service ? 
      `service-results/${service.service_type}` : 
      'attachments';
    
    const s3Result = await uploadToS3(
      req.file.buffer,
      req.file.originalname,
      folder,
      req.file.mimetype
    );

    // Create attachment object with S3 reference
    const attachment = {
      id: `attachment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: serviceName || name,
      type: type,
      service_id: service ? service.service_id : (service_id ? parseInt(service_id) : null),
      service_code: service ? service.service_code : service_code,
      service_name: serviceName,
      s3_key: s3Result.key,
      s3_url: s3Result.url,
      file_name: req.file.originalname,
      file_type: req.file.mimetype,
      file_size: req.file.size,
      date: new Date().toISOString()
    };

    // Add attachment to record
    if (!record.attachments) {
      record.attachments = [];
    }
    record.attachments.push(attachment);

    // Save updated record to database
    const updatedRecord = await updateMedicalRecord(recordId, {
      attachments: record.attachments,
      updatedBy: req.user.userId
    });

    logAccess(req, AUDIT_ACTIONS.CREATE, {
      resourceType: 'SERVICE_ATTACHMENT',
      resourceId: attachment.id,
      details: `Added ${service ? 'service' : ''} attachment: ${name} to medical record ${recordId}`
    });

    res.status(201).json({
      message: 'Attachment added successfully',
      attachment
    });
  } catch (error) {
    console.error('Error uploading attachment:', error);
    res.status(500).json({ error: error.message || 'Failed to upload attachment' });
  }
});

/**
 * GET /api/medical-records/attachments/:attachmentId/download
 * Get signed URL for downloading attachment from S3
 */
router.get('/attachments/:attachmentId/download', authenticate, canViewMedicalRecords, async (req, res) => {
  try {
    const { attachmentId } = req.params;
    const { recordId } = req.query;

    if (!recordId) {
      return res.status(400).json({ error: 'recordId query parameter is required' });
    }

    const record = await findMedicalRecordById(recordId);
    if (!record) {
      return res.status(404).json({ error: 'Medical record not found' });
    }

    // Check clinic access
    if (req.user.clinicId && record.clinicId !== req.user.clinicId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Find attachment
    const attachment = record.attachments?.find(a => a.id === attachmentId);
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Generate signed URL if S3 file
    if (attachment.s3_key || attachment.s3_url) {
      const key = attachment.s3_key || attachment.s3_url.replace(`s3://${process.env.AWS_S3_BUCKET_NAME || 'mediconnect-medical-files'}/`, '');
      const signedUrl = await getSignedUrlForFile(key, 3600); // 1 hour expiry

      return res.json({
        attachmentId,
        fileName: attachment.file_name || attachment.name,
        signedUrl,
        expiresIn: 3600
      });
    }

    // Fallback for old local file attachments
    return res.status(404).json({ error: 'File not available (legacy attachment)' });
  } catch (error) {
    console.error('Error generating download URL:', error);
    res.status(500).json({ error: error.message || 'Failed to generate download URL' });
  }
});

/**
 * GET /api/medical-records/assets/:filename
 * Serve uploaded scan images (legacy - for old local files)
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

    const record = await findMedicalRecordById(recordId);
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

    const record = await findMedicalRecordById(recordId);
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

    // Save updated record to database
    await updateMedicalRecord(recordId, {
      attachments: record.attachments,
      updatedBy: req.user.userId
    });

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

    const record = await findMedicalRecordById(recordId);
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

    const record = await findMedicalRecordById(recordId);
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

    // Save updated record to database
    await updateMedicalRecord(recordId, {
      attachments: record.attachments,
      updatedBy: req.user.userId
    });

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

