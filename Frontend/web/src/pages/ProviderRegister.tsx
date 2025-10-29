import React, { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './ProviderRegister.css';

interface ProviderFormData {
  role: 'doctor' | 'clinic_admin';
  clinicName: string;
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  country: string;
  state: string;
  city: string;
  specialty: string;
}

// ISO 3166-1 Countries (common subset)
const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'IN', name: 'India' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'JP', name: 'Japan' },
  { code: 'CN', name: 'China' },
  { code: 'BR', name: 'Brazil' },
];

// US States (ISO 3166-2:US)
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

// Canadian Provinces
const CA_PROVINCES = [
  'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick',
  'Newfoundland and Labrador', 'Nova Scotia', 'Ontario',
  'Prince Edward Island', 'Quebec', 'Saskatchewan'
];

const STATES_BY_COUNTRY: Record<string, string[]> = {
  'US': US_STATES,
  'CA': CA_PROVINCES,
};

const ProviderRegister: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<ProviderFormData>({
    role: 'doctor',
    clinicName: '',
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    country: '',
    state: '',
    city: '',
    specialty: '',
  });
  const [showPasswords, setShowPasswords] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [availableStates, setAvailableStates] = useState<string[]>([]);

  // Update available states when country changes
  useEffect(() => {
    const selectedCountry = COUNTRIES.find(c => c.name === formData.country);
    if (selectedCountry && STATES_BY_COUNTRY[selectedCountry.code]) {
      setAvailableStates(STATES_BY_COUNTRY[selectedCountry.code]);
      // Clear state if it's not valid for new country
      if (formData.state && !STATES_BY_COUNTRY[selectedCountry.code].includes(formData.state)) {
        setFormData(prev => ({ ...prev, state: '' }));
      }
    } else {
      setAvailableStates([]);
    }
  }, [formData.country]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string): boolean => {
    if (password.length < 8) return false;
    if (!/[A-Z]/.test(password)) return false;
    if (!/[a-z]/.test(password)) return false;
    if (!/\d/.test(password)) return false;
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return false;
    return true;
  };

  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^\+?[\d\s\-()]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
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

    if (formData.role === 'clinic_admin' && !formData.clinicName.trim()) {
      newErrors.clinicName = 'Clinic name is required';
    }

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (!validatePassword(formData.password)) {
      newErrors.password = 'Password must be at least 8 characters with uppercase, lowercase, number, and special character';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!validatePhone(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number (at least 10 digits)';
    }

    if (!formData.country.trim()) {
      newErrors.country = 'Country is required';
    } else if (!COUNTRIES.find(c => c.name === formData.country)) {
      newErrors.country = 'Please select a valid country from the list';
    }

    if (!formData.state.trim()) {
      newErrors.state = 'State is required';
    } else {
      const selectedCountry = COUNTRIES.find(c => c.name === formData.country);
      if (selectedCountry && STATES_BY_COUNTRY[selectedCountry.code]) {
        if (!STATES_BY_COUNTRY[selectedCountry.code].includes(formData.state)) {
          newErrors.state = 'Please select a valid state for the chosen country';
        }
      }
    }

    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
    } else if (!validateCity(formData.city)) {
      newErrors.city = 'City must be 2-85 characters, contain letters, and cannot be numbers or symbols only';
    }

    if (formData.role === 'doctor' && !formData.specialty.trim()) {
      newErrors.specialty = 'Specialty is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setErrors({});
    setSuccessMessage('');

    try {
      const profile: any = {
        full_name: formData.fullName.trim(),
        phone: formData.phone.trim(),
        country: formData.country.trim(),
        state: formData.state.trim(),
        city: formData.city.trim(),
      };

      if (formData.role === 'clinic_admin') {
        profile.clinic_name = formData.clinicName.trim();
      } else {
        profile.specialty = formData.specialty.trim();
      }

      const payload = {
        role: formData.role,
        auth: {
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
        },
        profile,
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

  const handleChange = (field: keyof ProviderFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleRoleChange = (role: 'doctor' | 'clinic_admin') => {
    setFormData(prev => ({ ...prev, role }));
    setErrors({});
  };

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
            <h2>Provider Registration</h2>

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

            <div className="toggle-container">
              <p className="toggle-label">Select your role:</p>
              <div className="toggle-pills">
                <button
                  type="button"
                  className={`toggle-pill ${formData.role === 'doctor' ? 'active' : ''}`}
                  onClick={() => handleRoleChange('doctor')}
                >
                  Doctor
                </button>
                <button
                  type="button"
                  className={`toggle-pill ${formData.role === 'clinic_admin' ? 'active' : ''}`}
                  onClick={() => handleRoleChange('clinic_admin')}
                >
                  Clinic Admin
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              {formData.role === 'clinic_admin' && (
                <div className="form-group">
                  <label htmlFor="clinicName">Clinic Name</label>
                  <input
                    type="text"
                    id="clinicName"
                    className={`form-input ${errors.clinicName ? 'error' : ''}`}
                    value={formData.clinicName}
                    onChange={(e) => handleChange('clinicName', e.target.value)}
                    placeholder="ABC Medical Center"
                    required
                  />
                  {errors.clinicName && <span className="error-message">{errors.clinicName}</span>}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="fullName">
                  {formData.role === 'clinic_admin' ? 'Admin Full Name' : 'Full Name'}
                </label>
                <input
                  type="text"
                  id="fullName"
                  className={`form-input ${errors.fullName ? 'error' : ''}`}
                  value={formData.fullName}
                  onChange={(e) => handleChange('fullName', e.target.value)}
                  placeholder="Dr. John Smith"
                  required
                />
                {errors.fullName && <span className="error-message">{errors.fullName}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  className={`form-input ${errors.email ? 'error' : ''}`}
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="john.smith@example.com"
                  required
                />
                {errors.email && <span className="error-message">{errors.email}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  id="password"
                  className={`form-input ${errors.password ? 'error' : ''}`}
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  required
                />
                <small style={{ display: 'block', marginTop: '4px', color: '#718096', fontSize: '0.85rem' }}>
                  Must be at least 8 characters with uppercase, lowercase, number, and special character
                </small>
                {errors.password && <span className="error-message">{errors.password}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  id="confirmPassword"
                  className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
                  value={formData.confirmPassword}
                  onChange={(e) => handleChange('confirmPassword', e.target.value)}
                  required
                />
                {errors.confirmPassword && <span className="error-message">{errors.confirmPassword}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="phone">Phone Number</label>
                <input
                  type="tel"
                  id="phone"
                  className={`form-input ${errors.phone ? 'error' : ''}`}
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  required
                />
                {errors.phone && <span className="error-message">{errors.phone}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="country">Country</label>
                <select
                  id="country"
                  className={`form-input ${errors.country ? 'error' : ''}`}
                  value={formData.country}
                  onChange={(e) => handleChange('country', e.target.value)}
                  required
                >
                  <option value="">Select a country</option>
                  {COUNTRIES.map(country => (
                    <option key={country.code} value={country.name}>
                      {country.name}
                    </option>
                  ))}
                </select>
                {errors.country && <span className="error-message">{errors.country}</span>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="state">State/Province</label>
                  {availableStates.length > 0 ? (
                    <select
                      id="state"
                      className={`form-input ${errors.state ? 'error' : ''}`}
                      value={formData.state}
                      onChange={(e) => handleChange('state', e.target.value)}
                      required
                    >
                      <option value="">Select a state</option>
                      {availableStates.map(state => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      id="state"
                      className={`form-input ${errors.state ? 'error' : ''}`}
                      value={formData.state}
                      onChange={(e) => handleChange('state', e.target.value)}
                      placeholder="Enter state/province"
                      required
                    />
                  )}
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

              {formData.role === 'doctor' && (
                <div className="form-group">
                  <label htmlFor="specialty">Specialty</label>
                  <input
                    type="text"
                    id="specialty"
                    className={`form-input ${errors.specialty ? 'error' : ''}`}
                    value={formData.specialty}
                    onChange={(e) => handleChange('specialty', e.target.value)}
                    placeholder="Cardiology"
                    required
                  />
                  {errors.specialty && <span className="error-message">{errors.specialty}</span>}
                </div>
              )}

              <div className="form-check">
                <input
                  type="checkbox"
                  id="showPasswords"
                  checked={showPasswords}
                  onChange={(e) => setShowPasswords(e.target.checked)}
                />
                <label htmlFor="showPasswords">Show passwords</label>
              </div>

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Creating account...' : 'Sign Up'}
              </button>

              <div className="divider">
                <span>OR</span>
              </div>

              <p className="auth-link">
                Are you a patient? <Link to="/register/patient/step1">Sign up here</Link>
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

export default ProviderRegister;
