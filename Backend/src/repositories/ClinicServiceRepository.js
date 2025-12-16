const { query } = require('../db/connection');

class ClinicServiceRepository {
  /**
   * Get all clinic services (optionally filtered by clinic_id)
   * @param {number|null} clinicId - If provided, filter by clinic_id (null = all clinics)
   * @param {string|null} serviceType - Optional filter by service_type
   * @param {boolean} activeOnly - If true, only return active services
   * @returns {Promise<Array>} List of clinic services
   */
  static async getAll(clinicId = null, serviceType = null, activeOnly = true) {
    let queryStr = `
      SELECT 
        service_id,
        clinic_id,
        service_code,
        service_name,
        service_type,
        category,
        description,
        unit_price,
        unit,
        cpt_code,
        hcpcs_code,
        is_active,
        requires_prescription,
        created_at,
        updated_at
      FROM clinic_services
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (activeOnly) {
      queryStr += ` AND is_active = true`;
    }

    if (clinicId !== null) {
      queryStr += ` AND (clinic_id = $${paramCount} OR clinic_id IS NULL)`;
      params.push(clinicId);
      paramCount++;
    }

    if (serviceType) {
      queryStr += ` AND service_type = $${paramCount}`;
      params.push(serviceType);
      paramCount++;
    }

    queryStr += ` ORDER BY service_type, service_name`;

    const result = await query(queryStr, params);
    return result.rows;
  }

  /**
   * Get service by ID
   * @param {number} serviceId
   * @returns {Promise<Object|null>} Clinic service or null
   */
  static async findById(serviceId) {
    const result = await query(
      `SELECT * FROM clinic_services WHERE service_id = $1`,
      [serviceId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get service by code
   * @param {string} serviceCode
   * @returns {Promise<Object|null>} Clinic service or null
   */
  static async findByCode(serviceCode) {
    const result = await query(
      `SELECT * FROM clinic_services WHERE service_code = $1`,
      [serviceCode]
    );
    return result.rows[0] || null;
  }

  /**
   * Get services by type
   * @param {string} serviceType - 'injection', 'procedure', 'vaccination', 'lab_test', 'imaging', 'medication'
   * @param {number|null} clinicId - Optional clinic filter
   * @returns {Promise<Array>} List of services
   */
  static async findByType(serviceType, clinicId = null) {
    return this.getAll(clinicId, serviceType, true);
  }

  /**
   * Create a new clinic service
   * @param {Object} serviceData
   * @returns {Promise<Object>} Created service
   */
  static async create(serviceData) {
    const {
      clinic_id,
      service_code,
      service_name,
      service_type,
      category,
      description,
      unit_price,
      unit = 'each',
      cpt_code,
      hcpcs_code,
      is_active = true,
      requires_prescription = false
    } = serviceData;

    const result = await query(
      `INSERT INTO clinic_services (
        clinic_id, service_code, service_name, service_type, category,
        description, unit_price, unit, cpt_code, hcpcs_code,
        is_active, requires_prescription
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        clinic_id || null,
        service_code,
        service_name,
        service_type,
        category || null,
        description || null,
        unit_price,
        unit,
        cpt_code || null,
        hcpcs_code || null,
        is_active,
        requires_prescription
      ]
    );
    return result.rows[0];
  }

  /**
   * Update clinic service
   * @param {number} serviceId
   * @param {Object} updates
   * @returns {Promise<Object|null>} Updated service
   */
  static async update(serviceId, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return null;
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(serviceId);

    const result = await query(
      `UPDATE clinic_services 
       SET ${fields.join(', ')}
       WHERE service_id = $${paramCount}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Delete (deactivate) clinic service
   * @param {number} serviceId
   * @returns {Promise<boolean>} Success
   */
  static async delete(serviceId) {
    const result = await query(
      `UPDATE clinic_services 
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE service_id = $1
       RETURNING service_id`,
      [serviceId]
    );
    return result.rows.length > 0;
  }
}

module.exports = ClinicServiceRepository;

