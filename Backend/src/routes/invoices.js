const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const InvoiceRepository = require('../repositories/InvoiceRepository');
const PatientRepository = require('../repositories/PatientRepository');
const { logAccess, AUDIT_ACTIONS } = require('../middleware/auditLogger');

const router = express.Router();

/**
 * Get invoices for current user
 * GET /api/invoices
 * Query params: status, startDate, endDate
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    let invoices = [];

    if (req.user.role === 'patient') {
      // Get patient_id from user_id
      const patient = await PatientRepository.findByUserId(userId);
      if (!patient) {
        return res.status(404).json({ error: 'Patient profile not found' });
      }

      invoices = await InvoiceRepository.findByPatientId(patient.patient_id, {
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate
      });
    } else if (req.user.role === 'doctor') {
      // Get doctor_id from user_id
      const DoctorRepository = require('../repositories/DoctorRepository');
      const doctor = await DoctorRepository.findByUserId(userId);
      if (!doctor) {
        return res.status(404).json({ error: 'Doctor profile not found' });
      }

      invoices = await InvoiceRepository.findByDoctorId(doctor.doctor_id, {
        status: req.query.status
      });
    } else if (req.user.role === 'clinic_admin' || req.user.role === 'clinic_staff') {
      // Admins can see all invoices (for now, filter by clinic_id if needed)
      // For simplicity, we'll show all for clinic admins
      const result = await require('../db/connection').query(
        `SELECT 
          i.*,
          p.patient_id,
          pu.first_name || ' ' || pu.last_name AS patient_name,
          d.doctor_id,
          du.first_name || ' ' || du.last_name AS doctor_name
        FROM invoices i
        JOIN patients p ON i.patient_id = p.patient_id
        JOIN users pu ON p.user_id = pu.user_id
        JOIN doctors d ON i.doctor_id = d.doctor_id
        JOIN users du ON d.user_id = du.user_id
        WHERE i.clinic_id = $1 OR i.clinic_id IS NULL
        ORDER BY i.service_date DESC`,
        [req.user.clinicId || 1]
      );
      invoices = result.rows;
    } else {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Format invoices for frontend
    const formattedInvoices = invoices.map(inv => ({
      invoiceId: inv.invoice_id,
      invoiceNumber: inv.invoice_number,
      patientId: inv.patient_id,
      patientName: inv.patient_name || 'Unknown Patient',
      doctorId: inv.doctor_id,
      doctorName: inv.doctor_name || 'Unknown Doctor',
      serviceDate: inv.service_date,
      invoiceDate: inv.invoice_date,
      dueDate: inv.due_date,
      lineItems: typeof inv.line_items === 'string' ? JSON.parse(inv.line_items) : inv.line_items,
      subtotal: parseFloat(inv.subtotal),
      tax: parseFloat(inv.tax || 0),
      discount: parseFloat(inv.discount || 0),
      totalAmount: parseFloat(inv.total_amount),
      insuranceId: inv.insurance_id,
      insuranceCoveragePercent: parseFloat(inv.insurance_coverage_percent || 0),
      insurancePaid: parseFloat(inv.insurance_paid || 0),
      patientResponsibility: parseFloat(inv.patient_responsibility),
      status: inv.status,
      paidAmount: parseFloat(inv.paid_amount || 0),
      balanceDue: parseFloat(inv.balance_due),
      notes: inv.notes,
      createdAt: inv.created_at
    }));

    res.json({
      count: formattedInvoices.length,
      invoices: formattedInvoices
    });
  } catch (error) {
    console.error('[ERROR] Error fetching invoices:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch invoices' });
  }
});

/**
 * Get invoice by ID
 * GET /api/invoices/:id
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id);
    const invoice = await InvoiceRepository.findById(invoiceId);

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Check permissions
    if (req.user.role === 'patient') {
      const patient = await PatientRepository.findByUserId(req.user.userId);
      if (patient && invoice.patient_id !== patient.patient_id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Get payments
    const payments = await InvoiceRepository.getPayments(invoiceId);

    res.json({
      invoice: {
        invoiceId: invoice.invoice_id,
        invoiceNumber: invoice.invoice_number,
        patientId: invoice.patient_id,
        patientName: invoice.patient_name,
        doctorId: invoice.doctor_id,
        doctorName: invoice.doctor_name,
        clinicName: invoice.clinic_name,
        serviceDate: invoice.service_date,
        invoiceDate: invoice.invoice_date,
        dueDate: invoice.due_date,
        lineItems: typeof invoice.line_items === 'string' ? JSON.parse(invoice.line_items) : invoice.line_items,
        subtotal: parseFloat(invoice.subtotal),
        tax: parseFloat(invoice.tax || 0),
        discount: parseFloat(invoice.discount || 0),
        totalAmount: parseFloat(invoice.total_amount),
        insuranceId: invoice.insurance_id,
        insuranceProvider: invoice.insurance_provider,
        insuranceCoveragePercent: parseFloat(invoice.insurance_coverage_percent || 0),
        insurancePaid: parseFloat(invoice.insurance_paid || 0),
        patientResponsibility: parseFloat(invoice.patient_responsibility),
        status: invoice.status,
        paidAmount: parseFloat(invoice.paid_amount || 0),
        balanceDue: parseFloat(invoice.balance_due),
        notes: invoice.notes,
        createdAt: invoice.created_at
      },
      payments: payments.map(p => ({
        paymentId: p.payment_id,
        invoiceId: p.invoice_id,
        paymentDate: p.payment_date,
        amount: parseFloat(p.amount),
        paymentMethod: p.payment_method,
        paymentReference: p.payment_reference,
        status: p.status,
        receiptId: p.receipt_id,
        gatewayTransactionId: p.gateway_transaction_id,
        last4: p.last4
      }))
    });
  } catch (error) {
    console.error('[ERROR] Error fetching invoice:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch invoice' });
  }
});

/**
 * Create invoice manually (for doctors to send bills)
 * POST /api/invoices
 */
