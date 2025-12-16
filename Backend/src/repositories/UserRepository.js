const { query } = require('../db/connection');
const bcrypt = require('bcryptjs');

class UserRepository {
  /**
   * Check if email already exists
   * @param {string} email
   * @returns {Promise<boolean>}
   */
  static async emailExists(email) {
    const result = await query(
      'SELECT COUNT(*) as count FROM users WHERE email = $1',
      [email]
    );
    return parseInt(result.rows[0].count) > 0;
  }

  /**
   * Find user by email (with role joined)
   * @param {string} email
   * @returns {Promise<Object|null>} User object with role_name
   */
  static async findByEmail(email) {
    const result = await query(
      `SELECT 
        u.user_id,
        u.email,
        u.password_hash,
        u.first_name,
        u.last_name,
        u.phone_number,
        u.country,
        u.state,
        u.city,
        u.role_id,
        u.clinic_id,
        u.is_active,
        u.last_login,
        u.created_at,
        r.role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.role_id
      WHERE u.email = $1`,
      [email]
    );
    return result.rows[0] || null;
  }

  /**
   * Find user by ID (with role joined)
   * @param {number} userId
   * @returns {Promise<Object|null>} User object with role_name
   */
  static async findById(userId) {
    const result = await query(
      `SELECT 
        u.user_id,
        u.email,
        u.password_hash,
        u.first_name,
        u.last_name,
        u.phone_number,
        u.country,
        u.state,
        u.city,
        u.role_id,
        u.clinic_id,
        u.is_active,
        u.last_login,
        u.created_at,
        r.role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.role_id
      WHERE u.user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Verify password against hash
   * @param {string} password - Plain text password
   * @param {string} hash - Bcrypt hash
   * @returns {Promise<boolean>}
   */
  static async verifyPassword(password, hash) {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  /**
   * Update last login timestamp
   * @param {number} userId
   * @returns {Promise<void>}
   */
  static async updateLastLogin(userId) {
    await query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1',
      [userId]
    );
  }

  /**
   * Create a new user
   * @param {Object} userData - User data
   * @returns {Promise<Object>} Created user
   */
  static async create(userData) {
    const {
      email,
      password_hash,
      first_name,
      last_name,
      phone_number,
      country,
      state,
      city,
      role_id,
      clinic_id
    } = userData;

    const result = await query(
      `INSERT INTO users (
        email, password_hash, first_name, last_name, phone_number,
        country, state, city, role_id, clinic_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING user_id, email, first_name, last_name, phone_number,
        country, state, city, role_id, clinic_id, is_active, created_at`,
      [
        email,
        password_hash,
        first_name,
        last_name,
        phone_number || null,
        country || null,
        state || null,
        city || null,
        role_id,
        clinic_id || null
      ]
    );
    return result.rows[0];
  }

  /**
   * Update user
   * @param {number} userId
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} Updated user
   */
  static async update(userId, updates) {
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

    values.push(userId);

    const result = await query(
      `UPDATE users
       SET ${fields.join(', ')}
       WHERE user_id = $${paramCount}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }
}

module.exports = UserRepository;

