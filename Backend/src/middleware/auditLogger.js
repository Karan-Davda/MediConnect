const { createAuditLog } = require('../models/AuditLog');

// Audit logging middleware for HIPAA compliance
function auditLogger(action, resourceType) {
  return (req, res, next) => {
    const originalSend = res.send;
    
    // Override res.send to capture response
    res.send = function(body) {
      res.send = originalSend;
      
      // Log the action after response is sent
      if (req.user && res.statusCode < 400) {
        const logData = {
          userId: req.user.userId,
          userEmail: req.user.email,
          action: action,
          resourceType: resourceType,
          resourceId: req.params.id || req.params.userId || null,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('user-agent'),
          details: {
            method: req.method,
            path: req.path,
            query: req.query,
            statusCode: res.statusCode
          }
        };
        
        createAuditLog(logData);
      }
      
      return res.send.call(this, body);
    };
    
    next();
  };
}

// Specific audit log actions
const AUDIT_ACTIONS = {
  VIEW: 'VIEW',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  EXPORT: 'EXPORT',
  SHARE: 'SHARE'
};

function logAccess(req, action, details = {}) {
  if (!req.user) return;
  
  createAuditLog({
    userId: req.user.userId,
    userEmail: req.user.email,
    action: action,
    resourceType: details.resourceType || 'UNKNOWN',
    resourceId: details.resourceId,
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    details: {
      method: req.method,
      path: req.path,
      ...details
    }
  });
}

module.exports = {
  auditLogger,
  AUDIT_ACTIONS,
  logAccess
};

