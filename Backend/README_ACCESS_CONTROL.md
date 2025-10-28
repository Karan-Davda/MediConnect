# Access Control System - S1: 01.04 Control Access

## Overview

This module implements a comprehensive access control system for MediConnect that manages user access rights, permissions, and security settings to ensure data security and HIPAA compliance.

## Features

### 1. Role-Based Access Control (RBAC)
- **Roles Supported:**
  - Patient
  - Doctor
  - Clinic Staff
  - Clinic Administrator
  - Account Manager
  - Customer Success Specialist

### 2. Permission Management
Each role has specific permissions that control what users can do in the system:
- View/Edit own profile
- View/Edit patient records
- Manage appointments
- Write prescriptions
- Manage staff and users
- View analytics and billing
- Manage system settings

### 3. Audit Logging
- Complete audit trail of all user actions
- HIPAA compliant logging
- Track: user, action, resource type, timestamp, IP address
- Accessible to authorized administrators

### 4. Security Settings
- Authentication via JWT tokens
- Permission verification middleware
- Access control enforcement
- Role hierarchy checking

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/logout` - User logout

### Access Control
- `GET /api/access-control/users` - List all users (Admin only)
- `GET /api/access-control/users/:id` - Get user details
- `PUT /api/access-control/users/:id/permissions` - Update user permissions (Admin only)
- `GET /api/access-control/audit-logs` - View audit logs (Admin only)
- `GET /api/access-control/me/permissions` - Get own permissions
- `POST /api/access-control/check-permission` - Check if user has specific permission

## Usage

### Basic Authentication
```javascript
// Login
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});

const { token } = await response.json();
```

### Protected Routes
```javascript
// Add authentication header to protected requests
fetch('/api/protected', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Check Permissions
```javascript
const response = await fetch('/api/access-control/check-permission', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    permission: 'VIEW_PATIENT_RECORDS'
  })
});

const { hasAccess } = await response.json();
```

## Middleware

### Authentication Middleware
```javascript
const { authenticate } = require('./src/middleware/auth');

app.get('/api/protected', authenticate, (req, res) => {
  // req.user contains user info
  res.json({ user: req.user });
});
```

### Permission Check
```javascript
const { checkPermission, PERMISSIONS } = require('./src/middleware/auth');

app.get('/api/patients', 
  authenticate, 
  checkPermission(PERMISSIONS.VIEW_ALL_PATIENTS), 
  (req, res) => {
    // Only users with VIEW_ALL_PATIENTS can access
  }
);
```

### Role-Based Access
```javascript
const { requireRole } = require('./src/middleware/auth');

app.put('/api/settings', 
  authenticate, 
  requireRole('clinic_admin', 'account_manager'), 
  (req, res) => {
    // Only clinic admins and account managers can access
  }
);
```

## Audit Logging

All sensitive operations are automatically logged:
- User login/logout
- Viewing medical records
- Creating/updating/deleting records
- Changing permissions
- Accessing audit logs

Audit logs are stored with:
- Timestamp
- User ID and email
- Action type
- Resource type and ID
- IP address
- User agent
- Additional metadata

## Security Features

1. **JWT Authentication**: Secure token-based authentication
2. **Role Hierarchy**: Ensures users can only access appropriate resources
3. **Permission Checks**: Fine-grained access control
4. **Audit Trail**: Complete activity logging for compliance
5. **Access Control**: Prevents unauthorized access to resources

## HIPAA Compliance

This access control system ensures HIPAA compliance through:
- Authentication of all users
- Authorization based on role and permissions
- Complete audit trail of access to protected health information (PHI)
- Access controls on data storage and transmission
- Role-based access control
- User activity monitoring and logging

## Testing

To test the system:

1. Start the backend server:
```bash
cd Backend
npm start
```

2. Test with sample credentials:
- Patient: `patient@example.com` / `password123`
- Doctor: `doctor@example.com` / `password123`
- Admin: `admin@example.com` / `password123`

3. Access the dashboard:
Navigate to `http://localhost:5173/access-control` (frontend)

## File Structure

```
Backend/
├── server.js                          # Main server file
├── src/
│   ├── models/
│   │   ├── Role.js                    # Role definitions and permissions
│   │   ├── User.js                    # User model
│   │   └── AuditLog.js                # Audit logging system
│   ├── middleware/
│   │   ├── auth.js                    # Authentication & authorization
│   │   └── auditLogger.js             # Audit logging middleware
│   └── routes/
│       ├── auth.js                    # Authentication routes
│       └── access-control.js          # Access control routes

Frontend/
├── web/src/
│   ├── components/
│   │   ├── AccessControlDashboard.tsx # Access control UI
│   │   └── AccessControlDashboard.css # Dashboard styles
│   └── pages/
│       └── AccessControl.tsx           # Access control page
```

## Future Enhancements

- [ ] Two-factor authentication (2FA)
- [ ] IP whitelisting
- [ ] Session management
- [ ] Password complexity requirements
- [ ] Account lockout after failed attempts
- [ ] Email verification
- [ ] Encryption at rest
- [ ] Integration with external identity providers

