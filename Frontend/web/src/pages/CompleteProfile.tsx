import React, { useState, useEffect, useRef } from 'react';
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
  'Arabic', 'Portuguese', 'Russian', 'Japanese', 'Korean', 'Italian',
  'Dutch', 'Polish', 'Turkish', 'Vietnamese', 'Thai', 'Greek',
  'Hebrew', 'Swedish', 'Norwegian', 'Danish', 'Finnish', 'Czech',
  'Romanian', 'Hungarian', 'Bulgarian', 'Croatian', 'Serbian', 'Other'
];

const INSURANCE_OPTIONS = [
  'Aetna', 'Blue Cross Blue Shield', 'Cigna', 'UnitedHealthcare',
  'Medicare', 'Medicaid', 'Humana', 'Kaiser Permanente', 'Other'
];

const CompleteProfile: React.FC = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  
  // Clinic admins skip Step 1 (License & Certification), start at Step 2
  const isClinicAdmin = user?.role === 'clinic_admin';
  const startStep = isClinicAdmin ? 2 : 1;
  const totalSteps = isClinicAdmin ? 3 : 4;
  
  const [currentStep, setCurrentStep] = useState(startStep);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [languageInput, setLanguageInput] = useState('');
  const [languageSuggestions, setLanguageSuggestions] = useState<string[]>([]);
  const [showLanguageSuggestions, setShowLanguageSuggestions] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  
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

    // Step 1: License & Certification (only for doctors)
    if (step === 1 && !isClinicAdmin) {
      if (!formData.licenseNumber.trim()) newErrors.licenseNumber = 'License number is required';
      if (!formData.npi.trim()) newErrors.npi = 'NPI / Provider ID is required';
      if (formData.npi && !/^\d{10}$/.test(formData.npi.replace(/\D/g, ''))) {
        newErrors.npi = 'NPI must be a 10-digit number';
      }
      if (!formData.issuingAuthority.trim()) newErrors.issuingAuthority = 'Issuing authority is required';
      if (!formData.licenseExpiryDate) newErrors.licenseExpiryDate = 'License expiry date is required';
    } 
    // Step 2: Professional Information (Step 1 for clinic admins)
    else if (step === 2) {
      if (!formData.yearsOfExperience.trim()) newErrors.yearsOfExperience = 'Years of experience is required';
      if (user?.role === 'doctor' && !formData.medicalSchool.trim()) {
        newErrors.medicalSchool = 'Medical school is required';
      }
    } 
    // Step 3: Practice Information (Step 2 for clinic admins)
    else if (step === 3) {
      if (!formData.officeAddress.trim()) newErrors.officeAddress = 'Office address is required';
      if (!formData.officeCity.trim()) newErrors.officeCity = 'Office city is required';
      if (!formData.officeState.trim()) newErrors.officeState = 'Office state is required';
      if (!formData.officeZip.trim()) newErrors.officeZip = 'Office ZIP code is required';
      if (!formData.officePhone.trim()) newErrors.officePhone = 'Office phone is required';
    }
    // Step 4: Preferences (Step 3 for clinic admins) - no validation needed

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      const lastStep = isClinicAdmin ? 4 : 4; // Both end at step 4
      if (currentStep < lastStep) {
        setCurrentStep(currentStep + 1);
      } else {
        handleSubmit();
      }
    }
  };

  const handleBack = () => {
    if (currentStep > startStep) {
      setCurrentStep(currentStep - 1);
      setErrors({});
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(4)) return;

    setLoading(true);
    setErrors({});
    try {
      const url = apiUrl('auth/complete-profile');
      console.log('Submitting profile to:', url);
      console.log('Token available:', !!token);
      console.log('Form data:', formData);
      
      if (!token) {
        setErrors({ submit: 'Authentication token is missing. Please log in again.' });
        setLoading(false);
        return;
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let errorData;
        try {
          const text = await response.text();
          console.log('Error response text:', text);
          errorData = JSON.parse(text);
        } catch (e) {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        console.error('Error response:', errorData);
        setErrors({ submit: errorData.error || `Failed to complete profile (${response.status})` });
        setLoading(false);
        return;
      }

      const data = await response.json();
      console.log('Profile completed successfully:', data);
      
      // Redirect to home
      navigate('/home');
    } catch (error: any) {
      console.error('Profile submission error:', error);
      setErrors({ submit: error.message || 'Network error. Please check your connection and try again.' });
      setLoading(false);
    }
  };

  const handleChange = (field: keyof OnboardingData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleLanguageInputChange = (value: string) => {
    setLanguageInput(value);
    if (value.length >= 1) {
      const filtered = LANGUAGE_OPTIONS.filter(lang =>
        lang.toLowerCase().startsWith(value.toLowerCase()) &&
        !formData.languages.includes(lang)
      );
      setLanguageSuggestions(filtered);
      setShowLanguageSuggestions(filtered.length > 0);
    } else {
      setLanguageSuggestions([]);
      setShowLanguageSuggestions(false);
    }
  };

  const handleLanguageSelect = (language: string) => {
    if (!formData.languages.includes(language)) {
      setFormData(prev => ({
        ...prev,
        languages: [...prev.languages, language]
      }));
    }
    setLanguageInput('');
    setShowLanguageSuggestions(false);
  };

  const handleLanguageRemove = (language: string) => {
    setFormData(prev => ({
      ...prev,
      languages: prev.languages.filter(l => l !== language)
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
          <div className="progress-line" style={{ width: `${((currentStep - startStep) / (totalSteps - 1)) * 100}%` }}></div>
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((displayStep) => {
            // Map display step to actual step number
            const actualStep = isClinicAdmin ? displayStep + 1 : displayStep;
            return (
              <div
                key={displayStep}
                className={`progress-step ${currentStep >= actualStep ? 'active' : ''} ${currentStep === actualStep ? 'current' : ''}`}
              >
                {displayStep}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="step-content">
          {currentStep === 1 && !isClinicAdmin && (
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
                <div className="date-input-wrapper">
                  <input
                    ref={dateInputRef}
                    type="date"
                    id="licenseExpiryDate"
                    className={`date-input ${errors.licenseExpiryDate ? 'error' : ''}`}
                    value={formData.licenseExpiryDate}
                    onChange={(e) => handleChange('licenseExpiryDate', e.target.value)}
                    onClick={(e) => {
                      // Only open picker if clicking on the input itself (not when pasting)
                      // Check if this is a click event (not paste)
                      if (e.type === 'click') {
                        const input = e.currentTarget;
                        // Try to open the picker
                        if (input.showPicker && typeof input.showPicker === 'function') {
                          try {
                            input.showPicker();
                          } catch (err) {
                            // If showPicker fails, just focus (which should open picker in most browsers)
                            input.focus();
                          }
                        } else {
                          // Fallback: focus the input which should trigger the picker
                          input.focus();
                        }
                      }
                    }}
                    onFocus={(e) => {
                      // Open date picker on focus (but allow pasting first)
                      const input = e.currentTarget;
                      // Small delay to allow paste to complete
                      setTimeout(() => {
                        if (input.showPicker && typeof input.showPicker === 'function') {
                          try {
                            input.showPicker();
                          } catch (err) {
                            // Ignore if showPicker fails
                          }
                        }
                      }, 100);
                    }}
                    onPaste={(e) => {
                      // Don't prevent default - allow normal paste, then parse
                      const pastedText = e.clipboardData.getData('text');
                      
                      // Small delay to let the paste happen, then parse and format
                      setTimeout(() => {
                        // Try to parse common date formats
                        const dateFormats = [
                          /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
                          /(\d{2})\/(\d{2})\/(\d{4})/, // MM/DD/YYYY
                          /(\d{2})-(\d{2})-(\d{4})/, // MM-DD-YYYY
                          /(\d{4})\/(\d{2})\/(\d{2})/, // YYYY/MM/DD
                        ];
                        
                        for (const format of dateFormats) {
                          const match = pastedText.match(format);
                          if (match) {
                            let year, month, day;
                            if (format === dateFormats[0] || format === dateFormats[3]) {
                              // YYYY-MM-DD or YYYY/MM/DD
                              year = match[1];
                              month = match[2];
                              day = match[3];
                            } else {
                              // MM/DD/YYYY or MM-DD-YYYY
                              month = match[1];
                              day = match[2];
                              year = match[3];
                            }
                            const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                            handleChange('licenseExpiryDate', formattedDate);
                            return;
                          }
                        }
                        // If no format matches, try to use the text as-is if it looks like a date
                        if (pastedText.length >= 8 && /^\d/.test(pastedText)) {
                          handleChange('licenseExpiryDate', pastedText);
                        }
                      }, 10);
                    }}
                  />
                </div>
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
                <div className="language-input-container">
                  {/* Selected languages as chips */}
                  {formData.languages.length > 0 && (
                    <div className="language-chips">
                      {formData.languages.map(lang => (
                        <span key={lang} className="language-chip">
                          {lang}
                          <button
                            type="button"
                            className="chip-remove"
                            onClick={() => handleLanguageRemove(lang)}
                            aria-label={`Remove ${lang}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Language input with autocomplete */}
                  <div className="language-input-wrapper">
                    <input
                      type="text"
                      className="language-input"
                      placeholder="Type to search languages (e.g., Eng, Spa, Fre)..."
                      value={languageInput}
                      onChange={(e) => handleLanguageInputChange(e.target.value)}
                      onFocus={() => {
                        if (languageInput.length >= 1) {
                          setShowLanguageSuggestions(true);
                        }
                      }}
                      onBlur={() => {
                        // Delay to allow click on suggestion
                        setTimeout(() => setShowLanguageSuggestions(false), 200);
                      }}
                    />
                    {showLanguageSuggestions && languageSuggestions.length > 0 && (
                      <div className="language-suggestions">
                        {languageSuggestions.map(lang => (
                          <div
                            key={lang}
                            className="language-suggestion-item"
                            onMouseDown={(e) => {
                              e.preventDefault(); // Prevent input blur
                              handleLanguageSelect(lang);
                            }}
                          >
                            {lang}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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
                <div className="office-hours-modern">
                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                    <div key={day} className="office-hours-row-modern">
                      <div className="day-toggle-container">
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={!formData.officeHours[day as keyof typeof formData.officeHours].closed}
                            onChange={(e) => handleOfficeHoursChange(day, 'closed', !e.target.checked)}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                        <span className="day-name">{day.charAt(0).toUpperCase() + day.slice(1)}</span>
                      </div>
                      {!formData.officeHours[day as keyof typeof formData.officeHours].closed && (
                        <div className="time-inputs">
                          <input
                            type="time"
                            className="time-input"
                            value={formData.officeHours[day as keyof typeof formData.officeHours].open}
                            onChange={(e) => handleOfficeHoursChange(day, 'open', e.target.value)}
                          />
                          <span className="time-separator">to</span>
                          <input
                            type="time"
                            className="time-input"
                            value={formData.officeHours[day as keyof typeof formData.officeHours].close}
                            onChange={(e) => handleOfficeHoursChange(day, 'close', e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Insurance Accepted</label>
                <div className="insurance-grid">
                  {INSURANCE_OPTIONS.map(insurance => (
                    <label key={insurance} className="insurance-checkbox-card">
                      <input
                        type="checkbox"
                        checked={formData.insuranceAccepted.includes(insurance)}
                        onChange={() => handleInsuranceToggle(insurance)}
                      />
                      <div className="checkbox-card-content">
                        <span className="checkbox-icon">
                          {formData.insuranceAccepted.includes(insurance) ? '✓' : ''}
                        </span>
                        <span className="checkbox-label-text">{insurance}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="step-section">
              <h2>Preferences & Settings</h2>
              
              <div className="preferences-container">
                <div className="preference-item">
                  <div className="preference-info">
                    <h3>Email Notifications</h3>
                    <p>Receive notifications via email</p>
                  </div>
                  <label className="toggle-switch-large">
                    <input
                      type="checkbox"
                      checked={formData.emailNotifications}
                      onChange={(e) => handleChange('emailNotifications', e.target.checked)}
                    />
                    <span className="toggle-slider-large"></span>
                  </label>
                </div>

                <div className="preference-item">
                  <div className="preference-info">
                    <h3>SMS Notifications</h3>
                    <p>Receive notifications via text message</p>
                  </div>
                  <label className="toggle-switch-large">
                    <input
                      type="checkbox"
                      checked={formData.smsNotifications}
                      onChange={(e) => handleChange('smsNotifications', e.target.checked)}
                    />
                    <span className="toggle-slider-large"></span>
                  </label>
                </div>

                <div className="form-group">
                  <label htmlFor="preferredContactMethod">Preferred Contact Method</label>
                  <select
                    id="preferredContactMethod"
                    className="modern-select"
                    value={formData.preferredContactMethod}
                    onChange={(e) => handleChange('preferredContactMethod', e.target.value)}
                  >
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="both">Both</option>
                  </select>
                </div>

                <div className="preference-item">
                  <div className="preference-info">
                    <h3>Availability Reminders</h3>
                    <p>Get reminders about your availability schedule</p>
                  </div>
                  <label className="toggle-switch-large">
                    <input
                      type="checkbox"
                      checked={formData.availabilityReminders}
                      onChange={(e) => handleChange('availabilityReminders', e.target.checked)}
                    />
                    <span className="toggle-slider-large"></span>
                  </label>
                </div>
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
          {currentStep > startStep && (
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

