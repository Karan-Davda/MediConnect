import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import "./Account.css";

// Mock data for CSV export (same as in Billing.tsx)
const mockInvoicesForExport = [
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
    coveragePercent: 0,
    status: "PENDING_INSURANCE",
  },
];

const BillingReportsPage: React.FC = () => {
  const { isAuthenticated, hasRole, user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [status, setStatus] = useState<"ALL" | "PAID" | "DUE" | "PENDING_INSURANCE">(
    "ALL"
  );

  const isAdmin = hasRole(["admin", "clinic_admin"]);

  const toggleSidebar = () => setSidebarCollapsed((s) => !s);

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="dashboard-container">
        <div className="main-content">
          <div className="dashboard-content">
            <p>You are not authorized to view billing reports.</p>
          </div>
        </div>
      </div>
    );
  }

  const generateCSV = (data: any[]) => {
    const headers = [
      "Invoice ID",
      "Service Date",
      "Patient Name",
      "Provider Name",
      "Service Description",
      "Total Amount",
      "Coverage Percent",
      "Insurance Covered",
      "Patient Balance",
      "Status"
    ];

    const csvContent = [
      headers.join(","),
      ...data.map(invoice => {
        const covered = invoice.totalAmount * (invoice.coveragePercent / 100);
        const balance = invoice.totalAmount - covered;
        
        return [
          `"${invoice.invoiceId}"`,
          `"${invoice.serviceDate}"`,
          `"${invoice.patientName}"`,
          `"${invoice.providerName}"`,
          `"${invoice.serviceDesc}"`,
          invoice.totalAmount.toFixed(2),
          invoice.coveragePercent,
          covered.toFixed(2),
          balance.toFixed(2),
          `"${invoice.status}"`
        ].join(",");
      })
    ].join("\n");

    return csvContent;
  };

  const downloadCSV = (csvContent: string, filename: string) => {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleExport = () => {
    // Filter data based on form inputs
    let filteredData = [...mockInvoicesForExport];

    // Filter by date range
    if (fromDate) {
      filteredData = filteredData.filter(
        invoice => new Date(invoice.serviceDate) >= new Date(fromDate)
      );
    }
    if (toDate) {
      filteredData = filteredData.filter(
        invoice => new Date(invoice.serviceDate) <= new Date(toDate)
      );
    }

    // Filter by status
    if (status !== "ALL") {
      if (status === "DUE") {
        filteredData = filteredData.filter(
          invoice => invoice.status === "DUE" || invoice.status === "PARTIAL"
        );
      } else {
        filteredData = filteredData.filter(invoice => invoice.status === status);
      }
    }

    // Generate CSV
    const csvContent = generateCSV(filteredData);
    
    // Create filename with current date and filters
    const today = new Date().toISOString().split('T')[0];
    const statusFilter = status === "ALL" ? "all" : status.toLowerCase();
    const filename = `billing-report-${today}-${statusFilter}.csv`;
    
    // Download the file
    downloadCSV(csvContent, filename);
  };

  return (
    <div className="dashboard-container">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      <div
        className={`main-content ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}
      >
        <header className="header">
          <div className="header-left">
            <h1 className="brand-title">MediConnect — Billing Reports</h1>
          </div>
          <div className="header-right">
            {user && (
              <span className="user-name" style={{ fontSize: 12, color: "#4a5568" }}>
                {user.name || user.email}
              </span>
            )}
          </div>
        </header>

        <div className="dashboard-content" style={{ maxWidth: 900, margin: "0 auto" }}>
          <section className="account-section">
            <h2>Export Billing Report (CSV)</h2>
            <p style={{ color: "#4a5568", marginTop: 4 }}>
              Generate a CSV export of billing activity for finance and audit purposes.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 16,
                marginTop: 16,
              }}
            >
              <div>
                <label style={{ fontSize: 13, color: "#4a5568" }}>From date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  style={{ marginTop: 4, width: "100%", padding: "6px 8px" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, color: "#4a5568" }}>To date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  style={{ marginTop: 4, width: "100%", padding: "6px 8px" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, color: "#4a5568" }}>Status</label>
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as typeof status)
                  }
                  style={{ marginTop: 4, width: "100%", padding: "6px 8px" }}
                >
                  <option value="ALL">All</option>
                  <option value="PAID">Paid</option>
                  <option value="DUE">Due / Partial</option>
                  <option value="PENDING_INSURANCE">Pending insurance</option>
                </select>
              </div>
            </div>

            <button
              style={{ marginTop: 20 }}
              onClick={handleExport}
            >
              Download CSV
            </button>
            
            <p style={{ marginTop: 12, fontSize: 12, color: "#718096" }}>
              The CSV will include invoice details, patient information, provider details, 
              amounts, insurance coverage, and payment status. Data is filtered based on 
              your selected criteria above.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default BillingReportsPage;
