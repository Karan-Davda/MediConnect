const { query } = require('../db/connection');

class InvoiceRepository {
  /**
   * Generate unique invoice number
   * Format: INV-YYYY-MMDD-XXXX
   */
  static async generateInvoiceNumber() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const prefix = `INV-${year}-${month}${day}`;

    // Get the last invoice number for today
    const result = await query(
      `SELECT invoice_number FROM invoices 
       WHERE invoice_number LIKE $1 
       ORDER BY invoice_number DESC 
       LIMIT 1`,
      [`${prefix}-%`]
    );

    let sequence = 1;
    if (result.rows.length > 0) {
      const lastNumber = result.rows[0].invoice_number;
      const lastSeq = parseInt(lastNumber.split('-').pop());
      sequence = lastSeq + 1;
    }

    return `${prefix}-${String(sequence).padStart(4, '0')}`;
  }

  /**
   * Create a new invoice
   * @param {Object} invoiceData
   * @returns {Promise<Object>} Created invoice
   */
  static async create(invoiceData) {
    const {
      patient_id,
      appointment_id,
      medical_record_id,
      doctor_id,
      clinic_id,
      service_date,
      due_date, // Allow custom due date
      line_items,
      subtotal,
      tax = 0,
      discount = 0,
      total_amount,
      insurance_id = null,
      insurance_coverage_percent = 0,
      notes = null,
      created_by
    } = invoiceData;

    // Generate invoice number
    const invoice_number = await this.generateInvoiceNumber();

    // Calculate insurance and patient responsibility
    const insurance_paid = total_amount * (insurance_coverage_percent / 100);
    const patient_responsibility = total_amount - insurance_paid;
    const balance_due = patient_responsibility; // Initially, no payments made

    // Determine status
    let status = 'DUE';
    if (insurance_coverage_percent > 0 && insurance_paid > 0) {
      status = 'PENDING_INSURANCE';
    }

    // Calculate due date: use provided due_date, or default to service_date + 30 days
    let calculatedDueDate = due_date;
    if (!calculatedDueDate) {
      const serviceDate = service_date || new Date();
      calculatedDueDate = new Date(serviceDate);
      calculatedDueDate.setDate(calculatedDueDate.getDate() + 30);
    }

    const result = await query(
      `INSERT INTO invoices (
        invoice_number, patient_id, appointment_id, medical_record_id,
        doctor_id, clinic_id, invoice_date, service_date, due_date,
        line_items, subtotal, tax, discount, total_amount,
        insurance_id, insurance_coverage_percent, insurance_paid,
        patient_responsibility, status, paid_amount, balance_due,
        notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, $7, $8, 
                $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 0, $19, $20, $21)
      RETURNING *`,
      [
        invoice_number,
        patient_id,
        appointment_id || null,
        medical_record_id || null,
        doctor_id,
        clinic_id || null,
        service_date || new Date(),
        calculatedDueDate,
        JSON.stringify(line_items),
        subtotal,
        tax,
        discount,
        total_amount,
        insurance_id,
        insurance_coverage_percent,
        insurance_paid,
        patient_responsibility,
        status,
        balance_due,
        notes,
        created_by
      ]
    );

    return result.rows[0];
  }

  /**
   * Find invoice by ID
   * @param {number} invoiceId
   * @returns {Promise<Object|null>} Invoice with related data
   */
  static async findById(invoiceId) {
    const result = await query(
      `SELECT 
        i.*,
        p.patient_id,
        pu.first_name || ' ' || pu.last_name AS patient_name,
        pu.email AS patient_email,
        d.doctor_id,
        du.first_name || ' ' || du.last_name AS doctor_name,
        c.name AS clinic_name,
        ins.insurance_provider,
        ins.coverage_percentage AS insurance_coverage
      FROM invoices i
      JOIN patients p ON i.patient_id = p.patient_id
      JOIN users pu ON p.user_id = pu.user_id
      JOIN doctors d ON i.doctor_id = d.doctor_id
      JOIN users du ON d.user_id = du.user_id
      LEFT JOIN clinics c ON i.clinic_id = c.clinic_id
      LEFT JOIN insurance ins ON i.insurance_id = ins.insurance_id
      WHERE i.invoice_id = $1`,
      [invoiceId]
    );
    return result.rows[0] || null;
  }

  /**
   * Find invoices by patient ID
   * @param {number} patientId
   * @param {Object} filters - { status, startDate, endDate }
   * @returns {Promise<Array>} List of invoices
   */
  static async findByPatientId(patientId, filters = {}) {
    let queryStr = `
      SELECT 
        i.*,
        p.patient_id,
        pu.first_name || ' ' || pu.last_name AS patient_name,
        d.doctor_id,
        du.first_name || ' ' || du.last_name AS doctor_name,
        c.name AS clinic_name,
        ins.insurance_provider
      FROM invoices i
      JOIN patients p ON i.patient_id = p.patient_id
      JOIN users pu ON p.user_id = pu.user_id
      JOIN doctors d ON i.doctor_id = d.doctor_id
      JOIN users du ON d.user_id = du.user_id
      LEFT JOIN clinics c ON i.clinic_id = c.clinic_id
      LEFT JOIN insurance ins ON i.insurance_id = ins.insurance_id
      WHERE i.patient_id = $1
    `;
    const params = [patientId];
    let paramCount = 2;

    if (filters.status) {
      queryStr += ` AND i.status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }

    if (filters.startDate) {
      queryStr += ` AND i.service_date >= $${paramCount}`;
      params.push(filters.startDate);
      paramCount++;
    }

    if (filters.endDate) {
      queryStr += ` AND i.service_date <= $${paramCount}`;
      params.push(filters.endDate);
      paramCount++;
    }

    queryStr += ` ORDER BY i.service_date DESC, i.invoice_date DESC`;

    const result = await query(queryStr, params);
    return result.rows;
  }

  /**
   * Find invoices by doctor ID
   * @param {number} doctorId
   * @param {Object} filters
   * @returns {Promise<Array>} List of invoices
   */
  static async findByDoctorId(doctorId, filters = {}) {
    let queryStr = `
      SELECT 
        i.*,
        p.patient_id,
        pu.first_name || ' ' || pu.last_name AS patient_name
      FROM invoices i
      JOIN patients p ON i.patient_id = p.patient_id
      JOIN users pu ON p.user_id = pu.user_id
      WHERE i.doctor_id = $1
    `;
    const params = [doctorId];
    let paramCount = 2;

    if (filters.status) {
      queryStr += ` AND i.status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }

    queryStr += ` ORDER BY i.service_date DESC`;

    const result = await query(queryStr, params);
    return result.rows;
  }

  /**
   * Update invoice status and payment amounts
   * @param {number} invoiceId
   * @param {Object} updates
   * @returns {Promise<Object|null>} Updated invoice
   */
  static async update(invoiceId, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined && key !== 'invoice_id') {
        if (key === 'line_items' && typeof updates[key] === 'object') {
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

    // Recalculate balance_due if paid_amount changed
    if (updates.paid_amount !== undefined) {
      fields.push(`balance_due = patient_responsibility - $${paramCount}`);
      values.push(updates.paid_amount);
      paramCount++;

      // Update status based on payment
      const invoice = await this.findById(invoiceId);
      if (invoice) {
        const newBalance = invoice.patient_responsibility - updates.paid_amount;
        if (newBalance <= 0) {
          fields.push(`status = 'PAID'`);
        } else if (updates.paid_amount > 0) {
          fields.push(`status = 'PARTIAL'`);
        }
      }
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(invoiceId);

    const result = await query(
      `UPDATE invoices 
       SET ${fields.join(', ')}
       WHERE invoice_id = $${paramCount}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Record a payment
   * @param {Object} paymentData
   * @returns {Promise<Object>} Created payment
   */
  static async recordPayment(paymentData) {
    const {
      invoice_id,
      amount,
      payment_method,
      payment_reference = null,
      status = 'SUCCESS',
      receipt_id = null,
      gateway_transaction_id = null,
      last4 = null
    } = paymentData;

    // Create payment record
    const paymentResult = await query(
      `INSERT INTO invoice_payments (
        invoice_id, amount, payment_method, payment_reference,
        status, receipt_id, gateway_transaction_id, last4
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        invoice_id,
        amount,
        payment_method,
        payment_reference,
        status,
        receipt_id,
        gateway_transaction_id,
        last4
      ]
    );

    // Update invoice paid_amount
    const invoice = await this.findById(invoice_id);
    if (invoice) {
      const newPaidAmount = parseFloat(invoice.paid_amount || 0) + parseFloat(amount);
      await this.update(invoice_id, { paid_amount: newPaidAmount });
    }

    return paymentResult.rows[0];
  }

  /**
   * Get payments for an invoice
   * @param {number} invoiceId
   * @returns {Promise<Array>} List of payments
   */
  static async getPayments(invoiceId) {
    const result = await query(
      `SELECT * FROM invoice_payments 
       WHERE invoice_id = $1 
       ORDER BY payment_date DESC`,
      [invoiceId]
    );
    return result.rows;
  }
}

module.exports = InvoiceRepository;

