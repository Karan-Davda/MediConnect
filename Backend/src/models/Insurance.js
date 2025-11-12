// Insurance model - manages patient insurance information and verification
class Insurance {
  constructor({
    id,
    patientId,
    patientName, // For display purposes
    insuranceProvider,
    policyNumber,
    groupNumber,
    subscriberName,
    subscriberRelationship, // 'self', 'spouse', 'parent', 'child', 'other'
    subscriberDateOfBirth,
    effectiveDate,
    expirationDate,
    planType, // 'HMO', 'PPO', 'EPO', 'POS', 'HDHP'
    coverageType, // 'primary', 'secondary', 'tertiary'
    copay,
    deductible,
    deductibleMet,
    outOfPocketMax,
    outOfPocketMet,
    coveragePercentage,
    priorAuthRequired,
    verificationStatus, // 'pending', 'verified', 'failed', 'expired'
    verifiedDate,
    verifiedBy,
    verificationNotes,
    insurancePhone,
    insuranceAddress,
    claimsAddress,
    rxBin, // Prescription benefit BIN
    rxPcn, // Prescription benefit PCN
    rxGroup, // Prescription benefit Group
    status, // 'active', 'inactive', 'terminated'
    notes,
    attachments, // Array of document URLs/paths
    createdAt,
    updatedAt,
    createdBy,
    updatedBy
  }) {
    this.id = id;
    this.patientId = patientId;
    this.patientName = patientName;
    this.insuranceProvider = insuranceProvider;
    this.policyNumber = policyNumber;
    this.groupNumber = groupNumber;
    this.subscriberName = subscriberName;
    this.subscriberRelationship = subscriberRelationship || 'self';
    this.subscriberDateOfBirth = subscriberDateOfBirth;
    this.effectiveDate = effectiveDate;
    this.expirationDate = expirationDate;
    this.planType = planType;
    this.coverageType = coverageType || 'primary';
    this.copay = copay;
    this.deductible = deductible;
    this.deductibleMet = deductibleMet || 0;
    this.outOfPocketMax = outOfPocketMax;
    this.outOfPocketMet = outOfPocketMet || 0;
    this.coveragePercentage = coveragePercentage || 80;
    this.priorAuthRequired = priorAuthRequired || false;
    this.verificationStatus = verificationStatus || 'pending';
    this.verifiedDate = verifiedDate;
    this.verifiedBy = verifiedBy;
    this.verificationNotes = verificationNotes;
    this.insurancePhone = insurancePhone;
    this.insuranceAddress = insuranceAddress;
    this.claimsAddress = claimsAddress;
    this.rxBin = rxBin;
    this.rxPcn = rxPcn;
    this.rxGroup = rxGroup;
    this.status = status || 'active';
    this.notes = notes;
    this.attachments = attachments || [];
    this.createdAt = createdAt || new Date();
    this.updatedAt = updatedAt || new Date();
    this.createdBy = createdBy;
    this.updatedBy = updatedBy;
  }

  toJSON() {
    return {
      id: this.id,
      patientId: this.patientId,
      patientName: this.patientName,
      insuranceProvider: this.insuranceProvider,
      policyNumber: this.policyNumber,
      groupNumber: this.groupNumber,
      subscriberName: this.subscriberName,
      subscriberRelationship: this.subscriberRelationship,
      subscriberDateOfBirth: this.subscriberDateOfBirth,
      effectiveDate: this.effectiveDate,
      expirationDate: this.expirationDate,
      planType: this.planType,
      coverageType: this.coverageType,
      copay: this.copay,
      deductible: this.deductible,
      deductibleMet: this.deductibleMet,
      outOfPocketMax: this.outOfPocketMax,
      outOfPocketMet: this.outOfPocketMet,
      coveragePercentage: this.coveragePercentage,
      priorAuthRequired: this.priorAuthRequired,
      verificationStatus: this.verificationStatus,
      verifiedDate: this.verifiedDate,
      verifiedBy: this.verifiedBy,
      verificationNotes: this.verificationNotes,
      insurancePhone: this.insurancePhone,
      insuranceAddress: this.insuranceAddress,
      claimsAddress: this.claimsAddress,
      rxBin: this.rxBin,
      rxPcn: this.rxPcn,
      rxGroup: this.rxGroup,
      status: this.status,
      notes: this.notes,
      attachments: this.attachments,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      createdBy: this.createdBy,
      updatedBy: this.updatedBy
    };
  }
}

module.exports = { Insurance };
