const { query } = require('../db/connection');

class ClinicRepository {
  /**
   * Find clinic by ID
   * @param {number} clinicId
   * @returns {Promise<Object|null>} Clinic object
   */
  static async findById(clinicId) {
    const result = await query(
      `SELECT 
        clinic_id,
        name,
        phone,
        email,
        country,
        state,
        city,
        address,
        created_at,
        updated_at
      FROM clinics
      WHERE clinic_id = $1`,
      [clinicId]
    );
    return result.rows[0] || null;
  }

  /**
   * Create a new clinic
   * @param {Object} clinicData - Clinic data
   * @returns {Promise<Object>} Created clinic
   */
  static async create(clinicData) {
    const {
      name,
      phone,
      email,
      country,
      state,
      city,
      address
    } = clinicData;

    const result = await query(
      `INSERT INTO clinics (
        name, phone, email, country, state, city, address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING clinic_id, name, phone, email, country, state, city, address, created_at`,
      [
        name,
        phone || null,
        email || null,
        country || null,
        state || null,
        city || null,
        address || null
      ]
    );
    return result.rows[0];
  }

  /**
   * Update clinic
   * @param {number} clinicId
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} Updated clinic
   */
  static async update(clinicId, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      fields.push(`${key} = $${paramCount}`);
      values.push(updates[key]);
      paramCount++;
    });

    if (fields.length === 0) {
      return null;
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(clinicId);

    const result = await query(
      `UPDATE clinics
       SET ${fields.join(', ')}
       WHERE clinic_id = $${paramCount}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Get all clinics
   * @returns {Promise<Array>} Array of clinic objects
   */
  static async getAll() {
    const result = await query(
      'SELECT * FROM clinics ORDER BY name'
    );
    return result.rows;
  }
}

module.exports = ClinicRepository;

