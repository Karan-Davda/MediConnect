import React, { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

type LoginRole = 'patient' | 'clinic_admin' | 'marketing_admin';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [loginRole, setLoginRole] = useState<LoginRole>('patient');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);
  
  // Get the path the user was trying to access before being redirected to login
  const from = (location.state as any)?.from?.pathname || null;

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      // Trim email before sending to API
      await login(formData.email.trim(), formData.password);

      // Handle remember me functionality
      if (formData.rememberMe) {
        localStorage.setItem('rememberMe', 'true');
      } else {
        localStorage.removeItem('rememberMe');
      }

      // Persist chosen role for front-end demo (ET-In / AUT local override)
      if (loginRole === 'patient') {
        localStorage.removeItem('forcedRole');
      } else {
        localStorage.setItem('forcedRole', loginRole);
      }

      // Check if user was redirected from a protected route
      const returnPath = localStorage.getItem('returnPath');
      
      // Priority 1: Redirect to the page they were trying to access (from ProtectedRoute)
      if (from) {
        navigate(from, { replace: true });
      } 
      // Priority 2: Redirect to stored return path (from booking page, etc.)
      else if (returnPath) {
        localStorage.removeItem('returnPath');
        navigate(returnPath, { replace: true });
      } 
      // Priority 3: Check if profile needs to be completed (for providers)
      else {
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        if ((userData.role === 'doctor' || userData.role === 'clinic_admin') && !userData.profileComplete) {
          navigate('/onboarding', { replace: true });
        } else if (loginRole === 'marketing_admin') {
          navigate('/marketing-campaigns');
        } else {
          navigate('/home', { replace: true });
        }
      }
    } catch (error: any) {
      setErrors({ password: error.message || 'Login failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof LoginFormData, value: string | boolean) => {
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
            <h2>Welcome Back</h2>

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  className={`form-input ${errors.email ? 'error' : ''}`}
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  required
                />
                {errors.email && <span className="error-message">{errors.email}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  className={`form-input ${errors.password ? 'error' : ''}`}
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  required
                />
                {errors.password && <span className="error-message">{errors.password}</span>}
              </div>

              <div className="form-check">
                <input
                  type="checkbox"
                  id="showPassword"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                />
                <label htmlFor="showPassword">Show password</label>
              </div>

              <div className="form-check">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={formData.rememberMe}
                  onChange={(e) => handleChange('rememberMe', e.target.checked)}
                />
                <label htmlFor="rememberMe">Remember me</label>
              </div>

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Logging in...' : 'Login'}
              </button>

              <p className="auth-link">
                Don't have an account?{' '}
                <Link to="/register/patient/step1">Sign up</Link>
              </p>

              <p className="auth-link">
                <Link to="/forgot-password">Forgot password?</Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
