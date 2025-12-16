// Notification Service - handles sending notifications via email, SMS, and in-app
const {
  createNotification,
  findNotificationsByPatientId
} = require('../repositories/NotificationRepository');
const { findPatientById } = require('../repositories/MedicalRecordRepository');

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff in ms

/**
 * Sleep utility for retry delays
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Send email notification using Resend
 * @param {Object} patient - Patient object
 * @param {Object} labResult - LabResult object
 * @param {Object} medicalRecord - MedicalRecord object
 * @returns {Promise<Object>} Result of email send
 */
async function sendEmailNotification(patient, labResult, medicalRecord) {
  // Check if Resend is available
  let Resend;
  try {
    const resendModule = require('resend');
    // Resend v3 exports as { Resend } - use the Resend property
    Resend = resendModule.Resend;
    if (!Resend) {
      throw new Error('Resend class not found in module');
    }
  } catch (error) {
    console.warn('Resend package not installed or invalid:', error.message);
    return { success: false, error: 'Email service not installed' };
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured, skipping email notification');
    return { success: false, error: 'Email service not configured' };
  }

  // Resend v3 - instantiate with API key
  const resend = new Resend(process.env.RESEND_API_KEY);

  // Validate patient email
  if (!patient.email && !patient.userId) {
    throw new Error('Patient email is missing or invalid');
  }

  // Get patient email - try to get from user if available
  let patientEmail = patient.email;
  if (!patientEmail && patient.userId) {
    // In a real system, you'd fetch from UserRepository
    // For now, we'll use a placeholder or throw error
    throw new Error('Patient email not found');
  }

  const statusEmoji = labResult.status === 'critical' ? '🚨' : 
                     labResult.status === 'abnormal' ? '⚠️' : '📋';
  const statusText = labResult.status === 'critical' ? 'CRITICAL' : 
                    labResult.status === 'abnormal' ? 'ABNORMAL' : 'AVAILABLE';

  const subject = `${statusEmoji} New Test Result Available - ${labResult.testName}`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .result-box { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid ${labResult.status === 'critical' ? '#f44336' : labResult.status === 'abnormal' ? '#ff9800' : '#4CAF50'}; }
        .status-badge { display: inline-block; padding: 5px 10px; border-radius: 3px; font-weight: bold; }
        .critical { background-color: #f44336; color: white; }
        .abnormal { background-color: #ff9800; color: white; }
        .normal { background-color: #4CAF50; color: white; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>MediConnect - Test Result Notification</h2>
        </div>
        <div class="content">
          <p>Dear ${patient.firstName} ${patient.lastName},</p>
          <p>Your healthcare provider has uploaded a new test result for your review.</p>
          
          <div class="result-box">
            <h3>Test Information</h3>
            <p><strong>Test Name:</strong> ${labResult.testName}</p>
            <p><strong>Result:</strong> ${labResult.result} ${labResult.unit || ''}</p>
            <p><strong>Status:</strong> <span class="status-badge ${labResult.status}">${statusText}</span></p>
            ${labResult.referenceRange ? `<p><strong>Reference Range:</strong> ${labResult.referenceRange}</p>` : ''}
            <p><strong>Date Performed:</strong> ${new Date(labResult.performedDate).toLocaleDateString()}</p>
            <p><strong>Provider:</strong> ${medicalRecord.providerName}</p>
            ${labResult.notes ? `<p><strong>Notes:</strong> ${labResult.notes}</p>` : ''}
          </div>
          
          ${labResult.status === 'critical' ? '<p style="color: #f44336; font-weight: bold;">⚠️ This is a critical result. Please contact your healthcare provider immediately.</p>' : ''}
          
          <p>Please log in to your MediConnect account to view the complete medical record.</p>
        </div>
        <div class="footer">
          <p>This is an automated notification from MediConnect.</p>
          <p>Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    console.log('📧 Attempting to send email via Resend:', {
      from: fromEmail,
      to: patientEmail,
      subject: subject,
      patientName: `${patient.firstName} ${patient.lastName}`,
      hasApiKey: !!process.env.RESEND_API_KEY,
      apiKeyPrefix: process.env.RESEND_API_KEY ? process.env.RESEND_API_KEY.substring(0, 10) + '...' : 'NOT SET'
    });
    console.log(`⚠️  IMPORTANT: Email is being sent to: ${patientEmail}`);
    console.log(`   Please verify this is the correct email address you're checking!`);

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [patientEmail],
      subject: subject,
      html: htmlContent,
    });

    if (error) {
      console.error('❌ Resend API error:', {
        message: error.message,
        statusCode: error.statusCode,
        name: error.name,
        fullError: error
      });
      throw new Error(error.message || 'Failed to send email');
    }

    console.log('✅ Email sent successfully via Resend:', {
      emailId: data?.id,
      to: patientEmail,
      subject: subject,
      fullResponse: data
    });
    console.log(`📬 Email delivered to: ${patientEmail}`);
    console.log(`   Check your inbox (and spam folder) at this address!`);
    console.log(`   Resend email ID: ${data?.id} - View in dashboard: https://resend.com/emails/${data?.id}`);

    return { success: true, data };
  } catch (error) {
    console.error('❌ Email send error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    throw error;
  }
}

/**
 * Send SMS notification (structure for future implementation)
 * @param {Object} patient - Patient object
 * @param {Object} labResult - LabResult object
 * @param {Object} medicalRecord - MedicalRecord object
 * @returns {Promise<Object>} Result of SMS send
 */
async function sendSMSNotification(patient, labResult, medicalRecord) {
  // Validate patient phone number
  if (!patient.phoneNumber) {
    throw new Error('Patient phone number is missing or invalid');
  }

  // TODO: Implement SMS service integration (Twilio, AWS SNS, etc.)
  // For now, log the SMS attempt
  console.log(`[SMS] Would send to ${patient.phoneNumber}: New test result available for ${labResult.testName}`);
  
  return { 
    success: false, 
    error: 'SMS service not yet implemented',
    note: 'SMS notification logged but not sent'
  };
}

/**
 * Send in-app notification
 * @param {string} patientId - Patient ID
 * @param {Object} labResult - LabResult object
 * @param {Object} medicalRecord - MedicalRecord object
 * @returns {Notification} Created notification
 */
async function sendInAppNotification(patientId, labResult, medicalRecord) {
  const statusText = labResult.status === 'critical' ? 'CRITICAL' : 
                    labResult.status === 'abnormal' ? 'ABNORMAL' : 'Available';
  
  const title = `New Test Result: ${labResult.testName}`;
  const message = `Your ${labResult.testName} result is ${statusText}. ${labResult.status === 'critical' ? 'Please contact your provider immediately.' : 'Please review in your medical records.'}`;

  // Get user_id from patient_id for quick lookup
  let userId = null;
  try {
    const PatientRepository = require('../repositories/PatientRepository');
    let patientIdNum = patientId;
    if (typeof patientIdNum === 'string' && patientIdNum.startsWith('patient_')) {
      patientIdNum = parseInt(patientIdNum.replace('patient_', ''));
    }
    const patient = await PatientRepository.findById(patientIdNum);
    if (patient) {
      userId = patient.user_id;
    }
  } catch (err) {
    console.warn('Could not fetch user_id for notification:', err.message);
  }

  return await createNotification({
    patientId,
    userId,
    type: 'test_result',
    title,
    message,
    medicalRecordId: medicalRecord.id,
    data: {
      labResult: labResult.toJSON ? labResult.toJSON() : labResult
    },
    priority: labResult.status === 'critical' ? 'urgent' : (labResult.status === 'abnormal' ? 'high' : 'normal')
  });
}

/**
 * Retry wrapper for async operations
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number[]} delays - Array of delay times in ms
 * @returns {Promise<any>} Result of function
 */
async function retryOperation(fn, maxRetries = MAX_RETRIES, delays = RETRY_DELAYS) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const delay = delays[attempt] || delays[delays.length - 1];
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

/**
 * Main method to send notification based on patient preferences
 * @param {Object} patient - Patient object
 * @param {Object} labResult - LabResult object
 * @param {Object} medicalRecord - MedicalRecord object
 * @param {Object} preferences - Notification preferences { emailReminders: boolean, smsReminders: boolean }
 * @returns {Promise<Object>} Result of notification sends
 */
async function sendNotification(patient, labResult, medicalRecord, preferences = {}) {
  const results = {
    email: { success: false, error: null },
    sms: { success: false, error: null },
    inApp: { success: false, error: null, notification: null }
  };

  // Always send in-app notification
  try {
    results.inApp.notification = await sendInAppNotification(patient.id, labResult, medicalRecord);
    results.inApp.success = true;
  } catch (error) {
    results.inApp.error = error.message;
    console.error('In-app notification error:', error);
  }

  // Send email if enabled and patient has email
  if (preferences.emailReminders !== false) { // Default to true if not specified
    try {
      if (patient.email) {
        console.log(`Sending email notification to: ${patient.email} for test: ${labResult.testName}`);
        results.email = await retryOperation(() => 
          sendEmailNotification(patient, labResult, medicalRecord)
        );
        console.log(`Email notification result:`, results.email);
      } else {
        results.email.error = `Patient email not available. Patient ID: ${patient.id}, User ID: ${patient.userId}`;
        console.warn('Email notification skipped - patient email missing:', {
          patientId: patient.id,
          userId: patient.userId,
          patientName: patient.fullName
        });
      }
    } catch (error) {
      results.email.error = error.message;
      console.error('Email notification error:', error);
    }
  } else {
    results.email.error = 'Email notifications disabled by patient';
    console.log('Email notification skipped - disabled by patient preferences');
  }

  // Send SMS if enabled and patient has phone
  if (preferences.smsReminders === true) {
    try {
      if (patient.phoneNumber) {
        results.sms = await retryOperation(() => 
          sendSMSNotification(patient, labResult, medicalRecord)
        );
      } else {
        results.sms.error = 'Patient phone number not available';
      }
    } catch (error) {
      results.sms.error = error.message;
      console.error('SMS notification error:', error);
    }
  } else {
    results.sms.error = 'SMS notifications disabled by patient';
  }

  return results;
}

/**
 * Send appointment confirmation email
 * @param {Object} appointment - Appointment object with patient and doctor info
 * @param {Object} patient - Patient object with email
 * @param {Object} doctor - Doctor object with name
 * @returns {Promise<Object>} Result of email send
 */
async function sendAppointmentConfirmationEmail(appointment, patient, doctor) {
  console.log('[APPOINTMENT_EMAIL] Function called with:', {
    appointment_id: appointment?.appt_id,
    patient_id: patient?.patient_id,
    doctor_id: doctor?.doctor_id
  });
  
  // Check if Resend is available
  let Resend;
  try {
    const resendModule = require('resend');
    Resend = resendModule.Resend;
    if (!Resend) {
      throw new Error('Resend class not found in module');
    }
    console.log('[APPOINTMENT_EMAIL] Resend module loaded successfully');
  } catch (error) {
    console.error('[APPOINTMENT_EMAIL] Resend package not installed or invalid:', error.message);
    return { success: false, error: 'Email service not installed' };
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('[APPOINTMENT_EMAIL] RESEND_API_KEY not configured, skipping email notification');
    return { success: false, error: 'Email service not configured' };
  }
  
  console.log('[APPOINTMENT_EMAIL] RESEND_API_KEY found, initializing Resend client');

  const resend = new Resend(process.env.RESEND_API_KEY);

  // Get patient email
  let patientEmail = patient.email;
  console.log('[APPOINTMENT_EMAIL] Initial patient email check:', {
    hasEmail: !!patientEmail,
    email: patientEmail,
    user_id: patient.user_id
  });
  
  if (!patientEmail) {
    // Try to get from user
    console.log('[APPOINTMENT_EMAIL] Patient email not found, fetching from UserRepository...');
    const UserRepository = require('../repositories/UserRepository');
    const user = await UserRepository.findById(patient.user_id);
    if (user) {
      patientEmail = user.email;
      console.log('[APPOINTMENT_EMAIL] Found email from UserRepository:', patientEmail);
    } else {
      console.warn('[APPOINTMENT_EMAIL] User not found for user_id:', patient.user_id);
    }
  }

  if (!patientEmail) {
    console.error('[APPOINTMENT_EMAIL] Patient email not found for appointment confirmation');
    console.error('[APPOINTMENT_EMAIL] Patient object:', {
      patient_id: patient.patient_id,
      user_id: patient.user_id,
      hasEmail: !!patient.email
    });
    return { success: false, error: 'Patient email not found' };
  }
  
  console.log('[APPOINTMENT_EMAIL] Using patient email:', patientEmail);

  const startTime = new Date(appointment.start_time);
  const formattedDate = startTime.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const formattedTime = startTime.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });

  const subject = `✅ Appointment Confirmed - ${formattedDate} at ${formattedTime}`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .appointment-box { background-color: white; padding: 20px; margin: 15px 0; border-left: 4px solid #4CAF50; }
        .info-row { margin: 10px 0; }
        .label { font-weight: bold; color: #555; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        .button { display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>✅ Appointment Confirmed</h2>
        </div>
        <div class="content">
          <p>Dear ${patient.first_name || patient.firstName || 'Patient'} ${patient.last_name || patient.lastName || ''},</p>
          <p>Your appointment has been successfully confirmed!</p>
          
          <div class="appointment-box">
            <h3>Appointment Details</h3>
            <div class="info-row">
              <span class="label">Date:</span> ${formattedDate}
            </div>
            <div class="info-row">
              <span class="label">Time:</span> ${formattedTime}
            </div>
            <div class="info-row">
              <span class="label">Provider:</span> ${doctor.first_name || ''} ${doctor.last_name || ''} ${doctor.speciality_name ? `- ${doctor.speciality_name}` : ''}
            </div>
            ${appointment.reason ? `
            <div class="info-row">
              <span class="label">Reason:</span> ${appointment.reason}
            </div>
            ` : ''}
            ${appointment.appointment_type ? `
            <div class="info-row">
              <span class="label">Type:</span> ${appointment.appointment_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </div>
            ` : ''}
          </div>
          
          <p>Please arrive 10-15 minutes early for your appointment. If you need to reschedule or cancel, please log in to your MediConnect account.</p>
          
          <div style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" class="button">View Appointment</a>
          </div>
        </div>
        <div class="footer">
          <p>This is an automated confirmation from MediConnect.</p>
          <p>Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    console.log('📧 Sending appointment confirmation email:', {
      from: fromEmail,
      to: patientEmail,
      subject: subject
    });

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [patientEmail],
      subject: subject,
      html: htmlContent,
    });

    if (error) {
      console.error('❌ Resend API error:', error);
      throw new Error(error.message || 'Failed to send email');
    }

    console.log('✅ Appointment confirmation email sent:', {
      emailId: data?.id,
      to: patientEmail
    });

    return { success: true, data };
  } catch (error) {
    console.error('❌ Email send error:', error);
    throw error;
  }
}

