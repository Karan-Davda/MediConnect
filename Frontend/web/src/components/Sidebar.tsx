import React from "react";
import { NavLink } from "react-router-dom";
import "./Sidebar.css";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  { path: "/home", icon: "📊", label: "Dashboard" },
  { path: "/book-appointment", icon: "📅", label: "Appointments" },
  { path: "/test-results", icon: "🧪", label: "Test Results" },
  { path: "/account", icon: "👤", label: "Account" },
  { path: "/billing", icon: "💳", label: "Billing" },
];

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
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
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
