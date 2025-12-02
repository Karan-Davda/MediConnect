class Claim {
  constructor({
    id,
    claimNumber,
    patientId,
    patientName,
    insuranceId,
    insuranceProvider,
    policyNumber,
    providerId,
    providerName,
    serviceDate,
    submissionDate,
    diagnosisCodes,
    procedureCodes,
    serviceDescription,
    totalCharges,
    claimedAmount,
    approvedAmount,
    deniedAmount,
    patientResponsibility,
    status,
    submittedBy,
    claimType,
    placeOfService,
    priorAuthNumber,
    referenceNumber,
    payerId,
    payerName,
    payerAddress,
    eobDate,
    eobNumber,
    denialReason,
    denialCode,
    notes,
    attachments,
    adjudicationDate,
    paymentDate,
    paymentAmount,
    paymentMethod,
    checkNumber,
    remittanceAdviceUrl,
    resubmissionCount,
    originalClaimId,
    appealDate,
    appealStatus,
    reconciliationStatus,
    createdAt,
    updatedAt,
    createdBy,
    updatedBy
  }) {
    this.id = id;
    this.claimNumber = claimNumber;
    this.patientId = patientId;
    this.patientName = patientName;
    this.insuranceId = insuranceId;
    this.insuranceProvider = insuranceProvider;
    this.policyNumber = policyNumber;
    this.providerId = providerId;
    this.providerName = providerName;
    this.serviceDate = serviceDate;
    this.submissionDate = submissionDate || new Date();
    this.diagnosisCodes = diagnosisCodes || [];
    this.procedureCodes = procedureCodes || [];
    this.serviceDescription = serviceDescription;
    this.totalCharges = totalCharges;
    this.claimedAmount = claimedAmount;
    this.approvedAmount = approvedAmount || 0;
    this.deniedAmount = deniedAmount || 0;
    this.patientResponsibility = patientResponsibility || 0;
    this.status = status || 'pending';
    this.submittedBy = submittedBy;
    this.claimType = claimType || 'professional';
    this.placeOfService = placeOfService;
    this.priorAuthNumber = priorAuthNumber;
    this.referenceNumber = referenceNumber;
    this.payerId = payerId;
    this.payerName = payerName;
    this.payerAddress = payerAddress;
    this.eobDate = eobDate;
    this.eobNumber = eobNumber;
    this.denialReason = denialReason;
    this.denialCode = denialCode;
    this.notes = notes;
    this.attachments = attachments || [];
    this.adjudicationDate = adjudicationDate;
    this.paymentDate = paymentDate;
    this.paymentAmount = paymentAmount || 0;
    this.paymentMethod = paymentMethod;
    this.checkNumber = checkNumber;
    this.remittanceAdviceUrl = remittanceAdviceUrl;
    this.resubmissionCount = resubmissionCount || 0;
    this.originalClaimId = originalClaimId;
    this.appealDate = appealDate;
    this.appealStatus = appealStatus;
    this.reconciliationStatus = reconciliationStatus || 'pending';
    this.createdAt = createdAt || new Date();
    this.updatedAt = updatedAt || new Date();
    this.createdBy = createdBy;
    this.updatedBy = updatedBy;
  }

  toJSON() {
    return {
      id: this.id,
      claimNumber: this.claimNumber,
      patientId: this.patientId,
      patientName: this.patientName,
      insuranceId: this.insuranceId,
      insuranceProvider: this.insuranceProvider,
      policyNumber: this.policyNumber,
      providerId: this.providerId,
      providerName: this.providerName,
      serviceDate: this.serviceDate,
      submissionDate: this.submissionDate,
      diagnosisCodes: this.diagnosisCodes,
      procedureCodes: this.procedureCodes,
      serviceDescription: this.serviceDescription,
      totalCharges: this.totalCharges,
      claimedAmount: this.claimedAmount,
      approvedAmount: this.approvedAmount,
      deniedAmount: this.deniedAmount,
      patientResponsibility: this.patientResponsibility,
      status: this.status,
      submittedBy: this.submittedBy,
      claimType: this.claimType,
      placeOfService: this.placeOfService,
      priorAuthNumber: this.priorAuthNumber,
      referenceNumber: this.referenceNumber,
      payerId: this.payerId,
      payerName: this.payerName,
      payerAddress: this.payerAddress,
      eobDate: this.eobDate,
      eobNumber: this.eobNumber,
      denialReason: this.denialReason,
      denialCode: this.denialCode,
      notes: this.notes,
      attachments: this.attachments,
      adjudicationDate: this.adjudicationDate,
      paymentDate: this.paymentDate,
      paymentAmount: this.paymentAmount,
      paymentMethod: this.paymentMethod,
      checkNumber: this.checkNumber,
      remittanceAdviceUrl: this.remittanceAdviceUrl,
      resubmissionCount: this.resubmissionCount,
      originalClaimId: this.originalClaimId,
      appealDate: this.appealDate,
      appealStatus: this.appealStatus,
      reconciliationStatus: this.reconciliationStatus,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      createdBy: this.createdBy,
      updatedBy: this.updatedBy
    };
  }
}

module.exports = { Claim };
