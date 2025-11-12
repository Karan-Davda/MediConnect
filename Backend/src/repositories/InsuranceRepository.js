const { Insurance } = require('../models/Insurance');

// In-memory storage (will be replaced with database later)
let insuranceRecords = [];
let insuranceIdCounter = 1;

// Initialize with sample insurance records matching existing patients
function initializeSampleInsurance() {
  insuranceRecords = [
    new Insurance({
      id: `insurance_${insuranceIdCounter++}`,
      patientId: 'patient_1',
      patientName: 'John Doe',
      insuranceProvider: 'Blue Cross Blue Shield',
      policyNumber: 'BC123456789',
      groupNumber: 'GRP001',
      subscriberName: 'John Doe',
      subscriberRelationship: 'self',
      subscriberDateOfBirth: '1985-03-15',
      effectiveDate: '2024-01-01',
      expirationDate: '2024-12-31',
      planType: 'PPO',
      coverageType: 'primary',
      copay: 25,
      deductible: 1500,
      deductibleMet: 500,
      outOfPocketMax: 6000,
      outOfPocketMet: 1200,
      coveragePercentage: 80,
      priorAuthRequired: false,
      verificationStatus: 'verified',
      verifiedDate: new Date('2024-01-05'),
      verifiedBy: '2', // Dr. Smith
      verificationNotes: 'Coverage verified for 2024',
      insurancePhone: '1-800-BCBS-123',
      insuranceAddress: '100 Summer Street, Boston, MA 02110',
      claimsAddress: 'PO Box 9012, Boston, MA 02205',
      rxBin: '610014',
      rxPcn: 'MEDDADV',
      rxGroup: 'RX001',
      status: 'active',
      notes: 'Primary insurance, no issues',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-05')
    }),
    new Insurance({
      id: `insurance_${insuranceIdCounter++}`,
      patientId: 'patient_2',
      patientName: 'Jane Smith',
      insuranceProvider: 'Aetna',
      policyNumber: 'AET987654321',
      groupNumber: 'GRP002',
      subscriberName: 'Jane Smith',
      subscriberRelationship: 'self',
      subscriberDateOfBirth: '1990-07-22',
      effectiveDate: '2024-01-01',
      expirationDate: '2024-12-31',
      planType: 'HMO',
      coverageType: 'primary',
      copay: 20,
      deductible: 1000,
      deductibleMet: 800,
      outOfPocketMax: 5000,
      outOfPocketMet: 2000,
      coveragePercentage: 90,
      priorAuthRequired: true,
      verificationStatus: 'verified',
      verifiedDate: new Date('2024-01-20'),
      verifiedBy: '2',
      verificationNotes: 'Requires prior auth for specialists',
      insurancePhone: '1-800-AETNA-01',
      insuranceAddress: '151 Farmington Avenue, Hartford, CT 06156',
      claimsAddress: 'PO Box 14094, Lexington, KY 40512',
      rxBin: '610455',
      rxPcn: 'AETNA',
      rxGroup: 'RX002',
      status: 'active',
      notes: 'HMO plan requires PCP referrals',
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-20')
    }),
    new Insurance({
      id: `insurance_${insuranceIdCounter++}`,
      patientId: 'patient_3',
      patientName: 'Michael Johnson',
      insuranceProvider: 'UnitedHealthcare',
      policyNumber: 'UHC456789123',
      groupNumber: 'GRP003',
      subscriberName: 'Michael Johnson',
      subscriberRelationship: 'self',
      subscriberDateOfBirth: '1978-11-30',
      effectiveDate: '2024-01-01',
      expirationDate: '2024-12-31',
      planType: 'PPO',
      coverageType: 'primary',
      copay: 30,
      deductible: 2000,
      deductibleMet: 0,
      outOfPocketMax: 7000,
      outOfPocketMet: 0,
      coveragePercentage: 80,
      priorAuthRequired: false,
      verificationStatus: 'pending',
      verificationNotes: 'Pending verification',
      insurancePhone: '1-866-UHC-5000',
      insuranceAddress: '9900 Bren Road East, Minnetonka, MN 55343',
      claimsAddress: 'PO Box 30555, Salt Lake City, UT 84130',
      rxBin: '610020',
      rxPcn: 'UHC',
      rxGroup: 'RX003',
      status: 'active',
      notes: 'New policy, verification in progress',
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-02-01')
    })
  ];
}

