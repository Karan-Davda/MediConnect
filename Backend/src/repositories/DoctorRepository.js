const { query } = require('../db/connection');

class DoctorRepository {
  /**
   * Create a new doctor
   * @param {Object} doctorData - { user_id, address, speciality_id, standard_healthcare_id, license_number, license_expiry }
   * @param {string} fullName - Full name to split (if needed to update users table)
   * @param {string} specialty - Specialty name (if speciality_id not provided)
   * @returns {Object} Created doctor
   */
  static async create(doctorData, fullName = null, specialty = null) {
    const {
      user_id,
      address,
      speciality_id,
      standard_healthcare_id,
      license_number,
      license_expiry
    } = doctorData;

    // If fullName is provided, update the user record
    if (fullName) {
      const nameParts = fullName.trim().split(/\s+/);
      const first_name = nameParts[0] || '';
      const last_name = nameParts.slice(1).join(' ') || '';

      if (first_name || last_name) {
        await query(
          'UPDATE users SET first_name = $1, last_name = $2 WHERE user_id = $3',
          [first_name, last_name, user_id]
        );
      }
    }

    // TODO: If specialty is provided but speciality_id is not,
    // you may want to look up speciality_id from speciality table
    // For now, we'll store it as-is if speciality_id is provided

    const result = await query(
      `INSERT INTO doctors (
        user_id, address, speciality_id, standard_healthcare_id,
        license_number, license_expiry
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        user_id,
        address,
        speciality_id,
        standard_healthcare_id,
        license_number,
        license_expiry
      ]
    );

    return result.rows[0];
  }

  /**
   * Find doctor by user_id
   * @param {number} userId
   * @returns {Object} Doctor with user info
   */
  static async findByUserId(userId) {
    const result = await query(
      `SELECT 
        d.*,
        d.fees,
        u.first_name, u.last_name, u.email, u.phone_number,
        u.country, u.state, u.city, u.clinic_id
      FROM doctors d
      JOIN users u ON d.user_id = u.user_id
      WHERE d.user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Find doctor by doctor_id
   * @param {number} doctorId
   * @returns {Object} Doctor with user info
   */
  static async findById(doctorId) {
    const result = await query(
      `SELECT 
        d.*,
        d.fees,
        u.first_name, u.last_name, u.email, u.phone_number,
        u.country, u.state, u.city, u.clinic_id
      FROM doctors d
      JOIN users u ON d.user_id = u.user_id
      WHERE d.doctor_id = $1`,
      [doctorId]
    );
    return result.rows[0] || null;
  }

  /**
   * Update doctor
   * @param {number} doctorId
   * @param {Object} updates - Fields to update
   */
  static async update(doctorId, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;
    const jsonbFields = ['languages', 'office_hours', 'insurance_accepted'];

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        // Handle JSONB fields - cast to JSONB in SQL
        if (jsonbFields.includes(key) && typeof updates[key] === 'string') {
          fields.push(`${key} = $${paramCount}::jsonb`);
        } else {
          fields.push(`${key} = $${paramCount}`);
        }
        values.push(updates[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return null;
    }

    fields.push(`updated_at = NOW()`);
    values.push(doctorId);

    const result = await query(
      `UPDATE doctors 
       SET ${fields.join(', ')}
       WHERE doctor_id = $${paramCount}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Get all doctors
   * @param {number|null} clinicId - Optional clinic filter (for single-clinic mode)
   * @returns {Array} List of doctors
   */
  static async getAll(clinicId = null) {
    let queryStr = `
      SELECT 
        d.*,
        d.fees,
        u.first_name, u.last_name, u.email, u.phone_number,
        u.country, u.state, u.city, u.clinic_id,
        s.speciality_name
      FROM doctors d
      JOIN users u ON d.user_id = u.user_id
      LEFT JOIN speciality s ON d.speciality_id = s.speciality_id
    `;
    
    const params = [];
    if (clinicId) {
      queryStr += ` WHERE u.clinic_id = $1`;
      params.push(clinicId);
    }
    
    queryStr += ` ORDER BY u.last_name, u.first_name`;
    
    const result = await query(queryStr, params);
    return result.rows;
  }

  /**
   * Get doctors by clinic_id
   * @param {number} clinicId
   * @returns {Array} List of doctors in clinic
   */
  static async findByClinicId(clinicId) {
    const result = await query(
      `SELECT 
        d.*,
        u.first_name, u.last_name, u.email, u.phone_number,
        u.country, u.state, u.city
      FROM doctors d
      JOIN users u ON d.user_id = u.user_id
      WHERE u.clinic_id = $1
      ORDER BY u.last_name, u.first_name`,
      [clinicId]
    );
    return result.rows;
  }
}

module.exports = DoctorRepository;

