const { query } = require('../db/connection');

class PatientRepository {
  /**
   * Find patient by user_id
   * @param {number} userId
   * @returns {Object} Patient with user info, or null if not found
   */
  static async findByUserId(userId) {
    const result = await query(
      `SELECT 
        p.*,
        u.first_name, u.last_name, u.email, u.phone_number,
        u.country, u.state, u.city
      FROM patients p
      JOIN users u ON p.user_id = u.user_id
      WHERE p.user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Find patient by patient_id
   * @param {number} patientId
   * @returns {Object} Patient with user info, or null if not found
   */
  static async findById(patientId) {
    const result = await query(
      `SELECT 
        p.*,
        u.first_name, u.last_name, u.email, u.phone_number,
        u.country, u.state, u.city
      FROM patients p
      JOIN users u ON p.user_id = u.user_id
      WHERE p.patient_id = $1`,
      [patientId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get all patients (for dropdowns, etc.)
   * @returns {Array} Array of patients with user info
   */
  static async getAll() {
    const result = await query(
      `SELECT 
        p.*,
        u.first_name, u.last_name, u.email, u.phone_number,
        u.country, u.state, u.city
      FROM patients p
      JOIN users u ON p.user_id = u.user_id
      ORDER BY u.last_name, u.first_name`
    );
    return result.rows;
  }

  /**
   * Create a new patient
   * @param {Object} patientData - { user_id, dob, gender, address, emergency_contact, insurance_id, allergies, medical_history }
   * @returns {Object} Created patient
   */
  static async create(patientData) {
    const {
      user_id,
      dob,
      gender,
      address,
      emergency_contact,
      insurance_id,
      allergies,
      medical_history
    } = patientData;

    const result = await query(
      `INSERT INTO patients (
        user_id, dob, gender, address, emergency_contact,
        insurance_id, allergies, medical_history
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        user_id,
        dob,
        gender,
        address ? JSON.stringify(address) : null,
        emergency_contact ? JSON.stringify(emergency_contact) : null,
        insurance_id,
        allergies ? JSON.stringify(allergies) : '[]',
        medical_history ? JSON.stringify(medical_history) : '[]'
      ]
    );

    return result.rows[0];
  }

  /**
   * Update patient
   * @param {number} patientId
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated patient
   */
  static async update(patientId, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;
    const jsonbFields = ['address', 'emergency_contact', 'allergies', 'medical_history'];

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        // Handle JSONB fields
        if (jsonbFields.includes(key) && typeof updates[key] === 'object') {
          fields.push(`${key} = $${paramCount}::jsonb`);
          values.push(JSON.stringify(updates[key]));
        } else {
          fields.push(`${key} = $${paramCount}`);
          values.push(updates[key]);
        }
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return null;
    }

    fields.push(`updated_at = NOW()`);
    values.push(patientId);

    const result = await query(
      `UPDATE patients 
       SET ${fields.join(', ')}
       WHERE patient_id = $${paramCount}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Delete patient
   * @param {number} patientId
   * @returns {boolean} True if deleted, false if not found
   */
  static async delete(patientId) {
    const result = await query(
      'DELETE FROM patients WHERE patient_id = $1 RETURNING patient_id',
      [patientId]
    );
    return result.rows.length > 0;
  }

  /**
   * Search patients by criteria
   * @param {Object} criteria - Search criteria
   * @returns {Array} Array of matching patients
   */
  static async search(criteria) {
    let queryStr = `
      SELECT 
        p.*,
        u.first_name, u.last_name, u.email, u.phone_number
      FROM patients p
      JOIN users u ON p.user_id = u.user_id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (criteria.firstName) {
      queryStr += ` AND u.first_name ILIKE $${paramCount}`;
      params.push(`%${criteria.firstName}%`);
      paramCount++;
    }

    if (criteria.lastName) {
      queryStr += ` AND u.last_name ILIKE $${paramCount}`;
      params.push(`%${criteria.lastName}%`);
      paramCount++;
    }

    if (criteria.email) {
      queryStr += ` AND u.email ILIKE $${paramCount}`;
      params.push(`%${criteria.email}%`);
      paramCount++;
    }

    queryStr += ` ORDER BY u.last_name, u.first_name`;

    const result = await query(queryStr, params);
    return result.rows;
  }
}

module.exports = PatientRepository;
