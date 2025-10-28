import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import './Home.css';

const Home: React.FC = () => {
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

        {/* Dashboard Content */}
        <div className="dashboard-content">
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
          <div className="widget appointments-widget">
            <div className="widget-header">
              <span className="widget-icon">📅</span>
              <h3 className="widget-title">Appointments</h3>
            </div>
            <div className="widget-content">
              <div className="calendar-section">
                <div className="calendar-header">
                  <span className="calendar-nav">‹</span>
                  <span className="calendar-month">September</span>
                  <span className="calendar-nav">›</span>
                </div>
                <div className="calendar-grid">
                  <div className="calendar-days">
                    <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                  </div>
                  <div className="calendar-dates">
                    <span className="other-month">31</span>
                    <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span>
                    <span>7</span><span>8</span><span>9</span><span>10</span><span>11</span><span>12</span><span>13</span>
                    <span>14</span><span>15</span><span>16</span><span>17</span><span>18</span><span>19</span>
                    <span className="selected">20</span><span>21</span><span>22</span><span>23</span><span>24</span><span>25</span><span>26</span>
                    <span>27</span><span>28</span><span>29</span><span>30</span>
                    <span className="other-month">1</span><span className="other-month">2</span><span className="other-month">3</span><span className="other-month">4</span>
                  </div>
                </div>
              </div>
              <div className="upcoming-appointments">
                <h4>Upcoming Appointments</h4>
                <div className="appointment-item">
                  <div className="appointment-date">
                    <span className="date-icon">📅</span>
                    <span>Sept. 20th, 2025</span>
                  </div>
                  <div className="appointment-provider">
                    <span className="provider-icon">👤</span>
                    <span>Name</span>
                    <span>Specialty</span>
                  </div>
                  <div className="appointment-actions">
                    <button className="action-btn">
                      <span className="btn-icon">📅</span>
                      Reschedule
                    </button>
                    <button className="action-btn">
                      <span className="btn-icon">➕</span>
                      Add to Calendar
                    </button>
                    <button className="action-btn">
                      <span className="btn-icon">✕</span>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

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

