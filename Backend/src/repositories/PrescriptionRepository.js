const { Prescription, Pharmacy } = require('../models/Prescription');

// In-memory storage (will be replaced with database later)
let prescriptions = [];
let pharmacies = [];
let prescriptionIdCounter = 1;
let pharmacyIdCounter = 1;

// Initialize with sample pharmacies
function initializeSamplePharmacies() {
  pharmacies = [
    new Pharmacy({
      id: `pharmacy_${pharmacyIdCounter++}`,
      name: 'CVS Pharmacy',
      ncpdpId: '1234567',
      npi: '1234567890',
      address: '123 Main Street',
      city: 'Boston',
      state: 'MA',
      zipCode: '02101',
      phoneNumber: '617-555-0100',
      faxNumber: '617-555-0101',
      email: 'boston@cvs.com',
      isActive: true,
      deliveryAvailable: true,
      hours: 'Mon-Fri: 8am-9pm, Sat-Sun: 9am-6pm',
      preferredByClinic: true
    }),
    new Pharmacy({
      id: `pharmacy_${pharmacyIdCounter++}`,
      name: 'Walgreens',
      ncpdpId: '7654321',
      npi: '0987654321',
      address: '456 Park Avenue',
      city: 'Boston',
      state: 'MA',
      zipCode: '02102',
      phoneNumber: '617-555-0200',
      faxNumber: '617-555-0201',
      email: 'boston@walgreens.com',
      isActive: true,
      deliveryAvailable: false,
      hours: 'Mon-Fri: 7am-10pm, Sat-Sun: 8am-8pm',
      preferredByClinic: false
    }),
    new Pharmacy({
      id: `pharmacy_${pharmacyIdCounter++}`,
      name: 'RiteAid Pharmacy',
      ncpdpId: '3456789',
      npi: '5678901234',
      address: '789 Commonwealth Ave',
      city: 'Boston',
      state: 'MA',
      zipCode: '02103',
      phoneNumber: '617-555-0300',
      faxNumber: '617-555-0301',
      email: 'boston@riteaid.com',
      isActive: true,
      deliveryAvailable: true,
      hours: '24/7',
      preferredByClinic: false
    })
  ];
}

// Initialize sample data
initializeSamplePharmacies();

class PrescriptionRepository {
  // ==================== PRESCRIPTION CRUD OPERATIONS ====================

  /**
   * Create a new prescription
   */
  async createPrescription(prescriptionData) {
    const prescription = new Prescription({
      ...prescriptionData,
      id: `prescription_${prescriptionIdCounter++}`,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    prescriptions.push(prescription);
    return prescription;
  }

  /**
   * Get all prescriptions with optional filters
   */
  async getAllPrescriptions(filters = {}) {
    let results = [...prescriptions];

    // Filter by patient
    if (filters.patientId) {
      results = results.filter(p => p.patientId === filters.patientId);
    }

    // Filter by provider
    if (filters.providerId) {
      results = results.filter(p => p.providerId === filters.providerId);
    }

    // Filter by clinic
    if (filters.clinicId) {
      results = results.filter(p => p.clinicId === filters.clinicId);
    }

    // Filter by status
    if (filters.status) {
      results = results.filter(p => p.status === filters.status);
    }

    // Filter by date range
    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      results = results.filter(p => new Date(p.createdAt) >= startDate);
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      results = results.filter(p => new Date(p.createdAt) <= endDate);
    }

    // Search by medication name
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      results = results.filter(p =>
        p.medicationName.toLowerCase().includes(searchLower) ||
        (p.indication && p.indication.toLowerCase().includes(searchLower))
      );
    }

    // Sort by creation date (newest first)
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return results;
  }

  /**
   * Get prescription by ID
   */
  async getPrescriptionById(id) {
    return prescriptions.find(p => p.id === id);
  }

