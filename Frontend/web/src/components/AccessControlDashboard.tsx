import React, { useState, useEffect } from 'react';
import './AccessControlDashboard.css';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
}

interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  timestamp: string;
}

const AccessControlDashboard: React.FC = () => {
  // Demo users for testing
  const demoUsers: User[] = [
    { id: '1', email: 'patient@example.com', name: 'John Patient', role: 'patient', isActive: true },
    { id: '2', email: 'doctor@example.com', name: 'Dr. Jane Smith', role: 'doctor', isActive: true },
    { id: '3', email: 'admin@example.com', name: 'Sarah Administrator', role: 'clinic_admin', isActive: true },
    { id: '4', email: 'staff@example.com', name: 'Mike Clinic Staff', role: 'clinic_staff', isActive: true },
    { id: '5', email: 'account@example.com', name: 'Lisa Account Manager', role: 'account_manager', isActive: true },
    { id: '6', email: 'cs@example.com', name: 'Tom Customer Success', role: 'customer_success', isActive: true }
  ];

  const [users, setUsers] = useState<User[]>(demoUsers);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'patient',
    clinicId: '',
    isActive: true
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      loadData();
    } else {
      setLoading(false);
    }
  }, []);

  const loadData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('No authentication token found');
        setLoading(false);
        return;
      }

      const [usersRes, logsRes] = await Promise.all([
        fetch('/api/access-control/users', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }).catch(err => {
          console.error('Failed to fetch users:', err);
          return { ok: false, text: async () => 'Network error' };
        }),
        fetch('/api/access-control/audit-logs', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }).catch(err => {
          console.error('Failed to fetch logs:', err);
          return { ok: false };
        })
      ]);

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users || []);
        console.log('Loaded users:', data.users);
      } else {
        const errorText = await usersRes.text();
        console.error('Failed to load users:', usersRes.status, errorText);
      }

      if (logsRes.ok) {
        const data = await logsRes.json();
        setAuditLogs(data.logs || []);
      } else {
        console.error('Failed to load logs');
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      'patient': '#3b82f6',
      'doctor': '#10b981',
      'clinic_staff': '#8b5cf6',
      'clinic_admin': '#f59e0b',
      'account_manager': '#ef4444',
      'customer_success': '#06b6d4'
    };
    return colors[role] || '#6b7280';
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      'patient': 'Patient',
      'doctor': 'Doctor',
      'clinic_staff': 'Clinic Staff',
      'clinic_admin': 'Clinic Administrator',
      'account_manager': 'Account Manager',
      'customer_success': 'Customer Success Specialist'
    };
    return labels[role] || role;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleAddUser = () => {
    // Validate required fields
    if (!newUser.name || !newUser.email) {
      alert('Please fill in all required fields (Name and Email)');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      
      // Always use demo mode for now (skip backend API calls)
      const addedUser: User = {
        id: String(users.length + 1),
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        isActive: newUser.isActive
      };
      setUsers([...users, addedUser]);
      
      setShowAddUserModal(false);
      setNewUser({
        name: '',
        email: '',
        password: '',
        role: 'patient',
        clinicId: '',
        isActive: true
      });
    } catch (error) {
      console.error('Failed to add user:', error);
      alert('Failed to add user: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  // Show demo data if not authenticated (for testing purposes)

  return (
    <div className="access-control-dashboard-wrapper">
      <div className="access-control-dashboard-card">
        <div className="dashboard-header">
          <h1>Access Control Dashboard</h1>
          <p className="subtitle">Manage user access rights, permissions, and security settings</p>
        </div>

        <div className="dashboard-tabs">
          <div className="tabs-left">
            <button
              className={activeTab === 'users' ? 'active' : ''}
              onClick={() => setActiveTab('users')}
            >
              Users Management
            </button>
            <button
              className={activeTab === 'audit' ? 'active' : ''}
              onClick={() => setActiveTab('audit')}
            >
              Audit Logs
            </button>
          </div>
          {activeTab === 'users' && (
            <button className="btn-primary btn-add-user" onClick={() => setShowAddUserModal(true)}>Add User</button>
          )}
        </div>

        {activeTab === 'users' && (
          <div className="users-section">

            {users.length > 0 ? (
              <div className="users-grid">
                {users.map((user) => (
                  <div key={user.id} className="user-card">
                    <div className="user-header">
                      <div className="user-avatar">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="user-info">
                        <h3>{user.name}</h3>
                        <p className="user-email">{user.email}</p>
                      </div>
                    </div>
                    
                    <div className="user-role">
                      <span
                        className="role-badge"
                        style={{ backgroundColor: getRoleBadgeColor(user.role) }}
                      >
                        {getRoleLabel(user.role)}
                      </span>
                      <span className={`status-badge ${user.isActive ? 'active' : 'inactive'}`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="user-actions">
                      <button className='btn-secondary' onClick={() => setSelectedUser(user)}>
                        View Details
                      </button>
                      <button className="btn-secondary">
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ height: '200px' }} />
            )}
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="audit-section">
            <div className="section-header">
              <h2>Audit Logs</h2>
              <p className="audit-description">
                HIPAA compliant activity logs for data security and compliance
              </p>
            </div>

            <div className="audit-filters">
              <select>
                <option value="">All Actions</option>
                <option value="LOGIN">Login</option>
                <option value="VIEW">View</option>
                <option value="UPDATE">Update</option>
                <option value="DELETE">Delete</option>
              </select>
              <select>
                <option value="">All Resources</option>
                <option value="USER">User</option>
                <option value="MEDICAL_RECORD">Medical Record</option>
                <option value="APPOINTMENT">Appointment</option>
              </select>
              <input type="date" placeholder="Start Date" />
              <input type="date" placeholder="End Date" />
              <button className="btn-primary">Filter</button>
            </div>

            <div className="audit-table-container">
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{formatDate(log.timestamp)}</td>
                      <td>{log.userEmail}</td>
                      <td>
                        <span className={`action-badge ${log.action.toLowerCase()}`}>
                          {log.action}
                        </span>
                      </td>
                      <td>{log.resourceType}</td>
                      <td>{log.resourceId || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {selectedUser && (
        <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>User Details</h2>
              <button onClick={() => setSelectedUser(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-row">
                <strong>Name:</strong> {selectedUser.name}
              </div>
              <div className="detail-row">
                <strong>Email:</strong> {selectedUser.email}
              </div>
              <div className="detail-row">
                <strong>Role:</strong> {getRoleLabel(selectedUser.role)}
              </div>
              <div className="detail-row">
                <strong>Status:</strong> {selectedUser.isActive ? 'Active' : 'Inactive'}
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddUserModal && (
        <div className="modal-overlay" onClick={() => setShowAddUserModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>Add New User</h2>
              <button onClick={() => setShowAddUserModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Name</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Email</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Password</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }}
                >
                  <option value="patient">Patient</option>
                  <option value="doctor">Doctor</option>
                  <option value="clinic_staff">Clinic Staff</option>
                  <option value="clinic_admin">Clinic Admin</option>
                  <option value="account_manager">Account Manager</option>
                  <option value="customer_success">Customer Success</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Clinic ID (optional)</label>
                <input
                  type="text"
                  value={newUser.clinicId}
                  onChange={(e) => setNewUser({...newUser, clinicId: e.target.value})}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button className="btn-primary" onClick={handleAddUser} style={{ flex: 1 }}>
                  Add User
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => setShowAddUserModal(false)}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccessControlDashboard;
