const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const ClinicServiceRepository = require('../repositories/ClinicServiceRepository');
const { logAccess, AUDIT_ACTIONS } = require('../middleware/auditLogger');

const router = express.Router();

/**
 * Get all clinic services
 * GET /api/clinic-services
 * Query params: clinicId, serviceType, activeOnly
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const clinicId = req.query.clinicId ? parseInt(req.query.clinicId) : null;
    const serviceType = req.query.serviceType || null;
    const activeOnly = req.query.activeOnly !== 'false';

    const services = await ClinicServiceRepository.getAll(clinicId, serviceType, activeOnly);

    res.json({
      count: services.length,
      services: services.map(s => ({
        service_id: s.service_id,
        clinic_id: s.clinic_id,
        service_code: s.service_code,
        service_name: s.service_name,
        service_type: s.service_type,
        category: s.category,
        description: s.description,
        unit_price: parseFloat(s.unit_price),
        unit: s.unit,
        cpt_code: s.cpt_code,
        hcpcs_code: s.hcpcs_code,
        is_active: s.is_active,
        requires_prescription: s.requires_prescription
      }))
    });
  } catch (error) {
    console.error('[ERROR] Error fetching clinic services:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch clinic services' });
  }
});

/**
 * Get service by ID
 * GET /api/clinic-services/:id
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const serviceId = parseInt(req.params.id);
    const service = await ClinicServiceRepository.findById(serviceId);

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    res.json({
      service_id: service.service_id,
      clinic_id: service.clinic_id,
      service_code: service.service_code,
      service_name: service.service_name,
      service_type: service.service_type,
      category: service.category,
      description: service.description,
      unit_price: parseFloat(service.unit_price),
      unit: service.unit,
      cpt_code: service.cpt_code,
      hcpcs_code: service.hcpcs_code,
      is_active: service.is_active,
      requires_prescription: service.requires_prescription
    });
  } catch (error) {
    console.error('[ERROR] Error fetching service:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch service' });
  }
});

/**
 * Create clinic service (admin only)
 * POST /api/clinic-services
 */
router.post('/', authenticate, requireRole('clinic_admin'), async (req, res) => {
  try {
    const serviceData = req.body;

    if (!serviceData.service_code || !serviceData.service_name || !serviceData.service_type || !serviceData.unit_price) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['service_code', 'service_name', 'service_type', 'unit_price']
      });
    }

    const service = await ClinicServiceRepository.create(serviceData);

    logAccess(req, AUDIT_ACTIONS.CREATE, {
      resourceType: 'CLINIC_SERVICE',
      resourceId: service.service_id,
      details: `Created clinic service: ${service.service_name}`
    });

    res.status(201).json({
      message: 'Clinic service created successfully',
      service
    });
  } catch (error) {
    console.error('[ERROR] Error creating clinic service:', error);
    res.status(500).json({ error: error.message || 'Failed to create clinic service' });
  }
});

/**
 * Update clinic service (admin only)
 * PUT /api/clinic-services/:id
 */
router.put('/:id', authenticate, requireRole('clinic_admin'), async (req, res) => {
  try {
    const serviceId = parseInt(req.params.id);
    const updates = req.body;

    const service = await ClinicServiceRepository.update(serviceId, updates);

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    logAccess(req, AUDIT_ACTIONS.UPDATE, {
      resourceType: 'CLINIC_SERVICE',
      resourceId: serviceId,
      details: `Updated clinic service: ${service.service_name}`
    });

    res.json({
      message: 'Service updated successfully',
      service
    });
  } catch (error) {
    console.error('[ERROR] Error updating service:', error);
    res.status(500).json({ error: error.message || 'Failed to update service' });
  }
});

/**
 * Delete (deactivate) clinic service (admin only)
 * DELETE /api/clinic-services/:id
 */
router.delete('/:id', authenticate, requireRole('clinic_admin'), async (req, res) => {
  try {
    const serviceId = parseInt(req.params.id);
    const success = await ClinicServiceRepository.delete(serviceId);

    if (!success) {
      return res.status(404).json({ error: 'Service not found' });
    }

    logAccess(req, AUDIT_ACTIONS.DELETE, {
      resourceType: 'CLINIC_SERVICE',
      resourceId: serviceId,
      details: 'Deactivated clinic service'
    });

    res.json({ message: 'Service deactivated successfully' });
  } catch (error) {
    console.error('[ERROR] Error deleting service:', error);
    res.status(500).json({ error: error.message || 'Failed to delete service' });
  }
});

module.exports = router;

