class CheckIn {
  constructor({
    id,
    patientId,
    appointmentId,
    clinicId,
    checkInTime,
    status,
    queuePosition,
    estimatedWaitTime,
    providerId,
    reason,
    triageLevel,
    createdAt,
    updatedAt
  }) {
    this.id = id;
    this.patientId = patientId;
    this.appointmentId = appointmentId;
    this.clinicId = clinicId;
    this.checkInTime = checkInTime || new Date();
    this.status = status || 'waiting';
    this.queuePosition = queuePosition;
    this.estimatedWaitTime = estimatedWaitTime;
    this.providerId = providerId;
    this.reason = reason;
    this.triageLevel = triageLevel || 'routine';
    this.createdAt = createdAt || new Date();
    this.updatedAt = updatedAt || new Date();
  }

  toJSON() {
    return {
      id: this.id,
      patientId: this.patientId,
      appointmentId: this.appointmentId,
      clinicId: this.clinicId,
      checkInTime: this.checkInTime,
      status: this.status,
      queuePosition: this.queuePosition,
      estimatedWaitTime: this.estimatedWaitTime,
      providerId: this.providerId,
      reason: this.reason,
      triageLevel: this.triageLevel,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = CheckIn;
