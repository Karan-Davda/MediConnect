import React, { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import type { PatientStep1Data } from './PatientRegisterStep1';
import './PatientRegister.css';

interface PatientStep2Data {
  countryCode: string;
  phone: string;
  dob: string;
  country: string;
  state: string;
  city: string;
}

const COUNTRY_CODES = [
  { code: '+1', country: 'US', name: 'United States', maxDigits: 10 },
  { code: '+91', country: 'IN', name: 'India', maxDigits: 10 },
  { code: '+44', country: 'GB', name: 'United Kingdom', maxDigits: 10 },
  { code: '+61', country: 'AU', name: 'Australia', maxDigits: 9 },
  { code: '+86', country: 'CN', name: 'China', maxDigits: 11 },
];

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
  'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
  'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
  'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
  'New Hampshire', 'New Jersey', 'New Mexico', 'New York',
  'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon',
  'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
  'West Virginia', 'Wisconsin', 'Wyoming'
];

const US_CITIES_BY_STATE: Record<string, string[]> = {
  'California': ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento', 'Fresno', 'Oakland'],
  'New York': ['New York City', 'Buffalo', 'Rochester', 'Yonkers', 'Syracuse', 'Albany'],
  'Texas': ['Houston', 'San Antonio', 'Dallas', 'Austin', 'Fort Worth', 'El Paso', 'Arlington'],
  'Florida': ['Jacksonville', 'Miami', 'Tampa', 'Orlando', 'St. Petersburg', 'Tallahassee'],
  'Illinois': ['Chicago', 'Aurora', 'Naperville', 'Joliet', 'Rockford', 'Springfield'],
  'Pennsylvania': ['Philadelphia', 'Pittsburgh', 'Allentown', 'Erie', 'Reading', 'Scranton'],
  'Ohio': ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron', 'Dayton'],
  'Georgia': ['Atlanta', 'Augusta', 'Columbus', 'Savannah', 'Athens', 'Macon'],
  'North Carolina': ['Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem', 'Fayetteville'],
  'Michigan': ['Detroit', 'Grand Rapids', 'Warren', 'Sterling Heights', 'Ann Arbor', 'Lansing'],
};

