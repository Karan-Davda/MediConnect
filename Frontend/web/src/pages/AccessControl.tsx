import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import AccessControlDashboard from '../components/AccessControlDashboard';
import './Home.css';

const AccessControl: React.FC = () => {
  console.log('AccessControl page: Component rendering');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  
  // Test if component is rendering
  if (!isAuthenticated) {
    console.log('AccessControl: User not authenticated, redirecting...');
  }

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
        <div className="dashboard-content" style={{ display: 'block', minHeight: '400px', padding: '1rem', backgroundColor: '#f7fafc' }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', minHeight: '300px' }}>
            <h1 style={{ margin: 0, marginBottom: '1rem', color: '#2d3748' }}>Access Control</h1>
            <div style={{ border: '1px solid #e2e8f0', padding: '1rem', borderRadius: '4px', backgroundColor: '#fff', minHeight: '200px' }}>
              <div style={{ padding: '1rem', backgroundColor: '#e6fffa', border: '1px solid #38b2ac', borderRadius: '4px', marginBottom: '1rem' }}>
                <strong>Debug Info:</strong> Component should render below. If you see this but not the dashboard, there's a render error.
              </div>
              <AccessControlDashboard />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccessControl;

