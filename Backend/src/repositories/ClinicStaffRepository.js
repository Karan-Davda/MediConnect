const { query } = require('../db/connection');

class ClinicStaffRepository {
  /**
   * Find clinic staff by user_id
   * @param {number} userId
   * @returns {Promise<Object|null>} Clinic staff object
   */
  static async findByUserId(userId) {
    const result = await query(
      `SELECT 
        cs.staff_id,
        cs.user_id,
        cs.position,
        cs.address,
        cs.created_at,
        cs.updated_at,
        u.email,
        u.first_name,
        u.last_name,
        u.clinic_id
      FROM clinic_staff cs
      JOIN users u ON cs.user_id = u.user_id
      WHERE cs.user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Find clinic staff by staff_id
   * @param {number} staffId
   * @returns {Promise<Object|null>} Clinic staff object
   */
  static async findById(staffId) {
    const result = await query(
      `SELECT 
        cs.staff_id,
        cs.user_id,
        cs.position,
        cs.address,
        cs.created_at,
        cs.updated_at,
        u.email,
        u.first_name,
        u.last_name,
        u.clinic_id
      FROM clinic_staff cs
      JOIN users u ON cs.user_id = u.user_id
      WHERE cs.staff_id = $1`,
      [staffId]
    );
    return result.rows[0] || null;
  }

  /**
   * Create a new clinic staff record
   * @param {Object} staffData - Staff data
   * @returns {Promise<Object>} Created staff record
   */
  static async create(staffData) {
    const {
      user_id,
      position,
      address
    } = staffData;

    const result = await query(
      `INSERT INTO clinic_staff (user_id, position, address)
       VALUES ($1, $2, $3)
       RETURNING staff_id, user_id, position, address, created_at`,
      [
        user_id,
        position || null,
        address || null
      ]
    );
    return result.rows[0];
  }

  /**
   * Update clinic staff
   * @param {number} staffId
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} Updated staff record
   */
  static async update(staffId, updates) {
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
    values.push(staffId);

    const result = await query(
      `UPDATE clinic_staff
       SET ${fields.join(', ')}
       WHERE staff_id = $${paramCount}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Get all staff for a clinic
   * @param {number} clinicId
   * @returns {Promise<Array>} Array of staff objects
   */
  static async getByClinicId(clinicId) {
    const result = await query(
      `SELECT 
        cs.staff_id,
        cs.user_id,
        cs.position,
        cs.address,
        cs.created_at,
        cs.updated_at,
        u.email,
        u.first_name,
        u.last_name,
        u.clinic_id
      FROM clinic_staff cs
      JOIN users u ON cs.user_id = u.user_id
      WHERE u.clinic_id = $1
      ORDER BY u.last_name, u.first_name`,
      [clinicId]
    );
    return result.rows;
  }
}

module.exports = ClinicStaffRepository;

