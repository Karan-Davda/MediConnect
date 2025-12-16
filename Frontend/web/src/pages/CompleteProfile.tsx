import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../config/api';
import './CompleteProfile.css';

interface OnboardingData {
  // Step 1: License & Certification
  licenseNumber: string;
  npi: string;
  issuingAuthority: string;
  licenseExpiryDate: string;
  boardCertification: string;
  
  // Step 2: Professional Information
  yearsOfExperience: string;
  medicalSchool: string;
  residency: string;
  languages: string[];
  bio: string;
  
  // Step 3: Practice Information
  officeAddress: string;
  officeCity: string;
  officeState: string;
  officeZip: string;
  officePhone: string;
  officeHours: {
    monday: { open: string; close: string; closed: boolean };
    tuesday: { open: string; close: string; closed: boolean };
    wednesday: { open: string; close: string; closed: boolean };
    thursday: { open: string; close: string; closed: boolean };
    friday: { open: string; close: string; closed: boolean };
    saturday: { open: string; close: string; closed: boolean };
    sunday: { open: string; close: string; closed: boolean };
  };
  insuranceAccepted: string[];
  
  // Step 4: Preferences
  emailNotifications: boolean;
  smsNotifications: boolean;
  preferredContactMethod: 'email' | 'phone' | 'both';
  availabilityReminders: boolean;
}

const LANGUAGE_OPTIONS = [
  'English', 'Spanish', 'French', 'German', 'Mandarin', 'Hindi', 
  'Arabic', 'Portuguese', 'Russian', 'Japanese', 'Korean', 'Other'
];

const INSURANCE_OPTIONS = [
  'Aetna', 'Blue Cross Blue Shield', 'Cigna', 'UnitedHealthcare',
  'Medicare', 'Medicaid', 'Humana', 'Kaiser Permanente', 'Other'
];

