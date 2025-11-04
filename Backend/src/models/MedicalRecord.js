// Medical Record model - stores comprehensive patient health information
class MedicalRecord {
  constructor({
    id,
    patientId,
    visitDate,
    visitType, // 'routine', 'emergency', 'follow-up', 'consultation'
    providerId, // Doctor/Staff who created the record
    providerName,
    clinicId,
    chiefComplaint,
    diagnoses = [],
    treatments = [],
    labResults = [],
    vitalSigns = {},
    notes = '',
    prescriptions = [],
    followUpRequired = false,
    followUpDate = null,
    attachments = [],
    createdAt,
    updatedAt,
    createdBy,
    updatedBy
  }) {
    this.id = id;
    this.patientId = patientId;
    this.visitDate = visitDate || new Date();
    this.visitType = visitType;
    this.providerId = providerId;
    this.providerName = providerName;
    this.clinicId = clinicId;
    this.chiefComplaint = chiefComplaint;
    this.diagnoses = diagnoses; // Array of Diagnosis objects
    this.treatments = treatments; // Array of Treatment objects
    this.labResults = labResults; // Array of LabResult objects
    this.vitalSigns = vitalSigns; // { bloodPressure, heartRate, temperature, weight, height, etc. }
    this.notes = notes;
    this.prescriptions = prescriptions;
    this.followUpRequired = followUpRequired;
    this.followUpDate = followUpDate;
    this.attachments = attachments;
    this.createdAt = createdAt || new Date();
    this.updatedAt = updatedAt || new Date();
    this.createdBy = createdBy;
    this.updatedBy = updatedBy;
  }

  toJSON() {
    return {
      id: this.id,
      patientId: this.patientId,
      visitDate: this.visitDate,
      visitType: this.visitType,
      providerId: this.providerId,
      providerName: this.providerName,
      clinicId: this.clinicId,
      chiefComplaint: this.chiefComplaint,
      diagnoses: this.diagnoses,
      treatments: this.treatments,
      labResults: this.labResults,
      vitalSigns: this.vitalSigns,
      notes: this.notes,
      prescriptions: this.prescriptions,
      followUpRequired: this.followUpRequired,
      followUpDate: this.followUpDate,
      attachments: this.attachments,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      createdBy: this.createdBy,
      updatedBy: this.updatedBy
    };
  }
}

// Diagnosis sub-model
class Diagnosis {
  constructor({
    code, // ICD-10 code
    description,
    status, // 'confirmed', 'rule_out', 'differential'
    date,
    notes
  }) {
    this.code = code;
    this.description = description;
    this.status = status || 'confirmed';
    this.date = date || new Date();
    this.notes = notes;
  }

  toJSON() {
    return {
      code: this.code,
      description: this.description,
      status: this.status,
      date: this.date,
      notes: this.notes
    };
  }
}

// Treatment sub-model
class Treatment {
  constructor({
    type, // 'medication', 'procedure', 'therapy', 'surgery', 'other'
    name,
    description,
    dosage,
    frequency,
    duration,
    startDate,
    endDate,
    status, // 'active', 'completed', 'discontinued'
    notes
  }) {
    this.type = type;
    this.name = name;
    this.description = description;
    this.dosage = dosage;
    this.frequency = frequency;
    this.duration = duration;
    this.startDate = startDate || new Date();
    this.endDate = endDate;
    this.status = status || 'active';
    this.notes = notes;
  }

  toJSON() {
    return {
      type: this.type,
      name: this.name,
      description: this.description,
      dosage: this.dosage,
      frequency: this.frequency,
      duration: this.duration,
      startDate: this.startDate,
      endDate: this.endDate,
      status: this.status,
      notes: this.notes
    };
  }
}

// Lab Result sub-model
class LabResult {
  constructor({
    testName,
    testCode, // LOINC code
    result,
    unit,
    referenceRange,
    status, // 'normal', 'abnormal', 'critical', 'pending'
    performedDate,
    reportedDate,
    labName,
    notes
  }) {
    this.testName = testName;
    this.testCode = testCode;
    this.result = result;
    this.unit = unit;
    this.referenceRange = referenceRange;
    this.status = status || 'normal';
    this.performedDate = performedDate || new Date();
    this.reportedDate = reportedDate;
    this.labName = labName;
    this.notes = notes;
  }

  toJSON() {
    return {
      testName: this.testName,
      testCode: this.testCode,
      result: this.result,
      unit: this.unit,
      referenceRange: this.referenceRange,
      status: this.status,
      performedDate: this.performedDate,
      reportedDate: this.reportedDate,
      labName: this.labName,
      notes: this.notes
    };
  }
}

module.exports = {
  MedicalRecord,
  Diagnosis,
  Treatment,
  LabResult
};

