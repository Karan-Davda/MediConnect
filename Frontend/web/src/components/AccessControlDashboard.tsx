import React, { useState, useEffect } from 'react';
import { apiUrl } from '../config/api';
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
  console.log('AccessControlDashboard: Component rendering');
  
  // Demo users for testing (fallback)
  const demoUsers: User[] = [
    { id: '1', email: 'patient@example.com', name: 'John Patient', role: 'patient', isActive: true },
    { id: '2', email: 'doctor@example.com', name: 'Dr. Jane Smith', role: 'doctor', isActive: true },
    { id: '3', email: 'admin@example.com', name: 'Sarah Administrator', role: 'clinic_admin', isActive: true },
    { id: '4', email: 'staff@example.com', name: 'Mike Clinic Staff', role: 'clinic_staff', isActive: true },
    { id: '5', email: 'account@example.com', name: 'Lisa Account Manager', role: 'account_manager', isActive: true },
    { id: '6', email: 'cs@example.com', name: 'Tom Customer Success', role: 'customer_success', isActive: true }
  ];

  const [users, setUsers] = useState<User[]>(demoUsers); // Start with demo users so something shows
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false); // Start with false so we show content immediately
  const [error, setError] = useState<string | null>(null);
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
    console.log('AccessControlDashboard: useEffect running');
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    let user = null;
    try {
      user = userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      console.error('Failed to parse user from localStorage:', e);
    }
    
    console.log('AccessControlDashboard: User role:', user?.role);
    
    // Check if user has required role
    const allowedRoles = ['clinic_admin', 'account_manager', 'customer_success'];
    if (user && !allowedRoles.includes(user.role)) {
      console.warn('AccessControlDashboard: User role not authorized:', user.role);
      setError(`Access Denied: Your role (${user.role}) does not have permission to access this page. Required roles: ${allowedRoles.join(', ')}`);
      setLoading(false);
      return;
    }
    
    if (token) {
      console.log('AccessControlDashboard: Token found, loading data');
      setLoading(true);
      loadData();
    } else {
      console.log('AccessControlDashboard: No token found');
      setError('No authentication token found');
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('No authentication token found');
        setError('No authentication token found');
        setLoading(false);
        return;
      }

      console.log('Loading access control data...');
      
      const [usersRes, logsRes] = await Promise.all([
        fetch(apiUrl('access-control/users'), {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }).catch(err => {
          console.error('Failed to fetch users:', err);
          return null;
        }),
        fetch(apiUrl('access-control/audit-logs'), {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }).catch(err => {
          console.error('Failed to fetch logs:', err);
          return null;
        })
      ]);

      if (usersRes && usersRes.ok) {
        try {
          const data = await usersRes.json();
          console.log('Raw backend response:', data);
          // Map backend response to frontend format
          const mappedUsers = (data.users || []).map((u: any) => {
            // Build name from first_name and last_name
            const firstName = (u.first_name || '').trim();
            const lastName = (u.last_name || '').trim();
            let fullName = '';
            if (firstName && lastName) {
              fullName = `${firstName} ${lastName}`;
            } else if (firstName) {
              fullName = firstName;
            } else if (lastName) {
              fullName = lastName;
            } else if (u.name) {
              fullName = u.name;
            } else {
              // Use email as fallback if no name available
              fullName = u.email ? u.email.split('@')[0] : 'User';
            }
            
            return {
              id: String(u.id || u.user_id),
              email: u.email || '',
              name: fullName,
              role: u.role || u.role_name || '',
              isActive: u.is_active !== undefined ? u.is_active : (u.isActive !== undefined ? u.isActive : true)
            };
          });
          setUsers(mappedUsers);
          console.log('Mapped users:', mappedUsers);
        } catch (parseError) {
          console.error('Failed to parse users response:', parseError);
          setError('Failed to parse users data');
        }
      } else if (usersRes) {
        try {
          let errorData;
          try {
            errorData = await usersRes.json();
          } catch (jsonError) {
            const errorText = await usersRes.text();
            errorData = { error: errorText };
          }
          console.error('Failed to load users:', usersRes.status, errorData);
          if (usersRes.status === 403) {
            setError('Access Denied: You do not have permission to access this page. Required role: clinic_admin, account_manager, or customer_success');
          } else if (usersRes.status === 401) {
            setError('Authentication failed. Please log in again.');
          } else {
            setError(`Failed to load users (${usersRes.status}): ${errorData.error || 'Unknown error'}`);
          }
        } catch (textError) {
          console.error('Failed to load users:', usersRes.status, textError);
          if (usersRes.status === 403) {
            setError('Access Denied: You do not have permission to access this page.');
          } else {
            setError(`Failed to load users: ${usersRes.status}`);
          }
        }
      } else {
        console.error('Failed to fetch users: Network error');
        setError('Network error: Could not connect to server');
      }

      if (logsRes && logsRes.ok) {
        try {
          const data = await logsRes.json();
          setAuditLogs(data.logs || []);
          console.log('Loaded audit logs:', data.logs);
        } catch (parseError) {
          console.error('Failed to parse logs response:', parseError);
        }
      } else if (logsRes) {
        try {
          let errorData;
          try {
            errorData = await logsRes.json();
          } catch (jsonError) {
            const errorText = await logsRes.text();
            errorData = { error: errorText };
          }
          console.error('Failed to load logs:', logsRes.status, errorData);
          if (logsRes.status === 403) {
            setError(prev => prev ? prev + '\nAccess Denied: Cannot load audit logs. Required role: clinic_admin or account_manager' : 'Access Denied: Cannot load audit logs. Required role: clinic_admin or account_manager');
          }
        } catch (textError) {
          console.error('Failed to load logs:', logsRes.status, textError);
        }
      } else {
        console.error('Failed to fetch logs: Network error');
      }
    } catch (error: any) {
      console.error('Failed to load data:', error);
      setError(error.message || 'Failed to load data. Please try again.');
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

  // Always show content, even while loading (show demo data)
  // if (loading) {
  //   return (
  //     <div style={{ padding: '2rem', textAlign: 'center', minHeight: '200px' }}>
  //       <h2>Loading Access Control Dashboard...</h2>
  //       <p>Please wait while we load the data.</p>
  //     </div>
  //   );
  // }

  // Show error as a banner, but still show the dashboard
  // if (error) {
  //   return (
  //     <div style={{ padding: '2rem', textAlign: 'center', minHeight: '200px' }}>
  //       <h2 style={{ color: '#e53e3e' }}>Error Loading Data</h2>
  //       <p style={{ color: '#718096', marginBottom: '1rem' }}>{error}</p>
  //       <button 
  //         onClick={() => {
  //           setError(null);
  //           setLoading(true);
  //           loadData();
  //         }}
  //         style={{ 
  //           marginTop: '1rem', 
  //           padding: '0.75rem 1.5rem',
  //           backgroundColor: '#667eea',
  //           color: 'white',
  //           border: 'none',
  //           borderRadius: '8px',
  //           cursor: 'pointer',
  //           fontSize: '1rem'
  //         }}
  //       >
  //         Retry
  //       </button>
  //     </div>
  //   );
  // }

  // Use demo users if no users loaded
  const displayUsers = users.length > 0 ? users : demoUsers;

  console.log('AccessControlDashboard: About to render, users:', displayUsers.length, 'loading:', loading, 'error:', error);

  // Always render something - even if there's an error
  try {
    return (
      <div style={{ minHeight: '400px', padding: '1rem', backgroundColor: '#f7fafc', width: '100%', display: 'block' }}>
      {error && (
        <div style={{ 
          padding: '1.5rem', 
          marginBottom: '1rem', 
          backgroundColor: '#fed7d7', 
          color: '#742a2a', 
          borderRadius: '8px',
          border: '2px solid #fc8181',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <strong style={{ fontSize: '1.1rem' }}>⚠️ Error</strong>
            <button 
              onClick={() => {
                setError(null);
                setLoading(true);
                loadData();
              }}
              style={{ 
                padding: '0.5rem 1rem',
                backgroundColor: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              Retry
            </button>
          </div>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>{error}</div>
        </div>
      )}
      {loading && (
        <div style={{ padding: '1rem', marginBottom: '1rem', textAlign: 'center', color: '#718096' }}>
          Loading data from server...
        </div>
      )}
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '2rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ margin: 0, fontSize: '2rem', color: '#2d3748', fontWeight: 'bold' }}>Access Control Dashboard</h1>
          <p style={{ margin: '0.5rem 0 0 0', color: '#718096', fontSize: '1rem' }}>Manage user access rights, permissions, and security settings</p>
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

            {displayUsers.length > 0 ? (
              <div className="users-grid">
                {displayUsers.map((user) => (
                  <div key={user.id} className="user-card">
                    <div className="user-header">
                      <div className="user-avatar">
                        {(user.name && user.name.length > 0) ? user.name.charAt(0).toUpperCase() : '?'}
                      </div>
                      <div className="user-info">
                        <h3>{user.name || 'Unknown User'}</h3>
                        <p className="user-email">{user.email || 'No email'}</p>
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
  } catch (renderError) {
    console.error('AccessControlDashboard: Render error:', renderError);
    return (
      <div style={{ padding: '2rem', backgroundColor: '#fed7d7', color: '#742a2a', borderRadius: '8px' }}>
        <h2>Error Rendering Dashboard</h2>
        <p>{renderError instanceof Error ? renderError.message : 'Unknown error'}</p>
        <pre style={{ fontSize: '12px', overflow: 'auto' }}>{renderError instanceof Error ? renderError.stack : String(renderError)}</pre>
      </div>
    );
  }
};

export default AccessControlDashboard;