const CompleteProfile: React.FC = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
  const [formData, setFormData] = useState<OnboardingData>({
    licenseNumber: '',
    npi: '',
    issuingAuthority: '',
    licenseExpiryDate: '',
    boardCertification: '',
    yearsOfExperience: '',
    medicalSchool: '',
    residency: '',
    languages: [],
    bio: '',
    officeAddress: '',
    officeCity: '',
    officeState: '',
    officeZip: '',
    officePhone: '',
    officeHours: {
      monday: { open: '09:00', close: '17:00', closed: false },
      tuesday: { open: '09:00', close: '17:00', closed: false },
      wednesday: { open: '09:00', close: '17:00', closed: false },
      thursday: { open: '09:00', close: '17:00', closed: false },
      friday: { open: '09:00', close: '17:00', closed: false },
      saturday: { open: '09:00', close: '13:00', closed: false },
      sunday: { open: '', close: '', closed: true },
    },
    insuranceAccepted: [],
    emailNotifications: true,
    smsNotifications: false,
    preferredContactMethod: 'email',
    availabilityReminders: true,
  });

  useEffect(() => {
    // Redirect if not authenticated or not a provider
    if (!user || !token) {
      navigate('/login');
      return;
    }
    
    if (user.role !== 'doctor' && user.role !== 'clinic_admin') {
      navigate('/home');
      return;
    }
  }, [user, token, navigate]);

  const validateStep = (step: number): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (step === 1) {
      if (!formData.licenseNumber.trim()) newErrors.licenseNumber = 'License number is required';
      if (!formData.npi.trim()) newErrors.npi = 'NPI / Provider ID is required';
      if (formData.npi && !/^\d{10}$/.test(formData.npi.replace(/\D/g, ''))) {
        newErrors.npi = 'NPI must be a 10-digit number';
      }
      if (!formData.issuingAuthority.trim()) newErrors.issuingAuthority = 'Issuing authority is required';
      if (!formData.licenseExpiryDate) newErrors.licenseExpiryDate = 'License expiry date is required';
    } else if (step === 2) {
      if (!formData.yearsOfExperience.trim()) newErrors.yearsOfExperience = 'Years of experience is required';
      if (user?.role === 'doctor' && !formData.medicalSchool.trim()) {
        newErrors.medicalSchool = 'Medical school is required';
      }
    } else if (step === 3) {
      if (!formData.officeAddress.trim()) newErrors.officeAddress = 'Office address is required';
      if (!formData.officeCity.trim()) newErrors.officeCity = 'Office city is required';
      if (!formData.officeState.trim()) newErrors.officeState = 'Office state is required';
      if (!formData.officeZip.trim()) newErrors.officeZip = 'Office ZIP code is required';
      if (!formData.officePhone.trim()) newErrors.officePhone = 'Office phone is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < 4) {
        setCurrentStep(currentStep + 1);
      } else {
        handleSubmit();
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setErrors({});
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(4)) return;

    setLoading(true);
    try {
      const response = await fetch(apiUrl('auth/complete-profile'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save profile');
      }

      // Redirect to home after successful completion
      navigate('/home');
    } catch (error: any) {
      console.error('Profile completion error:', error);
      setErrors({ submit: error.message || 'Failed to save profile. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof OnboardingData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleLanguageToggle = (language: string) => {
    setFormData(prev => ({
      ...prev,
      languages: prev.languages.includes(language)
        ? prev.languages.filter(l => l !== language)
        : [...prev.languages, language]
    }));
  };

  const handleInsuranceToggle = (insurance: string) => {
    setFormData(prev => ({
      ...prev,
      insuranceAccepted: prev.insuranceAccepted.includes(insurance)
        ? prev.insuranceAccepted.filter(i => i !== insurance)
        : [...prev.insuranceAccepted, insurance]
    }));
  };

  const handleOfficeHoursChange = (day: string, field: 'open' | 'close' | 'closed', value: any) => {
    setFormData(prev => ({
      ...prev,
      officeHours: {
        ...prev.officeHours,
        [day]: {
          ...(prev.officeHours[day as keyof typeof prev.officeHours]),
          [field]: value
        }
      }
    }));
  };

  if (!user || (user.role !== 'doctor' && user.role !== 'clinic_admin')) {
    return null;
  }

  return (
    <div className="complete-profile-container">
      <div className="complete-profile-card">
        <div className="profile-header">
          <h1>Complete Your Profile</h1>
          <p>Welcome to MediConnect! Let's set up your professional profile.</p>
        </div>

        {/* Progress Indicator */}
        <div className="progress-indicator">
          <div className="progress-line" style={{ width: `${((currentStep - 1) / 3) * 100}%` }}></div>
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={`progress-step ${currentStep >= step ? 'active' : ''} ${currentStep === step ? 'current' : ''}`}
            >
              {step}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="step-content">
          {currentStep === 1 && (
            <div className="step-section">
              <h2>License & Certification Information</h2>
              
              <div className="form-group">
                <label htmlFor="licenseNumber">
                  License Number <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="licenseNumber"
                  className={errors.licenseNumber ? 'error' : ''}
                  value={formData.licenseNumber}
                  onChange={(e) => handleChange('licenseNumber', e.target.value)}
                  placeholder="Enter your medical license number"
                />
                {errors.licenseNumber && <span className="error-message">{errors.licenseNumber}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="npi">
                  NPI / Provider ID <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="npi"
                  className={errors.npi ? 'error' : ''}
                  value={formData.npi}
                  onChange={(e) => handleChange('npi', e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit NPI number"
                  maxLength={10}
                />
                {errors.npi && <span className="error-message">{errors.npi}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="issuingAuthority">
                  Issuing Authority <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="issuingAuthority"
                  className={errors.issuingAuthority ? 'error' : ''}
                  value={formData.issuingAuthority}
                  onChange={(e) => handleChange('issuingAuthority', e.target.value)}
                  placeholder="e.g., State Medical Board"
                />
                {errors.issuingAuthority && <span className="error-message">{errors.issuingAuthority}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="licenseExpiryDate">
                  License Expiry Date <span className="required">*</span>
                </label>
                <input
                  type="date"
                  id="licenseExpiryDate"
                  className={errors.licenseExpiryDate ? 'error' : ''}
                  value={formData.licenseExpiryDate}
                  onChange={(e) => handleChange('licenseExpiryDate', e.target.value)}
                />
                {errors.licenseExpiryDate && <span className="error-message">{errors.licenseExpiryDate}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="boardCertification">Board Certification</label>
                <input
                  type="text"
                  id="boardCertification"
                  value={formData.boardCertification}
                  onChange={(e) => handleChange('boardCertification', e.target.value)}
                  placeholder="e.g., American Board of Internal Medicine"
                />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="step-section">
              <h2>Professional Information</h2>
              
              <div className="form-group">
                <label htmlFor="yearsOfExperience">
                  Years of Experience <span className="required">*</span>
                </label>
                <input
                  type="number"
                  id="yearsOfExperience"
                  className={errors.yearsOfExperience ? 'error' : ''}
                  value={formData.yearsOfExperience}
                  onChange={(e) => handleChange('yearsOfExperience', e.target.value)}
                  placeholder="e.g., 10"
                  min="0"
                  max="50"
                />
                {errors.yearsOfExperience && <span className="error-message">{errors.yearsOfExperience}</span>}
              </div>

              {user.role === 'doctor' && (
                <>
                  <div className="form-group">
                    <label htmlFor="medicalSchool">
                      Medical School <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      id="medicalSchool"
                      className={errors.medicalSchool ? 'error' : ''}
                      value={formData.medicalSchool}
                      onChange={(e) => handleChange('medicalSchool', e.target.value)}
                      placeholder="e.g., Harvard Medical School"
                    />
                    {errors.medicalSchool && <span className="error-message">{errors.medicalSchool}</span>}
                  </div>

                  <div className="form-group">
                    <label htmlFor="residency">Residency / Fellowship</label>
                    <input
                      type="text"
                      id="residency"
                      value={formData.residency}
                      onChange={(e) => handleChange('residency', e.target.value)}
                      placeholder="e.g., Internal Medicine Residency, Johns Hopkins Hospital"
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label>Languages Spoken</label>
                <div className="checkbox-group">
                  {LANGUAGE_OPTIONS.map(lang => (
                    <label key={lang} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.languages.includes(lang)}
                        onChange={() => handleLanguageToggle(lang)}
                      />
                      <span>{lang}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="bio">Professional Bio</label>
                <textarea
                  id="bio"
                  rows={4}
                  value={formData.bio}
                  onChange={(e) => handleChange('bio', e.target.value)}
                  placeholder="Tell us about your professional background and expertise..."
                />
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="step-section">
              <h2>Practice Information</h2>
              
              <div className="form-group">
                <label htmlFor="officeAddress">
                  Office Address <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="officeAddress"
                  className={errors.officeAddress ? 'error' : ''}
                  value={formData.officeAddress}
                  onChange={(e) => handleChange('officeAddress', e.target.value)}
                  placeholder="Street address"
                />
                {errors.officeAddress && <span className="error-message">{errors.officeAddress}</span>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="officeCity">
                    City <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="officeCity"
                    className={errors.officeCity ? 'error' : ''}
                    value={formData.officeCity}
                    onChange={(e) => handleChange('officeCity', e.target.value)}
                  />
                  {errors.officeCity && <span className="error-message">{errors.officeCity}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="officeState">
                    State <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="officeState"
                    className={errors.officeState ? 'error' : ''}
                    value={formData.officeState}
                    onChange={(e) => handleChange('officeState', e.target.value)}
                  />
                  {errors.officeState && <span className="error-message">{errors.officeState}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="officeZip">
                    ZIP Code <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="officeZip"
                    className={errors.officeZip ? 'error' : ''}
                    value={formData.officeZip}
                    onChange={(e) => handleChange('officeZip', e.target.value)}
                    maxLength={10}
                  />
                  {errors.officeZip && <span className="error-message">{errors.officeZip}</span>}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="officePhone">
                  Office Phone <span className="required">*</span>
                </label>
                <input
                  type="tel"
                  id="officePhone"
                  className={errors.officePhone ? 'error' : ''}
                  value={formData.officePhone}
                  onChange={(e) => handleChange('officePhone', e.target.value)}
                  placeholder="(555) 123-4567"
                />
                {errors.officePhone && <span className="error-message">{errors.officePhone}</span>}
              </div>

              <div className="form-group">
                <label>Office Hours</label>
                <div className="office-hours">
                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                    <div key={day} className="office-hours-row">
                      <label className="day-label">
                        <input
                          type="checkbox"
                          checked={!formData.officeHours[day as keyof typeof formData.officeHours].closed}
                          onChange={(e) => handleOfficeHoursChange(day, 'closed', !e.target.checked)}
                        />
                        <span>{day.charAt(0).toUpperCase() + day.slice(1)}</span>
                      </label>
                      {!formData.officeHours[day as keyof typeof formData.officeHours].closed && (
                        <>
                          <input
                            type="time"
                            value={formData.officeHours[day as keyof typeof formData.officeHours].open}
                            onChange={(e) => handleOfficeHoursChange(day, 'open', e.target.value)}
                          />
                          <span>to</span>
                          <input
                            type="time"
                            value={formData.officeHours[day as keyof typeof formData.officeHours].close}
                            onChange={(e) => handleOfficeHoursChange(day, 'close', e.target.value)}
                          />
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Insurance Accepted</label>
                <div className="checkbox-group">
                  {INSURANCE_OPTIONS.map(insurance => (
                    <label key={insurance} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.insuranceAccepted.includes(insurance)}
                        onChange={() => handleInsuranceToggle(insurance)}
                      />
                      <span>{insurance}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="step-section">
              <h2>Preferences & Settings</h2>
              
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.emailNotifications}
                    onChange={(e) => handleChange('emailNotifications', e.target.checked)}
                  />
                  <span>Enable Email Notifications</span>
                </label>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.smsNotifications}
                    onChange={(e) => handleChange('smsNotifications', e.target.checked)}
                  />
                  <span>Enable SMS Notifications</span>
                </label>
              </div>

              <div className="form-group">
                <label htmlFor="preferredContactMethod">Preferred Contact Method</label>
                <select
                  id="preferredContactMethod"
                  value={formData.preferredContactMethod}
                  onChange={(e) => handleChange('preferredContactMethod', e.target.value)}
                >
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="both">Both</option>
                </select>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.availabilityReminders}
                    onChange={(e) => handleChange('availabilityReminders', e.target.checked)}
                  />
                  <span>Send Availability Reminders</span>
                </label>
              </div>
            </div>
          )}

          {errors.submit && (
            <div className="error-message" style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#fed7d7', color: '#742a2a', borderRadius: '8px' }}>
              {errors.submit}
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="step-navigation">
          {currentStep > 1 && (
            <button type="button" className="btn-secondary" onClick={handleBack} disabled={loading}>
              Back
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            onClick={handleNext}
            disabled={loading}
          >
            {loading ? 'Saving...' : currentStep === 4 ? 'Complete Profile' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompleteProfile;

