// Repository abstraction layer for Medical Records
// Now using PostgreSQL database instead of in-memory storage
const { MedicalRecord, Diagnosis, Treatment, LabResult } = require('../models/MedicalRecord');
const Patient = require('../models/Patient');
const { query } = require('../db/connection');
// PatientRepository is used in routes, but we don't need it here for now
// const PatientRepository = require('./PatientRepository');

// In-memory storage for patients (only used for syncing database patients to in-memory for notifications)
const patients = [];
let patientIdCounter = 1;

// ============================================
// PATIENT REPOSITORY METHODS (In-memory for notifications)
// ============================================

/**
 * Create a patient in in-memory storage (for notifications)
 * @param {Object} patientData - Patient data
 * @returns {Patient} Created patient
 */
function createPatient(patientData) {
  const patient = new Patient({
    id: patientData.id || `patient_${patientIdCounter++}`,
    ...patientData,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  patients.push(patient);
  return patient;
}

/**
 * Find patient by ID
 * @param {string} patientId - Patient ID
 * @returns {Patient|null} Patient or null
 */
function findPatientById(patientId) {
  return patients.find(p => p.id === patientId) || null;
}

/**
 * Find patient by user ID
 * @param {string} userId - User ID
 * @returns {Patient|null} Patient or null
 */
function findPatientByUserId(userId) {
  return patients.find(p => p.userId === userId) || null;
}

/**
 * Find all patients (with optional filters)
 * @param {Object} filters - Filter criteria
 * @returns {Patient[]} Array of patients
 */
function findAllPatients(filters = {}) {
  let result = [...patients];
  
  if (filters.clinicId) {
    // Filter by clinic if needed (for future implementation)
  }
  
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    result = result.filter(p => 
      p.firstName.toLowerCase().includes(searchLower) ||
      p.lastName.toLowerCase().includes(searchLower) ||
      (p.userId && p.userId.toString().includes(searchLower))
    );
  }
  
  return result;
}

/**
 * Update patient
 * @param {string} patientId - Patient ID
 * @param {Object} updateData - Data to update
 * @returns {Patient|null} Updated patient or null
 */
function updatePatient(patientId, updateData) {
  const patient = findPatientById(patientId);
  if (!patient) return null;
  
  Object.assign(patient, updateData, { updatedAt: new Date() });
  return patient;
}

// ============================================
// MEDICAL RECORD REPOSITORY METHODS (Database)
// ============================================

/**
 * Map database row to MedicalRecord model
 * @param {Object} row - Database row
 * @returns {MedicalRecord} MedicalRecord instance
 */
async function mapRowToMedicalRecord(row) {
  // Parse JSONB columns - PostgreSQL returns JSONB as JavaScript objects/arrays
  // Note: Database uses singular column names (diagnosis, treatment, medications)
  let diagnoses = [];
  if (row.diagnosis || row.diagnoses) {
    const diagnosisData = row.diagnosis || row.diagnoses;
    if (typeof diagnosisData === 'string') {
      try {
        diagnoses = JSON.parse(diagnosisData);
      } catch (e) {
        // If not JSON, treat as single diagnosis string
        diagnoses = diagnosisData ? [{ description: diagnosisData }] : [];
      }
    } else if (Array.isArray(diagnosisData)) {
      diagnoses = diagnosisData;
    } else {
      diagnoses = diagnosisData ? [diagnosisData] : [];
    }
  }
  diagnoses = diagnoses.map(d => {
    if (typeof d === 'string') {
      return new Diagnosis({ description: d });
    }
    return new Diagnosis(d);
  });

  let treatments = [];
  if (row.treatment || row.treatments) {
    const treatmentData = row.treatment || row.treatments;
    if (typeof treatmentData === 'string') {
      try {
        treatments = JSON.parse(treatmentData);
      } catch (e) {
        treatments = treatmentData ? [{ name: treatmentData, type: 'other' }] : [];
      }
    } else if (Array.isArray(treatmentData)) {
      treatments = treatmentData;
    } else {
      treatments = treatmentData ? [treatmentData] : [];
    }
  }
  treatments = treatments.map(t => {
    if (typeof t === 'string') {
      return new Treatment({ name: t, type: 'other' });
    }
    return new Treatment(t);
  });

  let labResults = [];
  if (row.lab_results) {
    if (typeof row.lab_results === 'string') {
      try {
        labResults = JSON.parse(row.lab_results);
      } catch (e) {
        labResults = [];
      }
    } else if (Array.isArray(row.lab_results)) {
      labResults = row.lab_results;
    }
  }
  labResults = labResults.map(l => new LabResult(l));

  let vitalSigns = {};
  if (row.vital_signs) {
    if (typeof row.vital_signs === 'string') {
      try {
        vitalSigns = JSON.parse(row.vital_signs);
      } catch (e) {
        vitalSigns = {};
      }
    } else if (typeof row.vital_signs === 'object') {
      vitalSigns = row.vital_signs;
    }
  }

  let attachments = [];
  if (row.attachments) {
    if (typeof row.attachments === 'string') {
      try {
        attachments = JSON.parse(row.attachments);
      } catch (e) {
        attachments = [];
      }
    } else if (Array.isArray(row.attachments)) {
      attachments = row.attachments;
    }
  }
  // Include scan_path and scan_name in attachments if they exist (legacy support)
  if (row.scan_path || row.scan_name) {
    attachments.push({
      name: row.scan_name || 'Scan',
      path: row.scan_path,
      type: 'scan'
    });
  }
  
  // Generate signed URLs for S3 attachments when fetching records
  // Note: This is done here so attachments always have signed URLs when returned
  if (attachments.length > 0) {
    const { getSignedUrlForFile } = require('../services/s3Service');
    attachments = await Promise.all(
      attachments.map(async (att) => {
        if (att.s3_key || att.s3_url) {
          try {
            const key = att.s3_key || att.s3_url.replace(`s3://${process.env.AWS_S3_BUCKET_NAME || 'mediconnect-medical-files'}/`, '');
            att.signed_url = await getSignedUrlForFile(key, 3600);
          } catch (error) {
            console.error(`Error generating signed URL for attachment ${att.id}:`, error);
            att.signed_url = null;
          }
        }
        return att;
      })
    );
  }

  let prescriptions = [];
  if (row.medications || row.prescriptions) {
    const medicationData = row.medications || row.prescriptions;
    if (typeof medicationData === 'string') {
      try {
        prescriptions = JSON.parse(medicationData);
      } catch (e) {
        prescriptions = [];
      }
    } else if (Array.isArray(medicationData)) {
      prescriptions = medicationData;
    }
  }

  // Extract patient_id from format "patient_123" or just use the number
  let patientId = row.patient_id;
  if (typeof patientId === 'number') {
    patientId = `patient_${patientId}`;
  }

  return new MedicalRecord({
    id: `record_${row.record_id}`,
    patientId: patientId,
    visitDate: row.visit_date,
    visitType: row.visit_type,
    providerId: row.doctor_id || row.provider_id, // Map doctor_id to providerId (support both)
    providerName: row.provider_name || null,
    clinicId: row.clinic_id || null,
    chiefComplaint: row.chief_complaint,
    diagnoses: diagnoses,
    treatments: treatments,
    labResults: labResults,
    vitalSigns: vitalSigns,
    notes: row.notes || '',
    prescriptions: prescriptions,
    followUpRequired: row.follow_up_required || false,
    followUpDate: row.follow_up_date,
    attachments: attachments,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by
  });
}

/**
 * Create a new medical record
 * @param {Object} recordData - Medical record data
 * @returns {Promise<MedicalRecord>} Created medical record
 */
async function createMedicalRecord(recordData) {
  // Extract patient_id number from "patient_123" format
  let patientIdNum = recordData.patientId;
  if (typeof patientIdNum === 'string' && patientIdNum.startsWith('patient_')) {
    patientIdNum = parseInt(patientIdNum.replace('patient_', ''));
  }

  // Extract doctor_id from providerId or doctor_id
  // This should be a valid doctor_id from the doctors table
  let doctorId = recordData.providerId || recordData.doctor_id;
  if (typeof doctorId === 'string' && doctorId.startsWith('doctor_')) {
    doctorId = parseInt(doctorId.replace('doctor_', ''));
  }
  if (typeof doctorId === 'string') {
    doctorId = parseInt(doctorId);
  }
  if (!doctorId || isNaN(doctorId) || doctorId <= 0) {
    throw new Error('Invalid doctor_id: A valid doctor ID is required to create a medical record');
  }

  // Prepare JSONB data - stringify for PostgreSQL JSONB columns
  // Convert model instances to plain objects and handle Date serialization
  const diagnoses = JSON.stringify((recordData.diagnoses || []).map(d => {
    if (d instanceof Diagnosis) {
      const obj = d.toJSON();
      // Convert Date objects to ISO strings
      if (obj.date && obj.date instanceof Date) {
        obj.date = obj.date.toISOString();
      }
      return obj;
    }
    // Handle plain objects with Date fields
    if (d && typeof d === 'object' && d.date instanceof Date) {
      return { ...d, date: d.date.toISOString() };
    }
    return d;
  }));
  
  const treatments = JSON.stringify((recordData.treatments || []).map(t => {
    if (t instanceof Treatment) {
      const obj = t.toJSON();
      // Convert Date objects to ISO strings
      if (obj.startDate && obj.startDate instanceof Date) {
        obj.startDate = obj.startDate.toISOString();
      }
      if (obj.endDate && obj.endDate instanceof Date) {
        obj.endDate = obj.endDate.toISOString();
      }
      return obj;
    }
    // Handle plain objects with Date fields
    if (t && typeof t === 'object') {
      const result = { ...t };
      if (t.startDate instanceof Date) result.startDate = t.startDate.toISOString();
      if (t.endDate instanceof Date) result.endDate = t.endDate.toISOString();
      return result;
    }
    return t;
  }));
  
  const labResults = JSON.stringify((recordData.labResults || []).map(l => {
    if (l instanceof LabResult) {
      const obj = l.toJSON();
      // Convert Date objects to ISO strings
      if (obj.performedDate && obj.performedDate instanceof Date) {
        obj.performedDate = obj.performedDate.toISOString();
      }
      if (obj.reportedDate && obj.reportedDate instanceof Date) {
        obj.reportedDate = obj.reportedDate.toISOString();
      }
      return obj;
    }
    // Handle plain objects with Date fields
    if (l && typeof l === 'object') {
      const result = { ...l };
      if (l.performedDate instanceof Date) result.performedDate = l.performedDate.toISOString();
      if (l.reportedDate instanceof Date) result.reportedDate = l.reportedDate.toISOString();
      return result;
    }
    return l;
  }));
  
  const vitalSigns = JSON.stringify(recordData.vitalSigns || {});
  const prescriptions = JSON.stringify(recordData.prescriptions || []);
  const attachments = JSON.stringify(recordData.attachments || []);

  // Extract appt_id if provided (can be from recordData.appt_id or recordData.appointmentId)
  // Only include if it's a valid appointment ID (medical records can exist without appointments)
  let apptId = recordData.appt_id || recordData.appointmentId;
  if (apptId) {
    if (typeof apptId === 'string' && apptId.startsWith('appt_')) {
      apptId = parseInt(apptId.replace('appt_', ''));
    }
    if (isNaN(apptId) || apptId <= 0) {
      apptId = null; // Invalid appointment ID, set to null
    }
  } else {
    apptId = null; // No appointment ID provided
  }

  const result = await query(
    `INSERT INTO emr_records (
      patient_id, doctor_id, visit_date, visit_type, chief_complaint,
      diagnosis, treatment, lab_results, vital_signs, medications,
      notes, follow_up_required, follow_up_date, attachments, appt_id, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING *`,
    [
      patientIdNum,
      doctorId,
      recordData.visitDate ? new Date(recordData.visitDate) : new Date(), // Use appointment date if provided
      recordData.visitType || 'routine',
      recordData.chiefComplaint || null,
      diagnoses,
      treatments,
      labResults,
      vitalSigns,
      prescriptions,
      recordData.notes || null,
      recordData.followUpRequired || false,
      recordData.followUpDate || null,
      attachments,
      apptId,
      recordData.createdBy || null
    ]
  );

  return await mapRowToMedicalRecord(result.rows[0]);
}

/**
 * Find medical record by ID
 * @param {string} recordId - Record ID (format: "record_123" or just "123")
 * @returns {Promise<MedicalRecord|null>} Medical record or null
 */
async function findMedicalRecordById(recordId) {
  // Extract record_id number from "record_123" format
  let recordIdNum = recordId;
  if (typeof recordIdNum === 'string' && recordIdNum.startsWith('record_')) {
    recordIdNum = parseInt(recordIdNum.replace('record_', ''));
  }

  const result = await query(
    `SELECT * FROM emr_records WHERE record_id = $1`,
    [recordIdNum]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return await mapRowToMedicalRecord(result.rows[0]);
}

/**
 * Find all medical records for a patient
 * @param {string} patientId - Patient ID (format: "patient_123" or just number)
 * @param {Object} options - Query options (sort, limit, etc.)
 * @returns {Promise<MedicalRecord[]>} Array of medical records
 */
async function findMedicalRecordsByPatientId(patientId, options = {}) {
  // Extract patient_id number from "patient_123" format
  let patientIdNum = patientId;
  if (typeof patientIdNum === 'string' && patientIdNum.startsWith('patient_')) {
    patientIdNum = parseInt(patientIdNum.replace('patient_', ''));
  }

  let queryStr = `SELECT * FROM emr_records WHERE patient_id = $1`;
  const params = [patientIdNum];

  // Add sorting
  const sortOrder = options.sortOrder || 'DESC';
  queryStr += ` ORDER BY visit_date ${sortOrder}`;

  // Add limit if specified
  if (options.limit) {
    queryStr += ` LIMIT $${params.length + 1}`;
    params.push(options.limit);
  }

  const result = await query(queryStr, params);
  return await Promise.all(result.rows.map(row => mapRowToMedicalRecord(row)));
}

/**
 * Find all medical records (with optional filters)
 * @param {Object} filters - Filter criteria
 * @returns {Promise<MedicalRecord[]>} Array of medical records
 */
async function findAllMedicalRecords(filters = {}) {
  let queryStr = `SELECT * FROM emr_records WHERE 1=1`;
  const params = [];
  let paramCount = 1;

  if (filters.patientId) {
    let patientIdNum = filters.patientId;
    if (typeof patientIdNum === 'string' && patientIdNum.startsWith('patient_')) {
      patientIdNum = parseInt(patientIdNum.replace('patient_', ''));
    }
    queryStr += ` AND patient_id = $${paramCount}`;
    params.push(patientIdNum);
    paramCount++;
  }

  if (filters.providerId) {
    let doctorId = filters.providerId;
    if (typeof doctorId === 'string' && doctorId.startsWith('doctor_')) {
      doctorId = parseInt(doctorId.replace('doctor_', ''));
    }
    queryStr += ` AND doctor_id = $${paramCount}`;
    params.push(doctorId);
    paramCount++;
  }

  if (filters.startDate) {
    queryStr += ` AND visit_date >= $${paramCount}`;
    params.push(filters.startDate);
    paramCount++;
  }

  if (filters.endDate) {
    queryStr += ` AND visit_date <= $${paramCount}`;
    params.push(filters.endDate);
    paramCount++;
  }

  if (filters.visitType) {
    queryStr += ` AND visit_type = $${paramCount}`;
    params.push(filters.visitType);
    paramCount++;
  }

  queryStr += ` ORDER BY visit_date DESC`;

  const result = await query(queryStr, params);
  return await Promise.all(result.rows.map(row => mapRowToMedicalRecord(row)));
}

/**
 * Update medical record
 * @param {string} recordId - Record ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<MedicalRecord|null>} Updated medical record or null
 */
async function updateMedicalRecord(recordId, updateData) {
  // Extract record_id number
  let recordIdNum = recordId;
  if (typeof recordIdNum === 'string' && recordIdNum.startsWith('record_')) {
    recordIdNum = parseInt(recordIdNum.replace('record_', ''));
  }

  const fields = [];
  const values = [];
  let paramCount = 1;

  // Build update query dynamically
  if (updateData.chiefComplaint !== undefined) {
    fields.push(`chief_complaint = $${paramCount}`);
    values.push(updateData.chiefComplaint);
    paramCount++;
  }

  if (updateData.diagnoses !== undefined) {
    const diagnoses = JSON.stringify((updateData.diagnoses || []).map(d => {
      if (d instanceof Diagnosis) {
        const obj = d.toJSON();
        if (obj.date && obj.date instanceof Date) {
          obj.date = obj.date.toISOString();
        }
        return obj;
      }
      if (d && typeof d === 'object' && d.date instanceof Date) {
        return { ...d, date: d.date.toISOString() };
      }
      return d;
    }));
    fields.push(`diagnosis = $${paramCount}`);
    values.push(diagnoses);
    paramCount++;
  }

  if (updateData.treatments !== undefined) {
    const treatments = JSON.stringify((updateData.treatments || []).map(t => {
      if (t instanceof Treatment) {
        const obj = t.toJSON();
        if (obj.startDate && obj.startDate instanceof Date) {
          obj.startDate = obj.startDate.toISOString();
        }
        if (obj.endDate && obj.endDate instanceof Date) {
          obj.endDate = obj.endDate.toISOString();
        }
        return obj;
      }
      if (t && typeof t === 'object') {
        const result = { ...t };
        if (t.startDate instanceof Date) result.startDate = t.startDate.toISOString();
        if (t.endDate instanceof Date) result.endDate = t.endDate.toISOString();
        return result;
      }
      return t;
    }));
    fields.push(`treatment = $${paramCount}`);
    values.push(treatments);
    paramCount++;
  }

  if (updateData.labResults !== undefined) {
    const labResults = JSON.stringify((updateData.labResults || []).map(l => {
      if (l instanceof LabResult) {
        const obj = l.toJSON();
        if (obj.performedDate && obj.performedDate instanceof Date) {
          obj.performedDate = obj.performedDate.toISOString();
        }
        if (obj.reportedDate && obj.reportedDate instanceof Date) {
          obj.reportedDate = obj.reportedDate.toISOString();
        }
        return obj;
      }
      if (l && typeof l === 'object') {
        const result = { ...l };
        if (l.performedDate instanceof Date) result.performedDate = l.performedDate.toISOString();
        if (l.reportedDate instanceof Date) result.reportedDate = l.reportedDate.toISOString();
        return result;
      }
      return l;
    }));
    fields.push(`lab_results = $${paramCount}`);
    values.push(labResults);
    paramCount++;
  }

  if (updateData.vitalSigns !== undefined) {
    fields.push(`vital_signs = $${paramCount}`);
    values.push(JSON.stringify(updateData.vitalSigns || {}));
    paramCount++;
  }

  if (updateData.prescriptions !== undefined) {
    fields.push(`medications = $${paramCount}`);
    values.push(JSON.stringify(updateData.prescriptions || []));
    paramCount++;
  }

  if (updateData.notes !== undefined) {
    fields.push(`notes = $${paramCount}`);
    values.push(updateData.notes);
    paramCount++;
  }

  if (updateData.followUpRequired !== undefined) {
    fields.push(`follow_up_required = $${paramCount}`);
    values.push(updateData.followUpRequired);
    paramCount++;
  }

  if (updateData.followUpDate !== undefined) {
    fields.push(`follow_up_date = $${paramCount}`);
    values.push(updateData.followUpDate);
    paramCount++;
  }

  if (updateData.attachments !== undefined) {
    fields.push(`attachments = $${paramCount}`);
    values.push(JSON.stringify(updateData.attachments || []));
    paramCount++;
  }

  if (fields.length === 0) {
    // No fields to update, just return the existing record
    return findMedicalRecordById(recordId);
  }

  // Add updated_at
  fields.push(`updated_at = CURRENT_TIMESTAMP`);

  values.push(recordIdNum);

  const result = await query(
    `UPDATE emr_records 
     SET ${fields.join(', ')}
     WHERE record_id = $${paramCount}
     RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return null;
  }

  return await mapRowToMedicalRecord(result.rows[0]);
}

/**
 * Delete medical record
 * @param {string} recordId - Record ID
 * @returns {Promise<boolean>} True if deleted, false otherwise
 */
async function deleteMedicalRecord(recordId) {
  // Extract record_id number
  let recordIdNum = recordId;
  if (typeof recordIdNum === 'string' && recordIdNum.startsWith('record_')) {
    recordIdNum = parseInt(recordIdNum.replace('record_', ''));
  }

  const result = await query(
    `DELETE FROM emr_records WHERE record_id = $1 RETURNING record_id`,
    [recordIdNum]
  );

  return result.rows.length > 0;
}

/**
 * Get patient medical history summary
 * @param {string} patientId - Patient ID
 * @returns {Promise<Object>} Medical history summary
 */
async function getPatientMedicalHistory(patientId) {
  const records = await findMedicalRecordsByPatientId(patientId, { sortOrder: 'DESC' });

  // Extract all diagnoses, treatments, and lab results
  const allDiagnoses = [];
  const allTreatments = [];
  const allLabResults = [];

  records.forEach(record => {
    allDiagnoses.push(...(record.diagnoses || []));
    allTreatments.push(...(record.treatments || []));
    allLabResults.push(...(record.labResults || []));
  });

  return {
    totalRecords: records.length,
    diagnoses: allDiagnoses,
    treatments: allTreatments,
    labResults: allLabResults,
    recentRecords: records.slice(0, 10).map(r => r.toJSON())
  };
}

module.exports = {
  // Patient methods (in-memory for notifications)
  createPatient,
  findPatientById,
  findPatientByUserId,
  findAllPatients,
  updatePatient,
  
  // Medical Record methods (database)
  createMedicalRecord,
  findMedicalRecordById,
  findMedicalRecordsByPatientId,
  findAllMedicalRecords,
  updateMedicalRecord,
  deleteMedicalRecord,
  getPatientMedicalHistory,
  
  // Export storage for testing/debugging
  _getStorage: () => ({ patients, medicalRecords: [] }) // medicalRecords now in DB
};
