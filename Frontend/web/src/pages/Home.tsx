import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import PatientAppointmentsWidget from "../widgets/PatientAppointmentsWidget";
import './Home.css';

const Home: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar Component */}
      <Sidebar 
        isCollapsed={sidebarCollapsed} 
        onToggle={toggleSidebar} 
      />

      {/* Main Content Area */}
      <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Top Header */}
        <header className="header">
          <div className="header-left">
            <h1 className="brand-title">MediConnect</h1>
          </div>
          <div className="header-center">
            <div className="search-bar">
              <span className="search-icon">🔍</span>
              <input type="text" placeholder="Search" className="search-input" />
            </div>
          </div>
          <div className="header-right">
            {isAuthenticated ? (
              <div className="user-menu">
                <span className="user-name">{user?.name || user?.email}</span>
                <button className="logout-btn" onClick={handleLogout}>
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

        {/* Dashboard Content */}
        <div className="dashboard-content">
          {/* Admin Quick Access Widget */}
          {isAuthenticated && user && (user.role === 'admin' || user.role === 'clinic_admin') && (
            <div className="widget admin-widget">
              <div className="widget-header">
                <span className="widget-icon">🏥</span>
                <h3 className="widget-title">Clinic Operations</h3>
              </div>
              <div className="widget-content">
                <p>
                  Manage clinic operations, check-ins, walk-ins, and waitlists
                </p>
                <button
                  className="admin-widget-btn"
                  onClick={() => navigate('/clinic-operations')}
                >
                  <span>🏥</span>
                  <span>Open Clinic Dashboard</span>
                </button>
              </div>
            </div>
          )}

          {/* To Do Widget */}
          <div className="widget todo-widget">
            <div className="widget-header">
              <span className="widget-icon">📝</span>
              <h3 className="widget-title">To Do</h3>
            </div>
            <div className="widget-content">
              <div className="todo-item">
                <div className="todo-bar"></div>
              </div>
              <div className="todo-item">
                <div className="todo-bar"></div>
              </div>
              <div className="todo-item">
                <div className="todo-bar"></div>
              </div>
            </div>
          </div>

          {/* Care Team Widget */}
          <div className="widget care-team-widget">
            <div className="widget-header">
              <span className="widget-icon">👥</span>
              <h3 className="widget-title">Your Care Team & Providers</h3>
            </div>
            <div className="widget-content">
              <div className="provider-item">
                <div className="provider-avatar">👤</div>
                <div className="provider-info">
                  <div className="provider-name">Name</div>
                  <div className="provider-specialty">Specialty</div>
                </div>
                <div className="provider-actions">
                  <span className="action-icon">✉️</span>
                  <span className="action-icon">📅</span>
                  <span className="action-icon">📊</span>
                </div>
              </div>
              <div className="provider-item">
                <div className="provider-avatar">👤</div>
                <div className="provider-info">
                  <div className="provider-name">Name</div>
                  <div className="provider-specialty">Specialty</div>
                </div>
                <div className="provider-actions">
                  <span className="action-icon">✉️</span>
                  <span className="action-icon">📅</span>
                  <span className="action-icon">📊</span>
                </div>
              </div>
            </div>
          </div>

          {/* Appointments Widget */}
          
          <PatientAppointmentsWidget patientId="patient-123" />
           
          {/* Medical Records Widget */}
          <div className="widget medical-records-widget">
            <div className="widget-header">
              <span className="widget-icon">📊</span>
              <h3 className="widget-title">Medical Records</h3>
            </div>
            <div className="widget-content">
              <div className="health-summary">
                <h4>Health Summary</h4>
                <div className="record-item">
                  <div className="record-info">
                    <span className="record-name">Anemia</span>
                    <span className="record-date">As of 01/10/2010</span>
                  </div>
                  <div className="record-actions">
                    <span className="info-icon">ℹ️</span>
                    <span className="delete-icon">✕</span>
                  </div>
                </div>
                <div className="record-item">
                  <div className="record-info">
                    <span className="record-name">Lipid Panel - Normal</span>
                    <span className="record-date">As of 02/12/2025</span>
                  </div>
                  <div className="record-actions">
                    <span className="info-icon">ℹ️</span>
                  </div>
                </div>
                <div className="record-item">
                  <div className="record-info">
                    <span className="record-name">Glucose - Normal</span>
                    <span className="record-date">As of 02/12/2025</span>
                  </div>
                  <div className="record-actions">
                    <span className="info-icon">ℹ️</span>
                  </div>
                </div>
                <div className="record-item">
                  <div className="record-info">
                    <span className="record-name">Thyroid - Normal</span>
                    <span className="record-date">As of 02/12/2025</span>
                  </div>
                  <div className="record-actions">
                    <span className="info-icon">ℹ️</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;

