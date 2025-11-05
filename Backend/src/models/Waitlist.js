class Waitlist {
  constructor({
    id,
    patientId,
    patientName,
    patientEmail,
    patientPhone,
    clinicId,
    providerId,
    preferredDate,
    preferredTimeSlot,
    reason,
    priority,
    status,
    addedAt,
    estimatedCallbackDate,
    notes,
    createdAt,
    updatedAt
  }) {
    this.id = id;
    this.patientId = patientId;
    this.patientName = patientName;
    this.patientEmail = patientEmail;
    this.patientPhone = patientPhone;
    this.clinicId = clinicId;
    this.providerId = providerId;
    this.preferredDate = preferredDate;
    this.preferredTimeSlot = preferredTimeSlot;
    this.reason = reason;
    this.priority = priority || 'normal';
    this.status = status || 'active';
    this.addedAt = addedAt || new Date();
    this.estimatedCallbackDate = estimatedCallbackDate;
    this.notes = notes;
    this.createdAt = createdAt || new Date();
    this.updatedAt = updatedAt || new Date();
  }

  toJSON() {
    return {
      id: this.id,
      patientId: this.patientId,
      patientName: this.patientName,
      patientEmail: this.patientEmail,
      patientPhone: this.patientPhone,
      clinicId: this.clinicId,
      providerId: this.providerId,
      preferredDate: this.preferredDate,
      preferredTimeSlot: this.preferredTimeSlot,
      reason: this.reason,
      priority: this.priority,
      status: this.status,
      addedAt: this.addedAt,
      estimatedCallbackDate: this.estimatedCallbackDate,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Waitlist;
