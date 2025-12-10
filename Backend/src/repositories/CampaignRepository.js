const Campaign = require('../models/Campaign');

class CampaignRepository {
  constructor() {
    this.campaigns = [];
    this.campaignCounter = 1;
    this.initializeMockData();
  }

  initializeMockData() {
    this.campaigns = [
      new Campaign({
        id: 'cmp-001',
        name: 'Annual Checkup Reminder',
        objective: 'Encourage overdue patients to schedule annual visits',
        channels: ['EMAIL'],
        targetAudience: {
          lastVisitRange: {
            from: null,
            to: '2024-01-01'
          }
        },
        startDate: '2025-11-01T09:00',
        endDate: '2025-11-15T23:59',
        status: 'ACTIVE',
        subject: "It's time for your annual checkup",
        body: 'Hi there, this is a reminder from MediConnect to schedule your annual preventive visit.',
        estimatedReach: 2,
        actualReach: 0,
        createdBy: 'marketing_admin@clinic.com',
        createdAt: new Date('2025-10-20T10:30'),
        updatedAt: new Date('2025-10-20T10:30')
      }),
      new Campaign({
        id: 'cmp-002',
        name: 'Flu Shot Campaign',
        objective: 'Promote flu vaccinations',
        channels: ['EMAIL', 'IN_APP'],
        targetAudience: {
          ageRange: {
            min: 18,
            max: null
          }
        },
        startDate: '2025-10-01T09:00',
        endDate: '2025-12-31T23:59',
        status: 'PAUSED',
        subject: 'Protect yourself this flu season',
        body: 'Flu vaccines are now available. Book a quick visit in MediConnect.',
        estimatedReach: 5,
        actualReach: 0,
        createdBy: 'marketing_admin@clinic.com',
        createdAt: new Date('2025-09-15T14:05'),
        updatedAt: new Date('2025-09-15T14:05')
      })
    ];
  }

  getAll() {
    return this.campaigns.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getById(id) {
    return this.campaigns.find(c => c.id === id);
  }

  create(campaignData) {
    const id = `cmp-${Math.random().toString(36).slice(2, 8)}`;
    const campaign = new Campaign({ ...campaignData, id });
    this.campaigns.push(campaign);
    return campaign;
  }

  update(id, updates) {
    const index = this.campaigns.findIndex(c => c.id === id);
    if (index === -1) return null;

    this.campaigns[index] = new Campaign({
      ...this.campaigns[index],
      ...updates,
      id,
      updatedAt: new Date()
    });

    return this.campaigns[index];
  }

  delete(id) {
    const index = this.campaigns.findIndex(c => c.id === id);
    if (index === -1) return false;

    this.campaigns.splice(index, 1);
    return true;
  }

  getByStatus(status) {
    return this.campaigns.filter(c => c.status === status);
  }

  getByCreator(email) {
    return this.campaigns.filter(c => c.createdBy === email);
  }
}

module.exports = CampaignRepository;
