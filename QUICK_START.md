# Quick Start Guide - Access Control System

## Prerequisites
- Node.js installed (v14 or higher)
- npm or yarn package manager

## Setup Instructions

### 1. Backend Setup

```bash
# Navigate to backend directory
cd Backend

# Install dependencies (if not already done)
npm install

# Start the backend server
npm start
```

The backend will start on `http://localhost:3000`

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd Frontend/web

# Install dependencies (if not already done)
npm install

# Start the development server
npm run dev
```

The frontend will start on `http://localhost:5173`

### 3. Access the Dashboard

1. Open your browser and go to: `http://localhost:5173/access-control`
2. You'll see the Access Control Dashboard (currently without authentication setup)
3. For full functionality, you'll need to implement authentication in your app

## Testing the API

### Option 1: Using curl

```bash
# Test health endpoint
curl http://localhost:3000/health

# Login as patient
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"patient@example.com","password":"password123"}'

# The response will include a JWT token that you can use for authenticated requests
```

### Option 2: Using Postman/Thunder Client
1. Import the collection or create requests
2. Use the endpoints defined in `Backend/README_ACCESS_CONTROL.md`

### Option 3: Run the test script
```bash
# Navigate to backend directory
cd Backend

# Run the test script
node test-access-control.js
```

## Sample Credentials

The system comes with pre-configured test users:

- **Patient**: `patient@example.com` / `password123`
- **Doctor**: `doctor@example.com` / `password123`
- **Clinic Admin**: `admin@example.com` / `password123`

## Key Features

### Access Control Dashboard
- View all users and their roles
- Check audit logs for compliance
- Manage user permissions
- Monitor system access

### API Endpoints
- `/api/auth/login` - User authentication
- `/api/auth/me` - Get current user
- `/api/access-control/users` - List users (Admin only)
- `/api/access-control/audit-logs` - View audit logs (Admin only)
- `/api/access-control/check-permission` - Check user permissions

## Architecture

```
┌─────────────────────────────────────┐
│         Frontend (React)            │
│  ┌─────────────────────────────┐   │
│  │ Access Control Dashboard     │   │
│  │ - User Management            │   │
│  │ - Audit Logs                 │   │
│  │ - Permission Management      │   │
│  └─────────────────────────────┘   │
└──────────┬──────────────────────────┘
           │
           │ API Calls
           │
┌──────────▼──────────────────────────┐
│      Backend (Express.js)           │
│  ┌─────────────────────────────┐    │
│  │ Authentication Middleware   │    │
│  │ - JWT Verification          │    │
│  │ - Role Checking             │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ Access Control Middleware    │    │
│  │ - Permission Checking        │    │
│  │ - Audit Logging              │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ Models                      │    │
│  │ - Roles & Permissions        │    │
│  │ - User Management            │    │
│  │ - Audit Logging              │    │
│  └─────────────────────────────┘    │
└──────────────────────────────────────┘
```

## Next Steps

1. Integrate authentication with your existing login system
2. Add database persistence (currently in-memory for demo)
3. Customize roles and permissions as needed
4. Implement additional security features (2FA, encryption, etc.)

## Documentation

- **Backend API**: See `Backend/README_ACCESS_CONTROL.md`
- **Implementation Details**: See `ACCESS_CONTROL_IMPLEMENTATION.md`
- **Full Documentation**: See the functional requirements document

## Support

For questions or issues:
1. Check the documentation files
2. Review the code comments
3. Test with the provided test scripts