/**
 * Send payment confirmation email to patient and doctor
 */
async function sendPaymentConfirmationEmail(invoice, payment, patient, doctor) {
  try {
    console.log('[PAYMENT_EMAIL] Starting email send process...');
    console.log('[PAYMENT_EMAIL] Invoice:', { 
      invoice_id: invoice.invoice_id || invoice.invoiceId,
      invoice_number: invoice.invoice_number || invoice.invoiceNumber,
      patient_id: invoice.patient_id || invoice.patientId,
      doctor_id: invoice.doctor_id || invoice.doctorId
    });
    console.log('[PAYMENT_EMAIL] Payment:', payment);
    console.log('[PAYMENT_EMAIL] Patient:', { 
      patient_id: patient?.patient_id,
      user_id: patient?.user_id 
    });
    console.log('[PAYMENT_EMAIL] Doctor:', { 
      doctor_id: doctor?.doctor_id,
      user_id: doctor?.user_id 
    });

    // Check if Resend is available
    let Resend;
    try {
      const resendModule = require('resend');
      // Resend v3 exports as { Resend } - use the Resend property
      Resend = resendModule.Resend;
      if (!Resend) {
        throw new Error('Resend class not found in module');
      }
    } catch (error) {
      console.warn('Resend package not installed or invalid:', error.message);
      return { success: false, error: 'Email service not installed' };
    }

    if (!process.env.RESEND_API_KEY) {
      console.error('[PAYMENT_EMAIL] RESEND_API_KEY not configured');
      return { success: false, error: 'Email service not configured' };
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    if (!process.env.RESEND_API_KEY) {
      console.error('[PAYMENT_EMAIL] RESEND_API_KEY not configured');
      return { success: false, error: 'Email service not configured' };
    }

    // Get patient email - patient object should have user_id
    const { query } = require('../db/connection');
    let patientUser;
    
    if (patient && patient.user_id) {
      const userResult = await query('SELECT email, first_name, last_name FROM users WHERE user_id = $1', [patient.user_id]);
      patientUser = userResult.rows[0];
      console.log('[PAYMENT_EMAIL] Patient user found:', { email: patientUser?.email });
    } else if (invoice.patient_id || invoice.patientId) {
      // Fallback: get patient from invoice
      const PatientRepository = require('../repositories/PatientRepository');
      const patientId = invoice.patient_id || invoice.patientId;
      const patientData = await PatientRepository.findById(patientId);
      if (patientData && patientData.user_id) {
        const userResult = await query('SELECT email, first_name, last_name FROM users WHERE user_id = $1', [patientData.user_id]);
        patientUser = userResult.rows[0];
        console.log('[PAYMENT_EMAIL] Patient user found via fallback:', { email: patientUser?.email });
      }
    }
    
    if (!patientUser || !patientUser.email) {
      console.error('[PAYMENT_EMAIL] Patient email not found');
      return { success: false, error: 'Patient email not found' };
    }

    // Get doctor email - doctor object should have user_id
    let doctorUser;
    
    if (doctor && doctor.user_id) {
      const doctorUserResult = await query('SELECT email, first_name, last_name FROM users WHERE user_id = $1', [doctor.user_id]);
      doctorUser = doctorUserResult.rows[0];
      console.log('[PAYMENT_EMAIL] Doctor user found:', { email: doctorUser?.email });
    } else if (invoice.doctor_id || invoice.doctorId) {
      // Fallback: get doctor from invoice
      const DoctorRepository = require('../repositories/DoctorRepository');
      const doctorId = invoice.doctor_id || invoice.doctorId;
      const doctorData = await DoctorRepository.findById(doctorId);
      if (doctorData && doctorData.user_id) {
        const doctorUserResult = await query('SELECT email, first_name, last_name FROM users WHERE user_id = $1', [doctorData.user_id]);
        doctorUser = doctorUserResult.rows[0];
        console.log('[PAYMENT_EMAIL] Doctor user found via fallback:', { email: doctorUser?.email });
      }
    }
    
    if (!doctorUser || !doctorUser.email) {
      console.error('[PAYMENT_EMAIL] Doctor email not found');
      return { success: false, error: 'Doctor email not found' };
    }

    const subject = `✅ Payment Confirmed - Invoice ${invoice.invoice_number || invoice.invoiceNumber || 'N/A'}`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .payment-box { background-color: white; padding: 20px; margin: 15px 0; border-left: 4px solid #4CAF50; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; color: #555; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>✅ Payment Confirmed</h2>
          </div>
          <div class="content">
            <p>Dear ${patientUser.first_name || 'Patient'},</p>
            <p>Your payment has been successfully processed!</p>
            
            <div class="payment-box">
              <h3>Payment Details</h3>
              <div class="info-row">
                <span class="label">Invoice Number:</span> ${invoice.invoice_number || invoice.invoiceNumber || 'N/A'}
              </div>
              <div class="info-row">
                <span class="label">Amount Paid:</span> $${parseFloat(payment.amount || 0).toFixed(2)}
              </div>
              <div class="info-row">
                <span class="label">Payment Method:</span> ${(payment.payment_method || payment.paymentMethod || 'N/A').toUpperCase()}
              </div>
              <div class="info-row">
                <span class="label">Payment Date:</span> ${new Date(payment.payment_date || payment.paymentDate || payment.created_at || new Date()).toLocaleDateString()}
              </div>
              <div class="info-row">
                <span class="label">Receipt ID:</span> ${payment.receipt_id || payment.receiptId || 'N/A'}
              </div>
            </div>
            
            <p>Thank you for your payment. This email serves as your receipt.</p>
          </div>
          <div class="footer">
            <p>This is an automated confirmation from MediConnect.</p>
            <p>Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    
    console.log('[PAYMENT_EMAIL] Sending emails...', {
      from: fromEmail,
      patientEmail: patientUser.email,
      doctorEmail: doctorUser.email
    });
    
    // Send to patient
    let patientEmailResult;
    try {
      patientEmailResult = await resend.emails.send({
        from: fromEmail,
        to: [patientUser.email],
        subject: subject,
        html: htmlContent,
      });
      console.log('[PAYMENT_EMAIL] Patient email sent successfully:', patientEmailResult);
    } catch (patientEmailError) {
      console.error('[PAYMENT_EMAIL] Error sending patient email:', patientEmailError);
      throw patientEmailError;
    }

    // Send to doctor
    const doctorSubject = `Payment Received - Invoice ${invoice.invoice_number || invoice.invoiceNumber || 'N/A'}`;
    const doctorHtmlContent = htmlContent
      .replace(`Dear ${patientUser.first_name || 'Patient'},`, `Dear Dr. ${doctorUser.first_name || ''} ${doctorUser.last_name || ''},`)
      .replace('Your payment has been', 'A payment has been received for');
    
    let doctorEmailResult;
    try {
      doctorEmailResult = await resend.emails.send({
        from: fromEmail,
        to: [doctorUser.email],
        subject: doctorSubject,
        html: doctorHtmlContent,
      });
      console.log('[PAYMENT_EMAIL] Doctor email sent successfully:', doctorEmailResult);
    } catch (doctorEmailError) {
      console.error('[PAYMENT_EMAIL] Error sending doctor email:', doctorEmailError);
      throw doctorEmailError;
    }

    console.log('✅ Payment confirmation emails sent:', {
      patientEmail: patientUser.email,
      doctorEmail: doctorUser.email,
      invoiceNumber: invoice.invoice_number || invoice.invoiceNumber || 'N/A'
    });

    return { 
      success: true, 
      patientEmail: patientEmailResult?.data, 
      doctorEmail: doctorEmailResult?.data 
    };
  } catch (error) {
    console.error('❌ Payment confirmation email error:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    throw error;
  }
}

module.exports = {
  sendEmailNotification,
  sendSMSNotification,
  sendInAppNotification,
  sendNotification,
  sendAppointmentConfirmationEmail,
  sendPaymentConfirmationEmail,
  retryOperation
};

