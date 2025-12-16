const { query } = require('../db/connection');
const { getSignedUrlForFile } = require('../services/s3Service');

class ServiceResultRepository {
  /**
   * Create service result
   * @param {Object} resultData
   * @returns {Promise<Object>} Created result
   */
  static async create(resultData) {
    const {
      medical_record_id,
      service_id,
      service_code,
      service_name,
      result_type,
      result_data,
      file_url,
      file_name,
      file_type,
      file_size,
      status = 'pending',
      performed_at,
      reported_at,
      notes,
      created_by
    } = resultData;

    const result = await query(
      `INSERT INTO service_results (
        medical_record_id, service_id, service_code, service_name,
        result_type, result_data, file_url, file_name, file_type, file_size,
        status, performed_at, reported_at, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        medical_record_id,
        service_id || null,
        service_code || null,
        service_name || null,
        result_type,
        result_data ? JSON.stringify(result_data) : null,
        file_url || null,
        file_name || null,
        file_type || null,
        file_size || null,
        status,
        performed_at || new Date(),
        reported_at || new Date(),
        notes || null,
        created_by
      ]
    );

    return result.rows[0];
  }

  /**
   * Get results by medical record ID
   * @param {number} recordId
   * @returns {Promise<Array>} List of results with signed URLs
   */
  static async findByMedicalRecordId(recordId) {
    try {
      const result = await query(
        `SELECT * FROM service_results 
         WHERE medical_record_id = $1 
         ORDER BY performed_at DESC`,
        [recordId]
      );

      // Generate signed URLs for file results
      const results = await Promise.all(
        result.rows.map(async (row) => {
          if (row.file_url && row.file_url.startsWith('s3://')) {
            const key = row.file_url.replace(`s3://${process.env.AWS_S3_BUCKET_NAME || 'mediconnect-medical-files'}/`, '');
            try {
              row.signed_url = await getSignedUrlForFile(key, 3600); // 1 hour expiry
            } catch (error) {
              console.error(`Error generating signed URL for ${key}:`, error);
              row.signed_url = null;
            }
          }
          if (row.result_data && typeof row.result_data === 'string') {
            try {
              row.result_data = JSON.parse(row.result_data);
            } catch (e) {
              // Keep as string if not valid JSON
            }
          }
          return row;
        })
      );

      return results;
    } catch (error) {
      // If table doesn't exist, return empty array instead of throwing
      if (error.code === '42P01' && error.message.includes('service_results')) {
        return [];
      }
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Find result by ID
   * @param {number} resultId
   * @returns {Promise<Object|null>} Result with signed URL
   */
  static async findById(resultId) {
    const result = await query(
      `SELECT * FROM service_results WHERE result_id = $1`,
      [resultId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    // Generate signed URL if file exists
    if (row.file_url && row.file_url.startsWith('s3://')) {
      const key = row.file_url.replace(`s3://${process.env.AWS_S3_BUCKET_NAME || 'mediconnect-medical-files'}/`, '');
      try {
        row.signed_url = await getSignedUrlForFile(key, 3600);
      } catch (error) {
        console.error(`Error generating signed URL:`, error);
        row.signed_url = null;
      }
    }

    if (row.result_data && typeof row.result_data === 'string') {
      try {
        row.result_data = JSON.parse(row.result_data);
      } catch (e) {
        // Keep as string
      }
    }

    return row;
  }

  /**
   * Update service result
   * @param {number} resultId
   * @param {Object} updates
   * @returns {Promise<Object|null>} Updated result
   */
  static async update(resultId, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined && key !== 'result_id') {
        if (key === 'result_data' && typeof updates[key] === 'object') {
          fields.push(`${key} = $${paramCount}::jsonb`);
          values.push(JSON.stringify(updates[key]));
        } else {
          fields.push(`${key} = $${paramCount}`);
          values.push(updates[key]);
        }
        paramCount++;
      }
    });

    if (fields.length === 0) return null;

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(resultId);

    const result = await query(
      `UPDATE service_results 
       SET ${fields.join(', ')}
       WHERE result_id = $${paramCount}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Delete service result
   * @param {number} resultId
   * @returns {Promise<boolean>}
   */
  static async delete(resultId) {
    // Get result to delete file from S3 if needed
    const result = await this.findById(resultId);
    if (result && result.file_url && result.file_url.startsWith('s3://')) {
      const { deleteFromS3 } = require('../services/s3Service');
      const key = result.file_url.replace(`s3://${process.env.AWS_S3_BUCKET_NAME || 'mediconnect-medical-files'}/`, '');
      await deleteFromS3(key);
    }

    const deleteResult = await query(
      `DELETE FROM service_results WHERE result_id = $1 RETURNING result_id`,
      [resultId]
    );

    return deleteResult.rows.length > 0;
  }
}

module.exports = ServiceResultRepository;