  /**
   * Get prescriptions by patient ID
   */
  async getPrescriptionsByPatient(patientId) {
    return prescriptions
      .filter(p => p.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Get prescriptions by medical record ID
   */
  async getPrescriptionsByMedicalRecord(medicalRecordId) {
    return prescriptions
      .filter(p => p.medicalRecordId === medicalRecordId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Update prescription
   */
  async updatePrescription(id, updates) {
    const index = prescriptions.findIndex(p => p.id === id);

    if (index === -1) {
      return null;
    }

    const existingPrescription = prescriptions[index];
    const updatedPrescription = new Prescription({
      ...existingPrescription,
      ...updates,
      id: existingPrescription.id,
      createdAt: existingPrescription.createdAt,
      updatedAt: new Date()
    });

    prescriptions[index] = updatedPrescription;
    return updatedPrescription;
  }

  /**
   * Update prescription status
   */
  async updatePrescriptionStatus(id, status, updatedBy) {
    const updates = {
      status,
      updatedBy,
      updatedAt: new Date()
    };

    // Add timestamp based on status
    if (status === 'sent') {
      updates.sentToPharmacyDate = new Date();
    } else if (status === 'filled') {
      updates.filledDate = new Date();
    }

    return this.updatePrescription(id, updates);
  }

  /**
   * Send prescription to pharmacy
   */
  async sendToPharmacy(id, pharmacyId, updatedBy) {
    const pharmacy = await this.getPharmacyById(pharmacyId);
    if (!pharmacy) {
      throw new Error('Pharmacy not found');
    }

    return this.updatePrescription(id, {
      pharmacyId,
      pharmacyName: pharmacy.name,
      status: 'sent',
      sentToPharmacyDate: new Date(),
      updatedBy
    });
  }

  /**
   * Cancel prescription
   */
  async cancelPrescription(id, updatedBy) {
    return this.updatePrescriptionStatus(id, 'cancelled', updatedBy);
  }

  /**
   * Delete prescription (soft delete - change status)
   */
  async deletePrescription(id) {
    const index = prescriptions.findIndex(p => p.id === id);

    if (index === -1) {
      return false;
    }

    // Soft delete by setting status to cancelled
    prescriptions[index].status = 'cancelled';
    prescriptions[index].updatedAt = new Date();
    return true;
  }

  // ==================== PHARMACY CRUD OPERATIONS ====================

  /**
   * Create a new pharmacy
   */
  async createPharmacy(pharmacyData) {
    const pharmacy = new Pharmacy({
      ...pharmacyData,
      id: `pharmacy_${pharmacyIdCounter++}`,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    pharmacies.push(pharmacy);
    return pharmacy;
  }

  /**
   * Get all pharmacies
   */
  async getAllPharmacies(filters = {}) {
    let results = [...pharmacies];

    // Filter by active status
    if (filters.isActive !== undefined) {
      results = results.filter(p => p.isActive === filters.isActive);
    }

    // Filter by delivery availability
    if (filters.deliveryAvailable !== undefined) {
      results = results.filter(p => p.deliveryAvailable === filters.deliveryAvailable);
    }

    // Filter by preferred status
    if (filters.preferredByClinic !== undefined) {
      results = results.filter(p => p.preferredByClinic === filters.preferredByClinic);
    }

    // Search by name or city
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      results = results.filter(p =>
        p.name.toLowerCase().includes(searchLower) ||
        p.city.toLowerCase().includes(searchLower)
      );
    }

    // Sort by name
    results.sort((a, b) => a.name.localeCompare(b.name));

    return results;
  }

  /**
   * Get pharmacy by ID
   */
  async getPharmacyById(id) {
    return pharmacies.find(p => p.id === id);
  }

  /**
   * Update pharmacy
   */
  async updatePharmacy(id, updates) {
    const index = pharmacies.findIndex(p => p.id === id);

    if (index === -1) {
      return null;
    }

    const existingPharmacy = pharmacies[index];
    const updatedPharmacy = new Pharmacy({
      ...existingPharmacy,
      ...updates,
      id: existingPharmacy.id,
      createdAt: existingPharmacy.createdAt,
      updatedAt: new Date()
    });

    pharmacies[index] = updatedPharmacy;
    return updatedPharmacy;
  }

  /**
   * Delete pharmacy
   */
  async deletePharmacy(id) {
    const index = pharmacies.findIndex(p => p.id === id);

    if (index === -1) {
      return false;
    }

    pharmacies.splice(index, 1);
    return true;
  }

  // ==================== STATISTICS AND REPORTS ====================

  /**
   * Get prescription statistics for a patient
   */
  async getPatientPrescriptionStats(patientId) {
    const patientPrescriptions = await this.getPrescriptionsByPatient(patientId);

    return {
      total: patientPrescriptions.length,
      active: patientPrescriptions.filter(p => p.status === 'pending' || p.status === 'sent').length,
      filled: patientPrescriptions.filter(p => p.status === 'filled').length,
      cancelled: patientPrescriptions.filter(p => p.status === 'cancelled').length
    };
  }

  /**
   * Get prescription statistics for a provider
   */
  async getProviderPrescriptionStats(providerId) {
    const providerPrescriptions = prescriptions.filter(p => p.providerId === providerId);

    return {
      total: providerPrescriptions.length,
      pending: providerPrescriptions.filter(p => p.status === 'pending').length,
      sent: providerPrescriptions.filter(p => p.status === 'sent').length,
      filled: providerPrescriptions.filter(p => p.status === 'filled').length
    };
  }
}

module.exports = new PrescriptionRepository();
