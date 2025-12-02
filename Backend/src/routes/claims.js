const express = require('express');
const router = express.Router();
const claimRepository = require('../repositories/ClaimRepository');
const insuranceRepository = require('../repositories/InsuranceRepository');
const { authenticate, checkPermission } = require('../middleware/auth');

router.post('/', authenticate, checkPermission('write_claims'), async (req, res) => {
  try {
    const {
      patientId,
      insuranceId,
      providerId,
      serviceDate,
      diagnosisCodes,
      procedureCodes,
      serviceDescription,
      totalCharges,
      claimedAmount,
      claimType,
      placeOfService,
      priorAuthNumber,
      notes
    } = req.body;

    if (!patientId || !insuranceId || !serviceDate || !totalCharges || !claimedAmount) {
      return res.status(400).json({
        error: 'Missing required fields: patientId, insuranceId, serviceDate, totalCharges, claimedAmount'
      });
    }

    const insurance = await insuranceRepository.getInsuranceById(insuranceId);
    if (!insurance) {
      return res.status(404).json({ error: 'Insurance record not found' });
    }

    if (insurance.status !== 'active') {
      return res.status(400).json({ error: 'Insurance is not active' });
    }

    if (insurance.verificationStatus !== 'verified') {
      return res.status(400).json({
        error: 'Insurance must be verified before submitting claims',
        verificationStatus: insurance.verificationStatus
      });
    }

    const claim = await claimRepository.create({
      patientId,
      patientName: insurance.patientName,
      insuranceId,
      insuranceProvider: insurance.insuranceProvider,
      policyNumber: insurance.policyNumber,
      providerId: providerId || req.user.id,
      providerName: req.user.name,
      serviceDate,
      diagnosisCodes: diagnosisCodes || [],
      procedureCodes: procedureCodes || [],
      serviceDescription,
      totalCharges: parseFloat(totalCharges),
      claimedAmount: parseFloat(claimedAmount),
      status: 'pending',
      submittedBy: req.user.id,
      claimType: claimType || 'professional',
      placeOfService: placeOfService || 'Office',
      priorAuthNumber,
      payerId: insurance.insuranceProvider,
      payerName: insurance.insuranceProvider,
      payerAddress: insurance.claimsAddress || insurance.insuranceAddress,
      notes,
      reconciliationStatus: 'pending',
      createdBy: req.user.id
    });


    res.status(201).json(claim);
  } catch (error) {
    console.error('Error creating claim:', error);
    res.status(500).json({ error: 'Failed to create claim' });
  }
});

router.get('/', authenticate, checkPermission('read_claims'), async (req, res) => {
  try {
    const { patientId, insuranceId, status, providerId, reconciliationStatus } = req.query;

    const filters = {};
    if (patientId) filters.patientId = patientId;
    if (insuranceId) filters.insuranceId = insuranceId;
    if (status) filters.status = status;
    if (providerId) filters.providerId = providerId;
    if (reconciliationStatus) filters.reconciliationStatus = reconciliationStatus;

    if (req.user.role === 'patient') {
      filters.patientId = req.user.id;
    } else if (req.user.role === 'doctor') {
      filters.providerId = filters.providerId || req.user.id;
    }

    const claims = await claimRepository.findAll(filters);
    res.json(claims);
  } catch (error) {
    console.error('Error fetching claims:', error);
    res.status(500).json({ error: 'Failed to fetch claims' });
  }
});

router.get('/statistics', authenticate, checkPermission('read_claims'), async (req, res) => {
  try {
    const { patientId, insuranceId, providerId } = req.query;

    const filters = {};
    if (patientId) filters.patientId = patientId;
    if (insuranceId) filters.insuranceId = insuranceId;
    if (providerId) filters.providerId = providerId;

    if (req.user.role === 'patient') {
      filters.patientId = req.user.id;
    } else if (req.user.role === 'doctor') {
      filters.providerId = filters.providerId || req.user.id;
    }

    const stats = await claimRepository.getStatistics(filters);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching claim statistics:', error);
    res.status(500).json({ error: 'Failed to fetch claim statistics' });
  }
});

