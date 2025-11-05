import React, { useState, useEffect } from 'react';
import './ClinicOperationsDashboard.css';

interface CheckIn {
  id: string;
  patientId: string;
  appointmentId?: string;
  clinicId: string;
  checkInTime: string;
  status: string;
  queuePosition: number;
  estimatedWaitTime: number;
  providerId?: string;
  reason?: string;
  triageLevel: string;
}

interface WalkIn {
  id: string;
  patientId?: string;
  patientName: string;
  patientEmail?: string;
  patientPhone?: string;
  clinicId: string;
  providerId?: string;
  reason: string;
  triageLevel: string;
  registrationTime: string;
  status: string;
  queuePosition: number;
  estimatedWaitTime: number;
  notes?: string;
}

interface Waitlist {
  id: string;
  patientId?: string;
  patientName: string;
  patientEmail?: string;
  patientPhone?: string;
  clinicId: string;
  providerId?: string;
  preferredDate?: string;
  preferredTimeSlot?: string;
  reason: string;
  priority: string;
  status: string;
  addedAt: string;
  estimatedCallbackDate?: string;
  notes?: string;
}

interface ClinicStatus {
  clinicId: string;
  timestamp: string;
  checkIns: {
    total: number;
    waiting: number;
    inProgress: number;
  };
  walkIns: {
    total: number;
    waiting: number;
    inProgress: number;
    urgent: number;
    high: number;
  };
  waitlist: {
    total: number;
    urgent: number;
    high: number;
  };
  overall: {
    totalWaiting: number;
    totalInProgress: number;
    averageWaitTime: number;
  };
}

const ClinicOperationsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'checkin' | 'walkin' | 'waitlist'>('overview');
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [walkIns, setWalkIns] = useState<WalkIn[]>([]);
  const [waitlists, setWaitlists] = useState<Waitlist[]>([]);
  const [clinicStatus, setClinicStatus] = useState<ClinicStatus | null>(null);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);

  const clinicId = '1';

  const [newCheckIn, setNewCheckIn] = useState({
    patientId: '',
    appointmentId: '',
    providerId: '',
    reason: '',
    triageLevel: 'routine'
  });

  const [newWalkIn, setNewWalkIn] = useState({
    patientName: '',
    patientEmail: '',
    patientPhone: '',
    providerId: '',
    reason: '',
    triageLevel: 'routine',
    notes: ''
  });

  const [newWaitlist, setNewWaitlist] = useState({
    patientName: '',
    patientEmail: '',
    patientPhone: '',
    providerId: '',
    preferredDate: '',
    preferredTimeSlot: '',
    reason: '',
    priority: 'normal',
    notes: ''
  });

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const headers = { 'Authorization': `Bearer ${token}` };

      const [checkInsRes, walkInsRes, waitlistsRes, statusRes] = await Promise.all([
        fetch(`http://localhost:3001/api/clinic-operations/check-ins?clinicId=${clinicId}`, { headers }),
        fetch(`http://localhost:3001/api/clinic-operations/walk-ins?clinicId=${clinicId}`, { headers }),
        fetch(`http://localhost:3001/api/clinic-operations/waitlist?clinicId=${clinicId}`, { headers }),
        fetch(`http://localhost:3001/api/clinic-operations/clinic-status/${clinicId}`, { headers })
      ]);

      if (checkInsRes.ok) setCheckIns(await checkInsRes.json());
      if (walkInsRes.ok) setWalkIns(await walkInsRes.json());
      if (waitlistsRes.ok) setWaitlists(await waitlistsRes.json());
      if (statusRes.ok) setClinicStatus(await statusRes.json());
    } catch (error) {
      console.error('Failed to load clinic operations data:', error);
    }
  };

  const handleCheckIn = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('http://localhost:3001/api/clinic-operations/check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newCheckIn,
          clinicId
        })
      });

      if (response.ok) {
        setShowCheckInModal(false);
        setNewCheckIn({
          patientId: '',
          appointmentId: '',
          providerId: '',
          reason: '',
          triageLevel: 'routine'
        });
        loadData();
      }
    } catch (error) {
      console.error('Failed to check in:', error);
    }
  };

  const handleWalkIn = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('http://localhost:3001/api/clinic-operations/walk-ins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newWalkIn,
          clinicId
        })
      });

      if (response.ok) {
        setShowWalkInModal(false);
        setNewWalkIn({
          patientName: '',
          patientEmail: '',
          patientPhone: '',
          providerId: '',
          reason: '',
          triageLevel: 'routine',
          notes: ''
        });
        loadData();
      }
    } catch (error) {
      console.error('Failed to register walk-in:', error);
    }
  };

  const handleWaitlist = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('http://localhost:3001/api/clinic-operations/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newWaitlist,
          clinicId
        })
      });

      if (response.ok) {
        setShowWaitlistModal(false);
        setNewWaitlist({
          patientName: '',
          patientEmail: '',
          patientPhone: '',
          providerId: '',
          preferredDate: '',
          preferredTimeSlot: '',
          reason: '',
          priority: 'normal',
          notes: ''
        });
        loadData();
      }
    } catch (error) {
      console.error('Failed to add to waitlist:', error);
    }
  };

  const updateStatus = async (type: 'checkin' | 'walkin', id: string, status: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const endpoint = type === 'checkin'
        ? `http://localhost:3001/api/clinic-operations/check-ins/${id}/status`
        : `http://localhost:3001/api/clinic-operations/walk-ins/${id}/status`;

      await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      loadData();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const updateWaitlistStatus = async (id: string, status: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await fetch(`http://localhost:3001/api/clinic-operations/waitlist/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      loadData();
    } catch (error) {
      console.error('Failed to update waitlist:', error);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    const statusMap: Record<string, string> = {
      'waiting': 'status-waiting',
      'in-progress': 'status-in-progress',
      'completed': 'status-completed',
      'cancelled': 'status-cancelled',
      'active': 'status-active',
      'contacted': 'status-contacted',
      'scheduled': 'status-scheduled',
      'expired': 'status-expired'
    };
    return statusMap[status] || 'status-default';
  };

  const getTriageBadgeClass = (level: string) => {
    const levelMap: Record<string, string> = {
      'urgent': 'triage-urgent',
      'high': 'triage-high',
      'routine': 'triage-routine'
    };
    return levelMap[level] || 'triage-default';
  };

  const getPriorityBadgeClass = (priority: string) => {
    const priorityMap: Record<string, string> = {
      'urgent': 'priority-urgent',
      'high': 'priority-high',
      'normal': 'priority-normal',
      'low': 'priority-low'
    };
    return priorityMap[priority] || 'priority-default';
  };

  return (
    <div className="clinic-operations-dashboard">
      <div className="dashboard-header">
        <h1>Clinic Operations Dashboard</h1>
        <p className="subtitle">Manage check-ins, walk-ins, waitlists, and clinic oversight</p>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab ${activeTab === 'checkin' ? 'active' : ''}`}
          onClick={() => setActiveTab('checkin')}
        >
          Check-Ins
        </button>
        <button
          className={`tab ${activeTab === 'walkin' ? 'active' : ''}`}
          onClick={() => setActiveTab('walkin')}
        >
          Walk-Ins
        </button>
        <button
          className={`tab ${activeTab === 'waitlist' ? 'active' : ''}`}
          onClick={() => setActiveTab('waitlist')}
        >
          Waitlist
        </button>
      </div>

      {activeTab === 'overview' && clinicStatus && (
        <div className="overview-section">
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Check-Ins</h3>
              <div className="stat-value">{clinicStatus.checkIns.total}</div>
              <div className="stat-details">
                <span>{clinicStatus.checkIns.waiting} waiting</span>
                <span>{clinicStatus.checkIns.inProgress} in progress</span>
              </div>
            </div>
            <div className="stat-card">
              <h3>Walk-Ins</h3>
              <div className="stat-value">{clinicStatus.walkIns.total}</div>
              <div className="stat-details">
                <span>{clinicStatus.walkIns.waiting} waiting</span>
                <span>{clinicStatus.walkIns.urgent} urgent</span>
              </div>
            </div>
            <div className="stat-card">
              <h3>Waitlist</h3>
              <div className="stat-value">{clinicStatus.waitlist.total}</div>
              <div className="stat-details">
                <span>{clinicStatus.waitlist.urgent} urgent</span>
                <span>{clinicStatus.waitlist.high} high priority</span>
              </div>
            </div>
            <div className="stat-card">
              <h3>Avg Wait Time</h3>
              <div className="stat-value">{clinicStatus.overall.averageWaitTime}</div>
              <div className="stat-details">
                <span>minutes</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'checkin' && (
        <div className="checkin-section">
          <div className="section-header">
            <h2>Check-Ins Queue</h2>
            <button className="btn-primary" onClick={() => setShowCheckInModal(true)}>
              + Check In Patient
            </button>
          </div>
          <div className="queue-list">
            {checkIns.map(checkIn => (
              <div key={checkIn.id} className="queue-item">
                <div className="queue-info">
                  <div className="queue-position">#{checkIn.queuePosition}</div>
                  <div className="queue-details">
                    <div className="patient-id">Patient ID: {checkIn.patientId}</div>
                    <div className="reason">{checkIn.reason || 'General visit'}</div>
                    <div className="time">Checked in: {new Date(checkIn.checkInTime).toLocaleTimeString()}</div>
                  </div>
                  <div className="queue-status">
                    <span className={`badge ${getStatusBadgeClass(checkIn.status)}`}>
                      {checkIn.status}
                    </span>
                    <span className={`badge ${getTriageBadgeClass(checkIn.triageLevel)}`}>
                      {checkIn.triageLevel}
                    </span>
                  </div>
                  <div className="wait-time">
                    <span className="label">Est. wait:</span>
                    <span className="value">{checkIn.estimatedWaitTime} min</span>
                  </div>
                </div>
                <div className="queue-actions">
                  <button onClick={() => updateStatus('checkin', checkIn.id, 'in-progress')}>
                    Start
                  </button>
                  <button onClick={() => updateStatus('checkin', checkIn.id, 'completed')}>
                    Complete
                  </button>
                  <button onClick={() => updateStatus('checkin', checkIn.id, 'cancelled')}>
                    Cancel
                  </button>
                </div>
              </div>
            ))}
            {checkIns.length === 0 && (
              <div className="empty-state">No patients in check-in queue</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'walkin' && (
        <div className="walkin-section">
          <div className="section-header">
            <h2>Walk-In Patients</h2>
            <button className="btn-primary" onClick={() => setShowWalkInModal(true)}>
              + Register Walk-In
            </button>
          </div>
          <div className="queue-list">
            {walkIns.map(walkIn => (
              <div key={walkIn.id} className="queue-item">
                <div className="queue-info">
                  <div className="queue-position">#{walkIn.queuePosition}</div>
                  <div className="queue-details">
                    <div className="patient-name">{walkIn.patientName}</div>
                    <div className="reason">{walkIn.reason}</div>
                    <div className="contact">{walkIn.patientPhone}</div>
                    <div className="time">Registered: {new Date(walkIn.registrationTime).toLocaleTimeString()}</div>
                  </div>
                  <div className="queue-status">
                    <span className={`badge ${getStatusBadgeClass(walkIn.status)}`}>
                      {walkIn.status}
                    </span>
                    <span className={`badge ${getTriageBadgeClass(walkIn.triageLevel)}`}>
                      {walkIn.triageLevel}
                    </span>
                  </div>
                  <div className="wait-time">
                    <span className="label">Est. wait:</span>
                    <span className="value">{walkIn.estimatedWaitTime} min</span>
                  </div>
                </div>
                <div className="queue-actions">
                  <button onClick={() => updateStatus('walkin', walkIn.id, 'in-progress')}>
                    Start
                  </button>
                  <button onClick={() => updateStatus('walkin', walkIn.id, 'completed')}>
                    Complete
                  </button>
                  <button onClick={() => updateStatus('walkin', walkIn.id, 'cancelled')}>
                    Cancel
                  </button>
                </div>
              </div>
            ))}
            {walkIns.length === 0 && (
              <div className="empty-state">No walk-in patients</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'waitlist' && (
        <div className="waitlist-section">
          <div className="section-header">
            <h2>Patient Waitlist</h2>
            <button className="btn-primary" onClick={() => setShowWaitlistModal(true)}>
              + Add to Waitlist
            </button>
          </div>
          <div className="waitlist-table">
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Contact</th>
                  <th>Reason</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Added</th>
                  <th>Est. Callback</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {waitlists.map(wait => (
                  <tr key={wait.id}>
                    <td>{wait.patientName}</td>
                    <td>
                      <div>{wait.patientEmail}</div>
                      <div>{wait.patientPhone}</div>
                    </td>
                    <td>{wait.reason}</td>
                    <td>
                      <span className={`badge ${getPriorityBadgeClass(wait.priority)}`}>
                        {wait.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(wait.status)}`}>
                        {wait.status}
                      </span>
                    </td>
                    <td>{new Date(wait.addedAt).toLocaleDateString()}</td>
                    <td>
                      {wait.estimatedCallbackDate
                        ? new Date(wait.estimatedCallbackDate).toLocaleDateString()
                        : '-'}
                    </td>
                    <td>
                      <select
                        value={wait.status}
                        onChange={(e) => updateWaitlistStatus(wait.id, e.target.value)}
                      >
                        <option value="active">Active</option>
                        <option value="contacted">Contacted</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="expired">Expired</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {waitlists.length === 0 && (
              <div className="empty-state">No patients on waitlist</div>
            )}
          </div>
        </div>
      )}

      {showCheckInModal && (
        <div className="modal-overlay" onClick={() => setShowCheckInModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Check In Patient</h2>
              <button className="close-btn" onClick={() => setShowCheckInModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Patient ID*</label>
                <input
                  type="text"
                  value={newCheckIn.patientId}
                  onChange={(e) => setNewCheckIn({ ...newCheckIn, patientId: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Appointment ID</label>
                <input
                  type="text"
                  value={newCheckIn.appointmentId}
                  onChange={(e) => setNewCheckIn({ ...newCheckIn, appointmentId: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Provider ID</label>
                <input
                  type="text"
                  value={newCheckIn.providerId}
                  onChange={(e) => setNewCheckIn({ ...newCheckIn, providerId: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Reason for Visit</label>
                <textarea
                  value={newCheckIn.reason}
                  onChange={(e) => setNewCheckIn({ ...newCheckIn, reason: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Triage Level</label>
                <select
                  value={newCheckIn.triageLevel}
                  onChange={(e) => setNewCheckIn({ ...newCheckIn, triageLevel: e.target.value })}
                >
                  <option value="routine">Routine</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowCheckInModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleCheckIn}>
                Check In
              </button>
            </div>
          </div>
        </div>
      )}

      {showWalkInModal && (
        <div className="modal-overlay" onClick={() => setShowWalkInModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Register Walk-In Patient</h2>
              <button className="close-btn" onClick={() => setShowWalkInModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Patient Name*</label>
                <input
                  type="text"
                  value={newWalkIn.patientName}
                  onChange={(e) => setNewWalkIn({ ...newWalkIn, patientName: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={newWalkIn.patientEmail}
                  onChange={(e) => setNewWalkIn({ ...newWalkIn, patientEmail: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  value={newWalkIn.patientPhone}
                  onChange={(e) => setNewWalkIn({ ...newWalkIn, patientPhone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Provider ID</label>
                <input
                  type="text"
                  value={newWalkIn.providerId}
                  onChange={(e) => setNewWalkIn({ ...newWalkIn, providerId: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Reason for Visit*</label>
                <textarea
                  value={newWalkIn.reason}
                  onChange={(e) => setNewWalkIn({ ...newWalkIn, reason: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Triage Level</label>
                <select
                  value={newWalkIn.triageLevel}
                  onChange={(e) => setNewWalkIn({ ...newWalkIn, triageLevel: e.target.value })}
                >
                  <option value="routine">Routine</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={newWalkIn.notes}
                  onChange={(e) => setNewWalkIn({ ...newWalkIn, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowWalkInModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleWalkIn}>
                Register
              </button>
            </div>
          </div>
        </div>
      )}

      {showWaitlistModal && (
        <div className="modal-overlay" onClick={() => setShowWaitlistModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add to Waitlist</h2>
              <button className="close-btn" onClick={() => setShowWaitlistModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Patient Name*</label>
                <input
                  type="text"
                  value={newWaitlist.patientName}
                  onChange={(e) => setNewWaitlist({ ...newWaitlist, patientName: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={newWaitlist.patientEmail}
                  onChange={(e) => setNewWaitlist({ ...newWaitlist, patientEmail: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  value={newWaitlist.patientPhone}
                  onChange={(e) => setNewWaitlist({ ...newWaitlist, patientPhone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Provider ID</label>
                <input
                  type="text"
                  value={newWaitlist.providerId}
                  onChange={(e) => setNewWaitlist({ ...newWaitlist, providerId: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Preferred Date</label>
                <input
                  type="date"
                  value={newWaitlist.preferredDate}
                  onChange={(e) => setNewWaitlist({ ...newWaitlist, preferredDate: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Preferred Time Slot</label>
                <select
                  value={newWaitlist.preferredTimeSlot}
                  onChange={(e) => setNewWaitlist({ ...newWaitlist, preferredTimeSlot: e.target.value })}
                >
                  <option value="">Any time</option>
                  <option value="morning">Morning (8AM-12PM)</option>
                  <option value="afternoon">Afternoon (12PM-5PM)</option>
                  <option value="evening">Evening (5PM-8PM)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Reason*</label>
                <textarea
                  value={newWaitlist.reason}
                  onChange={(e) => setNewWaitlist({ ...newWaitlist, reason: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Priority</label>
                <select
                  value={newWaitlist.priority}
                  onChange={(e) => setNewWaitlist({ ...newWaitlist, priority: e.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={newWaitlist.notes}
                  onChange={(e) => setNewWaitlist({ ...newWaitlist, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowWaitlistModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleWaitlist}>
                Add to Waitlist
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClinicOperationsDashboard;
