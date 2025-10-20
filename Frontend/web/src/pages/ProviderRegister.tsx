import React, { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
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

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string): boolean => {
    if (password.length < 8) return false;
    if (!/[a-zA-Z]/.test(password)) return false;
    if (!/\d/.test(password)) return false;
    return true;
  };

  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^\+?[\d\s\-()]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
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
      newErrors.password = 'Password must be at least 8 characters with at least 1 letter and 1 number';
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
    }

    if (!formData.state.trim()) {
      newErrors.state = 'State is required';
    }

    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
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

    setTimeout(() => {
      const profile: any = {
        full_name: formData.fullName,
        phone: formData.phone,
        country: formData.country,
        state: formData.state,
        city: formData.city,
      };

      if (formData.role === 'clinic_admin') {
        profile.clinic_name = formData.clinicName;
      } else {
        profile.specialty = formData.specialty;
      }

      const payload = {
        role: formData.role,
        auth: {
          email: formData.email,
          password: formData.password,
        },
        profile,
      };

      console.log('Provider Registration Payload:', payload);
      alert(
        `${formData.role === 'clinic_admin' ? 'Clinic Admin' : 'Doctor'} Registration successful! (Demo mode)\n\n` +
          JSON.stringify(payload, null, 2)
      );

      setLoading(false);
      navigate('/login');
    }, 600);
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
            <h2>Provider Registration</h2>

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
                Are you a patient? <a onClick={() => navigate('/register/patient/step1')}>Sign up here</a>
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

export default ProviderRegister;
