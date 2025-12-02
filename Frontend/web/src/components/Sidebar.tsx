import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Sidebar.css";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  { path: "/home", icon: "📊", label: "Dashboard" },
  { path: "/find-doctors", icon: "🔍", label: "Find Doctors" },
  { path: "/book-appointment", icon: "📅", label: "Appointments" },
  { path: "/medical-records", icon: "📋", label: "Medical Records" },
  { path: "/prescriptions", icon: "💊", label: "Prescriptions" },
  { path: "/insurance", icon: "🏥", label: "Insurance" },
  { path: "/claims", icon: "📄", label: "Claims" },
  { path: "/test-results", icon: "🧪", label: "Test Results" },
  { path: "/account", icon: "👤", label: "Account" },
  { path: "/billing", icon: "💳", label: "Billing" },
];

const adminNavItems = [
  { path: "/clinic-operations", icon: "🏥", label: "Clinic Operations", roles: ["admin", "clinic_admin"] },
  { path: "/access-control", icon: "🔐", label: "Access Control", roles: ["admin"] },
];

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const { isAuthenticated, user, hasRole } = useAuth();
  const navigate = useNavigate();

  const handleSettingsClick = () => {
    navigate('/access-control');
  };

  return (
    <aside className={`sidebar ${isCollapsed ? "collapsed" : ""}`}>
      {/* Toggle button */}
      <button
        className="sidebar-toggle"
        onClick={onToggle}
        aria-label="Toggle sidebar"
      >
        <span className="toggle-icon">{isCollapsed ? "▶" : "◀"}</span>
      </button>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <ul className="nav-list">
          {navItems.map((item) => (
            <li key={item.path} className="nav-item">
              <NavLink
                to={item.path}
                end={item.path === "/dashboard"} // keeps sub-routes like /appointments/book highlighted
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-text">{item.label}</span>
              </NavLink>
            </li>
          ))}

          {/* Admin Section */}
          {isAuthenticated && user && adminNavItems.filter(item => hasRole(item.roles)).length > 0 && (
            <>
              <li className="nav-divider">
                <span className="divider-text">Administration</span>
              </li>
              {adminNavItems
                .filter(item => hasRole(item.roles))
                .map((item) => (
                  <li key={item.path} className="nav-item admin-nav-item">
                    <NavLink
                      to={item.path}
                      className={({ isActive }) =>
                        `nav-link ${isActive ? "active" : ""}`
                      }
                    >
                      <span className="nav-icon">{item.icon}</span>
                      <span className="nav-text">{item.label}</span>
                    </NavLink>
                  </li>
                ))}
            </>
          )}
        </ul>
      </nav>

      {/* Settings and Auth Section */}
      <div className="sidebar-footer">
        {/* Settings Button - Only show for non-admin users or if they don't have admin nav */}
        {(!isAuthenticated || !user || !hasRole(['admin'])) && (
          <button
            className="settings-btn"
            onClick={handleSettingsClick}
            aria-label="Access Control Settings"
            data-tooltip="Access Control"
          >
            <span className="settings-icon">⚙️</span>
            <span className="settings-text">Settings</span>
          </button>
        )}

        {/* Login Button */}
        {!isAuthenticated && (
          <NavLink to="/login" className="auth-btn login-btn" data-tooltip="Login">
            <span className="auth-icon">🔑</span>
            <span className="auth-text">Login</span>
          </NavLink>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
