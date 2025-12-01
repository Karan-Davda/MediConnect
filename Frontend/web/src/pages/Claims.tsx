import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import { apiUrl } from '../config/api';
import './Claims.css';

interface Claim {
  id: string;
  claimNumber: string;
  patientId: string;
  patientName: string;
  insuranceId: string;
  insuranceProvider: string;
  policyNumber: string;
  providerId: string;
  providerName: string;
  serviceDate: string;
  submissionDate: string;
  diagnosisCodes: string[];
  procedureCodes: string[];
  serviceDescription: string;
  totalCharges: number;
  claimedAmount: number;
  approvedAmount: number;
  deniedAmount: number;
  patientResponsibility: number;
  status: string;
  claimType: string;
  placeOfService?: string;
  priorAuthNumber?: string;
  denialReason?: string;
  denialCode?: string;
  adjudicationDate?: string;
  paymentDate?: string;
  paymentAmount: number;
  reconciliationStatus: string;
  createdAt: string;
  updatedAt: string;
}

interface Insurance {
  id: string;
  insuranceProvider: string;
  policyNumber: string;
  verificationStatus: string;
  status: string;
}

interface ClaimStatistics {
  total: number;
  pending: number;
  submitted: number;
  approved: number;
  denied: number;
  partiallyApproved: number;
  totalClaimedAmount: number;
  totalApprovedAmount: number;
  totalDeniedAmount: number;
  totalPatientResponsibility: number;
  averageApprovalRate: string;
}

