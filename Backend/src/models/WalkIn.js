class WalkIn {
  constructor({
    id,
    patientId,
    patientName,
    patientEmail,
    patientPhone,
    clinicId,
    providerId,
    reason,
    triageLevel,
    registrationTime,
    status,
    queuePosition,
    estimatedWaitTime,
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
    this.reason = reason;
    this.triageLevel = triageLevel || 'routine';
    this.registrationTime = registrationTime || new Date();
    this.status = status || 'waiting';
    this.queuePosition = queuePosition;
    this.estimatedWaitTime = estimatedWaitTime;
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
      reason: this.reason,
      triageLevel: this.triageLevel,
      registrationTime: this.registrationTime,
      status: this.status,
      queuePosition: this.queuePosition,
      estimatedWaitTime: this.estimatedWaitTime,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = WalkIn;
