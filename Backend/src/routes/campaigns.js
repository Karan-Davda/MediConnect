const express = require('express');
const Campaign = require('../models/Campaign');
const CampaignRepository = require('../repositories/CampaignRepository');
const PatientRepository = require('../repositories/PatientRepository');
const AudienceFilterService = require('../services/audienceFilter');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const campaignRepo = new CampaignRepository();
const patientRepo = new PatientRepository();
const audienceService = new AudienceFilterService(patientRepo);

function auditLog(action, details, req) {
  console.log('[AUDIT][CAMPAIGN]', {
    action,
    timestamp: new Date().toISOString(),
    user: req.user?.email || 'unknown',
    details
  });
}

router.get('/', authenticate, (req, res) => {
  try {
    const campaigns = campaignRepo.getAll();
    res.json(campaigns);
  } catch (error) {
    console.error('[CAMPAIGN_LIST_ERROR]', error);
    res.status(500).json({ error: 'Failed to retrieve campaigns' });
  }
});

router.get('/:id', authenticate, (req, res) => {
  try {
    const campaign = campaignRepo.getById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    res.json(campaign);
  } catch (error) {
    console.error('[CAMPAIGN_GET_ERROR]', error);
    res.status(500).json({ error: 'Failed to retrieve campaign' });
  }
});

router.post('/', authenticate, (req, res) => {
  try {
    const campaignData = {
      ...req.body,
      createdBy: req.user?.email || 'unknown',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const campaign = new Campaign(campaignData);
    const errors = campaign.validate();

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    if (campaign.targetAudience) {
      const estimatedReach = audienceService.getEstimatedReach(campaign.targetAudience);
      campaign.estimatedReach = estimatedReach;
    }

    const saved = campaignRepo.create(campaign);
    auditLog('CREATE_CAMPAIGN', { id: saved.id, name: saved.name }, req);

    res.status(201).json(saved);
  } catch (error) {
    console.error('[CAMPAIGN_CREATE_ERROR]', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

router.put('/:id', authenticate, (req, res) => {
  try {
    const existing = campaignRepo.getById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const updates = {
      ...req.body,
      updatedAt: new Date()
    };

    const campaign = new Campaign({ ...existing, ...updates });
    const errors = campaign.validate();

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    if (updates.targetAudience) {
      const estimatedReach = audienceService.getEstimatedReach(updates.targetAudience);
      campaign.estimatedReach = estimatedReach;
    }

    const updated = campaignRepo.update(req.params.id, campaign);
    auditLog('UPDATE_CAMPAIGN', { id: updated.id, name: updated.name }, req);

    res.json(updated);
  } catch (error) {
    console.error('[CAMPAIGN_UPDATE_ERROR]', error);
    res.status(500).json({ error: 'Failed to update campaign' });
  }
});

router.delete('/:id', authenticate, (req, res) => {
  try {
    const campaign = campaignRepo.getById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const deleted = campaignRepo.delete(req.params.id);
    if (deleted) {
      auditLog('DELETE_CAMPAIGN', { id: req.params.id, name: campaign.name }, req);
      res.json({ message: 'Campaign deleted successfully' });
    } else {
      res.status(500).json({ error: 'Failed to delete campaign' });
    }
  } catch (error) {
    console.error('[CAMPAIGN_DELETE_ERROR]', error);
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
});

router.post('/preview-audience', authenticate, (req, res) => {
  try {
    const { targetAudience, limit } = req.body;

    if (!targetAudience || Object.keys(targetAudience).length === 0) {
      return res.status(400).json({ error: 'Target audience criteria is required' });
    }

    const preview = audienceService.previewAudience(targetAudience, limit || 10);
    res.json(preview);
  } catch (error) {
    console.error('[AUDIENCE_PREVIEW_ERROR]', error);
    res.status(500).json({ error: 'Failed to preview audience' });
  }
});

router.post('/:id/schedule', authenticate, (req, res) => {
  try {
    const campaign = campaignRepo.getById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const errors = campaign.validate();
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const updated = campaignRepo.update(req.params.id, {
      status: 'SCHEDULED',
      updatedAt: new Date()
    });

    auditLog('SCHEDULE_CAMPAIGN', {
      id: updated.id,
      name: updated.name,
      startDate: updated.startDate
    }, req);

    res.json(updated);
  } catch (error) {
    console.error('[CAMPAIGN_SCHEDULE_ERROR]', error);
    res.status(500).json({ error: 'Failed to schedule campaign' });
  }
});

router.post('/:id/pause', authenticate, (req, res) => {
  try {
    const campaign = campaignRepo.getById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const updated = campaignRepo.update(req.params.id, {
      status: 'PAUSED',
      updatedAt: new Date()
    });

    auditLog('PAUSE_CAMPAIGN', { id: updated.id, name: updated.name }, req);
    res.json(updated);
  } catch (error) {
    console.error('[CAMPAIGN_PAUSE_ERROR]', error);
    res.status(500).json({ error: 'Failed to pause campaign' });
  }
});

router.post('/:id/activate', authenticate, (req, res) => {
  try {
    const campaign = campaignRepo.getById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const updated = campaignRepo.update(req.params.id, {
      status: 'ACTIVE',
      updatedAt: new Date()
    });

    auditLog('ACTIVATE_CAMPAIGN', { id: updated.id, name: updated.name }, req);
    res.json(updated);
  } catch (error) {
    console.error('[CAMPAIGN_ACTIVATE_ERROR]', error);
    res.status(500).json({ error: 'Failed to activate campaign' });
  }
});

module.exports = router;
