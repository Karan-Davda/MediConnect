const { Claim } = require('../models/Claim');

class ClaimRepository {
  constructor() {
    this.claims = new Map();
    this.claimCounter = 1;
    this.initializeMockData();
  }

  initializeMockData() {
    const mockClaims = [
      new Claim({
        id: '1',
        claimNumber: 'CLM-2025-001',
        patientId: '1',
        patientName: 'Jane Doe',
        insuranceId: '1',
        insuranceProvider: 'Blue Cross Blue Shield',
        policyNumber: 'BCBS123456',
        providerId: '1',
        providerName: 'Dr. Alice Martin',
        serviceDate: '2025-10-20',
        submissionDate: '2025-10-22',
        diagnosisCodes: ['J06.9', 'R50.9'],
        procedureCodes: ['99213'],
        serviceDescription: 'Primary care follow-up visit',
        totalCharges: 120.00,
        claimedAmount: 120.00,
        approvedAmount: 96.00,
        deniedAmount: 0,
        patientResponsibility: 24.00,
        status: 'approved',
        submittedBy: 'clinic_admin',
        claimType: 'professional',
        placeOfService: 'Office',
        payerId: 'BCBS001',
        payerName: 'Blue Cross Blue Shield',
        adjudicationDate: '2025-10-28',
        paymentDate: '2025-11-01',
        paymentAmount: 96.00,
        paymentMethod: 'Electronic',
        reconciliationStatus: 'reconciled',
        createdAt: '2025-10-22',
        updatedAt: '2025-11-01'
      }),
      new Claim({
        id: '2',
        claimNumber: 'CLM-2025-002',
        patientId: '1',
        patientName: 'Jane Doe',
        insuranceId: '1',
        insuranceProvider: 'Blue Cross Blue Shield',
        policyNumber: 'BCBS123456',
        providerId: '2',
        providerName: 'Dr. Brian Patel',
        serviceDate: '2025-09-22',
        submissionDate: '2025-09-24',
        diagnosisCodes: ['I10'],
        procedureCodes: ['99204'],
        serviceDescription: 'Cardiology consult',
        totalCharges: 320.00,
        claimedAmount: 320.00,
        approvedAmount: 224.00,
        deniedAmount: 0,
        patientResponsibility: 96.00,
        status: 'approved',
        submittedBy: 'clinic_admin',
        claimType: 'professional',
        placeOfService: 'Office',
        payerId: 'BCBS001',
        payerName: 'Blue Cross Blue Shield',
        adjudicationDate: '2025-09-30',
        paymentDate: '2025-10-05',
        paymentAmount: 224.00,
        paymentMethod: 'Electronic',
        reconciliationStatus: 'reconciled',
        createdAt: '2025-09-24',
        updatedAt: '2025-10-05'
      }),
      new Claim({
        id: '3',
        claimNumber: 'CLM-2025-003',
        patientId: '1',
        patientName: 'Jane Doe',
        insuranceId: '1',
        insuranceProvider: 'Blue Cross Blue Shield',
        policyNumber: 'BCBS123456',
        providerId: '3',
        providerName: 'Clinic Lab East',
        serviceDate: '2025-11-10',
        submissionDate: '2025-11-12',
        diagnosisCodes: ['Z00.00'],
        procedureCodes: ['80053'],
        serviceDescription: 'Lab work - Comprehensive metabolic panel',
        totalCharges: 85.00,
        claimedAmount: 85.00,
        approvedAmount: 0,
        deniedAmount: 0,
        patientResponsibility: 0,
        status: 'submitted',
        submittedBy: 'clinic_staff',
        claimType: 'professional',
        placeOfService: 'Laboratory',
        payerId: 'BCBS001',
        payerName: 'Blue Cross Blue Shield',
        reconciliationStatus: 'pending',
        createdAt: '2025-11-12',
        updatedAt: '2025-11-12'
      }),
      new Claim({
        id: '4',
        claimNumber: 'CLM-2025-004',
        patientId: '2',
        patientName: 'John Smith',
        insuranceId: '2',
        insuranceProvider: 'Aetna',
        policyNumber: 'AET789012',
        providerId: '1',
        providerName: 'Dr. Alice Martin',
        serviceDate: '2025-11-05',
        submissionDate: '2025-11-07',
        diagnosisCodes: ['M25.561'],
        procedureCodes: ['99214'],
        serviceDescription: 'Follow-up for knee pain',
        totalCharges: 150.00,
        claimedAmount: 150.00,
        approvedAmount: 0,
        deniedAmount: 150.00,
        patientResponsibility: 150.00,
        status: 'denied',
        submittedBy: 'clinic_admin',
        claimType: 'professional',
        placeOfService: 'Office',
        payerId: 'AET001',
        payerName: 'Aetna',
        adjudicationDate: '2025-11-15',
        denialReason: 'Service not covered under current plan',
        denialCode: 'CO-50',
        reconciliationStatus: 'pending_review',
        createdAt: '2025-11-07',
        updatedAt: '2025-11-15'
      })
    ];

    mockClaims.forEach(claim => this.claims.set(claim.id, claim));
    this.claimCounter = mockClaims.length + 1;
  }

