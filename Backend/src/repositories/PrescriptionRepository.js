const { Prescription, Pharmacy } = require('../models/Prescription');
const { query } = require('../db/connection');

class PrescriptionRepository {
  // ==================== PRESCRIPTION CRUD OPERATIONS ====================

  /**
   * Create a new prescription
   * @param {Object} prescriptionData
   * @returns {Promise<Prescription>}
   */
  static async createPrescription(prescriptionData) {
    const {
      patientId,
      patientName,
      medicalRecordId,
      providerId,
      providerName,
      clinicId,
      medicationName,
      medicationCode,
      dosage,
      dosageUnit = 'mg',
      form = 'tablet',
      frequency,
      route = 'oral',
      duration,
      quantity,
      refills = 0,
      startDate,
      endDate,
      instructions,
      indication,
      pharmacyId,
      notes,
      priority = 'routine',
      substitutionAllowed = true,
      daw = false,
      createdBy
    } = prescriptionData;

    // Extract patient_id number
    let patientIdNum = patientId;
    if (typeof patientIdNum === 'string' && patientIdNum.startsWith('patient_')) {
      patientIdNum = parseInt(patientIdNum.replace('patient_', ''));
    }

    // Extract medical_record_id number
    let medicalRecordIdNum = medicalRecordId;
    if (medicalRecordIdNum) {
      if (typeof medicalRecordIdNum === 'string' && medicalRecordIdNum.startsWith('record_')) {
        medicalRecordIdNum = parseInt(medicalRecordIdNum.replace('record_', ''));
      }
    }

    // Extract provider_id number
    let providerIdNum = providerId;
    if (typeof providerIdNum === 'string' && providerIdNum.startsWith('doctor_')) {
      providerIdNum = parseInt(providerIdNum.replace('doctor_', ''));
    } else if (typeof providerIdNum === 'string') {
      providerIdNum = parseInt(providerIdNum);
    }

    const result = await query(
      `INSERT INTO prescriptions (
        patient_id, patient_name, medical_record_id, provider_id, provider_name, clinic_id,
        medication_name, medication_code, dosage, dosage_unit, form, frequency, route, duration,
        quantity, refills, start_date, end_date, instructions, indication,
        pharmacy_id, notes, priority, substitution_allowed, daw, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
      RETURNING *`,
      [
        patientIdNum,
        patientName || null,
        medicalRecordIdNum || null,
        providerIdNum,
        providerName || null,
        clinicId || null,
        medicationName,
        medicationCode || null,
        dosage,
        dosageUnit,
        form,
        frequency,
        route,
        duration,
        quantity,
        refills,
        startDate || null,
        endDate || null,
        instructions || null,
        indication || null,
        pharmacyId || null,
        notes || null,
        priority,
        substitutionAllowed,
        daw,
        createdBy || null
      ]
    );

    return this.mapRowToPrescription(result.rows[0]);
  }

  /**
   * Get all prescriptions with optional filters
   * @param {Object} filters
   * @returns {Promise<Array<Prescription>>}
   */
  static async getAllPrescriptions(filters = {}) {
    let queryStr = `
      SELECT 
        p.*,
        ph.name AS pharmacy_name,
        ph.phone_number AS pharmacy_phone,
        ph.address AS pharmacy_address,
        ph.city AS pharmacy_city,
        ph.state AS pharmacy_state
      FROM prescriptions p
      LEFT JOIN pharmacies ph ON p.pharmacy_id = ph.pharmacy_id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (filters.patientId) {
      let patientIdNum = filters.patientId;
      if (typeof patientIdNum === 'string' && patientIdNum.startsWith('patient_')) {
        patientIdNum = parseInt(patientIdNum.replace('patient_', ''));
      }
      queryStr += ` AND p.patient_id = $${paramCount}`;
      params.push(patientIdNum);
      paramCount++;
    }

    if (filters.providerId) {
      let providerIdNum = filters.providerId;
      if (typeof providerIdNum === 'string' && providerIdNum.startsWith('doctor_')) {
        providerIdNum = parseInt(providerIdNum.replace('doctor_', ''));
      }
      queryStr += ` AND p.provider_id = $${paramCount}`;
      params.push(providerIdNum);
      paramCount++;
    }

    if (filters.clinicId) {
      queryStr += ` AND p.clinic_id = $${paramCount}`;
      params.push(filters.clinicId);
      paramCount++;
    }

    if (filters.status) {
      // Handle array of statuses (for patient filtering: sent or filled)
      if (Array.isArray(filters.status)) {
        const placeholders = filters.status.map((_, idx) => `$${paramCount + idx}`).join(', ');
        queryStr += ` AND p.status IN (${placeholders})`;
        params.push(...filters.status);
        paramCount += filters.status.length;
      } else {
        queryStr += ` AND p.status = $${paramCount}`;
        params.push(filters.status);
        paramCount++;
      }
    }

    if (filters.startDate) {
      queryStr += ` AND p.created_at >= $${paramCount}`;
      params.push(filters.startDate);
      paramCount++;
    }

    if (filters.endDate) {
      queryStr += ` AND p.created_at <= $${paramCount}`;
      params.push(filters.endDate);
      paramCount++;
    }

    if (filters.search) {
      queryStr += ` AND (p.medication_name ILIKE $${paramCount} OR p.indication ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
      paramCount++;
    }

    queryStr += ` ORDER BY p.created_at DESC`;

    const result = await query(queryStr, params);
    return result.rows.map(row => this.mapRowToPrescription(row));
  }

