import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Sidebar.css";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

// All navigation items with role-based access control
const allNavItems = [
  // Dashboard - Available to all authenticated users
  { 
    path: "/home", 
    icon: "📊", 
    label: "Dashboard", 
    roles: ["patient", "doctor", "clinic_staff", "clinic_admin", "account_manager", "customer_success"] 
  },
  
  // Patient-only items
  { 
    path: "/find-doctors", 
    icon: "🔍", 
    label: "Find Doctors", 
    roles: ["patient"] 
  },
  { 
    path: "/book-appointment", 
    icon: "📅", 
    label: "Appointments", 
    roles: ["patient"] 
  },
  { 
    path: "/billing", 
    icon: "💳", 
    label: "Billing", 
    roles: ["patient"] 
  },
  
  // Provider items (doctors, clinic staff, clinic admins)
  { 
    path: "/medical-records", 
    icon: "📋", 
    label: "Medical Records", 
    roles: ["doctor", "clinic_staff", "clinic_admin"] 
  },
  { 
    path: "/prescriptions", 
    icon: "💊", 
    label: "Prescriptions", 
    roles: ["doctor", "clinic_staff", "clinic_admin"] 
  },
  
  // Shared items (patients and providers)
  { 
    path: "/insurance", 
    icon: "🏥", 
    label: "Insurance", 
    roles: ["patient", "doctor", "clinic_staff", "clinic_admin"] 
  },
  
  // Admin items (separated for styling)
  // Note: Account is in the footer, not in the main menu
  { 
    path: "/clinic-operations", 
    icon: "🏥", 
    label: "Clinic Operations", 
    roles: ["clinic_admin"],
    isAdmin: true 
  },
  { 
    path: "/access-control", 
    icon: "🔐", 
    label: "Access Control", 
    roles: ["clinic_admin"],
    isAdmin: true 
  },
];

const marketingNavItems = [
  { path: "/home", icon: "📊", label: "Dashboard" },
  { path: "/marketing-campaigns", icon: "📢", label: "Marketing Campaigns" },
  { path: "/account", icon: "👤", label: "Account" },
];

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const { isAuthenticated, user, hasRole } = useAuth();
  const navigate = useNavigate();

  const handleAccountClick = () => {
    navigate('/account');
  };

  // Check if user is marketing admin
  const forcedRole = localStorage.getItem("forcedRole");
  const effectiveRole = forcedRole || user?.role;
  const isMarketingAdmin = !!effectiveRole && (effectiveRole === "marketing_admin" || hasRole(["marketing_admin"]));

  // Filter menu items based on user role
  const getVisibleMenuItems = () => {
    if (!isAuthenticated || !user) {
      return [];
    }

    return allNavItems.filter(item => {
      if (!item.roles || item.roles.length === 0) {
        return false; // Hide items without roles defined
      }
      return hasRole(item.roles);
    });
  };

  // Separate regular items from admin items for styling
  const visibleItems = getVisibleMenuItems();
  const regularItems = visibleItems.filter(item => !item.isAdmin);
  const adminItems = visibleItems.filter(item => item.isAdmin);

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
          {isMarketingAdmin ? (
            // Marketing admin gets limited navigation
            marketingNavItems.map((item) => (
              <li key={item.path} className="nav-item">
                <NavLink
                  to={item.path}
                  end={item.path === "/home"} 
                  className={({ isActive }) =>
                    `nav-link ${isActive ? "active" : ""}`
                  }
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-text">{item.label}</span>
                </NavLink>
              </li>
            ))
          ) : (
            <>
              {/* Regular menu items */}
              {regularItems.map((item) => (
                <li key={item.path} className="nav-item">
                  <NavLink
                    to={item.path}
                    end={item.path === "/home"}
                    className={({ isActive }) =>
                      `nav-link ${isActive ? "active" : ""}`
                    }
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-text">{item.label}</span>
                  </NavLink>
                </li>
              ))}

              {/* Admin Section - Only show if there are admin items */}
              {adminItems.length > 0 && (
            <>
              <li className="nav-divider">
                <span className="divider-text">Administration</span>
              </li>
              {adminItems.map((item) => (
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
            </>
          )}
        </ul>
      </nav>

      {/* Account and Auth Section */}
      <div className="sidebar-footer">
        {/* Account Button - Show for all authenticated users */}
        {isAuthenticated && user && (
          <button
            className="settings-btn"
            onClick={handleAccountClick}
            aria-label="Account Settings"
            data-tooltip="Account"
          >
            <span className="settings-icon">👤</span>
            <span className="settings-text">Account</span>
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
