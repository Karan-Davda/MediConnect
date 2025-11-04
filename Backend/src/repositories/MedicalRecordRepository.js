// Repository abstraction layer for Medical Records
// This allows easy swapping between in-memory storage and database later
const { MedicalRecord, Diagnosis, Treatment, LabResult } = require('../models/MedicalRecord');
const Patient = require('../models/Patient');

// In-memory storage (will be replaced with database calls later)
const patients = [];
const medicalRecords = [];
let patientIdCounter = 1;
let recordIdCounter = 1;

// Initialize with temporary sample patient data
// When database is ready, remove this and load from database instead
function initializeSamplePatients() {
  if (patients.length === 0) {
    // Sample patients for testing
    const samplePatients = [
      {
        id: `patient_${patientIdCounter++}`,
        userId: '1', // Link to patient user
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1985-03-15',
        gender: 'male',
        phoneNumber: '+1-555-0101',
        address: {
          street: '123 Main St',
          city: 'Boston',
          state: 'MA',
          zipCode: '02101'
        },
        emergencyContact: {
          name: 'Jane Doe',
          relationship: 'Spouse',
          phone: '+1-555-0102'
        },
        insuranceInfo: {
          provider: 'Blue Cross Blue Shield',
          policyNumber: 'BC123456789',
          groupNumber: 'GRP001'
        },
        allergies: ['Penicillin', 'Peanuts'],
        medicalHistory: [],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      },
      {
        id: `patient_${patientIdCounter++}`,
        userId: null,
        firstName: 'Sarah',
        lastName: 'Johnson',
        dateOfBirth: '1990-07-22',
        gender: 'female',
        phoneNumber: '+1-555-0201',
        address: {
          street: '456 Oak Ave',
          city: 'Cambridge',
          state: 'MA',
          zipCode: '02138'
        },
        emergencyContact: {
          name: 'Michael Johnson',
          relationship: 'Brother',
          phone: '+1-555-0202'
        },
        insuranceInfo: {
          provider: 'Aetna',
          policyNumber: 'AET987654321',
          groupNumber: 'GRP002'
        },
        allergies: [],
        medicalHistory: [],
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15')
      },
      {
        id: `patient_${patientIdCounter++}`,
        userId: null,
        firstName: 'Robert',
        lastName: 'Smith',
        dateOfBirth: '1978-11-08',
        gender: 'male',
        phoneNumber: '+1-555-0301',
        address: {
          street: '789 Elm Street',
          city: 'Somerville',
          state: 'MA',
          zipCode: '02144'
        },
        emergencyContact: {
          name: 'Emily Smith',
          relationship: 'Wife',
          phone: '+1-555-0302'
        },
        insuranceInfo: {
          provider: 'UnitedHealthcare',
          policyNumber: 'UHC456789123',
          groupNumber: 'GRP003'
        },
        allergies: ['Sulfa drugs'],
        medicalHistory: [],
        createdAt: new Date('2024-02-01'),
        updatedAt: new Date('2024-02-01')
      },
      {
        id: `patient_${patientIdCounter++}`,
        userId: null,
        firstName: 'Maria',
        lastName: 'Garcia',
        dateOfBirth: '1995-05-30',
        gender: 'female',
        phoneNumber: '+1-555-0401',
        address: {
          street: '321 Pine Road',
          city: 'Quincy',
          state: 'MA',
          zipCode: '02169'
        },
        emergencyContact: {
          name: 'Carlos Garcia',
          relationship: 'Father',
          phone: '+1-555-0402'
        },
        insuranceInfo: {
          provider: 'Cigna',
          policyNumber: 'CIG789123456',
          groupNumber: 'GRP004'
        },
        allergies: ['Latex'],
        medicalHistory: [],
        createdAt: new Date('2024-02-15'),
        updatedAt: new Date('2024-02-15')
      },
      {
        id: `patient_${patientIdCounter++}`,
        userId: null,
        firstName: 'David',
        lastName: 'Williams',
        dateOfBirth: '1988-12-20',
        gender: 'male',
        phoneNumber: '+1-555-0501',
        address: {
          street: '654 Maple Drive',
          city: 'Newton',
          state: 'MA',
          zipCode: '02458'
        },
        emergencyContact: {
          name: 'Lisa Williams',
          relationship: 'Sister',
          phone: '+1-555-0502'
        },
        insuranceInfo: {
          provider: 'Harvard Pilgrim',
          policyNumber: 'HP147258369',
          groupNumber: 'GRP005'
        },
        allergies: [],
        medicalHistory: [],
        createdAt: new Date('2024-03-01'),
        updatedAt: new Date('2024-03-01')
      }
    ];

    // Add sample patients to the array
    samplePatients.forEach(patientData => {
      const patient = new Patient(patientData);
      patients.push(patient);
    });
  }
}

// Initialize sample data on module load
// When database is ready, comment this out and load from database instead
initializeSamplePatients();

// ============================================
// PATIENT REPOSITORY METHODS
// ============================================

/**
 * Create a new patient
 * @param {Object} patientData - Patient data
 * @returns {Patient} Created patient
 */
