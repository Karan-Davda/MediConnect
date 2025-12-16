import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import NotificationIcon from '../components/NotificationIcon';
import { apiUrl } from '../config/api';
import './Prescriptions.css';

interface Prescription {
  id: string;
  patientId: string;
  patientName?: string;
  medicalRecordId?: string;
  providerId: string;
  providerName: string;
  medicationName: string;
  medicationCode?: string;
  dosage: string;
  dosageUnit: string;
  form: string;
  frequency: string;
  route: string;
  duration: string;
  quantity: number;
  refills: number;
  startDate: string;
  endDate?: string;
  instructions?: string;
  indication?: string;
  status: string;
  pharmacyId?: string;
  pharmacyName?: string;
  sentToPharmacyDate?: string;
  filledDate?: string;
  notes?: string;
  priority: string;
  substitutionAllowed: boolean;
  daw: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Pharmacy {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phoneNumber: string;
  deliveryAvailable: boolean;
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
}

const Prescriptions: React.FC = () => {
  const { token, user, isAuthenticated, hasRole, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [loadingPharmacies, setLoadingPharmacies] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingPrescriptionId, setEditingPrescriptionId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    patientId: '',
    medicationName: '',
    medicationCode: '',
    dosage: '',
    dosageUnit: 'mg',
    form: 'tablet',
    frequency: '',
    route: 'oral',
    duration: '',
    quantity: '',
    refills: '0',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    instructions: '',
    indication: '',
    pharmacyId: '',
    notes: '',
    priority: 'routine',
    substitutionAllowed: true,
    daw: false
  });

  const canPrescribe = hasRole(['doctor', 'clinic_admin']);
  const canViewPrescriptions = hasRole(['doctor', 'clinic_staff', 'clinic_admin', 'patient']);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (canPrescribe || hasRole(['clinic_staff', 'clinic_admin'])) {
      fetchPatients();
      fetchPharmacies();
    }

