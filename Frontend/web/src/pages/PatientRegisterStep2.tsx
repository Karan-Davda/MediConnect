import React, { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PatientStep1Data } from './PatientRegisterStep1';
import './PatientRegister.css';

interface PatientStep2Data {
  phone: string;
  dob: string;
  country: string;
  state: string;
  city: string;
}

const PatientRegisterStep2: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<PatientStep2Data>({
    phone: '',
    dob: '',
    country: '',
    state: '',
    city: '',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const step1Data = localStorage.getItem('patientStep1Data');
    if (!step1Data) {
      navigate('/register/patient/step1');
    }
  }, [navigate]);

  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^\+?[\d\s\-()]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  };

  const validateDate = (dateStr: string): boolean => {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!validatePhone(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number (at least 10 digits)';
    }

    if (!formData.dob) {
      newErrors.dob = 'Date of birth is required';
    } else if (!validateDate(formData.dob)) {
      newErrors.dob = 'Date of birth cannot be in the future';
    }

    if (!formData.country.trim()) {
      newErrors.country = 'Country is required';
    }

    if (!formData.state.trim()) {
      newErrors.state = 'State is required';
    }

    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
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

    setTimeout(() => {
      const payload = {
        role: 'patient',
        auth: {
          email: step1Data.email,
          password: step1Data.password,
        },
        profile: {
          full_name: step1Data.fullName,
          phone: formData.phone,
          dob: formData.dob,
          country: formData.country,
          state: formData.state,
          city: formData.city,
        },
      };

      console.log('Patient Registration Payload:', payload);
      alert('Registration successful! (Demo mode)\n\n' + JSON.stringify(payload, null, 2));

      localStorage.removeItem('patientStep1Data');
      setLoading(false);
      navigate('/login');
    }, 600);
  };

  const handleChange = (field: keyof PatientStep2Data, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="auth-container">
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

            <form onSubmit={handleSubmit} noValidate>
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
                <label htmlFor="dob">Date of Birth</label>
                <input
                  type="date"
                  id="dob"
                  className={`form-input ${errors.dob ? 'error' : ''}`}
                  value={formData.dob}
                  onChange={(e) => handleChange('dob', e.target.value)}
                  required
                />
                {errors.dob && <span className="error-message">{errors.dob}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="country">Country</label>
                <input
                  type="text"
                  id="country"
                  className={`form-input ${errors.country ? 'error' : ''}`}
                  value={formData.country}
                  onChange={(e) => handleChange('country', e.target.value)}
                  placeholder="United States"
                  required
                />
                {errors.country && <span className="error-message">{errors.country}</span>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="state">State</label>
                  <input
                    type="text"
                    id="state"
                    className={`form-input ${errors.state ? 'error' : ''}`}
                    value={formData.state}
                    onChange={(e) => handleChange('state', e.target.value)}
                    placeholder="California"
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
                    placeholder="Los Angeles"
                    required
                  />
                  {errors.city && <span className="error-message">{errors.city}</span>}
                </div>
              </div>

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Creating account...' : 'Sign Up'}
              </button>

              <div className="divider">
                <span>OR</span>
              </div>

              <p className="auth-link">
                Are you a doctor or clinic admin?{' '}
                <a onClick={() => navigate('/register/provider')}>Sign up here</a>
              </p>

              <p className="auth-link">
                Already have an account? <a onClick={() => navigate('/login')}>Login</a>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientRegisterStep2;
