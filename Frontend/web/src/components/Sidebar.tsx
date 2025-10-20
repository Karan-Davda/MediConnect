import React from 'react';
import './Sidebar.css';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Toggle Button */}
      <button className="sidebar-toggle" onClick={onToggle} aria-label="Toggle sidebar">
        <span className="toggle-icon">
          {isCollapsed ? '▶' : '◀'}
        </span>
      </button>

      {/* Navigation Menu */}
      <nav className="sidebar-nav">
        <ul className="nav-list">
          <li className="nav-item active">
            <a href="/home" className="nav-link">
              <span className="nav-icon">📊</span>
              <span className="nav-text">Dashboard</span>
            </a>
          </li>
          <li className="nav-item">
            <a href="#" className="nav-link">
              <span className="nav-icon">📅</span>
              <span className="nav-text">Appointments</span>
            </a>
          </li>
          <li className="nav-item">
            <a href="#" className="nav-link">
              <span className="nav-icon">🧪</span>
              <span className="nav-text">Test Results</span>
            </a>
          </li>
          <li className="nav-item">
            <a href="/account" className="nav-link" data-tooltip="Manage your account settings">
              <span className="nav-icon">👤</span>
              <span className="nav-text">Account</span>
            </a>
          </li>
          <li className="nav-item">
            <a href="#" className="nav-link">
              <span className="nav-icon">💳</span>
              <span className="nav-text">Billing</span>
            </a>
          </li>
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
