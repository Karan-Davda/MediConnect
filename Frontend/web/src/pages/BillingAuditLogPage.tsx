import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import "./Account.css";

type AuditEvent = {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  details: string;
};

const mockAuditEvents: AuditEvent[] = [
  {
    id: "EVT-001",
    timestamp: "2025-11-20T14:32:00Z",
    actor: "admin@clinic.com",
    action: "EXPORT_REPORT",
    target: "Billing CSV",
    details: "Exported invoices from 2025-11-01 to 2025-11-20",
  },
  {
    id: "EVT-002",
    timestamp: "2025-11-18T10:15:00Z",
    actor: "billing.manager@clinic.com",
    action: "UPDATE_SETTINGS",
    target: "Payment Processor",
    details: "Enabled Stripe test mode",
  },
  {
    id: "EVT-003",
    timestamp: "2025-11-15T09:45:00Z",
    actor: "admin@clinic.com",
    action: "VIEW_INVOICE",
    target: "INV-2025-1101-0007",
    details: "Viewed invoice details and payment history",
  },
];

const BillingAuditLogPage: React.FC = () => {
  const { isAuthenticated, hasRole, user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const isAdmin = hasRole(["admin", "clinic_admin"]);

  const toggleSidebar = () => setSidebarCollapsed((s) => !s);

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="dashboard-container">
        <div className="main-content">
          <div className="dashboard-content">
            <p>You are not authorized to view the billing audit log.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      <div
        className={`main-content ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}
      >
        <header className="header">
          <div className="header-left">
            <h1 className="brand-title">MediConnect — Billing Audit Log</h1>
          </div>
          <div className="header-right">
            {user && (
              <span className="user-name" style={{ fontSize: 12, color: "#4a5568" }}>
                {user.name || user.email}
              </span>
            )}
          </div>
        </header>

        <div className="dashboard-content" style={{ maxWidth: 1000, margin: "0 auto" }}>
          <section className="account-section">
            <h2>Recent Billing Events</h2>
            <p style={{ color: "#4a5568", marginTop: 4 }}>
              View a trace of administrative actions taken on billing data (ExHL +
              Auditability).
            </p>

            <div style={{ marginTop: 12, overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 14,
                }}
              >
                <thead>
                  <tr
                    style={{
                      textAlign: "left",
                      borderBottom: "1px solid #e2e8f0",
                      background: "#f7fafc",
                    }}
                  >
                    <th style={{ padding: "8px 12px" }}>Time</th>
                    <th style={{ padding: "8px 12px" }}>Actor</th>
                    <th style={{ padding: "8px 12px" }}>Action</th>
                    <th style={{ padding: "8px 12px" }}>Target</th>
                    <th style={{ padding: "8px 12px" }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {mockAuditEvents.map((e) => (
                    <tr key={e.id} style={{ borderBottom: "1px solid #edf2f7" }}>
                      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                        {new Date(e.timestamp).toLocaleString()}
                      </td>
                      <td style={{ padding: "8px 12px" }}>{e.actor}</td>
                      <td style={{ padding: "8px 12px" }}>{e.action}</td>
                      <td style={{ padding: "8px 12px" }}>{e.target}</td>
                      <td style={{ padding: "8px 12px" }}>{e.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p style={{ marginTop: 10, fontSize: 12, color: "#718096" }}>
              In a production system, this data would come from a secure audit log store,
              filtered by date range and actor.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default BillingAuditLogPage;