  generateClaimNumber() {
    const year = new Date().getFullYear();
    const number = String(this.claimCounter).padStart(6, '0');
    return `CLM-${year}-${number}`;
  }

  async create(claimData) {
    const id = String(this.claimCounter++);
    const claimNumber = this.generateClaimNumber();

    const claim = new Claim({
      ...claimData,
      id,
      claimNumber,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    this.claims.set(id, claim);
    return claim;
  }

  async findById(id) {
    return this.claims.get(id) || null;
  }

  async findByPatientId(patientId) {
    return Array.from(this.claims.values())
      .filter(claim => claim.patientId === patientId)
      .sort((a, b) => new Date(b.submissionDate) - new Date(a.submissionDate));
  }

  async findByInsuranceId(insuranceId) {
    return Array.from(this.claims.values())
      .filter(claim => claim.insuranceId === insuranceId)
      .sort((a, b) => new Date(b.submissionDate) - new Date(a.submissionDate));
  }

  async findByStatus(status) {
    return Array.from(this.claims.values())
      .filter(claim => claim.status === status)
      .sort((a, b) => new Date(b.submissionDate) - new Date(a.submissionDate));
  }

  async findAll(filters = {}) {
    let claims = Array.from(this.claims.values());

    if (filters.patientId) {
      claims = claims.filter(claim => claim.patientId === filters.patientId);
    }

    if (filters.insuranceId) {
      claims = claims.filter(claim => claim.insuranceId === filters.insuranceId);
    }

    if (filters.status) {
      claims = claims.filter(claim => claim.status === filters.status);
    }

    if (filters.providerId) {
      claims = claims.filter(claim => claim.providerId === filters.providerId);
    }

    if (filters.reconciliationStatus) {
      claims = claims.filter(claim => claim.reconciliationStatus === filters.reconciliationStatus);
    }

    return claims.sort((a, b) => new Date(b.submissionDate) - new Date(a.submissionDate));
  }

  async update(id, updates) {
    const claim = this.claims.get(id);
    if (!claim) {
      return null;
    }

    const updatedClaim = new Claim({
      ...claim.toJSON(),
      ...updates,
      id,
      updatedAt: new Date()
    });

    this.claims.set(id, updatedClaim);
    return updatedClaim;
  }

  async updateStatus(id, status, additionalData = {}) {
    const claim = this.claims.get(id);
    if (!claim) {
      return null;
    }

    const updates = {
      status,
      ...additionalData,
      updatedAt: new Date()
    };

    if (status === 'approved') {
      updates.adjudicationDate = updates.adjudicationDate || new Date();
    }

    if (status === 'denied') {
      updates.adjudicationDate = updates.adjudicationDate || new Date();
    }

    return this.update(id, updates);
  }

  async delete(id) {
    return this.claims.delete(id);
  }

  async getStatistics(filters = {}) {
    const claims = await this.findAll(filters);

    const stats = {
      total: claims.length,
      pending: claims.filter(c => c.status === 'pending').length,
      submitted: claims.filter(c => c.status === 'submitted').length,
      approved: claims.filter(c => c.status === 'approved').length,
      denied: claims.filter(c => c.status === 'denied').length,
      partiallyApproved: claims.filter(c => c.status === 'partially_approved').length,
      totalClaimedAmount: claims.reduce((sum, c) => sum + c.claimedAmount, 0),
      totalApprovedAmount: claims.reduce((sum, c) => sum + c.approvedAmount, 0),
      totalDeniedAmount: claims.reduce((sum, c) => sum + c.deniedAmount, 0),
      totalPatientResponsibility: claims.reduce((sum, c) => sum + c.patientResponsibility, 0),
      averageApprovalRate: claims.length > 0
        ? (claims.filter(c => c.status === 'approved').length / claims.length * 100).toFixed(2)
        : 0
    };

    return stats;
  }
}

module.exports = new ClaimRepository();
