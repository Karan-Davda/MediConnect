// Notification model - stores patient notifications
class Notification {
  constructor({
    id,
    patientId,
    type, // 'test_result', 'appointment', 'prescription', etc.
    title,
    message,
    labResult = null, // LabResult object if type is 'test_result'
    medicalRecordId = null,
    status = 'unread', // 'unread', 'read'
    createdAt,
    readAt = null
  }) {
    this.id = id;
    this.patientId = patientId;
    this.type = type;
    this.title = title;
    this.message = message;
    this.labResult = labResult;
    this.medicalRecordId = medicalRecordId;
    this.status = status;
    this.createdAt = createdAt || new Date();
    this.readAt = readAt;
  }

  markAsRead() {
    this.status = 'read';
    this.readAt = new Date();
  }

  toJSON() {
    return {
      id: this.id,
      patientId: this.patientId,
      type: this.type,
      title: this.title,
      message: this.message,
      labResult: this.labResult ? (typeof this.labResult.toJSON === 'function' ? this.labResult.toJSON() : this.labResult) : null,
      medicalRecordId: this.medicalRecordId,
      status: this.status,
      createdAt: this.createdAt,
      readAt: this.readAt
    };
  }
}

module.exports = Notification;

