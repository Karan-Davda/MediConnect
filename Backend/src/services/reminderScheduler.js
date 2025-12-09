const appointmentRepository = require('../repositories/AppointmentRepository');
const notificationService = require('./notificationService');

class ReminderScheduler {
  constructor() {
    this.isRunning = false;
    this.interval = null;
    this.checkIntervalMinutes = 60;
    this.reminderWindowHours = 24;
  }

  start() {
    if (this.isRunning) {
      console.log('[ReminderScheduler] Already running');
      return;
    }

    console.log(`[ReminderScheduler] Starting scheduler - checking every ${this.checkIntervalMinutes} minutes`);
    this.isRunning = true;

    this.checkAndSendReminders();

    this.interval = setInterval(() => {
      this.checkAndSendReminders();
    }, this.checkIntervalMinutes * 60 * 1000);
  }

  stop() {
    if (!this.isRunning) {
      console.log('[ReminderScheduler] Not running');
      return;
    }

    console.log('[ReminderScheduler] Stopping scheduler');
    this.isRunning = false;

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async checkAndSendReminders() {
    try {
      console.log(`[ReminderScheduler] Checking for appointments needing reminders... (${new Date().toISOString()})`);

      const appointments = await appointmentRepository.findAppointmentsNeedingReminders(this.reminderWindowHours);

      if (appointments.length === 0) {
        console.log('[ReminderScheduler] No appointments need reminders at this time');
        return;
      }

      console.log(`[ReminderScheduler] Found ${appointments.length} appointment(s) needing reminders`);

      for (const appointment of appointments) {
        await this.sendReminderForAppointment(appointment);
      }

      console.log('[ReminderScheduler] Finished sending reminders');
    } catch (error) {
      console.error('[ReminderScheduler] Error checking/sending reminders:', error);
    }
  }

  async sendReminderForAppointment(appointment) {
    try {
      console.log(`[ReminderScheduler] Sending reminder for appointment ${appointment.appointmentNumber}`);

      const preferences = {
        smsNotifications: true,
        emailNotifications: true
      };

      const results = await notificationService.sendAppointmentReminder(appointment, preferences);

      await appointmentRepository.markReminderSent(appointment.id);

      console.log(`[ReminderScheduler] Reminder sent for appointment ${appointment.appointmentNumber}:`, results);

      return results;
    } catch (error) {
      console.error(`[ReminderScheduler] Error sending reminder for appointment ${appointment.appointmentNumber}:`, error);
      throw error;
    }
  }

  async sendReminderNow(appointmentId) {
    try {
      const appointment = await appointmentRepository.findById(appointmentId);

      if (!appointment) {
        throw new Error('Appointment not found');
      }

      if (appointment.status !== 'confirmed') {
        throw new Error('Only confirmed appointments can have reminders sent');
      }

      return await this.sendReminderForAppointment(appointment);
    } catch (error) {
      console.error(`[ReminderScheduler] Error sending immediate reminder:`, error);
      throw error;
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      checkIntervalMinutes: this.checkIntervalMinutes,
      reminderWindowHours: this.reminderWindowHours
    };
  }
}

module.exports = new ReminderScheduler();
