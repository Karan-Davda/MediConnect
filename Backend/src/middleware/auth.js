const jwt = require('jsonwebtoken');
const { ROLES, hasPermission, canAccess } = require('../models/Role');

// Mock user database for demo
const users = [
  {
    id: '1',
    email: 'patient@example.com',
    password: 'password123',
    name: 'John Patient',
    role: ROLES.PATIENT,
    clinicId: null,
    isActive: true
  },
  {
    id: '2',
    email: 'doctor@example.com',
    password: 'password123',
    name: 'Dr. Jane Smith',
    role: ROLES.DOCTOR,
    clinicId: 'clinic1',
    isActive: true
  },
  {
    id: '3',
    email: 'admin@example.com',
    password: 'password123',
    name: 'Sarah Administrator',
    role: ROLES.CLINIC_ADMIN,
    clinicId: 'clinic1',
    isActive: true
  },
  {
    id: '4',
    email: 'staff@example.com',
    password: 'password123',
    name: 'Mike Clinic Staff',
    role: ROLES.CLINIC_STAFF,
    clinicId: 'clinic1',
    isActive: true
  },
  {
    id: '5',
    email: 'account@example.com',
    password: 'password123',
    name: 'Lisa Account Manager',
    role: ROLES.ACCOUNT_MANAGER,
    clinicId: null,
    isActive: true
  },
  {
    id: '6',
    email: 'cs@example.com',
    password: 'password123',
    name: 'Tom Customer Success',
    role: ROLES.CUSTOMER_SUCCESS,
    clinicId: null,
    isActive: true
  }
];

// Authentication middleware
function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Check if user has permission
function checkPermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

// Check if user can access resource owned by another user
function checkAccessControl(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Allow if user is accessing their own resource
  if (req.params.userId === req.user.userId || req.body.userId === req.user.userId) {
    return next();
  }

  // Check if user has higher or equal role to access the resource
  const targetUser = users.find(u => u.id === req.params.userId);
  if (targetUser && canAccess(req.user.role, targetUser.role)) {
    return next();
  }

  return res.status(403).json({ error: 'Access denied' });
}

// Role-based authorization
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient privileges' });
    }

    next();
  };
}

module.exports = {
  authenticate,
  checkPermission,
  checkAccessControl,
  requireRole,
  users
};