    // Always fetch prescriptions on mount
    fetchPrescriptions();
  }, [isAuthenticated, navigate, token, user]);

  const fetchPatients = async () => {
    setLoadingPatients(true);
    try {
      const response = await fetch(apiUrl('medical-records/patients'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch patients');
      }

      const data = await response.json();
      setPatients(data.patients || []);
    } catch (err: any) {
      console.error('Error fetching patients:', err);
    } finally {
      setLoadingPatients(false);
    }
  };

  const fetchPharmacies = async () => {
    setLoadingPharmacies(true);
    try {
      const response = await fetch(apiUrl('prescriptions/pharmacies/list'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch pharmacies');
      }

      const data = await response.json();
      setPharmacies(data);
    } catch (err: any) {
      console.error('Error fetching pharmacies:', err);
    } finally {
      setLoadingPharmacies(false);
    }
  };

  const fetchPrescriptions = async (patientId?: string) => {
    setLoading(true);
    setError('');
    try {
      let url = 'prescriptions';
      if (patientId) {
        // Ensure patientId is in the correct format for the backend
        const formattedPatientId = patientId.startsWith('patient_') ? patientId : `patient_${patientId}`;
        url += `?patientId=${encodeURIComponent(formattedPatientId)}`;
      } else if (user?.role === 'patient') {
        // For patients, backend automatically filters to show only confirmed prescriptions (sent or filled)
        url = `prescriptions`;
      }

      console.log('[PRESCRIPTIONS] Fetching from:', apiUrl(url));
      
      const response = await fetch(apiUrl(url), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch prescriptions: ${response.status}`);
      }

      const data = await response.json();
      console.log('[PRESCRIPTIONS] Received data:', data);
      
      // Handle both array and object with array property
      const prescriptionsArray = Array.isArray(data) ? data : (data.prescriptions || data.data || []);
      setPrescriptions(prescriptionsArray);
      
      if (prescriptionsArray.length === 0) {
        console.log('[PRESCRIPTIONS] No prescriptions found');
      }
    } catch (err: any) {
      console.error('[PRESCRIPTIONS] Error:', err);
      setError(err.message || 'Failed to fetch prescriptions');
    } finally {
      setLoading(false);
    }
  };

  const handlePatientChange = (patientId: string) => {
    setSelectedPatient(patientId);
    if (patientId) {
      fetchPrescriptions(patientId);
    } else {
      fetchPrescriptions();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      if (name === 'dosage') {
        const dosagePattern = /^[0-9]*\.?[0-9]*$/;
        if (value === '' || dosagePattern.test(value)) {
          setFormData(prev => ({ ...prev, [name]: value }));
        }
        return;
      }

      if (name === 'frequency') {
        const frequencyPattern = /^[0-9]*\.?[0-9]*\s*(times?|x)?\s*(per|a|\/)?(\s*(day|daily|week|weekly|hour|hourly|month|monthly))?$/i;
        if (value === '' || frequencyPattern.test(value) || /^[0-9]*$/.test(value)) {
          setFormData(prev => ({ ...prev, [name]: value }));
        }
        return;
      }

      if (name === 'duration') {
        const durationPattern = /^[0-9]*\.?[0-9]*\s*(day|days|week|weeks|month|months|year|years)?$/i;
        if (value === '' || durationPattern.test(value) || /^[0-9]*$/.test(value)) {
          setFormData(prev => ({ ...prev, [name]: value }));
        }
        return;
      }

      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!formData.patientId || !formData.medicationName || !formData.dosage ||
        !formData.frequency || !formData.duration || !formData.quantity) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    const dosagePattern = /^[0-9]+\.?[0-9]*$/;
    if (!dosagePattern.test(formData.dosage)) {
      setError('Please enter a valid dosage (numbers only)');
      setLoading(false);
      return;
    }

    const frequencyPattern = /^[0-9]+\.?[0-9]*\s*(times?|x)?\s*(per|a|\/)?(\s*(day|daily|week|weekly|hour|hourly|month|monthly))?$/i;
    if (!frequencyPattern.test(formData.frequency) && !/^[0-9]+$/.test(formData.frequency)) {
      setError('Please enter a valid frequency (e.g., "3 times daily" or "2")');
      setLoading(false);
      return;
    }

    const durationPattern = /^[0-9]+\.?[0-9]*\s*(day|days|week|weeks|month|months|year|years)$/i;
    if (!durationPattern.test(formData.duration) && !/^[0-9]+$/.test(formData.duration)) {
      setError('Please enter a valid duration (e.g., "7 days" or "2 weeks")');
      setLoading(false);
      return;
    }

    try {
      const url = editingPrescriptionId
        ? `prescriptions/${editingPrescriptionId}`
        : 'prescriptions';

      const method = editingPrescriptionId ? 'PUT' : 'POST';

      const response = await fetch(apiUrl(url), {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          quantity: parseInt(formData.quantity),
          refills: parseInt(formData.refills)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save prescription');
      }

      setSuccess(editingPrescriptionId ? 'Prescription updated successfully' : 'Prescription created successfully');
      resetForm();
      fetchPrescriptions(selectedPatient);
    } catch (err: any) {
      setError(err.message || 'Failed to save prescription');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (prescription: Prescription) => {
    setEditingPrescriptionId(prescription.id);
    setFormData({
      patientId: prescription.patientId,
      medicationName: prescription.medicationName,
      medicationCode: prescription.medicationCode || '',
      dosage: prescription.dosage,
      dosageUnit: prescription.dosageUnit,
      form: prescription.form,
      frequency: prescription.frequency,
      route: prescription.route,
      duration: prescription.duration,
      quantity: prescription.quantity.toString(),
      refills: prescription.refills.toString(),
      startDate: prescription.startDate.split('T')[0],
      endDate: prescription.endDate ? prescription.endDate.split('T')[0] : '',
      instructions: prescription.instructions || '',
      indication: prescription.indication || '',
      pharmacyId: prescription.pharmacyId || '',
      notes: prescription.notes || '',
      priority: prescription.priority,
      substitutionAllowed: prescription.substitutionAllowed,
      daw: prescription.daw
    });
    setShowForm(true);
  };

  const handleSendToPharmacy = async (prescriptionId: string) => {
    if (!window.confirm('Confirm and send this prescription to the selected pharmacy? Once confirmed, it will be visible to the patient.')) {
      return;
    }

    const prescription = prescriptions.find(p => p.id === prescriptionId);
    if (!prescription?.pharmacyId) {
      setError('Please select a pharmacy before confirming');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(apiUrl(`prescriptions/${prescriptionId}/send-to-pharmacy`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ pharmacyId: prescription.pharmacyId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send prescription');
      }

      setSuccess('Prescription confirmed and sent to pharmacy successfully. It is now visible to the patient.');
      fetchPrescriptions(selectedPatient);
    } catch (err: any) {
      setError(err.message || 'Failed to send prescription');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (prescriptionId: string, newStatus: string) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(apiUrl(`prescriptions/${prescriptionId}/status`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update status');
      }

      setSuccess(`Prescription marked as ${newStatus}`);
      fetchPrescriptions(selectedPatient);
    } catch (err: any) {
      setError(err.message || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (prescriptionId: string) => {
    if (!window.confirm('Are you sure you want to cancel this prescription?')) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(apiUrl(`prescriptions/${prescriptionId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel prescription');
      }

      setSuccess('Prescription cancelled successfully');
      fetchPrescriptions(selectedPatient);
    } catch (err: any) {
      setError(err.message || 'Failed to cancel prescription');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      patientId: '',
      medicationName: '',
      medicationCode: '',
      dosage: '',
      dosageUnit: 'mg',
      form: 'tablet',
      frequency: '',
      route: 'oral',
      duration: '',
      quantity: '',
      refills: '0',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      instructions: '',
      indication: '',
      pharmacyId: '',
      notes: '',
      priority: 'routine',
      substitutionAllowed: true,
      daw: false
    });
    setEditingPrescriptionId(null);
    setShowForm(false);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending': return 'status-badge status-pending';
      case 'sent': return 'status-badge status-sent';
      case 'filled': return 'status-badge status-filled';
      case 'cancelled': return 'status-badge status-cancelled';
      case 'expired': return 'status-badge status-expired';
      default: return 'status-badge';
    }
  };

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case 'stat': return 'priority-badge priority-stat';
      case 'urgent': return 'priority-badge priority-urgent';
      case 'routine': return 'priority-badge priority-routine';
      default: return 'priority-badge';
    }
  };

  return (
    <div className="dashboard-container">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <header className="header">
          <div className="header-left">
            <h1 className="brand-title">MediConnect - Prescription Management</h1>
          </div>
          <div className="header-right">
            <div className="user-menu">
              <NotificationIcon />
              <span className="user-name">{user?.name}</span>
              <button onClick={logout} className="logout-btn">Logout</button>
            </div>
          </div>
        </header>

        <div className="prescriptions-container">
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          {/* Filters */}
          {(canPrescribe || hasRole(['clinic_staff', 'clinic_admin'])) && (
            <div className="filters-section">
              <div className="filter-group">
                <label>Filter by Patient:</label>
                <select
                  value={selectedPatient}
                  onChange={(e) => handlePatientChange(e.target.value)}
                  disabled={loadingPatients}
                >
                  <option value="">All Patients</option>
                  {Array.isArray(patients) && patients.map(patient => (
                    <option key={patient.id} value={patient.id}>
                      {patient.fullName}
                    </option>
                  ))}
                </select>
              </div>

              {canPrescribe && (
                <button
                  onClick={() => setShowForm(!showForm)}
                  className="btn-new-prescription"
                  disabled={loading}
                >
                  {showForm ? 'Cancel' : '+ New Prescription'}
                </button>
              )}
            </div>
          )}

          {/* Prescription Form */}
          {showForm && canPrescribe && (
            <div className="form-card">
              <h2>{editingPrescriptionId ? 'Edit Prescription' : 'New Prescription'}</h2>
              <form onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Patient *</label>
                    <select
                      name="patientId"
                      value={formData.patientId}
                      onChange={handleInputChange}
                      required
                      disabled={!!editingPrescriptionId}
                    >
                      <option value="">Select Patient</option>
                      {Array.isArray(patients) && patients.map(patient => (
                        <option key={patient.id} value={patient.id}>
                          {patient.fullName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Medication Name *</label>
                    <input
                      type="text"
                      name="medicationName"
                      value={formData.medicationName}
                      onChange={handleInputChange}
                      required
                      placeholder="e.g., Amoxicillin"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Dosage *</label>
                    <input
                      type="text"
                      name="dosage"
                      value={formData.dosage}
                      onChange={handleInputChange}
                      required
                      placeholder="e.g., 500"
                    />
                  </div>

                  <div className="form-group">
                    <label>Unit *</label>
                    <select name="dosageUnit" value={formData.dosageUnit} onChange={handleInputChange}>
                      <option value="mg">mg</option>
                      <option value="mcg">mcg</option>
                      <option value="g">g</option>
                      <option value="ml">ml</option>
                      <option value="units">units</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Form *</label>
                    <select name="form" value={formData.form} onChange={handleInputChange}>
                      <option value="tablet">Tablet</option>
                      <option value="capsule">Capsule</option>
                      <option value="liquid">Liquid</option>
                      <option value="injection">Injection</option>
                      <option value="cream">Cream</option>
                      <option value="ointment">Ointment</option>
                      <option value="inhaler">Inhaler</option>
                      <option value="patch">Patch</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Route *</label>
                    <select name="route" value={formData.route} onChange={handleInputChange}>
                      <option value="oral">Oral</option>
                      <option value="topical">Topical</option>
                      <option value="injection">Injection</option>
                      <option value="inhalation">Inhalation</option>
                      <option value="transdermal">Transdermal</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Frequency *</label>
                    <input
                      type="text"
                      name="frequency"
                      value={formData.frequency}
                      onChange={handleInputChange}
                      required
                      placeholder="e.g., Three times daily"
                    />
                  </div>

                  <div className="form-group">
                    <label>Duration *</label>
                    <input
                      type="text"
                      name="duration"
                      value={formData.duration}
                      onChange={handleInputChange}
                      required
                      placeholder="e.g., 7 days"
                    />
                  </div>

                  <div className="form-group">
                    <label>Quantity *</label>
                    <input
                      type="number"
                      name="quantity"
                      value={formData.quantity}
                      onChange={handleInputChange}
                      required
                      min="1"
                    />
                  </div>

                  <div className="form-group">
                    <label>Refills</label>
                    <input
                      type="number"
                      name="refills"
                      value={formData.refills}
                      onChange={handleInputChange}
                      min="0"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Pharmacy</label>
                    <select name="pharmacyId" value={formData.pharmacyId} onChange={handleInputChange}>
                      <option value="">Select Pharmacy</option>
                      {Array.isArray(pharmacies) && pharmacies.map(pharmacy => (
                        <option key={pharmacy.id} value={pharmacy.id}>
                          {pharmacy.name} - {pharmacy.city}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Priority</label>
                    <select name="priority" value={formData.priority} onChange={handleInputChange}>
                      <option value="routine">Routine</option>
                      <option value="urgent">Urgent</option>
                      <option value="stat">STAT</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Indication (Reason for Prescription)</label>
                  <input
                    type="text"
                    name="indication"
                    value={formData.indication}
                    onChange={handleInputChange}
                    placeholder="e.g., Upper respiratory infection"
                  />
                </div>

                <div className="form-group">
                  <label>Patient Instructions</label>
                  <textarea
                    name="instructions"
                    value={formData.instructions}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder="e.g., Take with food. Do not take with dairy products."
                  />
                </div>

                <div className="form-group">
                  <label>Provider Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows={2}
                  />
                </div>

                <div className="form-row checkbox-row">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="substitutionAllowed"
                      checked={formData.substitutionAllowed}
                      onChange={handleInputChange}
                    />
                    Allow Generic Substitution
                  </label>

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="daw"
                      checked={formData.daw}
                      onChange={handleInputChange}
                    />
                    Dispense As Written (Brand Name Only)
                  </label>
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Saving...' : (editingPrescriptionId ? 'Update Prescription' : 'Create Prescription')}
                  </button>
                  <button type="button" onClick={resetForm} className="btn btn-secondary" disabled={loading}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Prescriptions List */}
          <div className="prescriptions-list">
            <h2>Prescriptions {selectedPatient && `for ${patients.find(p => p.id === selectedPatient)?.fullName}`}</h2>

            {loading && <div className="loading">Loading prescriptions...</div>}

            {!loading && prescriptions.length === 0 && (
              <div className="no-data">No prescriptions found</div>
            )}

            {!loading && prescriptions.length > 0 && (
              <div className="prescription-cards">
                {prescriptions.map(prescription => (
                  <div key={prescription.id} className="prescription-card">
                    <div className="prescription-header">
                      <div>
                        <h3>{prescription.medicationName}</h3>
                        {prescription.patientName && (
                          <p className="prescription-meta">
                            Patient: {prescription.patientName}
                          </p>
                        )}
                        <p className="prescription-meta">
                          Prescribed by {prescription.providerName} on{' '}
                          {new Date(prescription.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="prescription-badges">
                        <span className={getStatusBadgeClass(prescription.status)}>
                          {prescription.status.toUpperCase()}
                        </span>
                        <span className={getPriorityBadgeClass(prescription.priority)}>
                          {prescription.priority.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="prescription-details">
                      <div className="detail-row">
                        <span className="detail-label">Dosage:</span>
                        <span>{prescription.dosage} {prescription.dosageUnit}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Form:</span>
                        <span>{prescription.form}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Frequency:</span>
                        <span>{prescription.frequency}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Duration:</span>
                        <span>{prescription.duration}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Quantity:</span>
                        <span>{prescription.quantity}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Refills:</span>
                        <span>{prescription.refills}</span>
                      </div>
                      {prescription.indication && (
                        <div className="detail-row">
                          <span className="detail-label">Indication:</span>
                          <span>{prescription.indication}</span>
                        </div>
                      )}
                      {prescription.instructions && (
                        <div className="detail-row">
                          <span className="detail-label">Instructions:</span>
                          <span>{prescription.instructions}</span>
                        </div>
                      )}
                      {prescription.pharmacyName && (
                        <div className="detail-row">
                          <span className="detail-label">Pharmacy:</span>
                          <span>{prescription.pharmacyName}</span>
                        </div>
                      )}
                      {prescription.sentToPharmacyDate && (
                        <div className="detail-row">
                          <span className="detail-label">Sent to Pharmacy:</span>
                          <span>{new Date(prescription.sentToPharmacyDate).toLocaleDateString()}</span>
                        </div>
                      )}
                      {prescription.filledDate && (
                        <div className="detail-row">
                          <span className="detail-label">Filled Date:</span>
                          <span>{new Date(prescription.filledDate).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>

                    {canPrescribe && prescription.status !== 'cancelled' && prescription.status !== 'filled' && (
                      <div className="prescription-actions">
                        {prescription.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleEdit(prescription)}
                              className="btn-action btn-edit"
                            >
                              Edit
                            </button>
                            {prescription.pharmacyId ? (
                              <button
                                onClick={() => handleSendToPharmacy(prescription.id)}
                                className="btn-action btn-confirm"
                              >
                                Confirm & Send to Pharmacy
                              </button>
                            ) : (
                              <span className="prescription-warning">Select a pharmacy to confirm</span>
                            )}
                            <button
                              onClick={() => handleCancel(prescription.id)}
                              className="btn-action btn-cancel"
                            >
                              Cancel
                            </button>
                          </>
                        )}

                        {prescription.status === 'sent' && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(prescription.id, 'filled')}
                              className="btn btn-small btn-success"
                            >
                              Mark as Filled
                            </button>
                            <button
                              onClick={() => handleCancel(prescription.id)}
                              className="btn btn-small btn-danger"
                            >
                              Cancel
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

export default Prescriptions;
