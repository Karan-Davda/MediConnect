// Role definitions for MediConnect
const ROLES = {
  PATIENT: 'patient',
  DOCTOR: 'doctor',
  CLINIC_STAFF: 'clinic_staff',
  CLINIC_ADMIN: 'clinic_admin',
  ACCOUNT_MANAGER: 'account_manager',
  CUSTOMER_SUCCESS: 'customer_success'
};

const ROLE_HIERARCHY = {
  [ROLES.PATIENT]: 1,
  [ROLES.DOCTOR]: 2,
  [ROLES.CLINIC_STAFF]: 3,
  [ROLES.CLINIC_ADMIN]: 4,
  [ROLES.ACCOUNT_MANAGER]: 5,
  [ROLES.CUSTOMER_SUCCESS]: 6
};

const PERMISSIONS = {
  // Patient Permissions
  VIEW_OWN_PROFILE: 'view_own_profile',
  EDIT_OWN_PROFILE: 'edit_own_profile',
  VIEW_OWN_MEDICAL_RECORDS: 'view_own_medical_records',
  BOOK_APPOINTMENT: 'book_appointment',
  VIEW_OWN_APPOINTMENTS: 'view_own_appointments',
  
  // Doctor/Staff Permissions
  VIEW_ALL_PATIENTS: 'view_all_patients',
  VIEW_PATIENT_RECORDS: 'view_patient_records',
  EDIT_PATIENT_RECORDS: 'edit_patient_records',
  MANAGE_APPOINTMENTS: 'manage_appointments',
  WRITE_PRESCRIPTIONS: 'write_prescriptions',
  VIEW_SCHEDULE: 'view_schedule',
  
  // Clinic Admin Permissions
  MANAGE_STAFF: 'manage_staff',
  MANAGE_USERS: 'manage_users',
  VIEW_ANALYTICS: 'view_analytics',
  MANAGE_SETTINGS: 'manage_settings',
  VIEW_BILLING: 'view_billing',
  MANAGE_CLAIMS: 'manage_claims',
  
  // Account Manager/Customer Success Permissions
  VIEW_ALL_CLINICS: 'view_all_clinics',
  MANAGE_CLINIC_ACCOUNTS: 'manage_clinic_accounts',
  VIEW_SYSTEM_ANALYTICS: 'view_system_analytics',
  MANAGE_SUBSCRIPTIONS: 'manage_subscriptions',
  
  // Admin-specific permissions
  MANAGE_ROLES: 'manage_roles',
  MANAGE_PERMISSIONS: 'manage_permissions',
  VIEW_AUDIT_LOGS: 'view_audit_logs',
  MANAGE_SYSTEM_SETTINGS: 'manage_system_settings'
};

const ROLE_PERMISSIONS = {
  [ROLES.PATIENT]: [
    PERMISSIONS.VIEW_OWN_PROFILE,
    PERMISSIONS.EDIT_OWN_PROFILE,
    PERMISSIONS.VIEW_OWN_MEDICAL_RECORDS,
    PERMISSIONS.BOOK_APPOINTMENT,
    PERMISSIONS.VIEW_OWN_APPOINTMENTS
  ],
  [ROLES.DOCTOR]: [
    PERMISSIONS.VIEW_OWN_PROFILE,
    PERMISSIONS.EDIT_OWN_PROFILE,
    PERMISSIONS.VIEW_PATIENT_RECORDS,
    PERMISSIONS.EDIT_PATIENT_RECORDS,
    PERMISSIONS.MANAGE_APPOINTMENTS,
    PERMISSIONS.WRITE_PRESCRIPTIONS,
    PERMISSIONS.VIEW_SCHEDULE
  ],
  [ROLES.CLINIC_STAFF]: [
    PERMISSIONS.VIEW_OWN_PROFILE,
    PERMISSIONS.VIEW_PATIENT_RECORDS,
    PERMISSIONS.MANAGE_APPOINTMENTS,
    PERMISSIONS.VIEW_SCHEDULE,
    PERMISSIONS.VIEW_BILLING
  ],
  [ROLES.CLINIC_ADMIN]: [
    PERMISSIONS.VIEW_OWN_PROFILE,
    PERMISSIONS.EDIT_OWN_PROFILE,
    PERMISSIONS.VIEW_ALL_PATIENTS,
    PERMISSIONS.VIEW_PATIENT_RECORDS,
    PERMISSIONS.EDIT_PATIENT_RECORDS,
    PERMISSIONS.MANAGE_APPOINTMENTS,
    PERMISSIONS.MANAGE_STAFF,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.MANAGE_SETTINGS,
    PERMISSIONS.VIEW_BILLING,
    PERMISSIONS.MANAGE_CLAIMS
  ],
  [ROLES.ACCOUNT_MANAGER]: [
    PERMISSIONS.VIEW_ALL_CLINICS,
    PERMISSIONS.MANAGE_CLINIC_ACCOUNTS,
    PERMISSIONS.VIEW_SYSTEM_ANALYTICS,
    PERMISSIONS.MANAGE_SUBSCRIPTIONS
  ],
  [ROLES.CUSTOMER_SUCCESS]: [
    PERMISSIONS.VIEW_ALL_CLINICS,
    PERMISSIONS.MANAGE_CLINIC_ACCOUNTS,
    PERMISSIONS.VIEW_SYSTEM_ANALYTICS
  ]
};

function hasPermission(userRole, permission) {
  const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
  return rolePermissions.includes(permission);
}

function canAccess(requesterRole, resourceRole) {
  const requesterLevel = ROLE_HIERARCHY[requesterRole] || 0;
  const resourceLevel = ROLE_HIERARCHY[resourceRole] || 0;
  return requesterLevel >= resourceLevel || requesterRole === resourceRole;
}

module.exports = {
  ROLES,
  ROLE_HIERARCHY,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  canAccess
};