  /**
   * Get prescription by ID
   * @param {string|number} id
   * @returns {Promise<Prescription|null>}
   */
  static async getPrescriptionById(id) {
    let prescriptionIdNum = id;
    if (typeof prescriptionIdNum === 'string' && prescriptionIdNum.startsWith('prescription_')) {
      prescriptionIdNum = parseInt(prescriptionIdNum.replace('prescription_', ''));
    }

    const result = await query(
      `SELECT 
        p.*,
        ph.name AS pharmacy_name,
        ph.phone_number AS pharmacy_phone,
        ph.address AS pharmacy_address,
        ph.city AS pharmacy_city,
        ph.state AS pharmacy_state
      FROM prescriptions p
      LEFT JOIN pharmacies ph ON p.pharmacy_id = ph.pharmacy_id
      WHERE p.prescription_id = $1`,
      [prescriptionIdNum]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToPrescription(result.rows[0]);
  }

  /**
   * Get prescriptions by patient ID
   * @param {string|number} patientId
   * @returns {Promise<Array<Prescription>>}
   */
  static async getPrescriptionsByPatient(patientId) {
    let patientIdNum = patientId;
    if (typeof patientIdNum === 'string' && patientIdNum.startsWith('patient_')) {
      patientIdNum = parseInt(patientIdNum.replace('patient_', ''));
    }

    const result = await query(
      `SELECT 
        p.*,
        ph.name AS pharmacy_name
      FROM prescriptions p
      LEFT JOIN pharmacies ph ON p.pharmacy_id = ph.pharmacy_id
      WHERE p.patient_id = $1
      ORDER BY p.created_at DESC`,
      [patientIdNum]
    );

    return result.rows.map(row => this.mapRowToPrescription(row));
  }

  /**
   * Get prescriptions by medical record ID
   * @param {string|number} medicalRecordId
   * @returns {Promise<Array<Prescription>>}
   */
  static async getPrescriptionsByMedicalRecord(medicalRecordId) {
    let recordIdNum = medicalRecordId;
    if (typeof recordIdNum === 'string' && recordIdNum.startsWith('record_')) {
      recordIdNum = parseInt(recordIdNum.replace('record_', ''));
    }

    const result = await query(
      `SELECT 
        p.*,
        ph.name AS pharmacy_name
      FROM prescriptions p
      LEFT JOIN pharmacies ph ON p.pharmacy_id = ph.pharmacy_id
      WHERE p.medical_record_id = $1
      ORDER BY p.created_at DESC`,
      [recordIdNum]
    );

    return result.rows.map(row => this.mapRowToPrescription(row));
  }

  /**
   * Update prescription
   * @param {string|number} id
   * @param {Object} updates
   * @returns {Promise<Prescription|null>}
   */
  static async updatePrescription(id, updates) {
    let prescriptionIdNum = id;
    if (typeof prescriptionIdNum === 'string' && prescriptionIdNum.startsWith('prescription_')) {
      prescriptionIdNum = parseInt(prescriptionIdNum.replace('prescription_', ''));
    }

    // Map camelCase keys to snake_case database column names
    const columnMap = {
      patientId: 'patient_id',
      patientName: 'patient_name',
      medicalRecordId: 'medical_record_id',
      providerId: 'provider_id',
      providerName: 'provider_name',
      clinicId: 'clinic_id',
      medicationName: 'medication_name',
      medicationCode: 'medication_code',
      dosage: 'dosage',
      dosageUnit: 'dosage_unit',
      form: 'form',
      frequency: 'frequency',
      route: 'route',
      duration: 'duration',
      quantity: 'quantity',
      refills: 'refills',
      startDate: 'start_date',
      endDate: 'end_date',
      instructions: 'instructions',
      indication: 'indication',
      status: 'status',
      pharmacyId: 'pharmacy_id',
      pharmacyName: 'pharmacy_name',
      pharmacy_name: 'pharmacy_name', // Handle both camelCase and snake_case
      sentToPharmacyDate: 'sent_to_pharmacy_date',
      filledDate: 'filled_date',
      notes: 'notes',
      priority: 'priority',
      substitutionAllowed: 'substitution_allowed',
      daw: 'daw',
      updatedBy: 'updated_by',
      createdBy: 'created_by'
    };

    // Helper function to extract numeric ID from formatted ID strings
    const extractNumericId = (value, prefix) => {
      if (value === null || value === undefined) return value;
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        if (value.startsWith(prefix)) {
          const num = parseInt(value.replace(prefix, ''));
          return isNaN(num) ? value : num;
        }
        // Try to parse as integer if it's a numeric string
        const num = parseInt(value);
        return isNaN(num) ? value : num;
      }
      return value;
    };

    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined && key !== 'id' && key !== 'prescription_id') {
        // Convert camelCase to snake_case for database column names
        const dbColumn = columnMap[key] || key;
        
        // Extract numeric ID for ID fields that might come in formatted format
        let value = updates[key];
        if (key === 'patientId' || dbColumn === 'patient_id') {
          value = extractNumericId(value, 'patient_');
        } else if (key === 'providerId' || dbColumn === 'provider_id') {
          value = extractNumericId(value, 'doctor_');
        } else if (key === 'medicalRecordId' || dbColumn === 'medical_record_id') {
          value = extractNumericId(value, 'record_');
        } else if (key === 'pharmacyId' || dbColumn === 'pharmacy_id') {
          value = extractNumericId(value, 'pharmacy_');
        } else if (key === 'clinicId' || dbColumn === 'clinic_id') {
          value = extractNumericId(value, 'clinic_');
        } else if (key === 'quantity' || dbColumn === 'quantity') {
          // Ensure quantity is an integer
          value = typeof value === 'string' ? parseInt(value) || 0 : (value || 0);
        } else if (key === 'refills' || dbColumn === 'refills') {
          // Ensure refills is an integer
          value = typeof value === 'string' ? parseInt(value) || 0 : (value || 0);
        } else if (key === 'startDate' || dbColumn === 'start_date') {
          // Convert date string to Date object if needed
          value = value ? new Date(value) : null;
        } else if (key === 'endDate' || dbColumn === 'end_date') {
          // Convert date string to Date object if needed
          value = value ? new Date(value) : null;
        } else if (key === 'substitutionAllowed' || dbColumn === 'substitution_allowed') {
          // Ensure boolean
          value = value === true || value === 'true' || value === 1 || value === '1';
        } else if (key === 'daw' || dbColumn === 'daw') {
          // Ensure boolean
          value = value === true || value === 'true' || value === 1 || value === '1';
        }
        
        fields.push(`${dbColumn} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return null;
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(prescriptionIdNum);

    const result = await query(
      `UPDATE prescriptions 
       SET ${fields.join(', ')}
       WHERE prescription_id = $${paramCount}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToPrescription(result.rows[0]);
  }

  /**
   * Update prescription status
   * @param {string|number} id
   * @param {string} status
   * @param {number} updatedBy
   * @returns {Promise<Prescription|null>}
   */
  static async updatePrescriptionStatus(id, status, updatedBy) {
    const updates = {
      status,
      updated_by: updatedBy
    };

    if (status === 'sent') {
      updates.sent_to_pharmacy_date = new Date();
    } else if (status === 'filled') {
      updates.filled_date = new Date();
    }

    return this.updatePrescription(id, updates);
  }

  /**
   * Send prescription to pharmacy
   * @param {string|number} id
   * @param {string|number} pharmacyId
   * @param {number} updatedBy
   * @returns {Promise<Prescription|null>}
   */
  static async sendToPharmacy(id, pharmacyId, updatedBy) {
    let pharmacyIdNum = pharmacyId;
    if (typeof pharmacyIdNum === 'string' && pharmacyIdNum.startsWith('pharmacy_')) {
      pharmacyIdNum = parseInt(pharmacyIdNum.replace('pharmacy_', ''));
    }

    const pharmacy = await this.getPharmacyById(pharmacyId);
    if (!pharmacy) {
      throw new Error('Pharmacy not found');
    }

    return this.updatePrescription(id, {
      pharmacy_id: pharmacyIdNum,
      pharmacy_name: pharmacy.name,
      status: 'sent',
      sent_to_pharmacy_date: new Date(),
      updated_by: updatedBy
    });
  }

  /**
   * Cancel prescription
   * @param {string|number} id
   * @param {number} updatedBy
   * @returns {Promise<Prescription|null>}
   */
  static async cancelPrescription(id, updatedBy) {
    return this.updatePrescriptionStatus(id, 'cancelled', updatedBy);
  }

  /**
   * Delete prescription (soft delete)
   * @param {string|number} id
   * @returns {Promise<boolean>}
   */
  static async deletePrescription(id) {
    let prescriptionIdNum = id;
    if (typeof prescriptionIdNum === 'string' && prescriptionIdNum.startsWith('prescription_')) {
      prescriptionIdNum = parseInt(prescriptionIdNum.replace('prescription_', ''));
    }

    const result = await query(
      `UPDATE prescriptions 
       SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE prescription_id = $1
       RETURNING prescription_id`,
      [prescriptionIdNum]
    );

    return result.rows.length > 0;
  }

  // ==================== PHARMACY CRUD OPERATIONS ====================

  /**
   * Create a new pharmacy
   * @param {Object} pharmacyData
   * @returns {Promise<Pharmacy>}
   */
  static async createPharmacy(pharmacyData) {
    const {
      name,
      ncpdpId,
      npi,
      address,
      city,
      state,
      zipCode,
      phoneNumber,
      faxNumber,
      email,
      isActive = true,
      deliveryAvailable = false,
      hours,
      preferredByClinic = false
    } = pharmacyData;

    const result = await query(
      `INSERT INTO pharmacies (
        name, ncpdp_id, npi, address, city, state, zip_code,
        phone_number, fax_number, email, is_active, delivery_available,
        hours, preferred_by_clinic
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        name,
        ncpdpId || null,
        npi || null,
        address || null,
        city || null,
        state || null,
        zipCode || null,
        phoneNumber || null,
        faxNumber || null,
        email || null,
        isActive,
        deliveryAvailable,
        hours || null,
        preferredByClinic
      ]
    );

    return this.mapRowToPharmacy(result.rows[0]);
  }

  /**
   * Get all pharmacies
   * @param {Object} filters
   * @returns {Promise<Array<Pharmacy>>}
   */
  static async getAllPharmacies(filters = {}) {
    let queryStr = `SELECT * FROM pharmacies WHERE 1=1`;
    const params = [];
    let paramCount = 1;

    if (filters.isActive !== undefined) {
      queryStr += ` AND is_active = $${paramCount}`;
      params.push(filters.isActive);
      paramCount++;
    }

    if (filters.deliveryAvailable !== undefined) {
      queryStr += ` AND delivery_available = $${paramCount}`;
      params.push(filters.deliveryAvailable);
      paramCount++;
    }

    if (filters.preferredByClinic !== undefined) {
      queryStr += ` AND preferred_by_clinic = $${paramCount}`;
      params.push(filters.preferredByClinic);
      paramCount++;
    }

    if (filters.search) {
      queryStr += ` AND (name ILIKE $${paramCount} OR city ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
      paramCount++;
    }

    queryStr += ` ORDER BY name`;

    const result = await query(queryStr, params);
    return result.rows.map(row => this.mapRowToPharmacy(row));
  }

  /**
   * Get pharmacy by ID
   * @param {string|number} id
   * @returns {Promise<Pharmacy|null>}
   */
  static async getPharmacyById(id) {
    let pharmacyIdNum = id;
    if (typeof pharmacyIdNum === 'string' && pharmacyIdNum.startsWith('pharmacy_')) {
      pharmacyIdNum = parseInt(pharmacyIdNum.replace('pharmacy_', ''));
    }

    const result = await query(
      `SELECT * FROM pharmacies WHERE pharmacy_id = $1`,
      [pharmacyIdNum]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToPharmacy(result.rows[0]);
  }

  /**
   * Update pharmacy
   * @param {string|number} id
   * @param {Object} updates
   * @returns {Promise<Pharmacy|null>}
   */
  static async updatePharmacy(id, updates) {
    let pharmacyIdNum = id;
    if (typeof pharmacyIdNum === 'string' && pharmacyIdNum.startsWith('pharmacy_')) {
      pharmacyIdNum = parseInt(pharmacyIdNum.replace('pharmacy_', ''));
    }

    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined && key !== 'id' && key !== 'pharmacy_id') {
        fields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return null;
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(pharmacyIdNum);

    const result = await query(
      `UPDATE pharmacies 
       SET ${fields.join(', ')}
       WHERE pharmacy_id = $${paramCount}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToPharmacy(result.rows[0]);
  }

  /**
   * Delete pharmacy
   * @param {string|number} id
   * @returns {Promise<boolean>}
   */
  static async deletePharmacy(id) {
    let pharmacyIdNum = id;
    if (typeof pharmacyIdNum === 'string' && pharmacyIdNum.startsWith('pharmacy_')) {
      pharmacyIdNum = parseInt(pharmacyIdNum.replace('pharmacy_', ''));
    }

    const result = await query(
      `UPDATE pharmacies 
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE pharmacy_id = $1
       RETURNING pharmacy_id`,
      [pharmacyIdNum]
    );

    return result.rows.length > 0;
  }

  // ==================== STATISTICS ====================

  /**
   * Get prescription statistics for a patient
   * @param {string|number} patientId
   * @returns {Promise<Object>}
   */
  static async getPatientPrescriptionStats(patientId) {
    let patientIdNum = patientId;
    if (typeof patientIdNum === 'string' && patientIdNum.startsWith('patient_')) {
      patientIdNum = parseInt(patientIdNum.replace('patient_', ''));
    }

    const result = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status IN ('pending', 'sent')) as active,
        COUNT(*) FILTER (WHERE status = 'filled') as filled,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
      FROM prescriptions
      WHERE patient_id = $1`,
      [patientIdNum]
    );

    return {
      total: parseInt(result.rows[0].total),
      active: parseInt(result.rows[0].active),
      filled: parseInt(result.rows[0].filled),
      cancelled: parseInt(result.rows[0].cancelled)
    };
  }

  /**
   * Get prescription statistics for a provider
   * @param {string|number} providerId
   * @returns {Promise<Object>}
   */
  static async getProviderPrescriptionStats(providerId) {
    let providerIdNum = providerId;
    if (typeof providerIdNum === 'string' && providerIdNum.startsWith('doctor_')) {
      providerIdNum = parseInt(providerIdNum.replace('doctor_', ''));
    }

    const result = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'sent') as sent,
        COUNT(*) FILTER (WHERE status = 'filled') as filled
      FROM prescriptions
      WHERE provider_id = $1`,
      [providerIdNum]
    );

    return {
      total: parseInt(result.rows[0].total),
      pending: parseInt(result.rows[0].pending),
      sent: parseInt(result.rows[0].sent),
      filled: parseInt(result.rows[0].filled)
    };
  }

  // ==================== HELPER METHODS ====================

  /**
   * Map database row to Prescription model
   * @param {Object} row
   * @returns {Prescription}
   */
  static mapRowToPrescription(row) {
    return new Prescription({
      id: `prescription_${row.prescription_id}`,
      patientId: `patient_${row.patient_id}`,
      patientName: row.patient_name,
      medicalRecordId: row.medical_record_id ? `record_${row.medical_record_id}` : null,
      providerId: `doctor_${row.provider_id}`,
      providerName: row.provider_name,
      clinicId: row.clinic_id,
      medicationName: row.medication_name,
      medicationCode: row.medication_code,
      dosage: row.dosage,
      dosageUnit: row.dosage_unit,
      form: row.form,
      frequency: row.frequency,
      route: row.route,
      duration: row.duration,
      quantity: row.quantity,
      refills: row.refills,
      startDate: row.start_date,
      endDate: row.end_date,
      instructions: row.instructions,
      indication: row.indication,
      status: row.status,
      pharmacyId: row.pharmacy_id ? `pharmacy_${row.pharmacy_id}` : null,
      pharmacyName: row.pharmacy_name,
      sentToPharmacyDate: row.sent_to_pharmacy_date,
      filledDate: row.filled_date,
      notes: row.notes,
      priority: row.priority,
      substitutionAllowed: row.substitution_allowed,
      daw: row.daw,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      updatedBy: row.updated_by
    });
  }

  /**
   * Map database row to Pharmacy model
   * @param {Object} row
   * @returns {Pharmacy}
   */
  static mapRowToPharmacy(row) {
    return new Pharmacy({
      id: `pharmacy_${row.pharmacy_id}`,
      name: row.name,
      ncpdpId: row.ncpdp_id,
      npi: row.npi,
      address: row.address,
      city: row.city,
      state: row.state,
      zipCode: row.zip_code,
      phoneNumber: row.phone_number,
      faxNumber: row.fax_number,
      email: row.email,
      isActive: row.is_active,
      deliveryAvailable: row.delivery_available,
      hours: row.hours,
      preferredByClinic: row.preferred_by_clinic,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }
}

module.exports = PrescriptionRepository;