router.post('/', authenticate, requireRole('doctor'), async (req, res) => {
  try {
    const {
      patientId,
      medicalRecordId,
      appointmentId,
      amount,
      dueDate,
      description,
      notes
    } = req.body;

    // Validation
    if (!patientId || !amount) {
      return res.status(400).json({
        error: 'Missing required fields: patientId, amount'
      });
    }

    // Get doctor_id from user_id
    const DoctorRepository = require('../repositories/DoctorRepository');
    const doctor = await DoctorRepository.findByUserId(parseInt(req.user.userId));
    if (!doctor) {
      return res.status(400).json({ error: 'User is not a doctor' });
    }

    // Get patient_id number
    let patientIdNum = patientId;
    if (typeof patientIdNum === 'string' && patientIdNum.startsWith('patient_')) {
      patientIdNum = parseInt(patientIdNum.replace('patient_', ''));
    }

    // Get medical_record_id if provided
    let medicalRecordIdNum = null;
    if (medicalRecordId) {
      if (typeof medicalRecordId === 'string' && medicalRecordId.startsWith('record_')) {
        medicalRecordIdNum = parseInt(medicalRecordId.replace('record_', ''));
      } else {
        medicalRecordIdNum = parseInt(medicalRecordId);
      }
    }

    // Get appointment_id if provided
    let appointmentIdNum = null;
    if (appointmentId) {
      if (typeof appointmentId === 'string' && appointmentId.startsWith('appt_')) {
        appointmentIdNum = parseInt(appointmentId.replace('appt_', ''));
      } else {
        appointmentIdNum = parseInt(appointmentId);
      }
    }

    // Build line items
    const lineItems = [{
      service_id: null,
      service_code: 'MANUAL_BILL',
      description: description || 'Medical Services',
      quantity: 1,
      unit_price: parseFloat(amount),
      total: parseFloat(amount),
      service_type: 'consultation'
    }];

    const subtotal = parseFloat(amount);
    const totalAmount = subtotal;

    // Parse due date
    let dueDateObj = null;
    if (dueDate) {
      dueDateObj = new Date(dueDate);
    }

    // Create invoice
    const invoice = await InvoiceRepository.create({
      patient_id: patientIdNum,
      appointment_id: appointmentIdNum,
      medical_record_id: medicalRecordIdNum,
      doctor_id: doctor.doctor_id,
      clinic_id: req.user.clinicId || 1,
      service_date: new Date(),
      due_date: dueDateObj,
      line_items: lineItems,
      subtotal: subtotal,
      tax: 0,
      discount: 0,
      total_amount: totalAmount,
      insurance_id: null,
      insurance_coverage_percent: 0,
      notes: notes || null,
      created_by: req.user.userId
    });

    logAccess(req, AUDIT_ACTIONS.CREATE, {
      resourceType: 'INVOICE',
      resourceId: invoice.invoice_id,
      details: `Created invoice ${invoice.invoice_number} for patient ${patientIdNum}`
    });

    res.status(201).json({
      message: 'Bill sent successfully',
      invoice: {
        invoiceId: invoice.invoice_id,
        invoiceNumber: invoice.invoice_number,
        totalAmount: parseFloat(invoice.total_amount),
        dueDate: invoice.due_date,
        status: invoice.status
      }
    });
  } catch (error) {
    console.error('[ERROR] Error creating invoice:', error);
    res.status(500).json({ error: error.message || 'Failed to create invoice' });
  }
});

/**
 * Record a payment
 * POST /api/invoices/:id/payments
 */
