import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import { apiUrl } from '../config/api';
import './Insurance.css';

interface InsuranceRecord {
  id: string;
  patientId: string;
  patientName?: string;
  insuranceProvider: string;
  policyNumber: string;
  groupNumber?: string;
  subscriberName: string;
  subscriberRelationship: string;
  subscriberDateOfBirth?: string;
  effectiveDate?: string;
  expirationDate?: string;
  planType?: string;
  coverageType: string;
  copay?: number;
  deductible?: number;
  deductibleMet?: number;
  outOfPocketMax?: number;
  outOfPocketMet?: number;
  coveragePercentage?: number;
  priorAuthRequired?: boolean;
  verificationStatus: string;
  verifiedDate?: string;
  verifiedBy?: string;
  verificationNotes?: string;
  insurancePhone?: string;
  insuranceAddress?: string;
  claimsAddress?: string;
  rxBin?: string;
  rxPcn?: string;
  rxGroup?: string;
  status: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
}

const Insurance: React.FC = () => {
  const { token, user, isAuthenticated, hasRole, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [insuranceRecords, setInsuranceRecords] = useState<InsuranceRecord[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingInsuranceId, setEditingInsuranceId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    patientId: '',
    insuranceProvider: '',
    policyNumber: '',
    groupNumber: '',
    subscriberName: '',
    subscriberRelationship: 'self',
    subscriberDateOfBirth: '',
    effectiveDate: '',
    expirationDate: '',
    planType: 'PPO',
    coverageType: 'primary',
    copay: '',
    deductible: '',
    deductibleMet: '',
    outOfPocketMax: '',
    outOfPocketMet: '',
    coveragePercentage: '80',
    priorAuthRequired: false,
    insurancePhone: '',
    insuranceAddress: '',
    claimsAddress: '',
    rxBin: '',
    rxPcn: '',
    rxGroup: '',
    notes: ''
  });

  // Verification form state
  const [showVerificationForm, setShowVerificationForm] = useState(false);
  const [verifyingInsuranceId, setVerifyingInsuranceId] = useState<string | null>(null);
  const [verificationData, setVerificationData] = useState({
    status: 'verified',
    notes: ''
  });

  const canManageInsurance = hasRole(['doctor', 'clinic_staff', 'clinic_admin', 'patient']);
  const canVerifyInsurance = hasRole(['doctor', 'clinic_staff', 'clinic_admin']);
  const isPatient = user?.role === 'patient';
  const isStaff = hasRole(['doctor', 'clinic_staff', 'clinic_admin']);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (isStaff) {
      fetchPatients();
    }
    fetchInsurance();
  }, [isAuthenticated, navigate]);

  const fetchPatients = async () => {
    if (!token || !isStaff) return;

    setLoadingPatients(true);
    try {
      const response = await fetch(apiUrl('medical-records/patients'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        logout();
        navigate('/login');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch patients');
      }

      const data = await response.json();
      setPatients(data.patients || []);
    } catch (err: any) {
      console.error('Error fetching patients:', err);
      setError(err.message || 'Failed to load patients');
    } finally {
      setLoadingPatients(false);
    }
  };

  const fetchInsurance = async (patientId?: string) => {
    if (!token) return;

    setLoading(true);
    setError('');

    try {
      let url = 'insurance';
      if (patientId) {
        url += `?patientId=${patientId}`;
      }

      const response = await fetch(apiUrl(url), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        logout();
        navigate('/login');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch insurance records');
      }

      const data = await response.json();
      setInsuranceRecords(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error fetching insurance:', err);
      setError(err.message || 'Failed to load insurance records');
      setInsuranceRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePatientChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const patientId = e.target.value;
    setSelectedPatient(patientId);
    if (patientId) {
      fetchInsurance(patientId);
    } else {
      fetchInsurance();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    if (name === 'insurancePhone') {
      const phonePattern = /^[0-9\s\-()]*$/;
      if (value === '' || phonePattern.test(value)) {
        setFormData(prev => ({
          ...prev,
          [name]: value
        }));
      }
      return;
    }

    if (name === 'rxBin') {
      const binPattern = /^[0-9]*$/;
      if (value === '' || binPattern.test(value)) {
        setFormData(prev => ({
          ...prev,
          [name]: value
        }));
      }
      return;
    }

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (formData.insurancePhone && formData.insurancePhone.trim() !== '') {
      const phonePattern = /^[0-9\s\-()]+$/;
      if (!phonePattern.test(formData.insurancePhone)) {
        setError('Insurance Phone must contain only numbers');
        setLoading(false);
        return;
      }
    }

    if (formData.rxBin && formData.rxBin.trim() !== '') {
      const binPattern = /^[0-9]+$/;
      if (!binPattern.test(formData.rxBin)) {
        setError('Prescription BIN must contain only numbers');
        setLoading(false);
        return;
      }
    }

    try {
      const url = editingInsuranceId
        ? apiUrl(`insurance/${editingInsuranceId}`)
        : apiUrl('insurance');

      const method = editingInsuranceId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save insurance');
      }

      setSuccess(editingInsuranceId ? 'Insurance updated successfully' : 'Insurance created successfully');
      resetForm();
      fetchInsurance(selectedPatient);
    } catch (err: any) {
      setError(err.message || 'Failed to save insurance');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (insurance: InsuranceRecord) => {
    setEditingInsuranceId(insurance.id);
    setFormData({
      patientId: insurance.patientId,
      insuranceProvider: insurance.insuranceProvider,
      policyNumber: insurance.policyNumber,
      groupNumber: insurance.groupNumber || '',
      subscriberName: insurance.subscriberName,
      subscriberRelationship: insurance.subscriberRelationship,
      subscriberDateOfBirth: insurance.subscriberDateOfBirth || '',
      effectiveDate: insurance.effectiveDate || '',
      expirationDate: insurance.expirationDate || '',
      planType: insurance.planType || 'PPO',
      coverageType: insurance.coverageType,
      copay: insurance.copay?.toString() || '',
      deductible: insurance.deductible?.toString() || '',
      deductibleMet: insurance.deductibleMet?.toString() || '',
      outOfPocketMax: insurance.outOfPocketMax?.toString() || '',
      outOfPocketMet: insurance.outOfPocketMet?.toString() || '',
      coveragePercentage: insurance.coveragePercentage?.toString() || '80',
      priorAuthRequired: insurance.priorAuthRequired || false,
      insurancePhone: insurance.insurancePhone || '',
      insuranceAddress: insurance.insuranceAddress || '',
      claimsAddress: insurance.claimsAddress || '',
      rxBin: insurance.rxBin || '',
      rxPcn: insurance.rxPcn || '',
      rxGroup: insurance.rxGroup || '',
      notes: insurance.notes || ''
    });
    setShowForm(true);
  };

  const handleVerify = (insuranceId: string) => {
    setVerifyingInsuranceId(insuranceId);
    setShowVerificationForm(true);
  };

  const handleVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingInsuranceId) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(apiUrl(`insurance/${verifyingInsuranceId}/verify`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(verificationData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to verify insurance');
      }

      setSuccess('Insurance verification updated successfully');
      setShowVerificationForm(false);
      setVerifyingInsuranceId(null);
      setVerificationData({ status: 'verified', notes: '' });
      fetchInsurance(selectedPatient);
    } catch (err: any) {
      setError(err.message || 'Failed to verify insurance');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (insuranceId: string) => {
    if (!window.confirm('Are you sure you want to deactivate this insurance record?')) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(apiUrl(`insurance/${insuranceId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to deactivate insurance');
      }

      setSuccess('Insurance deactivated successfully');
      fetchInsurance(selectedPatient);
    } catch (err: any) {
      setError(err.message || 'Failed to deactivate insurance');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      patientId: '',
      insuranceProvider: '',
      policyNumber: '',
      groupNumber: '',
      subscriberName: '',
      subscriberRelationship: 'self',
      subscriberDateOfBirth: '',
      effectiveDate: '',
      expirationDate: '',
      planType: 'PPO',
      coverageType: 'primary',
      copay: '',
      deductible: '',
      deductibleMet: '',
      outOfPocketMax: '',
      outOfPocketMet: '',
      coveragePercentage: '80',
      priorAuthRequired: false,
      insurancePhone: '',
      insuranceAddress: '',
      claimsAddress: '',
      rxBin: '',
      rxPcn: '',
      rxGroup: '',
      notes: ''
    });
    setEditingInsuranceId(null);
    setShowForm(false);
  };

  const getStatusBadgeClass = (status: string) => {
    const baseClass = 'status-badge';
    switch (status.toLowerCase()) {
      case 'active':
        return `${baseClass} status-active`;
      case 'inactive':
        return `${baseClass} status-inactive`;
      case 'terminated':
        return `${baseClass} status-terminated`;
      default:
        return baseClass;
    }
  };

  const getVerificationBadgeClass = (status: string) => {
    const baseClass = 'verification-badge';
    switch (status.toLowerCase()) {
      case 'verified':
        return `${baseClass} verification-verified`;
      case 'pending':
        return `${baseClass} verification-pending`;
      case 'failed':
        return `${baseClass} verification-failed`;
      case 'expired':
        return `${baseClass} verification-expired`;
      default:
        return baseClass;
    }
  };

  return (
    <div className="app-container">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <main className="main-content">
        <div className="insurance-container">
          <h1>Insurance Management</h1>

          {/* Alerts */}
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          {/* Filters Section */}
          <div className="filters-section">
            {isStaff && (
              <div className="filter-group">
                <label>Filter by Patient:</label>
                <select value={selectedPatient} onChange={handlePatientChange} disabled={loadingPatients}>
                  <option value="">All Patients</option>
                  {Array.isArray(patients) && patients.map(patient => (
                    <option key={patient.id} value={patient.id}>
                      {patient.fullName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {canManageInsurance && (
              <button
                onClick={() => {
                  resetForm();
                  if (isPatient) {
                    // For patients, auto-fill their patient ID from existing records
                    if (insuranceRecords.length > 0) {
                      setFormData(prev => ({ ...prev, patientId: insuranceRecords[0].patientId }));
                    }
                  }
                  setShowForm(true);
                }}
                className="btn btn-primary"
              >
                Add New Insurance
              </button>
            )}
          </div>

          {/* Insurance Form */}
          {showForm && (
            <div className="form-card">
              <h2>{editingInsuranceId ? 'Edit Insurance' : 'Add New Insurance'}</h2>
              <form onSubmit={handleSubmit}>
                <div className="form-row">
                  {isStaff && (
                    <div className="form-group">
                      <label>Patient *</label>
                      <select
                        name="patientId"
                        value={formData.patientId}
                        onChange={handleInputChange}
                        required
                        disabled={!!editingInsuranceId}
                      >
                        <option value="">Select Patient</option>
                        {Array.isArray(patients) && patients.map(patient => (
                          <option key={patient.id} value={patient.id}>
                            {patient.fullName}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="form-group">
                    <label>Insurance Provider *</label>
                    <input
                      type="text"
                      name="insuranceProvider"
                      value={formData.insuranceProvider}
                      onChange={handleInputChange}
                      required
                      placeholder="e.g., Blue Cross Blue Shield"
                    />
                  </div>

                  <div className="form-group">
                    <label>Policy Number *</label>
                    <input
                      type="text"
                      name="policyNumber"
                      value={formData.policyNumber}
                      onChange={handleInputChange}
                      required
                      placeholder="e.g., BC123456789"
                    />
                  </div>

                  <div className="form-group">
                    <label>Group Number</label>
                    <input
                      type="text"
                      name="groupNumber"
                      value={formData.groupNumber}
                      onChange={handleInputChange}
                      placeholder="e.g., GRP001"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Subscriber Name *</label>
                    <input
                      type="text"
                      name="subscriberName"
                      value={formData.subscriberName}
                      onChange={handleInputChange}
                      required
                      placeholder="Full name of subscriber"
                    />
                  </div>

                  <div className="form-group">
                    <label>Relationship to Subscriber *</label>
                    <select
                      name="subscriberRelationship"
                      value={formData.subscriberRelationship}
                      onChange={handleInputChange}
                    >
                      <option value="self">Self</option>
                      <option value="spouse">Spouse</option>
                      <option value="parent">Parent</option>
                      <option value="child">Child</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Subscriber Date of Birth</label>
                    <input
                      type="date"
                      name="subscriberDateOfBirth"
                      value={formData.subscriberDateOfBirth}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Effective Date</label>
                    <input
                      type="date"
                      name="effectiveDate"
                      value={formData.effectiveDate}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label>Expiration Date</label>
                    <input
                      type="date"
                      name="expirationDate"
                      value={formData.expirationDate}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label>Plan Type</label>
                    <select name="planType" value={formData.planType} onChange={handleInputChange}>
                      <option value="HMO">HMO</option>
                      <option value="PPO">PPO</option>
                      <option value="EPO">EPO</option>
                      <option value="POS">POS</option>
                      <option value="HDHP">HDHP</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Coverage Type *</label>
                    <select name="coverageType" value={formData.coverageType} onChange={handleInputChange}>
                      <option value="primary">Primary</option>
                      <option value="secondary">Secondary</option>
                      <option value="tertiary">Tertiary</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Copay ($)</label>
                    <input
                      type="number"
                      name="copay"
                      value={formData.copay}
                      onChange={handleInputChange}
                      min="0"
                      step="0.01"
                      placeholder="e.g., 25.00"
                    />
                  </div>

                  <div className="form-group">
                    <label>Deductible ($)</label>
                    <input
                      type="number"
                      name="deductible"
                      value={formData.deductible}
                      onChange={handleInputChange}
                      min="0"
                      step="0.01"
                      placeholder="e.g., 1500.00"
                    />
                  </div>

                  <div className="form-group">
                    <label>Deductible Met ($)</label>
                    <input
                      type="number"
                      name="deductibleMet"
                      value={formData.deductibleMet}
                      onChange={handleInputChange}
                      min="0"
                      step="0.01"
                      placeholder="e.g., 500.00"
                    />
                  </div>

                  <div className="form-group">
                    <label>Out of Pocket Max ($)</label>
                    <input
                      type="number"
                      name="outOfPocketMax"
                      value={formData.outOfPocketMax}
                      onChange={handleInputChange}
                      min="0"
                      step="0.01"
                      placeholder="e.g., 6000.00"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Out of Pocket Met ($)</label>
                    <input
                      type="number"
                      name="outOfPocketMet"
                      value={formData.outOfPocketMet}
                      onChange={handleInputChange}
                      min="0"
                      step="0.01"
                      placeholder="e.g., 1200.00"
                    />
                  </div>

                  <div className="form-group">
                    <label>Coverage Percentage (%)</label>
                    <input
                      type="number"
                      name="coveragePercentage"
                      value={formData.coveragePercentage}
                      onChange={handleInputChange}
                      min="0"
                      max="100"
                      placeholder="e.g., 80"
                    />
                  </div>

                  <div className="form-group">
                    <label>Insurance Phone</label>
                    <input
                      type="tel"
                      name="insurancePhone"
                      value={formData.insurancePhone}
                      onChange={handleInputChange}
                      placeholder="e.g., 1-800-123-4567"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Prescription BIN</label>
                    <input
                      type="text"
                      name="rxBin"
                      value={formData.rxBin}
                      onChange={handleInputChange}
                      placeholder="e.g., 610014"
                    />
                  </div>

                  <div className="form-group">
                    <label>Prescription PCN</label>
                    <input
                      type="text"
                      name="rxPcn"
                      value={formData.rxPcn}
                      onChange={handleInputChange}
                      placeholder="e.g., MEDDADV"
                    />
                  </div>

                  <div className="form-group">
                    <label>Prescription Group</label>
                    <input
                      type="text"
                      name="rxGroup"
                      value={formData.rxGroup}
                      onChange={handleInputChange}
                      placeholder="e.g., RX001"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Insurance Address</label>
                  <input
                    type="text"
                    name="insuranceAddress"
                    value={formData.insuranceAddress}
                    onChange={handleInputChange}
                    placeholder="Insurance company address"
                  />
                </div>

                <div className="form-group">
                  <label>Claims Address</label>
                  <input
                    type="text"
                    name="claimsAddress"
                    value={formData.claimsAddress}
                    onChange={handleInputChange}
                    placeholder="Address to send claims"
                  />
                </div>

                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder="Additional notes or information"
                  />
                </div>

                <div className="checkbox-row">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="priorAuthRequired"
                      checked={formData.priorAuthRequired}
                      onChange={handleInputChange}
                    />
                    Prior Authorization Required
                  </label>
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Saving...' : (editingInsuranceId ? 'Update Insurance' : 'Create Insurance')}
                  </button>
                  <button type="button" onClick={resetForm} className="btn btn-secondary" disabled={loading}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Verification Form */}
          {showVerificationForm && (
            <div className="form-card verification-form">
              <h2>Verify Insurance</h2>
              <form onSubmit={handleVerificationSubmit}>
                <div className="form-group">
                  <label>Verification Status *</label>
                  <select
                    value={verificationData.status}
                    onChange={(e) => setVerificationData(prev => ({ ...prev, status: e.target.value }))}
                    required
                  >
                    <option value="verified">Verified</option>
                    <option value="failed">Failed</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Verification Notes</label>
                  <textarea
                    value={verificationData.notes}
                    onChange={(e) => setVerificationData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={4}
                    placeholder="Enter verification details, coverage information, or issues found"
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Verifying...' : 'Submit Verification'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowVerificationForm(false);
                      setVerifyingInsuranceId(null);
                      setVerificationData({ status: 'verified', notes: '' });
                    }}
                    className="btn btn-secondary"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Insurance List */}
          <div className="insurance-list">
            <h2>Insurance Records</h2>

            {loading && <div className="loading">Loading insurance records...</div>}

            {!loading && insuranceRecords.length === 0 && (
              <div className="no-data">No insurance records found</div>
            )}

            {!loading && insuranceRecords.length > 0 && (
              <div className="insurance-cards">
                {insuranceRecords.map(insurance => (
                  <div key={insurance.id} className="insurance-card">
                    <div className="insurance-header">
                      <div>
                        <h3>{insurance.insuranceProvider}</h3>
                        {insurance.patientName && isStaff && (
                          <p className="insurance-meta">
                            Patient: {insurance.patientName}
                          </p>
                        )}
                        <p className="insurance-meta">
                          Policy: {insurance.policyNumber}
                          {insurance.groupNumber && ` | Group: ${insurance.groupNumber}`}
                        </p>
                      </div>
                      <div className="insurance-badges">
                        <span className={getStatusBadgeClass(insurance.status)}>
                          {insurance.status.toUpperCase()}
                        </span>
                        <span className={getVerificationBadgeClass(insurance.verificationStatus)}>
                          {insurance.verificationStatus.toUpperCase()}
                        </span>
                        <span className="coverage-badge">
                          {insurance.coverageType.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="insurance-details">
                      <div className="detail-row">
                        <span className="detail-label">Subscriber:</span>
                        <span>{insurance.subscriberName} ({insurance.subscriberRelationship})</span>
                      </div>
                      {insurance.planType && (
                        <div className="detail-row">
                          <span className="detail-label">Plan Type:</span>
                          <span>{insurance.planType}</span>
                        </div>
                      )}
                      {insurance.copay !== undefined && (
                        <div className="detail-row">
                          <span className="detail-label">Copay:</span>
                          <span>${insurance.copay}</span>
                        </div>
                      )}
                      {insurance.deductible !== undefined && (
                        <div className="detail-row">
                          <span className="detail-label">Deductible:</span>
                          <span>${insurance.deductible} (Met: ${insurance.deductibleMet || 0})</span>
                        </div>
                      )}
                      {insurance.outOfPocketMax !== undefined && (
                        <div className="detail-row">
                          <span className="detail-label">Out of Pocket Max:</span>
                          <span>${insurance.outOfPocketMax} (Met: ${insurance.outOfPocketMet || 0})</span>
                        </div>
                      )}
                      {insurance.coveragePercentage !== undefined && (
                        <div className="detail-row">
                          <span className="detail-label">Coverage:</span>
                          <span>{insurance.coveragePercentage}%</span>
                        </div>
                      )}
                      {insurance.effectiveDate && (
                        <div className="detail-row">
                          <span className="detail-label">Effective Date:</span>
                          <span>{new Date(insurance.effectiveDate).toLocaleDateString()}</span>
                        </div>
                      )}
                      {insurance.expirationDate && (
                        <div className="detail-row">
                          <span className="detail-label">Expiration Date:</span>
                          <span>{new Date(insurance.expirationDate).toLocaleDateString()}</span>
                        </div>
                      )}
                      {insurance.insurancePhone && (
                        <div className="detail-row">
                          <span className="detail-label">Phone:</span>
                          <span>{insurance.insurancePhone}</span>
                        </div>
                      )}
                      {insurance.priorAuthRequired && (
                        <div className="detail-row">
                          <span className="detail-label">Prior Auth:</span>
                          <span className="prior-auth-required">Required</span>
                        </div>
                      )}
                      {insurance.verificationNotes && (
                        <div className="detail-row full-width">
                          <span className="detail-label">Verification Notes:</span>
                          <span>{insurance.verificationNotes}</span>
                        </div>
                      )}
                      {insurance.notes && (
                        <div className="detail-row full-width">
                          <span className="detail-label">Notes:</span>
                          <span>{insurance.notes}</span>
                        </div>
                      )}
                    </div>

                    {insurance.status === 'active' && (
                      <div className="insurance-actions">
                        <button
                          onClick={() => handleEdit(insurance)}
                          className="btn btn-small btn-secondary"
                        >
                          Edit
                        </button>

                        {canVerifyInsurance && insurance.verificationStatus !== 'verified' && (
                          <button
                            onClick={() => handleVerify(insurance.id)}
                            className="btn btn-small btn-primary"
                          >
                            Verify
                          </button>
                        )}

                        {canVerifyInsurance && insurance.verificationStatus === 'verified' && (
                          <button
                            onClick={() => handleVerify(insurance.id)}
                            className="btn btn-small btn-success"
                          >
                            Re-verify
                          </button>
                        )}

                        {canVerifyInsurance && (
                          <button
                            onClick={() => handleDeactivate(insurance.id)}
                            className="btn btn-small btn-danger"
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Insurance;
