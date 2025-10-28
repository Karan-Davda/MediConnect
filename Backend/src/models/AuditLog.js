// Audit logging for HIPAA compliance
class AuditLog {
  constructor({
    id,
    userId,
    userEmail,
    action,
    resourceType,
    resourceId,
    ipAddress,
    userAgent,
    details,
    timestamp
  }) {
    this.id = id;
    this.userId = userId;
    this.userEmail = userEmail;
    this.action = action; // 'VIEW', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'
    this.resourceType = resourceType; // 'PROFILE', 'MEDICAL_RECORD', 'APPOINTMENT', etc.
    this.resourceId = resourceId;
    this.ipAddress = ipAddress;
    this.userAgent = userAgent;
    this.details = details; // Additional metadata
    this.timestamp = timestamp || new Date();
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      userEmail: this.userEmail,
      action: this.action,
      resourceType: this.resourceType,
      resourceId: this.resourceId,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

// In-memory storage for demo purposes
const auditLogs = [];
let logIdCounter = 1;

function createAuditLog(data) {
  const log = new AuditLog({
    id: `log_${logIdCounter++}`,
    ...data,
    timestamp: new Date()
  });
  auditLogs.push(log);
  return log;
}

function getAuditLogs(filters = {}) {
  let logs = [...auditLogs];
  
  if (filters.userId) {
    logs = logs.filter(log => log.userId === filters.userId);
  }
  
  if (filters.action) {
    logs = logs.filter(log => log.action === filters.action);
  }
  
  if (filters.resourceType) {
    logs = logs.filter(log => log.resourceType === filters.resourceType);
  }
  
  if (filters.startDate) {
    const start = new Date(filters.startDate);
    logs = logs.filter(log => new Date(log.timestamp) >= start);
  }
  
  if (filters.endDate) {
    const end = new Date(filters.endDate);
    logs = logs.filter(log => new Date(log.timestamp) <= end);
  }
  
  return logs;
}

module.exports = {
  AuditLog,
  createAuditLog,
  getAuditLogs
};