router.post('/:id/payments', authenticate, async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id);
    const { amount, paymentMethod, paymentReference, receiptId, gatewayTransactionId, last4 } = req.body;

    if (!amount || !paymentMethod) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['amount', 'paymentMethod']
      });
    }

    // Verify invoice exists and user has access
    const invoice = await InvoiceRepository.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (req.user.role === 'patient') {
      const patient = await PatientRepository.findByUserId(req.user.userId);
      if (patient && invoice.patient_id !== patient.patient_id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const payment = await InvoiceRepository.recordPayment({
      invoice_id: invoiceId,
      amount: parseFloat(amount),
      payment_method: paymentMethod,
      payment_reference: paymentReference,
      receipt_id: receiptId,
      gateway_transaction_id: gatewayTransactionId,
      last4: last4
    });

    // Update invoice status to PAID if payment amount equals or exceeds balance due
    // Note: recordPayment already updates paid_amount, so we need to get the updated invoice
    const updatedInvoice = await InvoiceRepository.findById(invoiceId);
    if (updatedInvoice) {
      const newPaidAmount = parseFloat(updatedInvoice.paid_amount || 0);
      const patientResponsibility = parseFloat(updatedInvoice.patient_responsibility || updatedInvoice.total_amount);
      const balanceDue = patientResponsibility - newPaidAmount;
      
      if (balanceDue <= 0 || newPaidAmount >= patientResponsibility) {
        await InvoiceRepository.update(invoiceId, { status: 'PAID', balance_due: 0 });
        console.log(`[PAYMENT] Invoice ${invoice.invoice_number} marked as PAID`);
      } else if (newPaidAmount > 0) {
        await InvoiceRepository.update(invoiceId, { status: 'PARTIAL', balance_due: balanceDue });
        console.log(`[PAYMENT] Invoice ${invoice.invoice_number} marked as PARTIAL, balance: $${balanceDue.toFixed(2)}`);
      }
    }

    // Send confirmation emails to patient and doctor
    try {
      const { sendPaymentConfirmationEmail } = require('../services/notificationService');
      const PatientRepository = require('../repositories/PatientRepository');
      const DoctorRepository = require('../repositories/DoctorRepository');
      
      const patient = await PatientRepository.findById(invoice.patient_id);
      const doctor = await DoctorRepository.findById(invoice.doctor_id);
      
      if (patient && doctor) {
        // Ensure payment object has all required fields (both snake_case and camelCase for compatibility)
        const paymentData = {
          amount: payment.amount,
          payment_method: payment.payment_method,
          paymentMethod: payment.payment_method,
          payment_date: payment.payment_date || payment.created_at || new Date(),
          paymentDate: payment.payment_date || payment.created_at || new Date(),
          receipt_id: payment.receipt_id,
          receiptId: payment.receipt_id,
          created_at: payment.created_at || payment.payment_date || new Date()
        };
        
        console.log('[PAYMENT] Sending confirmation emails with payment data:', paymentData);
        await sendPaymentConfirmationEmail(updatedInvoice || invoice, paymentData, patient, doctor);
        console.log(`[PAYMENT] Confirmation emails sent for invoice ${invoice.invoice_number || invoice.invoiceNumber || 'N/A'}`);
      } else {
        console.warn('[PAYMENT] Cannot send emails - patient or doctor not found:', { 
          patient: !!patient, 
          doctor: !!doctor,
          invoice_patient_id: invoice.patient_id,
          invoice_doctor_id: invoice.doctor_id
        });
      }
    } catch (emailError) {
      console.error('[PAYMENT] Error sending confirmation emails:', emailError);
      console.error('[PAYMENT] Email error details:', {
        message: emailError.message,
        stack: emailError.stack
      });
      // Don't fail the payment if email fails
    }

    logAccess(req, AUDIT_ACTIONS.CREATE, {
      resourceType: 'PAYMENT',
      resourceId: payment.payment_id,
      details: `Recorded payment of $${amount} for invoice ${invoice.invoice_number}`
    });

    res.status(201).json({
      message: 'Payment recorded successfully',
      payment: {
        paymentId: payment.payment_id,
        invoiceId: payment.invoice_id,
        amount: parseFloat(payment.amount),
        paymentMethod: payment.payment_method,
        status: payment.status,
        paymentDate: payment.payment_date
      },
      invoiceStatus: updatedInvoice ? (parseFloat(updatedInvoice.paid_amount || 0) >= parseFloat(updatedInvoice.balance_due || updatedInvoice.total_amount) ? 'PAID' : 'PARTIAL') : invoice.status
    });
  } catch (error) {
    console.error('[ERROR] Error recording payment:', error);
    res.status(500).json({ error: error.message || 'Failed to record payment' });
  }
});

module.exports = router;

