import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import "./Account.css";

type InvoiceStatus = "PENDING_INSURANCE" | "DUE" | "PAID" | "PARTIAL";

type Invoice = {
  invoiceId: string;
  serviceDate: string;
  serviceDesc: string;
  providerName: string;
  patientName: string;
  totalAmount: number;
  coveragePercent: number; // from 04.04 Record Insurance
  status: InvoiceStatus;
};

const mockInvoices: Invoice[] = [
  {
    invoiceId: "INV-2025-1101-0007",
    serviceDate: "2025-10-20",
    serviceDesc: "Primary care follow-up visit",
    providerName: "Dr. Alice Martin",
    patientName: "Jane Doe",
    totalAmount: 120.0,
    coveragePercent: 80,
    status: "DUE",
  },
  {
    invoiceId: "INV-2025-0922-0003",
    serviceDate: "2025-09-22",
    serviceDesc: "Cardiology consult",
    providerName: "Dr. Brian Patel",
    patientName: "Jane Doe",
    totalAmount: 320.0,
    coveragePercent: 70,
    status: "PAID",
  },
  {
    invoiceId: "INV-2025-1110-0010",
    serviceDate: "2025-11-10",
    serviceDesc: "Lab work",
    providerName: "Clinic Lab East",
    patientName: "Jane Doe",
    totalAmount: 85.0,
    coveragePercent: 0, // pending insurance
    status: "PENDING_INSURANCE",
  },
];

const Billing: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();

  const toggleSidebar = () => setSidebarCollapsed((s) => !s);

  // Simple copay/balance calc based on coveragePercent
  const invoicesWithBalance = useMemo(() => {
    return mockInvoices.map((inv) => {
      const covered = inv.totalAmount * (inv.coveragePercent / 100);
      const balance = inv.totalAmount - covered;
      return {
        ...inv,
        balance: parseFloat(balance.toFixed(2)),
      };
    });
  }, []);

  const totalDue = useMemo(
    () =>
      invoicesWithBalance
        .filter((i) => i.status === "DUE" || i.status === "PARTIAL")
        .reduce((sum, i) => sum + i.balance, 0),
    [invoicesWithBalance]
  );

  const handlePay = (invoiceId: string) => {
  navigate(`/process-payments?invoiceId=${encodeURIComponent(invoiceId)}`);
};

  const statusLabel = (status: InvoiceStatus) => {
    switch (status) {
      case "DUE":
        return "Amount due";
      case "PAID":
        return "Paid";
      case "PENDING_INSURANCE":
        return "Pending insurance";
      case "PARTIAL":
        return "Partial payment";
      default:
        return status;
    }
  };

  const statusColor = (status: InvoiceStatus) => {
    switch (status) {
      case "DUE":
      case "PARTIAL":
        return "#dd6b20"; // orange-ish
      case "PAID":
        return "#38a169"; // green
      case "PENDING_INSURANCE":
        return "#3182ce"; // blue
      default:
        return "#4a5568";
    }
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={toggleSidebar} />

      {/* Main */}
      <div className={`main-content ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        {/* Header (same as other pages) */}
        <header className="header">
          <div className="header-left">
            <h1 className="brand-title">MediConnect</h1>
          </div>
        </header>

        {/* Billing content */}
        <div className="dashboard-content" style={{ maxWidth: 1200, margin: "0 auto" }}>
          {/* Summary card */}
          <section className="account-section" style={{ marginBottom: 16 }}>
            <h2>Billing Overview</h2>
            <p style={{ color: "#4a5568", marginTop: 4 }}>
              View outstanding balances, insurance coverage, and process payments for your visits.
            </p>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 16,
                marginTop: 16,
              }}
            >
              <div
                style={{
                  flex: "1 1 220px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  padding: 16,
                  background: "#f7fafc",
                }}
              >
                <div style={{ fontSize: 13, color: "#4a5568" }}>Total due</div>
                <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
                  ${totalDue.toFixed(2)}
                </div>
                <div style={{ fontSize: 12, color: "#718096", marginTop: 4 }}>
                  Sum of all invoices marked as Due or Partial.
                </div>
              </div>

              <div
                style={{
                  flex: "1 1 220px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  padding: 16,
                  background: "#ffffff",
                }}
              >
                <div style={{ fontSize: 13, color: "#4a5568" }}>Insurance note</div>
                <div style={{ fontSize: 13, color: "#4a5568", marginTop: 4 }}>
                  Amounts shown reflect any insurance coverage that has been recorded and verified.
                </div>
              </div>
            </div>
          </section>

          {/* Invoice list */}
          <section className="account-section">
            <h2>Invoices</h2>

            {invoicesWithBalance.length === 0 ? (
              <p style={{ marginTop: 12, color: "#4a5568" }}>
                You currently have no invoices.
              </p>
            ) : (
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
                      <th style={{ padding: "8px 12px" }}>Invoice</th>
                      <th style={{ padding: "8px 12px" }}>Date</th>
                      <th style={{ padding: "8px 12px" }}>Service</th>
                      <th style={{ padding: "8px 12px" }}>Provider</th>
                      <th style={{ padding: "8px 12px" }}>Total</th>
                      <th style={{ padding: "8px 12px" }}>Coverage</th>
                      <th style={{ padding: "8px 12px" }}>Balance</th>
                      <th style={{ padding: "8px 12px" }}>Status</th>
                      <th style={{ padding: "8px 12px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoicesWithBalance.map((inv) => (
                      <tr
                        key={inv.invoiceId}
                        style={{ borderBottom: "1px solid #edf2f7" }}
                      >
                        <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                          {inv.invoiceId}
                        </td>
                        <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                          {new Date(inv.serviceDate).toLocaleDateString()}
                        </td>
                        <td style={{ padding: "8px 12px" }}>{inv.serviceDesc}</td>
                        <td style={{ padding: "8px 12px" }}>{inv.providerName}</td>
                        <td style={{ padding: "8px 12px" }}>
                          ${inv.totalAmount.toFixed(2)}
                        </td>
                        <td style={{ padding: "8px 12px" }}>{inv.coveragePercent}%</td>
                        <td style={{ padding: "8px 12px" }}>
                          ${inv.balance.toFixed(2)}
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 600,
                              color: "#fff",
                              backgroundColor: statusColor(inv.status),
                            }}
                          >
                            {statusLabel(inv.status)}
                          </span>
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>
                          {inv.status === "DUE" || inv.status === "PARTIAL" ? (
                            <button onClick={() => handlePay(inv.invoiceId)}>
                              Pay
                            </button>
                          ) : (
                            <button
                              disabled
                              style={{ opacity: 0.6, cursor: "default" }}
                            >
                              Pay
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p style={{ marginTop: 10, fontSize: 12, color: "#718096" }}>
              For questions about your statement or insurance coverage, contact the billing
              office or your provider’s clinic.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Billing;
