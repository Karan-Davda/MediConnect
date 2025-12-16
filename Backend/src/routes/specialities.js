const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const { authenticate } = require('../middleware/auth');

/**
 * GET /api/specialities
 * Get all active specialties
 * @access Public (for signup) or Authenticated
 */
router.get('/', async (req, res) => {
  try {
    const activeOnly = req.query.activeOnly !== 'false';
    
    let queryStr = 'SELECT speciality_id, speciality_name, description FROM speciality';
    const params = [];
    
    if (activeOnly) {
      queryStr += ' WHERE is_active = true';
    }
    
    queryStr += ' ORDER BY speciality_name ASC';
    
    const result = await query(queryStr, params);
    
    res.json({
      count: result.rows.length,
      specialities: result.rows.map(row => ({
        id: row.speciality_id,
        name: row.speciality_name,
        description: row.description
      }))
    });
  } catch (error) {
    console.error('Error fetching specialties:', error);
    res.status(500).json({ error: 'Failed to fetch specialties' });
  }
});

/**
 * GET /api/specialities/:id
 * Get specialty by ID
 * @access Public or Authenticated
 */
router.get('/:id', async (req, res) => {
  try {
    const specialityId = parseInt(req.params.id);
    
    if (isNaN(specialityId)) {
      return res.status(400).json({ error: 'Invalid specialty ID' });
    }
    
    const result = await query(
      'SELECT speciality_id, speciality_name, description FROM speciality WHERE speciality_id = $1 AND is_active = true',
      [specialityId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Specialty not found' });
    }
    
    const row = result.rows[0];
    res.json({
      id: row.speciality_id,
      name: row.speciality_name,
      description: row.description
    });
  } catch (error) {
    console.error('Error fetching specialty:', error);
    res.status(500).json({ error: 'Failed to fetch specialty' });
  }
});

module.exports = router;

