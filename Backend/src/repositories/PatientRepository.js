const Patient = require('../models/Patient');

class PatientRepository {
  constructor() {
    this.patients = [];
    this.patientCounter = 1;
    this.initializeMockData();
  }

  initializeMockData() {
    this.patients = [
      new Patient({
        id: '1',
        userId: 'u1',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1985-03-15',
        gender: 'Male',
        phoneNumber: '+1234567890',
        address: {
          street: '123 Main St',
          city: 'Boston',
          state: 'MA',
          zipCode: '02101'
        },
        emergencyContact: {
          name: 'Jane Doe',
          relationship: 'Spouse',
          phoneNumber: '+1234567891'
        },
        insuranceInfo: {
          provider: 'Blue Cross',
          policyNumber: 'BC123456',
          groupNumber: 'GRP001'
        },
        allergies: ['Penicillin'],
        medicalHistory: [
          { condition: 'Hypertension', diagnosedDate: '2020-01-10' }
        ],
        lastVisitDate: '2024-06-15',
        createdAt: new Date('2020-01-01'),
        updatedAt: new Date()
      }),
      new Patient({
        id: '2',
        userId: 'u2',
        firstName: 'Sarah',
        lastName: 'Johnson',
        dateOfBirth: '1990-07-22',
        gender: 'Female',
        phoneNumber: '+1234567892',
        address: {
          street: '456 Oak Ave',
          city: 'Boston',
          state: 'MA',
          zipCode: '02102'
        },
        emergencyContact: {
          name: 'Mike Johnson',
          relationship: 'Brother',
          phoneNumber: '+1234567893'
        },
        insuranceInfo: {
          provider: 'Aetna',
          policyNumber: 'AET789012',
          groupNumber: 'GRP002'
        },
        allergies: [],
        medicalHistory: [
          { condition: 'Diabetes Type 2', diagnosedDate: '2019-05-20' }
        ],
        lastVisitDate: '2023-11-10',
        createdAt: new Date('2019-03-15'),
        updatedAt: new Date()
      }),
      new Patient({
        id: '3',
        userId: 'u3',
        firstName: 'Michael',
        lastName: 'Chen',
        dateOfBirth: '1975-11-08',
        gender: 'Male',
        phoneNumber: '+1234567894',
        address: {
          street: '789 Elm St',
          city: 'Cambridge',
          state: 'MA',
          zipCode: '02139'
        },
        emergencyContact: {
          name: 'Lisa Chen',
          relationship: 'Wife',
          phoneNumber: '+1234567895'
        },
        insuranceInfo: {
          provider: 'UnitedHealth',
          policyNumber: 'UH345678',
          groupNumber: 'GRP003'
        },
        allergies: ['Sulfa drugs'],
        medicalHistory: [
          { condition: 'Asthma', diagnosedDate: '2015-08-12' }
        ],
        lastVisitDate: '2025-01-05',
        createdAt: new Date('2015-06-01'),
        updatedAt: new Date()
      }),
      new Patient({
        id: '4',
        userId: 'u4',
        firstName: 'Emily',
        lastName: 'Williams',
        dateOfBirth: '1995-02-14',
        gender: 'Female',
        phoneNumber: '+1234567896',
        address: {
          street: '321 Pine Rd',
          city: 'Somerville',
          state: 'MA',
          zipCode: '02143'
        },
        emergencyContact: {
          name: 'Robert Williams',
          relationship: 'Father',
          phoneNumber: '+1234567897'
        },
        insuranceInfo: {
          provider: 'Cigna',
          policyNumber: 'CIG901234',
          groupNumber: 'GRP004'
        },
        allergies: ['Latex'],
        medicalHistory: [],
        lastVisitDate: '2024-12-01',
        createdAt: new Date('2022-01-10'),
        updatedAt: new Date()
      }),
      new Patient({
        id: '5',
        userId: 'u5',
        firstName: 'David',
        lastName: 'Martinez',
        dateOfBirth: '1968-09-30',
        gender: 'Male',
        phoneNumber: '+1234567898',
        address: {
          street: '555 Maple Dr',
          city: 'Boston',
          state: 'MA',
          zipCode: '02115'
        },
        emergencyContact: {
          name: 'Maria Martinez',
          relationship: 'Spouse',
          phoneNumber: '+1234567899'
        },
        insuranceInfo: {
          provider: 'Blue Cross',
          policyNumber: 'BC567890',
          groupNumber: 'GRP005'
        },
        allergies: [],
        medicalHistory: [
          { condition: 'High Cholesterol', diagnosedDate: '2018-03-25' },
          { condition: 'Hypertension', diagnosedDate: '2020-06-10' }
        ],
        lastVisitDate: '2024-03-20',
        createdAt: new Date('2018-01-01'),
        updatedAt: new Date()
      })
    ];
  }

  getAll() {
    return this.patients;
  }

  getById(id) {
    return this.patients.find(p => p.id === id);
  }

  getByUserId(userId) {
    return this.patients.find(p => p.userId === userId);
  }

  create(patientData) {
    const id = (this.patientCounter++).toString();
    const patient = new Patient({ ...patientData, id });
    this.patients.push(patient);
    return patient;
  }

  update(id, updates) {
    const index = this.patients.findIndex(p => p.id === id);
    if (index === -1) return null;

    this.patients[index] = new Patient({
      ...this.patients[index],
      ...updates,
      id,
      updatedAt: new Date()
    });

    return this.patients[index];
  }

  delete(id) {
    const index = this.patients.findIndex(p => p.id === id);
    if (index === -1) return false;

    this.patients.splice(index, 1);
    return true;
  }

  search(criteria) {
    return this.patients.filter(patient => {
      for (const key in criteria) {
        if (patient[key] !== criteria[key]) {
          return false;
        }
      }
      return true;
    });
  }
}

module.exports = PatientRepository;
