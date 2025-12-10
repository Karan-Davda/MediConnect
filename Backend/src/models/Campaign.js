class Campaign {
  constructor({
    id,
    name,
    objective,
    channels = [],
    targetAudience = {},
    startDate,
    endDate,
    status = 'DRAFT',
    subject,
    body,
    estimatedReach = 0,
    actualReach = 0,
    createdBy,
    createdAt,
    updatedAt
  }) {
    this.id = id;
    this.name = name;
    this.objective = objective;
    this.channels = channels;
    this.targetAudience = targetAudience;
    this.startDate = startDate;
    this.endDate = endDate;
    this.status = status;
    this.subject = subject;
    this.body = body;
    this.estimatedReach = estimatedReach;
    this.actualReach = actualReach;
    this.createdBy = createdBy;
    this.createdAt = createdAt || new Date();
    this.updatedAt = updatedAt || new Date();
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      objective: this.objective,
      channels: this.channels,
      targetAudience: this.targetAudience,
      startDate: this.startDate,
      endDate: this.endDate,
      status: this.status,
      subject: this.subject,
      body: this.body,
      estimatedReach: this.estimatedReach,
      actualReach: this.actualReach,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  validate() {
    const errors = [];

    if (!this.name || this.name.trim() === '') {
      errors.push('Campaign name is required');
    }

    if (!this.objective || this.objective.trim() === '') {
      errors.push('Objective is required');
    }

    if (!this.channels || this.channels.length === 0) {
      errors.push('At least one channel is required');
    }

    if (!this.startDate) {
      errors.push('Start date is required');
    }

    if (this.endDate && new Date(this.endDate) < new Date(this.startDate)) {
      errors.push('End date cannot be before start date');
    }

    if (!this.subject || this.subject.trim() === '') {
      errors.push('Subject is required');
    }

    if (!this.body || this.body.trim() === '') {
      errors.push('Message body is required');
    }

    if (this.channels.includes('SMS') && this.body.length > 320) {
      errors.push('SMS message body must be under 320 characters');
    }

    if (!this.targetAudience || Object.keys(this.targetAudience).length === 0) {
      errors.push('Target audience criteria is required');
    }

    if (this.targetAudience && this.targetAudience.ageRange) {
      const { min, max } = this.targetAudience.ageRange;

      if (min !== undefined && min !== null && min < 0) {
        errors.push('Minimum age cannot be negative');
      }

      if (max !== undefined && max !== null && max < 0) {
        errors.push('Maximum age cannot be negative');
      }

      if (min !== undefined && min !== null && min > 120) {
        errors.push('Minimum age cannot exceed 120');
      }

      if (max !== undefined && max !== null && max > 120) {
        errors.push('Maximum age cannot exceed 120');
      }

      if (min !== undefined && min !== null && max !== undefined && max !== null && min > max) {
        errors.push('Minimum age cannot be greater than maximum age');
      }
    }

    return errors;
  }

  isSchedulable() {
    return this.validate().length === 0;
  }
}

module.exports = Campaign;