function createPatient(patientData) {
  const patient = new Patient({
    id: `patient_${patientIdCounter++}`,
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
// MEDICAL RECORD REPOSITORY METHODS
// ============================================

/**
 * Create a new medical record
 * @param {Object} recordData - Medical record data
 * @returns {MedicalRecord} Created medical record
 */
function createMedicalRecord(recordData) {
  // Transform nested objects if needed
  const diagnoses = (recordData.diagnoses || []).map(d => new Diagnosis(d));
  const treatments = (recordData.treatments || []).map(t => new Treatment(t));
  const labResults = (recordData.labResults || []).map(l => new LabResult(l));
  
  const record = new MedicalRecord({
    id: `record_${recordIdCounter++}`,
    ...recordData,
    diagnoses,
    treatments,
    labResults,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  medicalRecords.push(record);
  return record;
}

/**
 * Find medical record by ID
 * @param {string} recordId - Record ID
 * @returns {MedicalRecord|null} Medical record or null
 */
function findMedicalRecordById(recordId) {
  return medicalRecords.find(r => r.id === recordId) || null;
}

/**
 * Find all medical records for a patient
 * @param {string} patientId - Patient ID
 * @param {Object} options - Query options (sort, limit, etc.)
 * @returns {MedicalRecord[]} Array of medical records
 */
function findMedicalRecordsByPatientId(patientId, options = {}) {
  let records = medicalRecords.filter(r => r.patientId === patientId);
  
  // Sort by date (newest first by default)
  const sortOrder = options.sortOrder || 'desc';
  records.sort((a, b) => {
    const dateA = new Date(a.visitDate);
    const dateB = new Date(b.visitDate);
    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
  });
  
  // Apply limit if specified
  if (options.limit) {
    records = records.slice(0, options.limit);
  }
  
  return records;
}

/**
 * Find all medical records (with optional filters)
 * @param {Object} filters - Filter criteria
 * @returns {MedicalRecord[]} Array of medical records
 */
function findAllMedicalRecords(filters = {}) {
  let records = [...medicalRecords];
  
  if (filters.patientId) {
    records = records.filter(r => r.patientId === filters.patientId);
  }
  
  if (filters.providerId) {
    records = records.filter(r => r.providerId === filters.providerId);
  }
  
  if (filters.clinicId) {
    records = records.filter(r => r.clinicId === filters.clinicId);
  }
  
  if (filters.startDate) {
    const start = new Date(filters.startDate);
    records = records.filter(r => new Date(r.visitDate) >= start);
  }
  
  if (filters.endDate) {
    const end = new Date(filters.endDate);
    records = records.filter(r => new Date(r.visitDate) <= end);
  }
  
  if (filters.visitType) {
    records = records.filter(r => r.visitType === filters.visitType);
  }
  
  // Sort by date (newest first)
  records.sort((a, b) => {
    const dateA = new Date(a.visitDate);
    const dateB = new Date(b.visitDate);
    return dateB - dateA;
  });
  
  return records;
}

/**
 * Update medical record
 * @param {string} recordId - Record ID
 * @param {Object} updateData - Data to update
 * @returns {MedicalRecord|null} Updated record or null
 */
function updateMedicalRecord(recordId, updateData) {
  const record = findMedicalRecordById(recordId);
  if (!record) return null;
  
  // Transform nested objects if they're being updated
  if (updateData.diagnoses) {
    updateData.diagnoses = updateData.diagnoses.map(d => 
      d instanceof Diagnosis ? d : new Diagnosis(d)
    );
  }
  if (updateData.treatments) {
    updateData.treatments = updateData.treatments.map(t => 
      t instanceof Treatment ? t : new Treatment(t)
    );
  }
  if (updateData.labResults) {
    updateData.labResults = updateData.labResults.map(l => 
      l instanceof LabResult ? l : new LabResult(l)
    );
  }
  
  Object.assign(record, updateData, { updatedAt: new Date() });
  return record;
}

/**
 * Delete medical record
 * @param {string} recordId - Record ID
 * @returns {boolean} True if deleted, false if not found
 */
function deleteMedicalRecord(recordId) {
  const index = medicalRecords.findIndex(r => r.id === recordId);
  if (index === -1) return false;
  
  medicalRecords.splice(index, 1);
  return true;
}

/**
 * Get patient medical history summary
 * @param {string} patientId - Patient ID
 * @returns {Object} Medical history summary
 */
function getPatientMedicalHistory(patientId) {
  const records = findMedicalRecordsByPatientId(patientId);
  const patient = findPatientById(patientId);
  
  const allDiagnoses = [];
  const allTreatments = [];
  const allLabResults = [];
  
  records.forEach(record => {
    allDiagnoses.push(...record.diagnoses);
    allTreatments.push(...record.treatments);
    allLabResults.push(...record.labResults);
  });
  
  return {
    patient: patient ? patient.toJSON() : null,
    totalRecords: records.length,
    diagnoses: allDiagnoses,
    treatments: allTreatments,
    labResults: allLabResults,
    recentRecords: records.slice(0, 10).map(r => r.toJSON())
  };
}

// ============================================
// DATABASE MIGRATION HELPERS
// ============================================

/**
 * When database is ready, replace these methods with actual database calls
 * Example:
 * 
 * async function createMedicalRecord(recordData) {
 *   const db = await getDatabase();
 *   const result = await db.collection('medical_records').insertOne(recordData);
 *   return findMedicalRecordById(result.insertedId);
 * }
 * 
 * The interface remains the same, so routes don't need to change!
 */

module.exports = {
  // Patient methods
  createPatient,
  findPatientById,
  findPatientByUserId,
  findAllPatients,
  updatePatient,
  
  // Medical Record methods
  createMedicalRecord,
  findMedicalRecordById,
  findMedicalRecordsByPatientId,
  findAllMedicalRecords,
  updateMedicalRecord,
  deleteMedicalRecord,
  getPatientMedicalHistory,
  
  // Export storage for testing/debugging (remove in production)
  _getStorage: () => ({ patients, medicalRecords })
};