const PatientRegisterStep2: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<PatientStep2Data>({
    countryCode: '+1',
    phone: '',
    dob: '',
    country: 'United States',
    state: '',
    city: '',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string>('');

  useEffect(() => {
    const step1Data = localStorage.getItem('patientStep1Data');
    if (!step1Data) {
      navigate('/register/patient/step1');
    }
  }, [navigate]);

  useEffect(() => {
    if (formData.state && US_CITIES_BY_STATE[formData.state]) {
      setAvailableCities(US_CITIES_BY_STATE[formData.state]);
      setFormData(prev => ({ ...prev, city: '' }));
    } else {
      setAvailableCities([]);
    }
  }, [formData.state]);

  const validatePhone = (phone: string, countryCode: string): boolean => {
    const country = COUNTRY_CODES.find(c => c.code === countryCode);
    if (!country) return false;

    const digits = phone.replace(/\D/g, '');
    return digits.length === country.maxDigits;
  };

  const validateDOB = (dateStr: string): boolean => {
    if (!dateStr) return false;

    const parts = dateStr.split('-');
    if (parts.length !== 3) return false;

    const year = parseInt(parts[0]);
    if (year.toString().length !== 4) return false;
    if (year < 1900 || year > new Date().getFullYear()) return false;

    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(date.getTime())) return false;
    if (date >= today) return false;

    const age = today.getFullYear() - date.getFullYear();
    if (age < 0 || age > 120) return false;

    return true;
  };

  const validateCity = (city: string): boolean => {
    if (!city || city.length < 2 || city.length > 85) return false;

    // Allow letters, spaces, hyphens, apostrophes, and diacritics
    // Reject numeric-only and symbol-only values
    const cityRegex = /^[a-zA-ZÀ-ÿ\s'\-]+$/;
    if (!cityRegex.test(city)) return false;

    // Reject if only numbers
    if (/^\d+$/.test(city)) return false;

    // Reject if only symbols
    if (/^[^a-zA-ZÀ-ÿ0-9]+$/.test(city)) return false;

    return true;
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!validatePhone(formData.phone, formData.countryCode)) {
      const country = COUNTRY_CODES.find(c => c.code === formData.countryCode);
      newErrors.phone = `Please enter a valid ${country?.name} phone number (${country?.maxDigits} digits)`;
    }

    if (!formData.dob) {
      newErrors.dob = 'Date of birth is required';
    } else if (!validateDOB(formData.dob)) {
      newErrors.dob = 'Please enter a valid date of birth';
    }

    if (!formData.country.trim()) {
      newErrors.country = 'Country is required';
    }

    if (!formData.state.trim()) {
      newErrors.state = 'State is required';
    }

    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
    } else if (!validateCity(formData.city)) {
      newErrors.city = 'City must be 2-85 characters, contain letters, and cannot be numbers or symbols only';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const step1DataStr = localStorage.getItem('patientStep1Data');
    if (!step1DataStr) {
      navigate('/register/patient/step1');
      return;
    }

    const step1Data: PatientStep1Data = JSON.parse(step1DataStr);

    setLoading(true);
    setErrors({});
    setSuccessMessage('');

    try {
      const payload = {
        role: 'patient',
        auth: {
          email: step1Data.email,
          password: step1Data.password,
        },
        profile: {
          full_name: step1Data.fullName,
          phone: formData.countryCode + formData.phone.trim(),
          dob: formData.dob,
          country: formData.country.trim(),
          state: formData.state.trim(),
          city: formData.city.trim(),
        },
      };

      const response = await fetch('http://localhost:3001/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Registration failed');
      }

      const data = await response.json();
      console.log('Registration successful:', data);

      setSuccessMessage('Registration successful! Redirecting to login...');
      localStorage.removeItem('patientStep1Data');

      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error: any) {
      console.error('Registration error:', error);
      setErrors({ submit: error.message || 'Registration failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof PatientStep2Data, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, '');
    const country = COUNTRY_CODES.find(c => c.code === formData.countryCode);
    if (country && digits.length <= country.maxDigits) {
      handleChange('phone', digits);
    }
  };

  const maxDate = new Date().toISOString().split('T')[0];
  const minDate = new Date(1900, 0, 1).toISOString().split('T')[0];

  return (
    <div className="auth-container has-registration">
      <div className="auth-card">
        <div className="auth-left">
          <div className="logo-section">
            <h1>MediConnect</h1>
            <p>Clinic Appointment & Billing System</p>
          </div>
        </div>

        <div className="auth-right">
          <div className="auth-form-container">
            <h2>Patient Registration</h2>
            <p className="step-info">Step 2 of 2 - Personal Details</p>

            {successMessage && (
              <div style={{ padding: '12px', backgroundColor: '#c6f6d5', color: '#22543d', borderRadius: '8px', marginBottom: '1rem' }}>
                {successMessage}
              </div>
            )}

            {errors.submit && (
              <div style={{ padding: '12px', backgroundColor: '#fed7d7', color: '#742a2a', borderRadius: '8px', marginBottom: '1rem' }}>
                {errors.submit}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label htmlFor="phone">Phone Number</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select
                    value={formData.countryCode}
                    onChange={(e) => {
                      handleChange('countryCode', e.target.value);
                      handleChange('phone', '');
                    }}
                    style={{ width: '100px' }}
                    className="form-input"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    id="phone"
                    className={`form-input ${errors.phone ? 'error' : ''}`}
                    value={formData.phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder={`${COUNTRY_CODES.find(c => c.code === formData.countryCode)?.maxDigits} digits`}
                    required
                    style={{ flex: 1 }}
                  />
                </div>
                {errors.phone && <span className="error-message">{errors.phone}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="dob">Date of Birth</label>
                <input
                  type="date"
                  id="dob"
                  className={`form-input ${errors.dob ? 'error' : ''}`}
                  value={formData.dob}
                  onChange={(e) => handleChange('dob', e.target.value)}
                  max={maxDate}
                  min={minDate}
                  required
                />
                {errors.dob && <span className="error-message">{errors.dob}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="country">Country</label>
                <select
                  id="country"
                  className={`form-input ${errors.country ? 'error' : ''}`}
                  value={formData.country}
                  onChange={(e) => {
                    handleChange('country', e.target.value);
                    handleChange('state', '');
                    handleChange('city', '');
                  }}
                  required
                >
                  <option value="United States">United States</option>
                  <option value="India">India</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Australia">Australia</option>
                  <option value="China">China</option>
                </select>
                {errors.country && <span className="error-message">{errors.country}</span>}
              </div>

              {formData.country === 'United States' && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="state">State</label>
                      <select
                        id="state"
                        className={`form-input ${errors.state ? 'error' : ''}`}
                        value={formData.state}
                        onChange={(e) => handleChange('state', e.target.value)}
                        required
                      >
                        <option value="">Select State</option>
                        {US_STATES.map((state) => (
                          <option key={state} value={state}>
                            {state}
                          </option>
                        ))}
                      </select>
                      {errors.state && <span className="error-message">{errors.state}</span>}
                    </div>

                    <div className="form-group">
                      <label htmlFor="city">City</label>
                      {availableCities.length > 0 ? (
                        <select
                          id="city"
                          className={`form-input ${errors.city ? 'error' : ''}`}
                          value={formData.city}
                          onChange={(e) => handleChange('city', e.target.value)}
                          required
                        >
                          <option value="">Select City</option>
                          {availableCities.map((city) => (
                            <option key={city} value={city}>
                              {city}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <>
                          <input
                            type="text"
                            id="city"
                            className={`form-input ${errors.city ? 'error' : ''}`}
                            value={formData.city}
                            onChange={(e) => handleChange('city', e.target.value)}
                            placeholder="e.g., Los Angeles, São Paulo, Łódź"
                            required
                          />
                          <small style={{ display: 'block', marginTop: '4px', color: '#718096', fontSize: '0.85rem' }}>
                            2-85 characters, letters only (diacritics allowed)
                          </small>
                        </>
                      )}
                      {errors.city && <span className="error-message">{errors.city}</span>}
                    </div>
                  </div>
                </>
              )}

              {formData.country !== 'United States' && (
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="state">State/Province</label>
                    <input
                      type="text"
                      id="state"
                      className={`form-input ${errors.state ? 'error' : ''}`}
                      value={formData.state}
                      onChange={(e) => handleChange('state', e.target.value)}
                      placeholder="Enter your state"
                      required
                    />
                    {errors.state && <span className="error-message">{errors.state}</span>}
                  </div>

                  <div className="form-group">
                    <label htmlFor="city">City</label>
                    <input
                      type="text"
                      id="city"
                      className={`form-input ${errors.city ? 'error' : ''}`}
                      value={formData.city}
                      onChange={(e) => handleChange('city', e.target.value)}
                      placeholder="e.g., Los Angeles, São Paulo, Łódź"
                      required
                    />
                    <small style={{ display: 'block', marginTop: '4px', color: '#718096', fontSize: '0.85rem' }}>
                      2-85 characters, letters only (diacritics allowed)
                    </small>
                    {errors.city && <span className="error-message">{errors.city}</span>}
                  </div>
                </div>
              )}

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Creating account...' : 'Sign Up'}
              </button>

              <div className="divider">
                <span>OR</span>
              </div>

              <p className="auth-link">
                Are you a doctor or clinic admin?{' '}
                <Link to="/register/provider">Sign up here</Link>
              </p>

              <p className="auth-link">
                Already have an account? <Link to="/login">Login</Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientRegisterStep2;
