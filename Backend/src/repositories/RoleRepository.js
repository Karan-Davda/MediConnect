const { query } = require('../db/connection');

class RoleRepository {
  /**
   * Find role by name
   * @param {string} roleName - Role name (e.g., 'doctor', 'patient', 'clinic_admin')
   * @returns {Promise<Object|null>} Role object with role_id and role_name
   */
  static async findByName(roleName) {
    const result = await query(
      'SELECT role_id, role_name FROM roles WHERE role_name = $1',
      [roleName]
    );
    return result.rows[0] || null;
  }

  /**
   * Find role by ID
   * @param {number} roleId
   * @returns {Promise<Object|null>} Role object
   */
  static async findById(roleId) {
    const result = await query(
      'SELECT role_id, role_name FROM roles WHERE role_id = $1',
      [roleId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get all roles
   * @returns {Promise<Array>} Array of role objects
   */
  static async getAll() {
    const result = await query(
      'SELECT role_id, role_name FROM roles ORDER BY role_name'
    );
    return result.rows;
  }
}

module.exports = RoleRepository;

