import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import AccessControlDashboard from '../components/AccessControlDashboard';
import './Home.css';

const AccessControl: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { isAuthenticated, logout } = useAuth();
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
              <button onClick={handleLogout} className="login-btn">Logout</button>
            ) : (
              <Link to="/login" className="login-btn">Login</Link>
            )}
          </div>
        </header>

        {/* Access Control Content */}
        <div className="dashboard-content" style={{ display: 'block' }}>
          <AccessControlDashboard />
        </div>
      </div>
    </div>
  );
};

export default AccessControl;

