// Prescription model - manages medication prescriptions and pharmacy communication
class Prescription {
  constructor({
    id,
    patientId,
    patientName, // Patient's full name for display
    medicalRecordId, // Link to the medical record where this was prescribed
    providerId, // Doctor who prescribed
    providerName,
    clinicId,
    medicationName,
    medicationCode, // RxNorm or NDC code
    dosage,
    dosageUnit, // 'mg', 'ml', 'mcg', etc.
    form, // 'tablet', 'capsule', 'liquid', 'injection', etc.
    frequency, // 'once daily', 'twice daily', 'every 6 hours', etc.
    route, // 'oral', 'topical', 'injection', etc.
    duration, // '7 days', '2 weeks', '1 month', etc.
    quantity,
    refills,
    startDate,
    endDate,
    instructions, // Patient instructions (e.g., "Take with food")
    indication, // Reason for prescription
    status, // 'pending', 'sent', 'filled', 'cancelled', 'expired'
    pharmacyId, // Pharmacy where prescription was sent
    pharmacyName,
    sentToPharmacyDate,
    filledDate,
    notes,
    priority, // 'routine', 'urgent', 'stat'
    substitutionAllowed, // Boolean - can generic be substituted
    daw, // Dispense As Written - must use brand name
    createdAt,
    updatedAt,
    createdBy,
    updatedBy
  }) {
    this.id = id;
    this.patientId = patientId;
    this.patientName = patientName;
    this.medicalRecordId = medicalRecordId;
    this.providerId = providerId;
    this.providerName = providerName;
    this.clinicId = clinicId;
    this.medicationName = medicationName;
    this.medicationCode = medicationCode;
    this.dosage = dosage;
    this.dosageUnit = dosageUnit || 'mg';
    this.form = form || 'tablet';
    this.frequency = frequency;
    this.route = route || 'oral';
    this.duration = duration;
    this.quantity = quantity;
    this.refills = refills || 0;
    this.startDate = startDate || new Date();
    this.endDate = endDate;
    this.instructions = instructions;
    this.indication = indication;
    this.status = status || 'pending';
    this.pharmacyId = pharmacyId;
    this.pharmacyName = pharmacyName;
    this.sentToPharmacyDate = sentToPharmacyDate;
    this.filledDate = filledDate;
    this.notes = notes;
    this.priority = priority || 'routine';
    this.substitutionAllowed = substitutionAllowed !== undefined ? substitutionAllowed : true;
    this.daw = daw || false;
    this.createdAt = createdAt || new Date();
    this.updatedAt = updatedAt || new Date();
    this.createdBy = createdBy;
    this.updatedBy = updatedBy;
  }

  toJSON() {
    return {
      id: this.id,
      patientId: this.patientId,
      patientName: this.patientName,
      medicalRecordId: this.medicalRecordId,
      providerId: this.providerId,
      providerName: this.providerName,
      clinicId: this.clinicId,
      medicationName: this.medicationName,
      medicationCode: this.medicationCode,
      dosage: this.dosage,
      dosageUnit: this.dosageUnit,
      form: this.form,
      frequency: this.frequency,
      route: this.route,
      duration: this.duration,
      quantity: this.quantity,
      refills: this.refills,
      startDate: this.startDate,
      endDate: this.endDate,
      instructions: this.instructions,
      indication: this.indication,
      status: this.status,
      pharmacyId: this.pharmacyId,
      pharmacyName: this.pharmacyName,
      sentToPharmacyDate: this.sentToPharmacyDate,
      filledDate: this.filledDate,
      notes: this.notes,
      priority: this.priority,
      substitutionAllowed: this.substitutionAllowed,
      daw: this.daw,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      createdBy: this.createdBy,
      updatedBy: this.updatedBy
    };
  }
}

// Pharmacy model - stores pharmacy information for prescription routing
class Pharmacy {
  constructor({
    id,
    name,
    ncpdpId, // National Council for Prescription Drug Programs ID
    npi, // National Provider Identifier
    address,
    city,
    state,
    zipCode,
    phoneNumber,
    faxNumber,
    email,
    isActive,
    deliveryAvailable,
    hours,
    preferredByClinic, // If this clinic prefers this pharmacy
    createdAt,
    updatedAt
  }) {
    this.id = id;
    this.name = name;
    this.ncpdpId = ncpdpId;
    this.npi = npi;
    this.address = address;
    this.city = city;
    this.state = state;
    this.zipCode = zipCode;
    this.phoneNumber = phoneNumber;
    this.faxNumber = faxNumber;
    this.email = email;
    this.isActive = isActive !== undefined ? isActive : true;
    this.deliveryAvailable = deliveryAvailable || false;
    this.hours = hours;
    this.preferredByClinic = preferredByClinic || false;
    this.createdAt = createdAt || new Date();
    this.updatedAt = updatedAt || new Date();
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      ncpdpId: this.ncpdpId,
      npi: this.npi,
      address: this.address,
      city: this.city,
      state: this.state,
      zipCode: this.zipCode,
      phoneNumber: this.phoneNumber,
      faxNumber: this.faxNumber,
      email: this.email,
      isActive: this.isActive,
      deliveryAvailable: this.deliveryAvailable,
      hours: this.hours,
      preferredByClinic: this.preferredByClinic,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = {
  Prescription,
  Pharmacy
};
