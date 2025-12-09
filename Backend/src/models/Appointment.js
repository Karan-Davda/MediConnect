class Appointment {
  constructor({
    id,
    appointmentNumber,
    patientId,
    patientName,
    patientEmail,
    patientPhone,
    providerId,
    providerName,
    appointmentDate,
    appointmentTime,
    duration = 30,
    reason,
    type,
    status,
    location,
    notes,
    fee,
    reminderSent = false,
    reminderSentAt,
    createdAt,
    updatedAt,
    createdBy,
    updatedBy
  }) {
    this.id = id;
    this.appointmentNumber = appointmentNumber;
    this.patientId = patientId;
    this.patientName = patientName;
    this.patientEmail = patientEmail;
    this.patientPhone = patientPhone;
    this.providerId = providerId;
    this.providerName = providerName;
    this.appointmentDate = appointmentDate;
    this.appointmentTime = appointmentTime;
    this.duration = duration;
    this.reason = reason;
    this.type = type;
    this.status = status;
    this.location = location;
    this.notes = notes;
    this.fee = fee;
    this.reminderSent = reminderSent;
    this.reminderSentAt = reminderSentAt;
    this.createdAt = createdAt || new Date();
    this.updatedAt = updatedAt || new Date();
    this.createdBy = createdBy;
    this.updatedBy = updatedBy;
  }

  toJSON() {
    return {
      id: this.id,
      appointmentNumber: this.appointmentNumber,
      patientId: this.patientId,
      patientName: this.patientName,
      patientEmail: this.patientEmail,
      patientPhone: this.patientPhone,
      providerId: this.providerId,
      providerName: this.providerName,
      appointmentDate: this.appointmentDate,
      appointmentTime: this.appointmentTime,
      duration: this.duration,
      reason: this.reason,
      type: this.type,
      status: this.status,
      location: this.location,
      notes: this.notes,
      fee: this.fee,
      reminderSent: this.reminderSent,
      reminderSentAt: this.reminderSentAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Appointment;
