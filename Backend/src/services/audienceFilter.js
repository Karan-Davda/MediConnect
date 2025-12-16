const Patient = require('../models/Patient');

class AudienceFilterService {
  constructor(patientRepository) {
    this.patientRepository = patientRepository;
  }

  async filterPatients(targetAudience) {
    // Handle both instance methods (old) and static methods (new)
    let patients;
    if (typeof this.patientRepository.getAll === 'function') {
      patients = await this.patientRepository.getAll();
    } else {
      // Fallback for old in-memory repository
      patients = this.patientRepository.getAll();
    }

    if (targetAudience.ageRange) {
      patients = this.filterByAge(patients, targetAudience.ageRange);
    }

    if (targetAudience.genders && targetAudience.genders.length > 0) {
      patients = this.filterByGender(patients, targetAudience.genders);
    }

    if (targetAudience.locations && targetAudience.locations.length > 0) {
      patients = this.filterByLocation(patients, targetAudience.locations);
    }

    if (targetAudience.insuranceTypes && targetAudience.insuranceTypes.length > 0) {
      patients = this.filterByInsurance(patients, targetAudience.insuranceTypes);
    }

    if (targetAudience.medicalConditions && targetAudience.medicalConditions.length > 0) {
      patients = this.filterByMedicalConditions(patients, targetAudience.medicalConditions);
    }

    if (targetAudience.lastVisitRange) {
      patients = this.filterByLastVisit(patients, targetAudience.lastVisitRange);
    }

    return patients;
  }

  filterByAge(patients, ageRange) {
    return patients.filter(patient => {
      const age = this.calculateAge(patient.dateOfBirth);
      const meetsMin = !ageRange.min || age >= ageRange.min;
      const meetsMax = !ageRange.max || age <= ageRange.max;
      return meetsMin && meetsMax;
    });
  }

  filterByGender(patients, genders) {
    const normalizedGenders = genders.map(g => g.toLowerCase());
    return patients.filter(patient =>
      normalizedGenders.includes(patient.gender?.toLowerCase())
    );
  }

  filterByLocation(patients, locations) {
    if (locations.includes('All')) {
      return patients;
    }
    return patients.filter(patient => {
      if (!patient.address) return false;
      const patientLocation = this.extractLocation(patient.address);
      return locations.some(loc =>
        patientLocation.toLowerCase().includes(loc.toLowerCase())
      );
    });
  }

  filterByInsurance(patients, insuranceTypes) {
    if (insuranceTypes.includes('All')) {
      return patients;
    }
    return patients.filter(patient => {
      if (!patient.insuranceInfo) return false;
      const insuranceProvider = patient.insuranceInfo.provider || '';
      return insuranceTypes.some(type =>
        insuranceProvider.toLowerCase().includes(type.toLowerCase())
      );
    });
  }

  filterByMedicalConditions(patients, conditions) {
    return patients.filter(patient => {
      if (!patient.medicalHistory || patient.medicalHistory.length === 0) {
        return false;
      }
      const patientConditions = patient.medicalHistory.map(h =>
        h.condition?.toLowerCase() || ''
      );
      return conditions.some(condition =>
        patientConditions.some(pc => pc.includes(condition.toLowerCase()))
      );
    });
  }

  filterByLastVisit(patients, lastVisitRange) {
    return patients.filter(patient => {
      if (!patient.lastVisitDate) return false;

      const lastVisit = new Date(patient.lastVisitDate);
      const from = lastVisitRange.from ? new Date(lastVisitRange.from) : null;
      const to = lastVisitRange.to ? new Date(lastVisitRange.to) : null;

      const meetsFrom = !from || lastVisit >= from;
      const meetsTo = !to || lastVisit <= to;

      return meetsFrom && meetsTo;
    });
  }

  calculateAge(dateOfBirth) {
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }

    return age;
  }

  extractLocation(address) {
    if (typeof address === 'string') {
      return address;
    }
    if (typeof address === 'object') {
      return `${address.city || ''} ${address.state || ''} ${address.zipCode || ''}`.trim();
    }
    return '';
  }

  async getEstimatedReach(targetAudience) {
    const filtered = await this.filterPatients(targetAudience);
    return filtered.length;
  }

  async previewAudience(targetAudience, limit = 10) {
    const filtered = await this.filterPatients(targetAudience);
    return {
      count: filtered.length
    };
  }
}

module.exports = AudienceFilterService;
