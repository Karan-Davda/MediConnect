import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import { apiUrl } from "../config/api";
import "./Account.css";

type InvoiceStatus = "PENDING_INSURANCE" | "DUE" | "PAID" | "PARTIAL";

type Invoice = {
  invoiceId: string;
  invoiceNumber: string;
  serviceDate: string;
  invoiceDate?: string;
  dueDate?: string;
  serviceDesc: string;
  providerName: string;
  patientName: string;
  totalAmount: number;
  subtotal?: number;
  tax?: number;
  discount?: number;
  coveragePercent: number; // from 04.04 Record Insurance
  insurancePaid?: number;
  patientResponsibility?: number;
  balanceDue?: number;
  status: InvoiceStatus;
  lineItems?: Array<{
    service_code: string;
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  notes?: string | null;
};

type PaymentStatus = "SUCCESS" | "FAILED" | "REFUNDED";
type PaymentMethodType = "CREDIT" | "DEBIT" | "HSA";

type Payment = {
  paymentId: string;
  invoiceId: string;
  paidOn: string; // ISO date
  amount: number;
  methodType: PaymentMethodType;
  methodLabel: string; // masked for DP, e.g. "Visa •••• 4242"
  status: PaymentStatus;
};

const Billing: React.FC = () => {
  const { isAuthenticated, hasRole, user } = useAuth();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const toggleSidebar = () => setSidebarCollapsed((s) => !s);

  // Fetch invoices from backend
  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        
        const response = await fetch(apiUrl('invoices'), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch invoices');
        }

        const data = await response.json();
        
        // Check if invoices array exists
        if (!data || !data.invoices || !Array.isArray(data.invoices)) {
          console.error('Invalid invoice data structure:', data);
          setError('Invalid data received from server');
          setInvoices([]);
          return;
        }
        
        // Transform backend invoices to frontend format
        const formattedInvoices: Invoice[] = data.invoices.map((inv: any) => {
          // Get service description from line items
          const serviceDesc = inv.lineItems && Array.isArray(inv.lineItems) && inv.lineItems.length > 0
            ? inv.lineItems.map((item: any) => item.description || 'Service').join(', ')
            : 'Medical services';

          return {
            invoiceId: String(inv.invoiceId || inv.invoice_id || ''),
            invoiceNumber: inv.invoiceNumber || inv.invoice_number || '',
            serviceDate: inv.serviceDate || inv.service_date || new Date().toISOString(),
            invoiceDate: inv.invoiceDate || inv.invoice_date,
            dueDate: inv.dueDate || inv.due_date,
            serviceDesc: serviceDesc,
            providerName: inv.doctorName || inv.doctor_name || 'Unknown Doctor',
            patientName: inv.patientName || inv.patient_name || 'Unknown Patient',
            totalAmount: parseFloat(inv.totalAmount || inv.total_amount || 0),
            subtotal: inv.subtotal ? parseFloat(inv.subtotal) : parseFloat(inv.totalAmount || inv.total_amount || 0),
            tax: inv.tax ? parseFloat(inv.tax) : 0,
            discount: inv.discount ? parseFloat(inv.discount) : 0,
            coveragePercent: inv.insuranceCoveragePercent || inv.insurance_coverage_percent || 0,
            insurancePaid: inv.insurancePaid || inv.insurance_paid || 0,
            patientResponsibility: inv.patientResponsibility || inv.patient_responsibility || parseFloat(inv.totalAmount || inv.total_amount || 0),
            balanceDue: inv.balanceDue || inv.balance_due || parseFloat(inv.totalAmount || inv.total_amount || 0),
            status: (inv.status || 'DUE') as InvoiceStatus,
            lineItems: (inv.lineItems && Array.isArray(inv.lineItems)) ? inv.lineItems : [],
            notes: inv.notes || null
          };
        });

        setInvoices(formattedInvoices);

        // Fetch payments for all invoices
        const allPayments: Payment[] = [];
        for (const invoice of formattedInvoices) {
          try {
            const paymentResponse = await fetch(apiUrl(`invoices/${invoice.invoiceId}`), {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (paymentResponse.ok) {
              const paymentData = await paymentResponse.json();
              if (paymentData.payments && paymentData.payments.length > 0) {
                const formattedPayments = paymentData.payments.map((p: any) => ({
                  paymentId: String(p.paymentId),
                  invoiceId: String(p.invoiceId),
                  paidOn: p.paymentDate,
                  amount: p.amount,
                  methodType: p.paymentMethod.toUpperCase() as PaymentMethodType,
                  methodLabel: p.last4 ? `${p.paymentMethod} •••• ${p.last4}` : p.paymentMethod,
                  status: p.status as PaymentStatus
                }));
                allPayments.push(...formattedPayments);
              }
            }
          } catch (err) {
            console.error(`Error fetching payments for invoice ${invoice.invoiceId}:`, err);
          }
        }
        setPayments(allPayments);
      } catch (err: any) {
        console.error('Error fetching invoices:', err);
        setError(err.message || 'Failed to load invoices');
        setInvoices([]);
        setPayments([]);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (token) {
        fetchInvoices();
      } else {
        setLoading(false);
        setError('Authentication token not found');
      }
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Role flags (ET-In / AUT)
  const isPatient = hasRole(["patient"]);
  const isAdmin = hasRole(["admin", "clinic_admin"]);
  const isProvider = hasRole(["doctor", "clinic_staff"]);
  const canViewBilling = isPatient || isAdmin || isProvider;

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    if (!canViewBilling) {
      navigate("/home"); // Redirect unauthorized users
      return;
    }
  }, [isAuthenticated, canViewBilling, navigate]);

  // Admin nav handlers – wired to their own pages
  const handleExportBillingReportClick = () => {
    navigate("/billing/reports");
  };

  const handleViewAuditLogClick = () => {
    navigate("/audit-log/billing");
  };

  // Show loading state while checking authentication
  if (!isAuthenticated) {
    return (
      <div className="dashboard-container">
        <div className="main-content">
          <div className="dashboard-content">
            <p>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!canViewBilling) {
    return (
      <div className="dashboard-container">
        <div className="main-content">
          <div className="dashboard-content">
            <p>You do not have permission to view this page.</p>
          </div>
        </div>
      </div>
    );
  }

  // Simple copay/balance calc based on coveragePercent (CL / DDD)
  const invoicesWithBalance = useMemo(() => {
    if (!invoices || !Array.isArray(invoices)) {
      return [];
    }
    return invoices.map((inv) => {
      const total = inv.totalAmount || 0;
      const coverage = inv.coveragePercent || 0;
      const covered = total * (coverage / 100);
      const balance = total - covered;
      return {
        ...inv,
        covered: parseFloat(covered.toFixed(2)),
        balance: parseFloat(balance.toFixed(2)),
      };
    });
  }, [invoices]);

  const totalDue = useMemo(
    () =>
      (invoicesWithBalance || [])
        .filter((i) => i.status === "DUE" || i.status === "PARTIAL")
        .reduce((sum, i) => sum + (i.balance || 0), 0),
    [invoicesWithBalance]
  );

  const numDueInvoices = useMemo(
    () =>
      (invoicesWithBalance || []).filter(
        (i) => i.status === "DUE" || i.status === "PARTIAL"
      ).length,
    [invoicesWithBalance]
  );

  const numPendingInsurance = useMemo(
    () => (invoicesWithBalance || []).filter((i) => i.status === "PENDING_INSURANCE").length,
    [invoicesWithBalance]
  );

  const totalCollected = useMemo(
    () =>
      (payments || [])
        .filter((p) => p.status === "SUCCESS")
        .reduce((sum, p) => sum + (p.amount || 0), 0),
    [payments]
  );

  // Provider name for filtering
  const providerName = isProvider && user?.name ? user.name : "";

  // For provider "My encounters" – in real app you'd filter by providerId
  const providerInvoices = useMemo(
    () =>
      isProvider
        ? (invoicesWithBalance || []).filter((i) =>
            providerName
              ? i.providerName === providerName
              : (i.providerName || '').toLowerCase().includes("dr.")
          )
        : [],
    [isProvider, invoicesWithBalance, providerName]
  );

  const handlePay = (invoiceId: string) => {
    // 04.01 Process Payments – only patients navigate here
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

  const selectedInvoice = useMemo(
    () =>
      selectedInvoiceId && invoicesWithBalance
        ? invoicesWithBalance.find((i) => i.invoiceId === selectedInvoiceId) || null
        : null,
    [selectedInvoiceId, invoicesWithBalance]
  );

  // Filter payments for selected invoice (04.03 payment history)
  const relatedPayments = useMemo(
    () =>
      selectedInvoice && payments
        ? payments.filter((p) => p.invoiceId === selectedInvoice.invoiceId)
        : [],
    [selectedInvoice, payments]
  );

  // === Patient billing view (full detail + history) ===
  const renderPatientBilling = () => (
    <div
      className="dashboard-content"
      style={{ maxWidth: 1200, margin: "0 auto" }}
    >
      {/* Summary card */}
      <section className="account-section" style={{ marginBottom: 16 }}>
        <h2>Billing Overview</h2>
        <p style={{ color: "#4a5568", marginTop: 4 }}>
          View outstanding balances, insurance coverage, billing details, and payment
          history for your visits.
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
              Amounts shown reflect any insurance coverage that has been recorded and
              verified. Patient responsibility is calculated
              from the remaining balance.
            </div>
          </div>
        </div>
      </section>

      {/* Invoice list (04.01 + 04.03) */}
      <section className="account-section">
        <h2>Invoices</h2>

        {loading ? (
          <p style={{ marginTop: 12, color: "#4a5568" }}>Loading invoices...</p>
        ) : error ? (
          <div style={{ marginTop: 12, padding: 16, background: "#fee", border: "1px solid #fcc", borderRadius: 4 }}>
            <p style={{ color: "#e53e3e", margin: 0 }}>Error: {error}</p>
            <p style={{ color: "#666", fontSize: 12, marginTop: 8, marginBottom: 0 }}>
              Please refresh the page or contact support if the issue persists.
            </p>
          </div>
        ) : !invoicesWithBalance || invoicesWithBalance.length === 0 ? (
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
                  <th style={{ padding: "8px 12px" }}>Invoice #</th>
                  <th style={{ padding: "8px 12px" }}>Date</th>
                  <th style={{ padding: "8px 12px" }}>Service</th>
                  <th style={{ padding: "8px 12px" }}>Provider</th>
                  <th style={{ padding: "8px 12px" }}>Total</th>
                  <th style={{ padding: "8px 12px" }}>Coverage</th>
                  <th style={{ padding: "8px 12px" }}>Patient balance</th>
                  <th style={{ padding: "8px 12px" }}>Status</th>
                  <th style={{ padding: "8px 12px" }}></th>
                </tr>
              </thead>
              <tbody>
                {(invoicesWithBalance || []).map((inv) => (
                  <tr
                    key={inv.invoiceId}
                    style={{
                      borderBottom: "1px solid #edf2f7",
                      backgroundColor:
                        selectedInvoiceId === inv.invoiceId ? "#ebf8ff" : "transparent",
                      cursor: "pointer",
                    }}
                    onClick={() =>
                      setSelectedInvoiceId((current) =>
                        current === inv.invoiceId ? null : inv.invoiceId
                      )
                    }
                  >
                    <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                      {inv.invoiceNumber || inv.invoiceId}
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePay(inv.invoiceId);
                          }}
                        >
                          Pay
                        </button>
                      ) : (
                        <button
                          disabled
                          style={{ opacity: 0.6, cursor: "default" }}
                          onClick={(e) => e.stopPropagation()}
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

      {/* Detail Billing: selected invoice breakdown + payment history (04.03) */}
      <section className="account-section" style={{ marginTop: 16 }}>
        <h2>Billing Details &amp; Payment History</h2>

        {!selectedInvoice ? (
          <p style={{ marginTop: 8, color: "#4a5568" }}>
            Select an invoice from the table above to view detailed billing information and
            payment history.
          </p>
        ) : (
          <>
            {/* Invoice detail breakdown */}
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                background: "#f7fafc",
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: 8 }}>
                Invoice {selectedInvoice.invoiceNumber || selectedInvoice.invoiceId}
              </h3>
              <p style={{ margin: "4px 0", color: "#4a5568" }}>
                <strong>Service:</strong> {selectedInvoice.serviceDesc}
              </p>
              <p style={{ margin: "4px 0", color: "#4a5568" }}>
                <strong>Provider:</strong> {selectedInvoice.providerName}
              </p>
              <p style={{ margin: "4px 0", color: "#4a5568" }}>
                <strong>Date of service:</strong>{" "}
                {new Date(selectedInvoice.serviceDate).toLocaleDateString()}
              </p>
              {selectedInvoice.invoiceDate && (
                <p style={{ margin: "4px 0", color: "#4a5568" }}>
                  <strong>Invoice date:</strong>{" "}
                  {new Date(selectedInvoice.invoiceDate).toLocaleDateString()}
                </p>
              )}
              {selectedInvoice.dueDate && (
                <p style={{ margin: "4px 0", color: "#4a5568" }}>
                  <strong>Due date:</strong>{" "}
                  {new Date(selectedInvoice.dueDate).toLocaleDateString()}
                </p>
              )}
              {selectedInvoice.lineItems && selectedInvoice.lineItems.length > 0 && (
                <div style={{ margin: "8px 0" }}>
                  <strong style={{ color: "#4a5568" }}>Line items:</strong>
                  <ul style={{ margin: "4px 0", paddingLeft: "20px", color: "#4a5568" }}>
                    {selectedInvoice.lineItems.map((item: any, idx: number) => (
                      <li key={idx}>
                        {item.description} - Qty: {item.quantity} × ${item.unit_price?.toFixed(2) || '0.00'} = ${item.total?.toFixed(2) || '0.00'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedInvoice.subtotal !== undefined && (
                <p style={{ margin: "4px 0", color: "#4a5568" }}>
                  <strong>Subtotal:</strong> ${selectedInvoice.subtotal.toFixed(2)}
                </p>
              )}
              {selectedInvoice.tax !== undefined && selectedInvoice.tax > 0 && (
                <p style={{ margin: "4px 0", color: "#4a5568" }}>
                  <strong>Tax:</strong> ${selectedInvoice.tax.toFixed(2)}
                </p>
              )}
              {selectedInvoice.discount !== undefined && selectedInvoice.discount > 0 && (
                <p style={{ margin: "4px 0", color: "#4a5568" }}>
                  <strong>Discount:</strong> ${selectedInvoice.discount.toFixed(2)}
                </p>
              )}
              <p style={{ margin: "4px 0", color: "#4a5568" }}>
                <strong>Total charge:</strong> $
                {selectedInvoice.totalAmount.toFixed(2)}
              </p>
              <p style={{ margin: "4px 0", color: "#4a5568" }}>
                <strong>Insurance coverage:</strong>{" "}
                {selectedInvoice.coveragePercent}% ($
                {selectedInvoice.covered.toFixed(2)})
              </p>
              {selectedInvoice.insurancePaid !== undefined && selectedInvoice.insurancePaid > 0 && (
                <p style={{ margin: "4px 0", color: "#4a5568" }}>
                  <strong>Insurance paid:</strong> ${selectedInvoice.insurancePaid.toFixed(2)}
                </p>
              )}
              <p style={{ margin: "4px 0", color: "#4a5568" }}>
                <strong>Patient responsibility:</strong> $
                {selectedInvoice.balance.toFixed(2)}
              </p>
              {selectedInvoice.balanceDue !== undefined && (
                <p style={{ margin: "4px 0", color: "#4a5568" }}>
                  <strong>Balance due:</strong> ${selectedInvoice.balanceDue.toFixed(2)}
                </p>
              )}
              <p style={{ margin: "4px 0", color: "#4a5568" }}>
                <strong>Status:</strong> {statusLabel(selectedInvoice.status)}
              </p>
              {selectedInvoice.notes && (
                <p style={{ margin: "4px 0", color: "#4a5568" }}>
                  <strong>Notes:</strong> {selectedInvoice.notes}
                </p>
              )}
            </div>

            {/* Payment history for this invoice – patients CAN see card info (masked) */}
            <div style={{ marginTop: 16 }}>
              <h3 style={{ marginTop: 0 }}>Payment history</h3>

              {relatedPayments.length === 0 ? (
                <p style={{ marginTop: 8, color: "#4a5568" }}>
                  No payments recorded yet for this invoice.
                </p>
              ) : (
                <div style={{ marginTop: 8, overflowX: "auto" }}>
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
                        <th style={{ padding: "8px 12px" }}>Payment ID</th>
                        <th style={{ padding: "8px 12px" }}>Date</th>
                        <th style={{ padding: "8px 12px" }}>Amount</th>
                        <th style={{ padding: "8px 12px" }}>Method</th>
                        <th style={{ padding: "8px 12px" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(relatedPayments || []).map((p) => (
                        <tr
                          key={p.paymentId}
                          style={{ borderBottom: "1px solid #edf2f7" }}
                        >
                          <td
                            style={{ padding: "8px 12px", whiteSpace: "nowrap" }}
                          >
                            {p.paymentId}
                          </td>
                          <td
                            style={{ padding: "8px 12px", whiteSpace: "nowrap" }}
                          >
                            {new Date(p.paidOn).toLocaleString()}
                          </td>
                          <td style={{ padding: "8px 12px" }}>
                            ${p.amount.toFixed(2)}
                          </td>
                          <td style={{ padding: "8px 12px" }}>
                            {/* DP: masked, no full card details */}
                            {p.methodLabel}
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
                                backgroundColor:
                                  p.status === "SUCCESS"
                                    ? "#38a169"
                                    : p.status === "FAILED"
                                    ? "#e53e3e"
                                    : "#718096",
                              }}
                            >
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );

  // === Admin billing view – clinic-wide snapshot (no process payments) ===
  const renderAdminBilling = () => (
    <div
      className="dashboard-content"
      style={{ maxWidth: 1200, margin: "0 auto" }}
    >
      <section className="account-section" style={{ marginBottom: 16 }}>
        <h2>Clinic Billing Overview</h2>
        <p style={{ color: "#4a5568", marginTop: 4 }}>
          Monitor clinic-wide payments, balances, and insurance activity. 
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
            <div style={{ fontSize: 13, color: "#4a5568" }}>Total due (all patients)</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
              ${totalDue.toFixed(2)}
            </div>
            <div style={{ fontSize: 12, color: "#718096", marginTop: 4 }}>
              Across all invoices marked as Due or Partial.
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
            <div style={{ fontSize: 13, color: "#4a5568" }}>Collected (successful)</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
              ${totalCollected.toFixed(2)}
            </div>
            <div style={{ fontSize: 12, color: "#718096", marginTop: 4 }}>
              Sum of all successful payments recorded.
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
            <div style={{ fontSize: 13, color: "#4a5568" }}>Invoices due</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
              {numDueInvoices}
            </div>
            <div style={{ fontSize: 12, color: "#718096", marginTop: 4 }}>
              Currently marked as Due or Partial.
            </div>
          </div>

          <div
            style={{
              flex: "1 1 220px",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              padding: 16,
              background: "#fff5f5",
            }}
          >
            <div style={{ fontSize: 13, color: "#4a5568" }}>Pending insurance</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
              {numPendingInsurance}
            </div>
            <div style={{ fontSize: 12, color: "#718096", marginTop: 4 }}>
              Invoices still awaiting insurance adjudication.
            </div>
          </div>
        </div>
      </section>

      {/* All invoices table – includes patient name */}
      <section className="account-section">
        <h2>All Invoices</h2>
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
                  <th style={{ padding: "8px 12px" }}>Provider</th>
                  <th style={{ padding: "8px 12px" }}>Service</th>
                <th style={{ padding: "8px 12px" }}>Total</th>
                <th style={{ padding: "8px 12px" }}>Coverage</th>
                <th style={{ padding: "8px 12px" }}>Balance</th>
                <th style={{ padding: "8px 12px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {invoicesWithBalance.map((inv) => (
                <tr
                  key={inv.invoiceId}
                  style={{
                    borderBottom: "1px solid #edf2f7",
                    backgroundColor:
                      selectedInvoiceId === inv.invoiceId ? "#ebf8ff" : "transparent",
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    setSelectedInvoiceId((current) =>
                      current === inv.invoiceId ? null : inv.invoiceId
                    )
                  }
                >
                  <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                    {inv.invoiceNumber || inv.invoiceId}
                  </td>
                  <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                    {new Date(inv.serviceDate).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "8px 12px" }}>{inv.providerName}</td>
                  <td style={{ padding: "8px 12px" }}>{inv.serviceDesc}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Admin operations – three working buttons */}
      <section className="account-section" style={{ marginTop: 16 }}>
        <h2>Billing Operations</h2>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            marginTop: 8,
          }}
        >
          <button onClick={handleExportBillingReportClick}>
            Export Billing Report (CSV)
          </button>
          <button onClick={handleViewAuditLogClick}>View Audit Log</button>
        </div>
      </section>

      {/* Invoice details & payment history for admin */}
      <section className="account-section" style={{ marginTop: 16 }}>
        <h2>Invoice Details &amp; Payment History</h2>
        {!selectedInvoice ? (
          <p style={{ marginTop: 8, color: "#4a5568" }}>
            Select an invoice above to review billing details and payment history.
          </p>
        ) : (
          <>
            {/* Detail block */}
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                background: "#f7fafc",
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: 8 }}>
                Invoice {selectedInvoice.invoiceNumber || selectedInvoice.invoiceId}
              </h3>
              <p style={{ margin: "4px 0", color: "#4a5568" }}>
                <strong>Service:</strong> {selectedInvoice.serviceDesc}
              </p>
              <p style={{ margin: "4px 0", color: "#4a5568" }}>
                <strong>Provider:</strong> {selectedInvoice.providerName}
              </p>
              <p style={{ margin: "4px 0", color: "#4a5568" }}>
                <strong>Date of service:</strong>{" "}
                {new Date(selectedInvoice.serviceDate).toLocaleDateString()}
              </p>
              {selectedInvoice.invoiceDate && (
                <p style={{ margin: "4px 0", color: "#4a5568" }}>
                  <strong>Invoice date:</strong>{" "}
                  {new Date(selectedInvoice.invoiceDate).toLocaleDateString()}
                </p>
              )}
              {selectedInvoice.dueDate && (
                <p style={{ margin: "4px 0", color: "#4a5568" }}>
                  <strong>Due date:</strong>{" "}
                  {new Date(selectedInvoice.dueDate).toLocaleDateString()}
                </p>
              )}
              {selectedInvoice.lineItems && selectedInvoice.lineItems.length > 0 && (
                <div style={{ margin: "8px 0" }}>
                  <strong style={{ color: "#4a5568" }}>Line items:</strong>
                  <ul style={{ margin: "4px 0", paddingLeft: "20px", color: "#4a5568" }}>
                    {selectedInvoice.lineItems.map((item: any, idx: number) => (
                      <li key={idx}>
                        {item.description} - Qty: {item.quantity} × ${item.unit_price?.toFixed(2) || '0.00'} = ${item.total?.toFixed(2) || '0.00'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedInvoice.subtotal !== undefined && (
                <p style={{ margin: "4px 0", color: "#4a5568" }}>
                  <strong>Subtotal:</strong> ${selectedInvoice.subtotal.toFixed(2)}
                </p>
              )}
              {selectedInvoice.tax !== undefined && selectedInvoice.tax > 0 && (
                <p style={{ margin: "4px 0", color: "#4a5568" }}>
                  <strong>Tax:</strong> ${selectedInvoice.tax.toFixed(2)}
                </p>
              )}
              {selectedInvoice.discount !== undefined && selectedInvoice.discount > 0 && (
                <p style={{ margin: "4px 0", color: "#4a5568" }}>
                  <strong>Discount:</strong> ${selectedInvoice.discount.toFixed(2)}
                </p>
              )}
              <p style={{ margin: "4px 0", color: "#4a5568" }}>
                <strong>Total charge:</strong> $
                {selectedInvoice.totalAmount.toFixed(2)}
              </p>
              <p style={{ margin: "4px 0", color: "#4a5568" }}>
                <strong>Insurance coverage:</strong>{" "}
                {selectedInvoice.coveragePercent}% ($
                {selectedInvoice.covered.toFixed(2)})
              </p>
              {selectedInvoice.insurancePaid !== undefined && selectedInvoice.insurancePaid > 0 && (
                <p style={{ margin: "4px 0", color: "#4a5568" }}>
                  <strong>Insurance paid:</strong> ${selectedInvoice.insurancePaid.toFixed(2)}
                </p>
              )}
              <p style={{ margin: "4px 0", color: "#4a5568" }}>
                <strong>Patient responsibility:</strong> $
                {selectedInvoice.balance.toFixed(2)}
              </p>
              {selectedInvoice.balanceDue !== undefined && (
                <p style={{ margin: "4px 0", color: "#4a5568" }}>
                  <strong>Balance due:</strong> ${selectedInvoice.balanceDue.toFixed(2)}
                </p>
              )}
              <p style={{ margin: "4px 0", color: "#4a5568" }}>
                <strong>Status:</strong> {statusLabel(selectedInvoice.status)}
              </p>
              {selectedInvoice.notes && (
                <p style={{ margin: "4px 0", color: "#4a5568" }}>
                  <strong>Notes:</strong> {selectedInvoice.notes}
                </p>
              )}
            </div>

            {/* Payment history – admin CAN see card info (masked) */}
            <div style={{ marginTop: 16 }}>
              <h3 style={{ marginTop: 0 }}>Payment history</h3>
              {relatedPayments.length === 0 ? (
                <p style={{ marginTop: 8, color: "#4a5568" }}>
                  No payments recorded yet for this invoice.
                </p>
              ) : (
                <div style={{ marginTop: 8, overflowX: "auto" }}>
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
                        <th style={{ padding: "8px 12px" }}>Payment ID</th>
                        <th style={{ padding: "8px 12px" }}>Date</th>
                        <th style={{ padding: "8px 12px" }}>Amount</th>
                        <th style={{ padding: "8px 12px" }}>Method</th>
                        <th style={{ padding: "8px 12px" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(relatedPayments || []).map((p) => (
                        <tr
                          key={p.paymentId}
                          style={{ borderBottom: "1px solid #edf2f7" }}
                        >
                          <td
                            style={{ padding: "8px 12px", whiteSpace: "nowrap" }}
                          >
                            {p.paymentId}
                          </td>
                          <td
                            style={{ padding: "8px 12px", whiteSpace: "nowrap" }}
                          >
                            {new Date(p.paidOn).toLocaleString()}
                          </td>
                          <td style={{ padding: "8px 12px" }}>
                            ${p.amount.toFixed(2)}
                          </td>
                          <td style={{ padding: "8px 12px" }}>{p.methodLabel}</td>
                          <td style={{ padding: "8px 12px" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                borderRadius: 999,
                                fontSize: 12,
                                fontWeight: 600,
                                color: "#fff",
                                backgroundColor:
                                  p.status === "SUCCESS"
                                    ? "#38a169"
                                    : p.status === "FAILED"
                                    ? "#e53e3e"
                                    : "#718096",
                              }}
                            >
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );

  // === Provider billing view – encounters only, no history/details ===
  const renderProviderBilling = () => (
    <div
      className="dashboard-content"
      style={{ maxWidth: 1200, margin: "0 auto" }}
    >
      <section className="account-section" style={{ marginBottom: 16 }}>
        <h2>My Billing Summary</h2>
        <p style={{ color: "#4a5568", marginTop: 4 }}>
          View billed visits, claim status, and balances associated with your encounters.
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
            <div style={{ fontSize: 13, color: "#4a5568" }}>This sample week</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
              ${totalCollected.toFixed(2)}
            </div>
            <div style={{ fontSize: 12, color: "#718096", marginTop: 4 }}>
              Total collected across your encounters (sample data).
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
            <div style={{ fontSize: 13, color: "#4a5568" }}>Encounters due</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
              {
                providerInvoices.filter(
                  (i) => i.status === "DUE" || i.status === "PARTIAL"
                ).length
              }
            </div>
            <div style={{ fontSize: 12, color: "#718096", marginTop: 4 }}>
              Visits with outstanding patient balance.
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
            <div style={{ fontSize: 13, color: "#4a5568" }}>Pending insurance</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
              {
                providerInvoices.filter(
                  (i) => i.status === "PENDING_INSURANCE"
                ).length
              }
            </div>
            <div style={{ fontSize: 12, color: "#718096", marginTop: 4 }}>
              Visits still awaiting insurance adjudication.
            </div>
          </div>
        </div>
      </section>

      {/* Provider encounters table – no click, no history/details */}
      <section className="account-section">
        <h2>My Encounters</h2>
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
                <th style={{ padding: "8px 12px" }}>Date</th>
                <th style={{ padding: "8px 12px" }}>Service</th>
                <th style={{ padding: "8px 12px" }}>Total</th>
                <th style={{ padding: "8px 12px" }}>Coverage</th>
                <th style={{ padding: "8px 12px" }}>Balance</th>
                <th style={{ padding: "8px 12px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {(providerInvoices || []).map((inv) => (
                <tr
                  key={inv.invoiceId}
                  style={{
                    borderBottom: "1px solid #edf2f7",
                    backgroundColor: "transparent",
                  }}
                >
                  <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                    {new Date(inv.serviceDate).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "8px 12px" }}>{inv.serviceDesc}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );

  const renderRoleBilling = () => {
    if (isAdmin) return renderAdminBilling();
    if (isProvider) return renderProviderBilling();
    return renderPatientBilling();
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={toggleSidebar} />

      {/* Main */}
      <div
        className={`main-content ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}
      >
        {/* Header (same as other pages) */}
        <header className="header">
          <div className="header-left">
            <h1 className="brand-title">
              MediConnect — Billing
              {isAdmin
                ? " (Admin)"
                : isProvider
                ? " (Provider)"
                : isPatient
                ? " (Patient)"
                : ""}
            </h1>
          </div>
          <div className="header-right">
            {user && (
              <span className="user-name" style={{ fontSize: 12, color: "#4a5568" }}>
                {user.name || user.email}
              </span>
            )}
          </div>
        </header>

        {renderRoleBilling()}
      </div>
    </div>
  );
};

export default Billing;
