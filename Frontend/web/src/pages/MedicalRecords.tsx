import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import ScanViewer from '../components/ScanViewer';
import { apiUrl } from '../config/api';
import './MedicalRecords.css';

interface Diagnosis {
  code: string;
  description: string;
  status: string;
  date?: string;
  notes?: string;
}

interface Treatment {
  type: string;
  name: string;
  description?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  status: string;
  notes?: string;
}

interface LabResult {
  testName: string;
  testCode?: string;
  result: string;
  unit?: string;
  referenceRange?: string;
  status: string;
  notes?: string;
}

interface ScanAttachment {
  id: string;
  name: string;
  type: string;
  url: string;
  date?: string;
  size?: number;
}

interface MedicalRecord {
  id: string;
  patientId: string;
  visitDate: string;
  visitType: string;
  providerName: string;
  chiefComplaint?: string;
  diagnoses: Diagnosis[];
  treatments: Treatment[];
  labResults: LabResult[];
  vitalSigns?: {
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    weight?: number;
    height?: number;
  };
  notes?: string;
  attachments?: ScanAttachment[];
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
}

const MedicalRecords: React.FC = () => {
  const { token, user, isAuthenticated, hasRole, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  
  // Scan viewer state
  const [showScanViewer, setShowScanViewer] = useState(false);
  const [selectedScans, setSelectedScans] = useState<ScanAttachment[]>([]);
  const [scanViewerIndex, setScanViewerIndex] = useState(0);
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);
  
  // Attachment management state
  const [showAddAttachment, setShowAddAttachment] = useState<string | null>(null);
  const [newAttachment, setNewAttachment] = useState({
    name: '',
    type: '',
    file: null as File | null
  });
  const [uploading, setUploading] = useState(false);
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    patientId: '',
    visitDate: new Date().toISOString().split('T')[0],
    visitType: 'routine',
    chiefComplaint: '',
    diagnoses: [{ code: '', description: '', status: 'confirmed' }] as Diagnosis[],
    treatments: [{ type: 'medication', name: '', dosage: '', frequency: '', status: 'active' }] as Treatment[],
    labResults: [{ testName: '', result: '', status: 'normal' }] as LabResult[],
    vitalSigns: {
      bloodPressure: '',
      heartRate: '',
      temperature: '',
      weight: '',
      height: ''
    },
    notes: '',
    attachments: [] as ScanAttachment[]
  });

  const canManageRecords = hasRole(['doctor', 'clinic_staff', 'clinic_admin']);

  useEffect(() => {
    if (isAuthenticated && canManageRecords) {
      loadPatients();
      loadRecords();
    }
  }, [isAuthenticated, canManageRecords]);

  const loadPatients = async () => {
    try {
      if (!token) {
        console.log('No token available for loading patients');
        return;
      }

      setLoadingPatients(true);
      const response = await fetch(apiUrl('medical-records/patients'), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to load patients:', errorData);
        throw new Error(errorData.error || 'Failed to load patients');
      }
      
      const data = await response.json();
      console.log('Loaded patients:', data);
      setPatients(data.patients || []);
      if (data.patients && data.patients.length === 0) {
        console.warn('No patients found. Make sure sample patients are initialized in the backend.');
      }
    } catch (err: any) {
      console.error('Error loading patients:', err);
      setError(err.message || 'Failed to load patients. Please try again.');
    } finally {
      setLoadingPatients(false);
    }
  };

  const loadRecords = async () => {
    try {
      setLoading(true);
      const url = selectedPatient 
        ? apiUrl(`medical-records/patient/${selectedPatient}`)
        : apiUrl('medical-records');
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to load records');
      
      const data = await response.json();
      setRecords(data.records || data.count ? data.records : []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPatient) {
      loadRecords();
    }
  }, [selectedPatient]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const payload = {
        ...formData,
        diagnoses: formData.diagnoses.filter(d => d.code && d.description),
        treatments: formData.treatments.filter(t => t.name),
        labResults: formData.labResults.filter(l => l.testName && l.result),
        vitalSigns: Object.fromEntries(
          Object.entries(formData.vitalSigns).filter(([_, v]) => v !== '')
        ),
        attachments: formData.attachments.map(att => ({
          name: att.name,
          type: att.type,
          url: att.url,
          date: att.date || new Date().toISOString()
        }))
      };

      const isEditing = editingRecordId !== null;
      const url = isEditing 
        ? apiUrl(`medical-records/${editingRecordId}`)
        : apiUrl('medical-records');
      
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${isEditing ? 'update' : 'add'} record`);
      }

      setSuccess(`Medical record ${isEditing ? 'updated' : 'added'} successfully!`);
      setShowForm(false);
      setEditingRecordId(null);
      resetForm();
      loadRecords();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      patientId: '',
      visitDate: new Date().toISOString().split('T')[0],
      visitType: 'routine',
      chiefComplaint: '',
      diagnoses: [{ code: '', description: '', status: 'confirmed' }],
      treatments: [{ type: 'medication', name: '', dosage: '', frequency: '', status: 'active' }],
      labResults: [{ testName: '', result: '', status: 'normal' }],
      vitalSigns: {
        bloodPressure: '',
        heartRate: '',
        temperature: '',
        weight: '',
        height: ''
      },
      notes: '',
      attachments: []
    });
    setEditingRecordId(null);
  };

  const handleEdit = (record: MedicalRecord) => {
    // Parse visit date - handle both string and Date formats
    let visitDateStr = '';
    try {
      if (typeof record.visitDate === 'string') {
        visitDateStr = record.visitDate.includes('T') 
          ? record.visitDate.split('T')[0]
          : record.visitDate;
      } else {
        visitDateStr = new Date(record.visitDate).toISOString().split('T')[0];
      }
    } catch (e) {
      visitDateStr = new Date().toISOString().split('T')[0];
    }

    // Populate form with record data
    setFormData({
      patientId: record.patientId,
      visitDate: visitDateStr,
      visitType: record.visitType,
      chiefComplaint: record.chiefComplaint || '',
      diagnoses: record.diagnoses.length > 0 ? record.diagnoses : [{ code: '', description: '', status: 'confirmed' }],
      treatments: record.treatments.length > 0 ? record.treatments : [{ type: 'medication', name: '', dosage: '', frequency: '', status: 'active' }],
      labResults: record.labResults.length > 0 ? record.labResults : [{ testName: '', result: '', status: 'normal' }],
      vitalSigns: {
        bloodPressure: record.vitalSigns?.bloodPressure?.toString() || '',
        heartRate: record.vitalSigns?.heartRate?.toString() || '',
        temperature: record.vitalSigns?.temperature?.toString() || '',
        weight: record.vitalSigns?.weight?.toString() || '',
        height: record.vitalSigns?.height?.toString() || ''
      },
      notes: record.notes || '',
      attachments: record.attachments || []
    });
    setEditingRecordId(record.id);
    setShowForm(true);
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleViewScans = (record: MedicalRecord) => {
    // Collect all scans from this record and all other records for comparison
    const allScans: ScanAttachment[] = [];
    records.forEach(r => {
      if (r.attachments && r.attachments.length > 0) {
        allScans.push(...r.attachments);
      }
    });
    
    if (allScans.length === 0) {
      setError('No scans available for viewing');
      return;
    }

    // Find the index of the first scan from the selected record
    const recordScans = record.attachments || [];
    const firstScanIndex = recordScans.length > 0 
      ? allScans.findIndex(s => s.id === recordScans[0].id)
      : 0;

    setSelectedScans(allScans);
    setScanViewerIndex(Math.max(0, firstScanIndex));
    setShowScanViewer(true);
    // Store the record ID for saving annotations
    setCurrentRecordId(record.id);
  };

  const getScanCount = (record: MedicalRecord): number => {
    return record.attachments?.length || 0;
  };

  const isImagingScan = (attachment: ScanAttachment): boolean => {
    const imagingTypes = ['x-ray', 'xray', 'mri', 'ct', 'ct scan', 'ultrasound', 'scan', 'image'];
    const type = attachment.type?.toLowerCase() || '';
    const name = attachment.name?.toLowerCase() || '';
    return imagingTypes.some(t => type.includes(t) || name.includes(t));
  };

  const handleAddAttachmentToRecord = async (recordId: string) => {
    if (!newAttachment.name || !newAttachment.type || !newAttachment.file) {
      setError('Please fill in all fields and select an image file');
      return;
    }

    try {
      setUploading(true);
      setError('');
      
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('scanFile', newAttachment.file);
      formData.append('name', newAttachment.name);
      formData.append('type', newAttachment.type);

      console.log('Uploading file:', {
        recordId,
        name: newAttachment.name,
        type: newAttachment.type,
        fileName: newAttachment.file.name,
        fileSize: newAttachment.file.size,
        fileType: newAttachment.file.type
      });

      const uploadUrl = apiUrl(`medical-records/${recordId}/attachments`);
      console.log('Upload URL:', uploadUrl);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type, let browser set it with boundary for FormData
        },
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Failed to add attachment';
        try {
          const error = await response.json();
          errorMessage = error.error || error.message || errorMessage;
          console.error('Upload error:', error);
        } catch (e) {
          const text = await response.text();
          console.error('Upload error (non-JSON):', text);
          errorMessage = text || errorMessage;
        }
        throw new Error(errorMessage);
      }

      setSuccess('Scan attachment uploaded successfully!');
      setNewAttachment({ name: '', type: '', file: null });
      setShowAddAttachment(null);
      loadRecords();
    } catch (err: any) {
      setError(err.message || 'Failed to upload attachment');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file (JPEG, PNG, GIF, etc.)');
        e.target.value = ''; // Reset file input
        return;
      }
      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        e.target.value = ''; // Reset file input
        return;
      }
      setNewAttachment({ ...newAttachment, file });
      setError('');
      console.log('File selected:', file.name, file.size, file.type);
    }
  };

  const handleDeleteScan = async (scanId: string) => {
    try {
      // Find the record that contains this scan
      const record = records.find(r => 
        r.attachments && r.attachments.some(a => a.id === scanId)
      );
      
      if (!record) {
        setError('Record not found');
        return;
      }

      const response = await fetch(apiUrl(`medical-records/${record.id}/attachments/${scanId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete scan');
      }

      setSuccess('Scan deleted successfully!');
      
      // Close scan viewer if the deleted scan was being viewed
      if (selectedScans.some(s => s.id === scanId)) {
        setShowScanViewer(false);
      }
      
      // Reload records to update the list
      loadRecords();
    } catch (err: any) {
      setError(err.message || 'Failed to delete scan');
    }
  };

  const addDiagnosis = () => {
    setFormData({
      ...formData,
      diagnoses: [...formData.diagnoses, { code: '', description: '', status: 'confirmed' }]
    });
  };

  const addTreatment = () => {
    setFormData({
      ...formData,
      treatments: [...formData.treatments, { type: 'medication', name: '', dosage: '', frequency: '', status: 'active' }]
    });
  };

  const addLabResult = () => {
    setFormData({
      ...formData,
      labResults: [...formData.labResults, { testName: '', result: '', status: 'normal' }]
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="medical-records-container">
        <div className="auth-required">
          <h2>Authentication Required</h2>
          <p>Please log in to access medical records.</p>
        </div>
      </div>
    );
  }

  if (!canManageRecords) {
    return (
      <div className="medical-records-container">
        <div className="access-denied">
          <h2>Access Denied</h2>
          <p>Only doctors, clinic staff, and clinic administrators can manage medical records.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <Sidebar 
        isCollapsed={sidebarCollapsed} 
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
      />

      <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <header className="header">
          <div className="header-left">
            <h1 className="brand-title">Medical Records</h1>
          </div>
          <div className="header-right">
            {isAuthenticated ? (
              <div className="user-menu">
                <span className="user-name">{user?.name || user?.email}</span>
                <button className="logout-btn" onClick={async () => {
                  await logout();
                  navigate('/login');
                }}>
                  Logout
                </button>
              </div>
            ) : (
              <button className="login-btn" onClick={() => navigate('/login')}>
                Login
              </button>
            )}
          </div>
        </header>

        <div className="dashboard-content">
          {error && (
            <div className="alert alert-error">
              <span>❌</span> {error}
            </div>
          )}
          
          {success && (
            <div className="alert alert-success">
              <span>✅</span> {success}
            </div>
          )}

          <div className="medical-records-controls">
            <div className="control-group">
              <label>Filter by Patient:</label>
              <select 
                value={selectedPatient} 
                onChange={(e) => setSelectedPatient(e.target.value)}
                className="patient-select"
              >
                <option value="">All Patients</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.fullName}</option>
                ))}
              </select>
            </div>
            
            <button 
              className="create-record-btn"
              onClick={() => {
                if (showForm) {
                  setShowForm(false);
                  resetForm();
                } else {
                  resetForm();
                  setShowForm(true);
                }
              }}
            >
              {showForm ? 'Cancel' : '+ Add Medical Record'}
            </button>
          </div>

          {showForm && (
            <form className="medical-record-form" onSubmit={handleSubmit}>
              <h3>{editingRecordId ? 'Update Medical Record' : 'Add Medical Record'}</h3>
              
              <div className="form-group">
                <label>Patient *</label>
                <select
                  required
                  value={formData.patientId}
                  onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                  disabled={loadingPatients}
                >
                  <option value="">
                    {loadingPatients ? 'Loading patients...' : patients.length === 0 ? 'No patients available' : 'Select Patient'}
                  </option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.fullName}</option>
                  ))}
                </select>
                {patients.length === 0 && !loadingPatients && (
                  <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                    No patients found. Please ensure the backend has sample patients initialized.
                  </small>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Visit Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.visitDate}
                    onChange={(e) => setFormData({ ...formData, visitDate: e.target.value })}
                    onClick={(e) => {
                      // Ensure clicking anywhere on the input opens the calendar
                      try {
                        if (e.currentTarget.showPicker) {
                          e.currentTarget.showPicker();
                        }
                      } catch (err) {
                        // Fallback: browser will handle it natively
                        console.log('Calendar picker not available');
                      }
                    }}
                    onFocus={(e) => {
                      // Also open calendar on focus
                      try {
                        if (e.currentTarget.showPicker) {
                          e.currentTarget.showPicker();
                        }
                      } catch (err) {
                        // Fallback: browser will handle it natively
                      }
                    }}
                  />
                </div>
                <div className="form-group">
                  <label>Visit Type *</label>
                  <select
                    required
                    value={formData.visitType}
                    onChange={(e) => setFormData({ ...formData, visitType: e.target.value })}
                  >
                    <option value="routine">Routine</option>
                    <option value="emergency">Emergency</option>
                    <option value="follow-up">Follow-up</option>
                    <option value="consultation">Consultation</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Chief Complaint</label>
                <input
                  type="text"
                  value={formData.chiefComplaint}
                  onChange={(e) => setFormData({ ...formData, chiefComplaint: e.target.value })}
                  placeholder="Patient's main complaint"
                />
              </div>

              <div className="form-section">
                <h4>Vital Signs</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Blood Pressure</label>
                    <input
                      type="text"
                      value={formData.vitalSigns.bloodPressure}
                      onChange={(e) => setFormData({
                        ...formData,
                        vitalSigns: { ...formData.vitalSigns, bloodPressure: e.target.value }
                      })}
                      placeholder="120/80"
                    />
                  </div>
                  <div className="form-group">
                    <label>Heart Rate (bpm)</label>
                    <input
                      type="number"
                      value={formData.vitalSigns.heartRate}
                      onChange={(e) => setFormData({
                        ...formData,
                        vitalSigns: { ...formData.vitalSigns, heartRate: e.target.value }
                      })}
                      placeholder="72"
                    />
                  </div>
                  <div className="form-group">
                    <label>Temperature (°F)</label>
                    <input
                      type="number"
                      value={formData.vitalSigns.temperature}
                      onChange={(e) => setFormData({
                        ...formData,
                        vitalSigns: { ...formData.vitalSigns, temperature: e.target.value }
                      })}
                      placeholder="98.6"
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <div className="section-header">
                  <h4>Diagnoses</h4>
                  <button type="button" onClick={addDiagnosis} className="btn btn-sm">+ Add</button>
                </div>
                {formData.diagnoses.map((diag, idx) => (
                  <div key={idx} className="form-row">
                    <div className="form-group">
                      <label>ICD-10 Code</label>
                      <input
                        type="text"
                        value={diag.code}
                        onChange={(e) => {
                          const newDiag = [...formData.diagnoses];
                          newDiag[idx].code = e.target.value;
                          setFormData({ ...formData, diagnoses: newDiag });
                        }}
                        placeholder="R51"
                      />
                    </div>
                    <div className="form-group">
                      <label>Description</label>
                      <input
                        type="text"
                        value={diag.description}
                        onChange={(e) => {
                          const newDiag = [...formData.diagnoses];
                          newDiag[idx].description = e.target.value;
                          setFormData({ ...formData, diagnoses: newDiag });
                        }}
                        placeholder="Headache"
                      />
                    </div>
                    <div className="form-group">
                      <label>Status</label>
                      <select
                        value={diag.status}
                        onChange={(e) => {
                          const newDiag = [...formData.diagnoses];
                          newDiag[idx].status = e.target.value;
                          setFormData({ ...formData, diagnoses: newDiag });
                        }}
                      >
                        <option value="confirmed">Confirmed</option>
                        <option value="rule_out">Rule Out</option>
                        <option value="differential">Differential</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <div className="form-section">
                <div className="section-header">
                  <h4>Treatments</h4>
                  <button type="button" onClick={addTreatment} className="btn btn-sm">+ Add</button>
                </div>
                {formData.treatments.map((treat, idx) => (
                  <div key={idx} className="form-row">
                    <div className="form-group">
                      <label>Type</label>
                      <select
                        value={treat.type}
                        onChange={(e) => {
                          const newTreat = [...formData.treatments];
                          newTreat[idx].type = e.target.value;
                          setFormData({ ...formData, treatments: newTreat });
                        }}
                      >
                        <option value="medication">Medication</option>
                        <option value="procedure">Procedure</option>
                        <option value="therapy">Therapy</option>
                        <option value="surgery">Surgery</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Name</label>
                      <input
                        type="text"
                        value={treat.name}
                        onChange={(e) => {
                          const newTreat = [...formData.treatments];
                          newTreat[idx].name = e.target.value;
                          setFormData({ ...formData, treatments: newTreat });
                        }}
                        placeholder="Ibuprofen"
                      />
                    </div>
                    <div className="form-group">
                      <label>Dosage</label>
                      <input
                        type="text"
                        value={treat.dosage}
                        onChange={(e) => {
                          const newTreat = [...formData.treatments];
                          newTreat[idx].dosage = e.target.value;
                          setFormData({ ...formData, treatments: newTreat });
                        }}
                        placeholder="400mg"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="form-section">
                <div className="section-header">
                  <h4>Lab Results</h4>
                  <button type="button" onClick={addLabResult} className="btn btn-sm">+ Add</button>
                </div>
                {formData.labResults.map((lab, idx) => (
                  <div key={idx} className="form-row">
                    <div className="form-group">
                      <label>Test Name</label>
                      <input
                        type="text"
                        value={lab.testName}
                        onChange={(e) => {
                          const newLab = [...formData.labResults];
                          newLab[idx].testName = e.target.value;
                          setFormData({ ...formData, labResults: newLab });
                        }}
                        placeholder="Complete Blood Count"
                      />
                    </div>
                    <div className="form-group">
                      <label>Result</label>
                      <input
                        type="text"
                        value={lab.result}
                        onChange={(e) => {
                          const newLab = [...formData.labResults];
                          newLab[idx].result = e.target.value;
                          setFormData({ ...formData, labResults: newLab });
                        }}
                        placeholder="Normal"
                      />
                    </div>
                    <div className="form-group">
                      <label>Status</label>
                      <select
                        value={lab.status}
                        onChange={(e) => {
                          const newLab = [...formData.labResults];
                          newLab[idx].status = e.target.value;
                          setFormData({ ...formData, labResults: newLab });
                        }}
                      >
                        <option value="normal">Normal</option>
                        <option value="abnormal">Abnormal</option>
                        <option value="critical">Critical</option>
                        <option value="pending">Pending</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                  placeholder="Additional notes..."
                />
              </div>

              <div className="form-section">
                <div className="section-header">
                  <h4>Medical Scans / Attachments</h4>
                </div>
                <small style={{ color: '#666', marginTop: '8px', display: 'block', marginBottom: '10px' }}>
                  💡 Note: You can add scan attachments after creating the record using the "+ Add Scan" button on the record card.
                </small>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  {editingRecordId ? 'Update Record' : 'Add Record'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}>Cancel</button>
              </div>
            </form>
          )}

          <div className="records-list">
            <h3>Medical Records {selectedPatient && `for ${patients.find(p => p.id === selectedPatient)?.fullName}`}</h3>
            
            {loading ? (
              <div className="loading">Loading records...</div>
            ) : records.length === 0 ? (
              <div className="empty-state">No medical records found.</div>
            ) : (
              <div className="records-grid">
                {records.map(record => (
                  <div key={record.id} className="record-card">
                    <div className="record-header">
                      <h4>{new Date(record.visitDate).toLocaleDateString()}</h4>
                      <div className="record-header-right">
                        <span className="badge">{record.visitType}</span>
                        {canManageRecords && (
                          <button
                            className="edit-record-btn"
                            onClick={() => handleEdit(record)}
                            title="Edit Record"
                            aria-label="Edit Record"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="record-body">
                      <p><strong>Provider:</strong> {record.providerName}</p>
                      {record.chiefComplaint && (
                        <p><strong>Chief Complaint:</strong> {record.chiefComplaint}</p>
                      )}
                      {record.diagnoses.length > 0 && (
                        <div>
                          <strong>Diagnoses:</strong>
                          <ul>
                            {record.diagnoses.map((d, i) => (
                              <li key={i}>{d.code}: {d.description}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {record.treatments.length > 0 && (
                        <div>
                          <strong>Treatments:</strong>
                          <ul>
                            {record.treatments.map((t, i) => (
                              <li key={i}>{t.name} {t.dosage && `(${t.dosage})`}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {record.labResults.length > 0 && (
                        <div>
                          <strong>Lab Results:</strong>
                          <ul>
                            {record.labResults.map((l, i) => (
                              <li key={i}>{l.testName}: {l.result}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="record-scans">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <strong>Medical Scans ({getScanCount(record)}):</strong>
                          {canManageRecords && !showAddAttachment && (
                            <button
                              className="btn btn-sm"
                              onClick={() => {
                                setShowAddAttachment(record.id);
                                setNewAttachment({ name: '', type: '', file: null });
                              }}
                              style={{ fontSize: '12px', padding: '4px 8px' }}
                            >
                              + Add Scan
                            </button>
                          )}
                        </div>
                        
                        {showAddAttachment === record.id && (
                          <div style={{ padding: '10px', background: '#fff', borderRadius: '4px', marginBottom: '10px', border: '1px solid #ddd', maxWidth: '100%', boxSizing: 'border-box' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <strong style={{ fontSize: '13px' }}>Add New Scan</strong>
                              <button
                                onClick={() => {
                                  setShowAddAttachment(null);
                                  setNewAttachment({ name: '', type: '', file: null });
                                }}
                                style={{ background: '#6c757d', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', flexShrink: 0 }}
                                disabled={uploading}
                              >
                                Cancel
                              </button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <input
                                  type="text"
                                  placeholder="Scan Name"
                                  value={newAttachment.name}
                                  onChange={(e) => setNewAttachment({ ...newAttachment, name: e.target.value })}
                                  style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', flex: '1', minWidth: '120px', boxSizing: 'border-box' }}
                                  disabled={uploading}
                                />
                                <select
                                  value={newAttachment.type}
                                  onChange={(e) => setNewAttachment({ ...newAttachment, type: e.target.value })}
                                  style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', flex: '1', minWidth: '120px', boxSizing: 'border-box' }}
                                  disabled={uploading}
                                >
                                  <option value="">Select Type</option>
                                  <option value="X-Ray">X-Ray</option>
                                  <option value="MRI">MRI</option>
                                  <option value="CT Scan">CT Scan</option>
                                  <option value="Ultrasound">Ultrasound</option>
                                  <option value="Other">Other</option>
                                </select>
                              </div>
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleFileChange}
                                  style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', flex: '1', minWidth: '200px', boxSizing: 'border-box' }}
                                  disabled={uploading}
                                />
                                <button
                                  onClick={() => handleAddAttachmentToRecord(record.id)}
                                  className="btn btn-sm"
                                  style={{ fontSize: '12px', padding: '6px 12px', flexShrink: 0, whiteSpace: 'nowrap' }}
                                  disabled={uploading || !newAttachment.file}
                                >
                                  {uploading ? 'Uploading...' : 'Upload'}
                                </button>
                              </div>
                              {newAttachment.file && (
                                <small style={{ color: '#28a745', fontSize: '11px' }}>
                                  ✓ Selected: {newAttachment.file.name} ({(newAttachment.file.size / 1024).toFixed(2)} KB)
                                </small>
                              )}
                            </div>
                            <small style={{ color: '#666', fontSize: '11px', wordBreak: 'break-word', display: 'block' }}>
                              💡 Select an image file (JPEG, PNG, GIF, etc.) up to 10MB. File will be saved with naming: {`{Diagnosis}_{Patient Name}_{Date}`}
                            </small>
                          </div>
                        )}

                        {record.attachments && record.attachments.length > 0 ? (
                          <>
                            <div className="scans-list">
                              {record.attachments.filter(isImagingScan).map((scan, i) => (
                                <div key={scan.id || i} className="scan-item">
                                  <span>📄 {scan.name || `Scan ${i + 1}`}</span>
                                  <span className="scan-type">{scan.type}</span>
                                </div>
                              ))}
                            </div>
                            <button 
                              className="view-scans-btn"
                              onClick={() => handleViewScans(record)}
                              title="View Scans"
                            >
                              🔍 View Scans
                            </button>
                          </>
                        ) : !showAddAttachment && (
                          <p style={{ color: '#666', fontSize: '13px', margin: '8px 0' }}>No scans attached. Click "+ Add Scan" to add one.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showScanViewer && (
        <ScanViewer
          scans={selectedScans.map(scan => {
            let imageUrl = scan.url;
            // If URL starts with /api/medical-records/assets/, convert it to full API URL
            if (scan.url.startsWith('/api/medical-records/assets/')) {
              imageUrl = apiUrl(scan.url.replace('/api/', ''));
            } else if (scan.url.startsWith('/api/')) {
              imageUrl = apiUrl(scan.url.replace('/api/', ''));
            }
            
            // Find which record this scan belongs to
            const scanRecord = records.find(r => 
              r.attachments && r.attachments.some(a => a.id === scan.id)
            );
            
            return {
              id: scan.id,
              url: imageUrl,
              name: scan.name,
              type: scan.type,
              date: scan.date,
              recordId: scanRecord?.id || currentRecordId || undefined
            };
          })}
          onClose={() => {
            setShowScanViewer(false);
            setCurrentRecordId(null);
          }}
          initialScanIndex={scanViewerIndex}
          onDeleteScan={handleDeleteScan}
          canDelete={canManageRecords}
          recordId={currentRecordId || undefined}
        />
      )}
    </div>
  );
};

export default MedicalRecords;

