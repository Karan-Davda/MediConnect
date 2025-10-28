const express = require('express');
const { authenticate, requireRole, users: getUsers } = require('../middleware/auth');
const { PERMISSIONS } = require('../models/Role');
const { createAuditLog, getAuditLogs, AuditLog } = require('../models/AuditLog');
const { logAccess, AUDIT_ACTIONS } = require('../middleware/auditLogger');
const router = express.Router();

// Helper to get users list
const users = () => getUsers();
let usersList = getUsers();

// Get all users (admin only)
router.get('/users', authenticate, requireRole('clinic_admin', 'account_manager', 'customer_success'), async (req, res) => {
  try {
    logAccess(req, AUDIT_ACTIONS.VIEW, {
      resourceType: 'USER',
      details: 'Viewing all users'
    });
    
    res.json({
      users: usersList.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        clinicId: u.clinicId,
        isActive: u.isActive
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new user (admin only)
router.post('/users', authenticate, requireRole('clinic_admin', 'account_manager'), async (req, res) => {
  try {
    const { name, email, password, role, clinicId, isActive } = req.body;
    
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user already exists
    if (usersList.find(u => u.email === email)) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Create new user
    const newUser = {
      id: String(usersList.length + 1),
      email,
      password,
      name,
      role,
      clinicId: clinicId || null,
      isActive: isActive !== undefined ? isActive : true
    };

    usersList.push(newUser);

    logAccess(req, AUDIT_ACTIONS.CREATE, {
      resourceType: 'USER',
      resourceId: newUser.id,
      details: `Created user: ${name}`
    });
    
    res.json({
      message: 'User created successfully',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        clinicId: newUser.clinicId,
        isActive: newUser.isActive
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user by ID
router.get('/users/:id', authenticate, async (req, res) => {
  try {
    const userId = req.params.id;
    const requestorId = req.user.userId;
    
    // Users can view their own profile, or admins can view any profile
    if (userId !== requestorId && !['clinic_admin', 'account_manager', 'customer_success'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const user = users().find(u => u.id === userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    logAccess(req, AUDIT_ACTIONS.VIEW, {
      resourceType: 'USER',
      resourceId: userId
    });
    
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      clinicId: user.clinicId,
      isActive: user.isActive
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user permissions
router.put('/users/:id/permissions', authenticate, requireRole('clinic_admin', 'account_manager'), async (req, res) => {
  try {
    const { permissions } = req.body;
    
    logAccess(req, AUDIT_ACTIONS.UPDATE, {
      resourceType: 'PERMISSIONS',
      resourceId: req.params.id,
      details: { permissions }
    });
    
    // In a real implementation, you would update the database
    res.json({ 
      message: 'Permissions updated',
      permissions 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get audit logs (admin only)
router.get('/audit-logs', authenticate, requireRole('clinic_admin', 'account_manager'), async (req, res) => {
  try {
    const filters = {
      userId: req.query.userId,
      action: req.query.action,
      resourceType: req.query.resourceType,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    
    logAccess(req, AUDIT_ACTIONS.VIEW, {
      resourceType: 'AUDIT_LOG',
      details: { filters }
    });
    
    const logs = getAuditLogs(filters);
    
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current user permissions
router.get('/me/permissions', authenticate, async (req, res) => {
  try {
    const user = users.find(u => u.id === req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    logAccess(req, AUDIT_ACTIONS.VIEW, {
      resourceType: 'PERMISSIONS',
      details: 'Viewing own permissions'
    });
    
    res.json({
      userId: user.id,
      permissions: user.permissions || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check if user has specific permission
router.post('/check-permission', authenticate, async (req, res) => {
  try {
    const { permission } = req.body;
    
    if (!permission) {
      return res.status(400).json({ error: 'Permission is required' });
    }
    
    const user = users.find(u => u.id === req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const hasAccess = user.hasPermission ? user.hasPermission(permission) : false;
    
    res.json({ hasAccess });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

