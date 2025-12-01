const Appointment = require('../models/Appointment');

class AppointmentRepository {
  constructor() {
    this.appointments = [];
    this.appointmentCounter = 1;
    this.initializeMockData();
  }

  initializeMockData() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    this.appointments = [
      new Appointment({
        id: '1',
        appointmentNumber: 'APT-2025-000001',
        patientId: '1',
        patientName: 'John Patient',
        patientEmail: 'patient@example.com',
        patientPhone: '+1234567890',
        providerId: '2',
        providerName: 'Dr. Jane Smith',
        appointmentDate: tomorrow.toISOString().split('T')[0],
        appointmentTime: '09:00',
        duration: 30,
        reason: 'Annual checkup',
        type: 'In-Person',
        status: 'confirmed',
        location: 'Clinic East, Room 12A',
        fee: 120,
        reminderSent: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      new Appointment({
        id: '2',
        appointmentNumber: 'APT-2025-000002',
        patientId: '1',
        patientName: 'John Patient',
        patientEmail: 'patient@example.com',
        patientPhone: '+1234567890',
        providerId: '3',
        providerName: 'Dr. Bob Johnson',
        appointmentDate: nextWeek.toISOString().split('T')[0],
        appointmentTime: '14:00',
        duration: 30,
        reason: 'Follow-up consultation',
        type: 'Telemedicine',
        status: 'confirmed',
        location: 'Virtual',
        fee: 100,
        reminderSent: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      new Appointment({
        id: '3',
        appointmentNumber: 'APT-2025-000003',
        patientId: '2',
        patientName: 'Jane Doe',
        patientEmail: 'jane.doe@example.com',
        patientPhone: '+1987654321',
        providerId: '2',
        providerName: 'Dr. Jane Smith',
        appointmentDate: tomorrow.toISOString().split('T')[0],
        appointmentTime: '10:30',
        duration: 45,
        reason: 'Consultation',
        type: 'In-Person',
        status: 'confirmed',
        location: 'Clinic East, Room 12A',
        fee: 150,
        reminderSent: false,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    ];
    this.appointmentCounter = this.appointments.length + 1;
  }

  generateAppointmentNumber() {
    const year = new Date().getFullYear();
    const number = String(this.appointmentCounter).padStart(6, '0');
    return `APT-${year}-${number}`;
  }

  async create(appointmentData) {
    const appointment = new Appointment({
      id: String(this.appointmentCounter),
      appointmentNumber: this.generateAppointmentNumber(),
      ...appointmentData,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    this.appointments.push(appointment);
    this.appointmentCounter++;
    return appointment.toJSON();
  }

  async findById(id) {
    const appointment = this.appointments.find(a => a.id === id);
    return appointment ? appointment.toJSON() : null;
  }

  async findAll(filters = {}) {
    let filtered = [...this.appointments];

    if (filters.patientId) {
      filtered = filtered.filter(a => a.patientId === filters.patientId);
    }

    if (filters.providerId) {
      filtered = filtered.filter(a => a.providerId === filters.providerId);
    }

    if (filters.status) {
      filtered = filtered.filter(a => a.status === filters.status);
    }

    if (filters.date) {
      filtered = filtered.filter(a => a.appointmentDate === filters.date);
    }

    if (filters.type) {
      filtered = filtered.filter(a => a.type === filters.type);
    }

    filtered.sort((a, b) => {
      const dateA = new Date(`${a.appointmentDate}T${a.appointmentTime}`);
      const dateB = new Date(`${b.appointmentDate}T${b.appointmentTime}`);
      return dateA - dateB;
    });

    return filtered.map(a => a.toJSON());
  }

  async findUpcoming(filters = {}) {
    const now = new Date();
    let filtered = this.appointments.filter(a => {
      const appointmentDateTime = new Date(`${a.appointmentDate}T${a.appointmentTime}`);
      return appointmentDateTime >= now && a.status === 'confirmed';
    });

    if (filters.patientId) {
      filtered = filtered.filter(a => a.patientId === filters.patientId);
    }

    if (filters.providerId) {
      filtered = filtered.filter(a => a.providerId === filters.providerId);
    }

    filtered.sort((a, b) => {
      const dateA = new Date(`${a.appointmentDate}T${a.appointmentTime}`);
      const dateB = new Date(`${b.appointmentDate}T${b.appointmentTime}`);
      return dateA - dateB;
    });

    return filtered.map(a => a.toJSON());
  }

  async findAppointmentsNeedingReminders(hoursBeforeAppointment = 24) {
    const now = new Date();
    const reminderWindow = new Date(now.getTime() + hoursBeforeAppointment * 60 * 60 * 1000);

    const needingReminders = this.appointments.filter(a => {
      if (a.status !== 'confirmed' || a.reminderSent) {
        return false;
      }

      const appointmentDateTime = new Date(`${a.appointmentDate}T${a.appointmentTime}`);

      return appointmentDateTime > now && appointmentDateTime <= reminderWindow;
    });

    return needingReminders.map(a => a.toJSON());
  }

  async update(id, updates) {
    const index = this.appointments.findIndex(a => a.id === id);
    if (index === -1) return null;

    Object.assign(this.appointments[index], {
      ...updates,
      updatedAt: new Date()
    });

    return this.appointments[index].toJSON();
  }

  async updateStatus(id, status, additionalData = {}) {
    const index = this.appointments.findIndex(a => a.id === id);
    if (index === -1) return null;

    Object.assign(this.appointments[index], {
      status,
      ...additionalData,
      updatedAt: new Date()
    });

    return this.appointments[index].toJSON();
  }

  async markReminderSent(id) {
    const index = this.appointments.findIndex(a => a.id === id);
    if (index === -1) return null;

    this.appointments[index].reminderSent = true;
    this.appointments[index].reminderSentAt = new Date();
    this.appointments[index].updatedAt = new Date();

    return this.appointments[index].toJSON();
  }

  async delete(id) {
    const index = this.appointments.findIndex(a => a.id === id);
    if (index === -1) return false;

    this.appointments.splice(index, 1);
    return true;
  }

  async getStatistics(filters = {}) {
    let appointments = [...this.appointments];

    if (filters.patientId) {
      appointments = appointments.filter(a => a.patientId === filters.patientId);
    }

    if (filters.providerId) {
      appointments = appointments.filter(a => a.providerId === filters.providerId);
    }

    const stats = {
      total: appointments.length,
      confirmed: appointments.filter(a => a.status === 'confirmed').length,
      pending: appointments.filter(a => a.status === 'pending').length,
      cancelled: appointments.filter(a => a.status === 'cancelled').length,
      completed: appointments.filter(a => a.status === 'completed').length,
      upcoming: 0,
      past: 0,
      remindersSent: appointments.filter(a => a.reminderSent).length
    };

    const now = new Date();
    appointments.forEach(a => {
      const appointmentDateTime = new Date(`${a.appointmentDate}T${a.appointmentTime}`);
      if (appointmentDateTime >= now) {
        stats.upcoming++;
      } else {
        stats.past++;
      }
    });

    return stats;
  }
}

module.exports = new AppointmentRepository();