// Initialize sample data
initializeSampleInsurance();

class InsuranceRepository {
  // ==================== INSURANCE CRUD OPERATIONS ====================

  /**
   * Create a new insurance record
   */
  async createInsurance(insuranceData) {
    const insurance = new Insurance({
      ...insuranceData,
      id: `insurance_${insuranceIdCounter++}`,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    insuranceRecords.push(insurance);
    return insurance;
  }

  /**
   * Get all insurance records with optional filters
   */
  async getAllInsurance(filters = {}) {
    let results = [...insuranceRecords];

    // Filter by patient
    if (filters.patientId) {
      results = results.filter(i => i.patientId === filters.patientId);
    }

    // Filter by coverage type
    if (filters.coverageType) {
      results = results.filter(i => i.coverageType === filters.coverageType);
    }

    // Filter by status
    if (filters.status) {
      results = results.filter(i => i.status === filters.status);
    }

    // Filter by verification status
    if (filters.verificationStatus) {
      results = results.filter(i => i.verificationStatus === filters.verificationStatus);
    }

    // Filter by insurance provider (search)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      results = results.filter(i =>
        i.insuranceProvider?.toLowerCase().includes(searchLower) ||
        i.policyNumber?.toLowerCase().includes(searchLower) ||
        i.patientName?.toLowerCase().includes(searchLower)
      );
    }

    // Sort by creation date (newest first)
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return results;
  }

  /**
   * Get insurance by ID
   */
  async getInsuranceById(insuranceId) {
    return insuranceRecords.find(i => i.id === insuranceId) || null;
  }

  /**
   * Get all insurance records for a specific patient
   */
  async getInsuranceByPatient(patientId) {
    return insuranceRecords.filter(i => i.patientId === patientId);
  }

  /**
   * Get primary insurance for a patient
   */
  async getPrimaryInsurance(patientId) {
    return insuranceRecords.find(
      i => i.patientId === patientId && i.coverageType === 'primary' && i.status === 'active'
    ) || null;
  }

  /**
   * Update insurance record
   */
  async updateInsurance(insuranceId, updates) {
    const index = insuranceRecords.findIndex(i => i.id === insuranceId);

    if (index === -1) {
      return null;
    }

    const updatedInsurance = new Insurance({
      ...insuranceRecords[index],
      ...updates,
      id: insuranceId,
      updatedAt: new Date()
    });

    insuranceRecords[index] = updatedInsurance;
    return updatedInsurance;
  }

  /**
   * Verify insurance
   */
  async verifyInsurance(insuranceId, verificationData) {
    const insurance = await this.getInsuranceById(insuranceId);

    if (!insurance) {
      throw new Error('Insurance record not found');
    }

    return this.updateInsurance(insuranceId, {
      verificationStatus: verificationData.status || 'verified',
      verifiedDate: new Date(),
      verifiedBy: verificationData.verifiedBy,
      verificationNotes: verificationData.notes
    });
  }

  /**
   * Deactivate insurance (soft delete)
   */
  async deactivateInsurance(insuranceId) {
    return this.updateInsurance(insuranceId, {
      status: 'inactive'
    });
  }

  /**
   * Delete insurance record (hard delete)
   */
  async deleteInsurance(insuranceId) {
    const index = insuranceRecords.findIndex(i => i.id === insuranceId);

    if (index === -1) {
      return false;
    }

    insuranceRecords.splice(index, 1);
    return true;
  }

  /**
   * Get insurance statistics for a patient
   */
  async getPatientInsuranceStats(patientId) {
    const patientInsurance = await this.getInsuranceByPatient(patientId);

    return {
      total: patientInsurance.length,
      active: patientInsurance.filter(i => i.status === 'active').length,
      verified: patientInsurance.filter(i => i.verificationStatus === 'verified').length,
      pending: patientInsurance.filter(i => i.verificationStatus === 'pending').length,
      primaryInsurance: patientInsurance.find(i => i.coverageType === 'primary' && i.status === 'active') || null
    };
  }
}

module.exports = new InsuranceRepository();
