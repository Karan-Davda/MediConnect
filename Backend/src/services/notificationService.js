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
function sendInAppNotification(patientId, labResult, medicalRecord) {
  const statusText = labResult.status === 'critical' ? 'CRITICAL' : 
                    labResult.status === 'abnormal' ? 'ABNORMAL' : 'Available';
  
  const title = `New Test Result: ${labResult.testName}`;
  const message = `Your ${labResult.testName} result is ${statusText}. ${labResult.status === 'critical' ? 'Please contact your provider immediately.' : 'Please review in your medical records.'}`;

  return createNotification({
    patientId,
    type: 'test_result',
    title,
    message,
    labResult,
    medicalRecordId: medicalRecord.id
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
    results.inApp.notification = sendInAppNotification(patient.id, labResult, medicalRecord);
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

module.exports = {
  sendEmailNotification,
  sendSMSNotification,
  sendInAppNotification,
  sendNotification,
  retryOperation
};