const Claims: React.FC = () => {
  const { token, user, isAuthenticated, hasRole, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [insuranceRecords, setInsuranceRecords] = useState<Insurance[]>([]);
  const [statistics, setStatistics] = useState<ClaimStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const [showForm, setShowForm] = useState(false);
  const [editingClaimId, setEditingClaimId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    patientId: '',
    insuranceId: '',
    providerId: '',
    serviceDate: '',
    diagnosisCodes: '',
    procedureCodes: '',
    serviceDescription: '',
    totalCharges: '',
    claimedAmount: '',
    claimType: 'professional',
    placeOfService: 'Office',
    priorAuthNumber: '',
    notes: ''
  });

  const canWriteClaims = hasRole(['doctor', 'clinic_staff', 'clinic_admin']);
  const canReadClaims = hasRole(['doctor', 'clinic_staff', 'clinic_admin', 'patient']);
  const isPatient = user?.role === 'patient';

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (!canReadClaims) {
      navigate('/home');
      return;
    }

    if (canWriteClaims) {
      fetchInsurance();
    }
    fetchClaims();
    fetchStatistics();
  }, [isAuthenticated, navigate]);

  const fetchInsurance = async () => {
    try {
      const response = await fetch(apiUrl('insurance'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch insurance');

      const data = await response.json();
      setInsuranceRecords(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error fetching insurance:', err);
    }
  };

  const fetchClaims = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(apiUrl('claims'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        logout();
        navigate('/login');
        return;
      }

      if (!response.ok) throw new Error('Failed to fetch claims');

      const data = await response.json();
      setClaims(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error fetching claims:', err);
      setError(err.message || 'Failed to load claims');
      setClaims([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const response = await fetch(apiUrl('claims/statistics'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch statistics');

      const data = await response.json();
      setStatistics(data);
    } catch (err: any) {
      console.error('Error fetching statistics:', err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === 'totalCharges' || name === 'claimedAmount') {
      const numericPattern = /^[0-9]*\.?[0-9]*$/;
      if (value === '' || numericPattern.test(value)) {
        setFormData(prev => ({ ...prev, [name]: value }));
      }
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!formData.insuranceId || !formData.serviceDate || !formData.totalCharges || !formData.claimedAmount) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    const totalChargesNum = parseFloat(formData.totalCharges);
    const claimedAmountNum = parseFloat(formData.claimedAmount);

    if (isNaN(totalChargesNum) || totalChargesNum <= 0) {
      setError('Please enter a valid total charges amount');
      setLoading(false);
      return;
    }

    if (isNaN(claimedAmountNum) || claimedAmountNum <= 0) {
      setError('Please enter a valid claimed amount');
      setLoading(false);
      return;
    }

    if (claimedAmountNum > totalChargesNum) {
      setError('Claimed amount cannot exceed total charges');
      setLoading(false);
      return;
    }

    try {
      const url = editingClaimId
        ? apiUrl(`claims/${editingClaimId}`)
        : apiUrl('claims');

      const method = editingClaimId ? 'PUT' : 'POST';

      const selectedInsurance = insuranceRecords.find(ins => ins.id === formData.insuranceId);

      const payload = {
        ...formData,
        patientId: formData.patientId || user?.id,
        totalCharges: totalChargesNum,
        claimedAmount: claimedAmountNum,
        diagnosisCodes: formData.diagnosisCodes ? formData.diagnosisCodes.split(',').map(c => c.trim()) : [],
        procedureCodes: formData.procedureCodes ? formData.procedureCodes.split(',').map(c => c.trim()) : []
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save claim');
      }

      setSuccess(editingClaimId ? 'Claim updated successfully' : 'Claim created successfully');
      resetForm();
      fetchClaims();
      fetchStatistics();
    } catch (err: any) {
      setError(err.message || 'Failed to save claim');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitClaim = async (claimId: string) => {
    if (!window.confirm('Submit this claim to insurance? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(apiUrl(`claims/${claimId}/submit`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit claim');
      }

      setSuccess('Claim submitted successfully');
      fetchClaims();
      fetchStatistics();
    } catch (err: any) {
      setError(err.message || 'Failed to submit claim');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (claim: Claim) => {
    setEditingClaimId(claim.id);
    setFormData({
      patientId: claim.patientId,
      insuranceId: claim.insuranceId,
      providerId: claim.providerId,
      serviceDate: claim.serviceDate,
      diagnosisCodes: claim.diagnosisCodes.join(', '),
      procedureCodes: claim.procedureCodes.join(', '),
      serviceDescription: claim.serviceDescription,
      totalCharges: claim.totalCharges.toString(),
      claimedAmount: claim.claimedAmount.toString(),
      claimType: claim.claimType,
      placeOfService: claim.placeOfService || 'Office',
      priorAuthNumber: claim.priorAuthNumber || '',
      notes: ''
    });
    setShowForm(true);
  };

  const handleDelete = async (claimId: string) => {
    if (!window.confirm('Are you sure you want to delete this claim? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(apiUrl(`claims/${claimId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete claim');
      }

      setSuccess('Claim deleted successfully');
      fetchClaims();
      fetchStatistics();
    } catch (err: any) {
      setError(err.message || 'Failed to delete claim');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      patientId: '',
      insuranceId: '',
      providerId: '',
      serviceDate: '',
      diagnosisCodes: '',
      procedureCodes: '',
      serviceDescription: '',
      totalCharges: '',
      claimedAmount: '',
      claimType: 'professional',
      placeOfService: 'Office',
      priorAuthNumber: '',
      notes: ''
    });
    setEditingClaimId(null);
    setShowForm(false);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending': return 'status-badge status-pending';
      case 'submitted': return 'status-badge status-submitted';
      case 'approved': return 'status-badge status-verified';
      case 'denied': return 'status-badge status-failed';
      case 'partially_approved': return 'status-badge status-partial';
      default: return 'status-badge';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="app-container">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className={`main-content ${sidebarCollapsed ? 'expanded' : ''}`}>
        <header className="header">
          <div className="header-left">
            <h1 className="brand-title">MediConnect - Claims Management</h1>
          </div>
          <div className="header-right">
            <div className="user-menu">
              <span className="user-name">{user?.name}</span>
              <button onClick={logout} className="logout-btn">Logout</button>
            </div>
          </div>
        </header>

        <div className="insurance-container">
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          {statistics && (
            <div className="statistics-section">
              <h2>Claims Overview</h2>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Total Claims</div>
                  <div className="stat-value">{statistics.total}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Pending</div>
                  <div className="stat-value">{statistics.pending}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Submitted</div>
                  <div className="stat-value">{statistics.submitted}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Approved</div>
                  <div className="stat-value">{statistics.approved}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Denied</div>
                  <div className="stat-value">{statistics.denied}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Total Claimed</div>
                  <div className="stat-value">{formatCurrency(statistics.totalClaimedAmount)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Total Approved</div>
                  <div className="stat-value">{formatCurrency(statistics.totalApprovedAmount)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Approval Rate</div>
                  <div className="stat-value">{statistics.averageApprovalRate}%</div>
                </div>
              </div>
            </div>
          )}

          {canWriteClaims && (
            <div className="section-header">
              <button
                onClick={() => {
                  resetForm();
                  setShowForm(!showForm);
                }}
                className="btn btn-primary"
                disabled={loading}
              >
                {showForm ? 'Cancel' : '+ New Claim'}
              </button>
            </div>
          )}

          {showForm && canWriteClaims && (
            <div className="form-card">
              <h2>{editingClaimId ? 'Edit Claim' : 'Submit New Claim'}</h2>
              <form onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Insurance *</label>
                    <select
                      name="insuranceId"
                      value={formData.insuranceId}
                      onChange={handleInputChange}
                      required
                      disabled={!!editingClaimId}
                    >
                      <option value="">Select Insurance</option>
                      {insuranceRecords
                        .filter(ins => ins.status === 'active' && ins.verificationStatus === 'verified')
                        .map(insurance => (
                          <option key={insurance.id} value={insurance.id}>
                            {insurance.insuranceProvider} - {insurance.policyNumber}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Service Date *</label>
                    <input
                      type="date"
                      name="serviceDate"
                      value={formData.serviceDate}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Diagnosis Codes (comma separated)</label>
                    <input
                      type="text"
                      name="diagnosisCodes"
                      value={formData.diagnosisCodes}
                      onChange={handleInputChange}
                      placeholder="e.g., J06.9, R50.9"
                    />
                  </div>

                  <div className="form-group">
                    <label>Procedure Codes (comma separated)</label>
                    <input
                      type="text"
                      name="procedureCodes"
                      value={formData.procedureCodes}
                      onChange={handleInputChange}
                      placeholder="e.g., 99213, 80053"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Service Description *</label>
                  <textarea
                    name="serviceDescription"
                    value={formData.serviceDescription}
                    onChange={handleInputChange}
                    required
                    rows={3}
                    placeholder="Describe the service provided"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Total Charges *</label>
                    <input
                      type="text"
                      name="totalCharges"
                      value={formData.totalCharges}
                      onChange={handleInputChange}
                      required
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-group">
                    <label>Claimed Amount *</label>
                    <input
                      type="text"
                      name="claimedAmount"
                      value={formData.claimedAmount}
                      onChange={handleInputChange}
                      required
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Claim Type</label>
                    <select name="claimType" value={formData.claimType} onChange={handleInputChange}>
                      <option value="professional">Professional</option>
                      <option value="institutional">Institutional</option>
                      <option value="dental">Dental</option>
                      <option value="pharmacy">Pharmacy</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Place of Service</label>
                    <select name="placeOfService" value={formData.placeOfService} onChange={handleInputChange}>
                      <option value="Office">Office</option>
                      <option value="Hospital">Hospital</option>
                      <option value="Emergency Room">Emergency Room</option>
                      <option value="Laboratory">Laboratory</option>
                      <option value="Telehealth">Telehealth</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Prior Authorization Number</label>
                  <input
                    type="text"
                    name="priorAuthNumber"
                    value={formData.priorAuthNumber}
                    onChange={handleInputChange}
                    placeholder="If applicable"
                  />
                </div>

                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows={2}
                    placeholder="Additional notes"
                  />
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="btn btn-secondary"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Saving...' : editingClaimId ? 'Update Claim' : 'Create Claim'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="claims-list">
            <h2>Claims History</h2>
            {loading && <p>Loading...</p>}
            {!loading && claims.length === 0 && (
              <p className="empty-message">No claims found</p>
            )}
            {!loading && claims.length > 0 && (
              <div className="insurance-cards">
                {claims.map(claim => (
                  <div key={claim.id} className="insurance-card">
                    <div className="card-header">
                      <div className="card-title">
                        <h3>{claim.claimNumber}</h3>
                        <span className={getStatusBadgeClass(claim.status)}>
                          {claim.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <div className="card-meta">
                        Service Date: {formatDate(claim.serviceDate)}
                      </div>
                    </div>

                    <div className="card-body">
                      <div className="info-row">
                        <span className="info-label">Insurance:</span>
                        <span className="info-value">{claim.insuranceProvider}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Policy Number:</span>
                        <span className="info-value">{claim.policyNumber}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Provider:</span>
                        <span className="info-value">{claim.providerName}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Service:</span>
                        <span className="info-value">{claim.serviceDescription}</span>
                      </div>
                      {claim.diagnosisCodes.length > 0 && (
                        <div className="info-row">
                          <span className="info-label">Diagnosis Codes:</span>
                          <span className="info-value">{claim.diagnosisCodes.join(', ')}</span>
                        </div>
                      )}
                      {claim.procedureCodes.length > 0 && (
                        <div className="info-row">
                          <span className="info-label">Procedure Codes:</span>
                          <span className="info-value">{claim.procedureCodes.join(', ')}</span>
                        </div>
                      )}
                      <div className="info-row">
                        <span className="info-label">Total Charges:</span>
                        <span className="info-value">{formatCurrency(claim.totalCharges)}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Claimed Amount:</span>
                        <span className="info-value">{formatCurrency(claim.claimedAmount)}</span>
                      </div>
                      {claim.approvedAmount > 0 && (
                        <div className="info-row">
                          <span className="info-label">Approved Amount:</span>
                          <span className="info-value approved">{formatCurrency(claim.approvedAmount)}</span>
                        </div>
                      )}
                      {claim.deniedAmount > 0 && (
                        <div className="info-row">
                          <span className="info-label">Denied Amount:</span>
                          <span className="info-value denied">{formatCurrency(claim.deniedAmount)}</span>
                        </div>
                      )}
                      {claim.denialReason && (
                        <div className="info-row">
                          <span className="info-label">Denial Reason:</span>
                          <span className="info-value error">{claim.denialReason}</span>
                        </div>
                      )}
                      <div className="info-row">
                        <span className="info-label">Submitted:</span>
                        <span className="info-value">{formatDate(claim.submissionDate)}</span>
                      </div>
                    </div>

                    {canWriteClaims && (
                      <div className="card-actions">
                        {claim.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleEdit(claim)}
                              className="btn btn-sm btn-secondary"
                              disabled={loading}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleSubmitClaim(claim.id)}
                              className="btn btn-sm btn-primary"
                              disabled={loading}
                            >
                              Submit to Insurance
                            </button>
                            <button
                              onClick={() => handleDelete(claim.id)}
                              className="btn btn-sm btn-danger"
                              disabled={loading}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Claims;