router.get('/:id', authenticate, checkPermission('read_claims'), async (req, res) => {
  try {
    const claim = await claimRepository.findById(req.params.id);

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (req.user.role === 'patient' && claim.patientId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (req.user.role === 'doctor' && claim.providerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(claim);
  } catch (error) {
    console.error('Error fetching claim:', error);
    res.status(500).json({ error: 'Failed to fetch claim' });
  }
});

router.put('/:id', authenticate, checkPermission('write_claims'), async (req, res) => {
  try {
    const {
      diagnosisCodes,
      procedureCodes,
      serviceDescription,
      totalCharges,
      claimedAmount,
      placeOfService,
      priorAuthNumber,
      notes
    } = req.body;

    const existingClaim = await claimRepository.findById(req.params.id);
    if (!existingClaim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (existingClaim.status !== 'pending') {
      return res.status(400).json({
        error: 'Cannot update claim that has been submitted',
        currentStatus: existingClaim.status
      });
    }

    const updates = {
      diagnosisCodes,
      procedureCodes,
      serviceDescription,
      totalCharges: totalCharges ? parseFloat(totalCharges) : existingClaim.totalCharges,
      claimedAmount: claimedAmount ? parseFloat(claimedAmount) : existingClaim.claimedAmount,
      placeOfService,
      priorAuthNumber,
      notes,
      updatedBy: req.user.id
    };

    const updatedClaim = await claimRepository.update(req.params.id, updates);


    res.json(updatedClaim);
  } catch (error) {
    console.error('Error updating claim:', error);
    res.status(500).json({ error: 'Failed to update claim' });
  }
});

router.post('/:id/submit', authenticate, checkPermission('write_claims'), async (req, res) => {
  try {
    const claim = await claimRepository.findById(req.params.id);

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (claim.status !== 'pending') {
      return res.status(400).json({
        error: 'Claim has already been submitted',
        currentStatus: claim.status
      });
    }

    const insurance = await insuranceRepository.getInsuranceById(claim.insuranceId);
    if (!insurance || insurance.verificationStatus !== 'verified') {
      return res.status(400).json({
        error: 'Insurance verification required before submission'
      });
    }

    const updatedClaim = await claimRepository.updateStatus(req.params.id, 'submitted', {
      submissionDate: new Date(),
      submittedBy: req.user.id
    });

    res.json(updatedClaim);
  } catch (error) {
    console.error('Error submitting claim:', error);
    res.status(500).json({ error: 'Failed to submit claim' });
  }
});

router.put('/:id/status', authenticate, checkPermission('write_claims'), async (req, res) => {
  try {
    const {
      status,
      approvedAmount,
      deniedAmount,
      patientResponsibility,
      denialReason,
      denialCode,
      adjudicationDate,
      paymentDate,
      paymentAmount,
      paymentMethod,
      checkNumber,
      eobNumber,
      reconciliationStatus
    } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = ['pending', 'submitted', 'approved', 'denied', 'partially_approved', 'resubmitted'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        validStatuses
      });
    }

    const claim = await claimRepository.findById(req.params.id);
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    const additionalData = {
      updatedBy: req.user.id
    };

    if (approvedAmount !== undefined) additionalData.approvedAmount = parseFloat(approvedAmount);
    if (deniedAmount !== undefined) additionalData.deniedAmount = parseFloat(deniedAmount);
    if (patientResponsibility !== undefined) additionalData.patientResponsibility = parseFloat(patientResponsibility);
    if (denialReason) additionalData.denialReason = denialReason;
    if (denialCode) additionalData.denialCode = denialCode;
    if (adjudicationDate) additionalData.adjudicationDate = adjudicationDate;
    if (paymentDate) additionalData.paymentDate = paymentDate;
    if (paymentAmount !== undefined) additionalData.paymentAmount = parseFloat(paymentAmount);
    if (paymentMethod) additionalData.paymentMethod = paymentMethod;
    if (checkNumber) additionalData.checkNumber = checkNumber;
    if (eobNumber) additionalData.eobNumber = eobNumber;
    if (reconciliationStatus) additionalData.reconciliationStatus = reconciliationStatus;

    const updatedClaim = await claimRepository.updateStatus(req.params.id, status, additionalData);

    res.json(updatedClaim);
  } catch (error) {
    console.error('Error updating claim status:', error);
    res.status(500).json({ error: 'Failed to update claim status' });
  }
});

router.delete('/:id', authenticate, checkPermission('write_claims'), async (req, res) => {
  try {
    const claim = await claimRepository.findById(req.params.id);

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (claim.status !== 'pending') {
      return res.status(400).json({
        error: 'Cannot delete submitted claims',
        currentStatus: claim.status
      });
    }

    await claimRepository.delete(req.params.id);

    res.json({ message: 'Claim deleted successfully' });
  } catch (error) {
    console.error('Error deleting claim:', error);
    res.status(500).json({ error: 'Failed to delete claim' });
  }
});

module.exports = router;
