class NotificationService {
  constructor() {
    this.smsEnabled = process.env.SMS_ENABLED === 'true' || false;
    this.emailEnabled = process.env.EMAIL_ENABLED === 'true' || true;
  }

  async sendSMS(phoneNumber, message) {
    if (!this.smsEnabled) {
      console.log(`[SMS MOCK] To: ${phoneNumber}`);
      console.log(`[SMS MOCK] Message: ${message}`);
      return { success: true, mock: true, method: 'SMS' };
    }

    console.log(`[SMS] Sending to ${phoneNumber}: ${message}`);
    return { success: true, method: 'SMS' };
  }

  async sendEmail(to, subject, body) {
    if (!this.emailEnabled) {
      console.log(`[EMAIL MOCK] To: ${to}`);
      console.log(`[EMAIL MOCK] Subject: ${subject}`);
      console.log(`[EMAIL MOCK] Body: ${body}`);
      return { success: true, mock: true, method: 'EMAIL' };
    }

    console.log(`[EMAIL] Sending to ${to}`);
    console.log(`[EMAIL] Subject: ${subject}`);
    console.log(`[EMAIL] Body: ${body}`);
    return { success: true, method: 'EMAIL' };
  }

  formatAppointmentReminderSMS(appointment) {
    return `Hi ${appointment.patientName}, this is a reminder for your appointment with ${appointment.providerName} on ${appointment.appointmentDate} at ${appointment.appointmentTime}. Location: ${appointment.location}. Reply CANCEL to cancel.`;
  }

  formatAppointmentReminderEmail(appointment) {
    const subject = `Appointment Reminder - ${appointment.appointmentDate}`;
    const body = `
Dear ${appointment.patientName},

This is a reminder for your upcoming appointment:

Appointment Details:
- Provider: ${appointment.providerName}
- Date: ${appointment.appointmentDate}
- Time: ${appointment.appointmentTime}
- Duration: ${appointment.duration} minutes
- Location: ${appointment.location}
- Reason: ${appointment.reason}
${appointment.fee ? `- Fee: $${appointment.fee}` : ''}

Please arrive 10 minutes early to complete any necessary paperwork.

If you need to cancel or reschedule, please contact us as soon as possible.

Thank you,
MediConnect Team
    `.trim();

    return { subject, body };
  }

  async sendAppointmentReminder(appointment, preferences) {
    const results = [];

    if (!preferences) {
      preferences = {
        smsNotifications: true,
        emailNotifications: true
      };
    }

    if (preferences.smsNotifications && appointment.patientPhone) {
      const message = this.formatAppointmentReminderSMS(appointment);
      const result = await this.sendSMS(appointment.patientPhone, message);
      results.push(result);
    }

    if (preferences.emailNotifications && appointment.patientEmail) {
      const { subject, body } = this.formatAppointmentReminderEmail(appointment);
      const result = await this.sendEmail(appointment.patientEmail, subject, body);
      results.push(result);
    }

    return results;
  }

  async sendAppointmentConfirmation(appointment, preferences) {
    const results = [];

    if (!preferences) {
      preferences = {
        smsNotifications: true,
        emailNotifications: true
      };
    }

    if (preferences.smsNotifications && appointment.patientPhone) {
      const message = `Your appointment with ${appointment.providerName} has been confirmed for ${appointment.appointmentDate} at ${appointment.appointmentTime}. Appointment #${appointment.appointmentNumber}`;
      const result = await this.sendSMS(appointment.patientPhone, message);
      results.push(result);
    }

    if (preferences.emailNotifications && appointment.patientEmail) {
      const subject = `Appointment Confirmed - ${appointment.appointmentNumber}`;
      const body = `
Dear ${appointment.patientName},

Your appointment has been confirmed:

Appointment Number: ${appointment.appointmentNumber}
Provider: ${appointment.providerName}
Date: ${appointment.appointmentDate}
Time: ${appointment.appointmentTime}
Location: ${appointment.location}
${appointment.fee ? `Fee: $${appointment.fee}` : ''}

We look forward to seeing you.

Thank you,
MediConnect Team
      `.trim();

      const result = await this.sendEmail(appointment.patientEmail, subject, body);
      results.push(result);
    }

    return results;
  }

  async sendAppointmentCancellation(appointment, preferences) {
    const results = [];

    if (!preferences) {
      preferences = {
        smsNotifications: true,
        emailNotifications: true
      };
    }

    if (preferences.smsNotifications && appointment.patientPhone) {
      const message = `Your appointment #${appointment.appointmentNumber} with ${appointment.providerName} on ${appointment.appointmentDate} at ${appointment.appointmentTime} has been cancelled.`;
      const result = await this.sendSMS(appointment.patientPhone, message);
      results.push(result);
    }

    if (preferences.emailNotifications && appointment.patientEmail) {
      const subject = `Appointment Cancelled - ${appointment.appointmentNumber}`;
      const body = `
Dear ${appointment.patientName},

Your appointment has been cancelled:

Appointment Number: ${appointment.appointmentNumber}
Provider: ${appointment.providerName}
Date: ${appointment.appointmentDate}
Time: ${appointment.appointmentTime}

If you would like to reschedule, please contact us.

Thank you,
MediConnect Team
      `.trim();

      const result = await this.sendEmail(appointment.patientEmail, subject, body);
      results.push(result);
    }

    return results;
  }
}

module.exports = new NotificationService();
