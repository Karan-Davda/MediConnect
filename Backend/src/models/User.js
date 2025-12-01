// User model for access control
class User {
  constructor({
    id,
    email,
    password,
    name,
    role,
    clinicId,
    permissions = [],
    twoFactorEnabled = false,
    lastLogin,
    isActive = true,
    notificationPreferences = {
      emailNotifications: true,
      smsNotifications: true,
      appointmentReminders: true,
      reminderTimingHours: 24
    },
    createdAt,
    updatedAt
  }) {
    this.id = id;
    this.email = email;
    this.password = password;
    this.name = name;
    this.role = role;
    this.clinicId = clinicId;
    this.permissions = permissions;
    this.twoFactorEnabled = twoFactorEnabled;
    this.lastLogin = lastLogin;
    this.isActive = isActive;
    this.notificationPreferences = notificationPreferences;
    this.createdAt = createdAt || new Date();
    this.updatedAt = updatedAt || new Date();
  }

  toJSON() {
    const { password, ...user } = this;
    return user;
  }

  hasPermission(permission) {
    return this.permissions.includes(permission) || this.permissions.includes('*');
  }
}

module.exports = User;

