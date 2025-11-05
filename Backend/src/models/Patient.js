// Patient model
class Patient {
  constructor({
    id,
    userId, // Link to User account
    firstName,
    lastName,
    dateOfBirth,
    gender,
    phoneNumber,
    address,
    emergencyContact,
    insuranceInfo,
    allergies = [],
    medicalHistory = [],
    createdAt,
    updatedAt
  }) {
    this.id = id;
    this.userId = userId;
    this.firstName = firstName;
    this.lastName = lastName;
    this.dateOfBirth = dateOfBirth;
    this.gender = gender;
    this.phoneNumber = phoneNumber;
    this.address = address;
    this.emergencyContact = emergencyContact;
    this.insuranceInfo = insuranceInfo;
    this.allergies = allergies;
    this.medicalHistory = medicalHistory;
    this.createdAt = createdAt || new Date();
    this.updatedAt = updatedAt || new Date();
  }

  get fullName() {
    return `${this.firstName} ${this.lastName}`;
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      firstName: this.firstName,
      lastName: this.lastName,
      fullName: this.fullName,
      dateOfBirth: this.dateOfBirth,
      gender: this.gender,
      phoneNumber: this.phoneNumber,
      address: this.address,
      emergencyContact: this.emergencyContact,
      insuranceInfo: this.insuranceInfo,
      allergies: this.allergies,
      medicalHistory: this.medicalHistory,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Patient;

