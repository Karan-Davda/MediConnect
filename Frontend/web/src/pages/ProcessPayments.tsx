import React, { useMemo, useRef, useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import { apiUrl } from "../config/api";
import "./Account.css"; 

type Invoice = {
  invoiceId: string;
  patientId: string;
  patientName: string;
  serviceDesc: string;
  amountDue: number; // pre-insurance/copay outstanding
};

const mockInvoice: Invoice = {
  invoiceId: "INV-2025-1101-0007",
  patientId: "patient-123",
  patientName: "Jane Doe",
  serviceDesc: "Primary care follow-up visit",
  amountDue: 120.0,
};

const mockCoveragePercent = 80; // 80% covered → copay 20%


const onlyDigits = (s: string) => s.replace(/\D+/g, "");

const luhnCheck = (num: string) => {
  // Basic Luhn for FV of card number
  let sum = 0;
  let shouldDouble = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = parseInt(num.charAt(i), 10);
    if (shouldDouble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
};

const isFutureExpiry = (mmYY: string) => {
  // MM/YY -> must be end-of-month >= current month
  const m = mmYY.match(/^(\d{2})\/(\d{2})$/);
  if (!m) return false;
  const mm = parseInt(m[1], 10);
  const yy = parseInt(m[2], 10);
  if (mm < 1 || mm > 12) return false;
  const fullYear = 2000 + yy;
  const endOfMonth = new Date(fullYear, mm, 0, 23, 59, 59, 999);
  const now = new Date();
  return endOfMonth.getTime() >= now.getTime();
};

type PayMethod = "credit" | "debit" | "hsa";

type PaymentRequest = {
  amount: number;
  currency: "USD";
  method: PayMethod;
  nameOnCard: string;
  cardNumber: string; // DP: transient only
  expiry: string;     // MM/YY
  cvv: string;
  zip: string;
  hsaMemberId?: string;
  idempotencyKey: string; // CC: prevent double-charges
};

type Receipt = {
  receiptId: string;
  invoiceId: string;
  patientId: string;
  amount: number;
  last4: string;
  method: PayMethod;
  networkAuthCode: string;
  createdAt: string;
};

async function mockChargeGateway(req: PaymentRequest): Promise<Receipt> {
  // CN: latency
  await new Promise((r) => setTimeout(r, 800));

  // 7% simulated failure
  if (Math.random() < 0.07) {
    const e = new Error("Gateway timeout");
    (e as any).code = "ETIMEOUT";
    throw e;
  }

  const last4 = req.cardNumber.slice(-4);
  return {
    receiptId: `rcpt_${Math.random().toString(36).slice(2, 10)}`,
    invoiceId: mockInvoice.invoiceId,
    patientId: mockInvoice.patientId,
    amount: req.amount,
    last4,
    method: req.method,
    networkAuthCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
    createdAt: new Date().toISOString(),
  };
}

const ProcessPayments: React.FC = () => {
  const auth = useAuth();
  const user = auth?.user;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const invoiceIdParam = searchParams.get('invoiceId');
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const toggleSidebar = () => setSidebarCollapsed((s) => !s);
  
  const [invoice, setInvoice] = useState<any>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(true);
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');

  // Fetch invoice data from backend
  useEffect(() => {
    const fetchInvoice = async () => {
      if (!invoiceIdParam || !token) {
        setLoadingInvoice(false);
        return;
      }
      
      try {
        const response = await fetch(apiUrl(`invoices/${invoiceIdParam}`), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('[DEBUG] Invoice data received:', data);
          if (data && data.invoice) {
            setInvoice(data.invoice);
            setError(null);
          } else {
            console.error('Invalid invoice data structure:', data);
            setError('Invalid invoice data received');
            setInvoice(null);
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('Failed to fetch invoice:', response.status, errorData);
          setError(errorData.error || `Failed to load invoice (${response.status})`);
          setInvoice(null);
        }
      } catch (err: any) {
        console.error('Error fetching invoice:', err);
        setError(err.message || 'Failed to load invoice. Please try again.');
        setInvoice(null);
      } finally {
        setLoadingInvoice(false);
      }
    };
    
    fetchInvoice();
  }, [invoiceIdParam, token]);

  // DF-In/CL: compute copay from coverage
  const copayDue = useMemo(() => {
    if (!invoice) return 0;
    try {
      const balanceDue = parseFloat(String(invoice.balanceDue || invoice.balance_due || invoice.totalAmount || invoice.total_amount || 0));
      const coveragePercent = parseFloat(String(invoice.insuranceCoveragePercent || invoice.insurance_coverage_percent || 0));
      
      if (!coveragePercent || coveragePercent <= 0 || coveragePercent >= 100) {
        return parseFloat(balanceDue.toFixed(2));
      }
      const uncovered = balanceDue * (1 - coveragePercent / 100);
      return parseFloat(uncovered.toFixed(2));
    } catch (err) {
      console.error('Error calculating copay:', err);
      return 0;
    }
  }, [invoice]);

  // Form state (DDD defaults)
  const [method, setMethod] = useState<PayMethod>("credit");
  const [nameOnCard, setNameOnCard] = useState(user?.name || "");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [zip, setZip] = useState("");
  const [hsaMemberId, setHsaMemberId] = useState("");
  const [amount, setAmount] = useState(copayDue);
  
  // Update amount when copayDue changes
  useEffect(() => {
    if (copayDue > 0) {
      setAmount(copayDue);
    }
  }, [copayDue]);

  // UI / status
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const idempotencyKeyRef = useRef(
    `idem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  ); // CC

  // ADT-In: audit helper
  function audit(action: string, details?: any) {
    console.log("[AUDIT]", {
      ts: new Date().toISOString(),
      actor: user?.id || user?.userId || "local",
      action,
      details,
    });
  }

  /** FV + DDV */
  function validate(): string | null {
    if (!amount || amount <= 0) return "Enter a valid payment amount.";
    if (!nameOnCard.trim() || !/^[A-Za-z ,.'-]{2,}$/.test(nameOnCard)) {
      return "Enter a valid cardholder name.";
    }

    const cc = onlyDigits(cardNumber);
    if (cc.length < 12 || cc.length > 19 || !luhnCheck(cc)) {
      return "Invalid card number.";
    }

    if (!isFutureExpiry(expiry)) {
      return "Card is expired or has an invalid expiry format (MM/YY).";
    }

    if (!/^\d{3,4}$/.test(cvv)) return "Invalid CVV.";
    if (!/^\d{5}$/.test(zip)) return "Enter a 5-digit ZIP.";

    if (method === "hsa" && (!hsaMemberId || !/^[A-Za-z0-9]{8,15}$/.test(hsaMemberId))) {
      return "Enter a valid HSA member ID (8–15 alphanumeric).";
    }

    // DDV: require amount ≤ invoice due (no overpayments here)
    if (invoice) {
      try {
        const balanceDue = parseFloat(String(invoice.balanceDue || invoice.balance_due || invoice.totalAmount || invoice.total_amount || 0));
        if (amount > balanceDue) {
          return "Amount exceeds invoice balance.";
        }
      } catch (err) {
        console.error('Error validating amount:', err);
      }
    }

    return null;
  }

  /** Main submit (CN, SI-Out, DF-Out, ExHL, DP, CC, NOT/ALR) */
  async function handlePay() {
    setError(null);
    setSuccess(null);
    setNotice(null);

    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setProcessing(true);
    audit("PAYMENT_ATTEMPT", { invoiceId: invoiceIdParam || 'unknown', method, amount });

    try {
      // Simulate payment gateway (in production, this would be a real payment processor)
      await new Promise((r) => setTimeout(r, 800));
      
      // Generate receipt ID
      const receiptId = `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const last4 = onlyDigits(cardNumber).slice(-4);
      const gatewayTransactionId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // Call backend to record payment
      const response = await fetch(apiUrl(`invoices/${invoiceIdParam}/payments`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: parseFloat(amount.toFixed(2)),
          paymentMethod: method.toUpperCase(),
          paymentReference: gatewayTransactionId,
          receiptId: receiptId,
          gatewayTransactionId: gatewayTransactionId,
          last4: last4
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Payment failed');
      }

      const paymentData = await response.json();

      // DP: clear sensitive values after charge
      setCvv("");
      setCardNumber("");

      // Create receipt object
      const rcpt: Receipt = {
        receiptId: receiptId,
        invoiceId: invoiceIdParam || '',
        patientId: invoice?.patientId || invoice?.patient_id || '',
        amount: parseFloat(amount.toFixed(2)),
        last4: last4,
        method: method,
        networkAuthCode: gatewayTransactionId.slice(-8).toUpperCase(),
        createdAt: new Date().toISOString()
      };

      // DF-Out: broadcast to billing ledger / receipts module
      audit("PAYMENT_CAPTURED", rcpt);

      // ALR/NOT: friendly messages
      setReceipt(rcpt);
      setSuccess("Payment successful! Confirmation emails have been sent to you and your doctor.");
      setNotice(`Invoice ${invoice?.invoiceNumber || invoice?.invoice_number || invoiceIdParam} has been marked as ${paymentData.invoiceStatus || 'PAID'}.`);

      // CC: rotate idempotency key to prevent accidental re-tries as new payments
      idempotencyKeyRef.current = `idem_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 7)}`;

      // Redirect to billing screen after 2 seconds
      setTimeout(() => {
        navigate('/billing');
      }, 2000);
    } catch (e: any) {
      audit("PAYMENT_FAILED", { code: e?.code, message: e?.message });
      if (e?.code === "ETIMEOUT") {
        setError("We couldn’t reach the payment network. Please try again.");
      } else {
        setError("Payment failed. Check your details and try again.");
      }
    } finally {
      setProcessing(false);
    }
  }

  // CL: show derived copay, taxes/fees placeholder
  const derived = useMemo(() => {
    if (!invoice) return { copay: 0, taxes: 0, convenienceFee: 0, total: 0 };
    const copay = copayDue || 0;
    const taxes = 0;
    const convenienceFee = method === "debit" ? 0 : 0; // no fees for demo
    const total = parseFloat((copay + taxes + convenienceFee).toFixed(2));
    return { copay, taxes, convenienceFee, total };
  }, [copayDue, method, invoice]);

  // Show loading state if invoice is being fetched
  if (loadingInvoice && !invoice) {
    return (
      <div className="dashboard-container">
        <Sidebar isCollapsed={sidebarCollapsed} onToggle={toggleSidebar} />
        <div className={`main-content ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
          <header className="header">
            <div className="header-left">
              <h1 className="brand-title">MediConnect</h1>
            </div>
          </header>
          <div className="dashboard-content">
            <section className="account-section">
              <p>Loading invoice...</p>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={toggleSidebar} />

      <div className={`main-content ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        {/* Header (CS) */}
        <header className="header">
          <div className="header-left">
            <h1 className="brand-title">MediConnect</h1>
          </div>
        </header>

        <div className="dashboard-content">
          <section className="account-section">
            {/* Alerts */}
            {error && (
              <div
                className="form-alert error"
                role="alert"
                aria-live="assertive"
                style={{ marginTop: 12 }}
              >
                {error}
              </div>
            )}
            {success && (
              <div
                className="form-alert success"
                role="status"
                aria-live="polite"
                style={{ marginTop: 12 }}
              >
                {success}
              </div>
            )}
            {notice && (
              <div
                className="form-alert"
                style={{
                  marginTop: 12,
                  background: "#f7fafc",
                  border: "1px solid #e2e8f0",
                  color: "#2d3748",
                }}
              >
                {notice}
              </div>
            )}

            {/* Invoice summary (DF-In, DDD) */}
            {loadingInvoice ? (
              <div className="inline-hint" style={{ marginTop: 12 }}>
                Loading invoice...
              </div>
            ) : error && !invoice ? (
              <div className="inline-hint" style={{ marginTop: 12, color: '#e53e3e' }}>
                <strong>Error:</strong> {error}
                <br />
                <button 
                  onClick={() => window.location.reload()} 
                  style={{ marginTop: 8, padding: '4px 8px', cursor: 'pointer' }}
                >
                  Reload Page
                </button>
              </div>
            ) : invoice ? (
              <div className="inline-hint" style={{ marginTop: 12 }}>
                <strong>Invoice:</strong> {invoice.invoiceNumber || invoice.invoice_number || invoiceIdParam} —{" "}
                {invoice.lineItems && Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0 
                  ? invoice.lineItems.map((item: any) => item.description || 'Service').join(', ')
                  : 'Medical services'}
              </div>
            ) : (
              <div className="inline-hint" style={{ marginTop: 12, color: '#e53e3e' }}>
                Invoice not found. Please go back and try again.
              </div>
            )}

            {/* Payment method + fields */}
            <div
              style={{
                display: "grid",
                gap: 16,
                gridTemplateColumns: "1fr 1fr",
                marginTop: 16,
              }}
            >
              <div>
                <div className="form-label"> <strong> Payment Method</strong></div>
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <label>
                    <input
                      type="radio"
                      name="pm"
                      checked={method === "credit"}
                      onChange={() => setMethod("credit")}
                    />{" "}
                    Credit
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="pm"
                      checked={method === "debit"}
                      onChange={() => setMethod("debit")}
                    />{" "}
                    Debit
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="pm"
                      checked={method === "hsa"}
                      onChange={() => setMethod("hsa")}
                    />{" "}
                    HSA
                  </label>
                </div>
              </div>

              <label>
                <div className="form-label">Amount (USD)</div>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  min={0}
                  value={amount}
                  onChange={(e) =>
                    setAmount(parseFloat(e.target.value || "0"))
                  }
                />
              </label>

              <label>
                <div className="form-label">Name on Card</div>
                <input
                  className="form-input"
                  value={nameOnCard}
                  onChange={(e) => setNameOnCard(e.target.value)}
                  placeholder="Jane Doe"
                />
              </label>

              <label>
                <div className="form-label">Card Number</div>
                <input
                  className="form-input"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="4242 4242 4242 4242"
                />
              </label>

              <label>
                <div className="form-label">Expiry (MM/YY)</div>
                <input
                  className="form-input"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  placeholder="09/28"
                />
              </label>

              <label>
                <div className="form-label">CVV</div>
                <input
                  className="form-input"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value)}
                  placeholder="123"
                />
              </label>

              <label>
                <div className="form-label">ZIP</div>
                <input
                  className="form-input"
                  inputMode="numeric"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  placeholder="10001"
                />
              </label>

              {method === "hsa" && (
                <label>
                  <div className="form-label">HSA Member ID</div>
                  <input
                    className="form-input"
                    value={hsaMemberId}
                    onChange={(e) => setHsaMemberId(e.target.value)}
                    placeholder="HSA12345678"
                  />
                </label>
              )}
            </div>

            {/* Summary (CL) */}
            <div className="summary-box" style={{ marginTop: 16 }}>
              <div className="summary-row">
                <strong>Invoice total: </strong>
                <span>${invoice ? parseFloat(invoice.balanceDue || invoice.balance_due || invoice.totalAmount || invoice.total_amount || 0).toFixed(2) : '0.00'}</span>
              </div>
              <div className="summary-row">
                <strong>Coverage: </strong>
                <span>{invoice ? parseFloat(invoice.insuranceCoveragePercent || invoice.insurance_coverage_percent || 0) : 0}%</span>
              </div>
              <div className="summary-row">
                <strong>Estimated copay: </strong>
                <span>${(derived?.copay || 0).toFixed(2)}</span>
              </div>
              <div className="summary-row">
                <strong>Taxes: </strong>
                <span>${(derived?.taxes || 0).toFixed(2)}</span>
              </div>
              <div className="summary-row">
                <strong>Convenience fee:  </strong>
                <span>${(derived?.convenienceFee || 0).toFixed(2)}</span>
              </div>
              <div className="summary-row">
                <span>
                  <strong>Total recommended: </strong>
                </span>
                <span>
                  <strong>${(derived?.total || 0).toFixed(2)}</strong>
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="actions-row" style={{ marginTop: 16 }}>
              <button
                className="primary-btn"
                onClick={handlePay}
                disabled={processing || !invoice || loadingInvoice || !!error}
              >
                {processing ? "Processing…" : "Pay Now"}
              </button>
              {!invoice && !loadingInvoice && (
                <button
                  className="secondary-btn"
                  onClick={() => window.history.back()}
                  style={{ marginLeft: 8 }}
                >
                  Go Back
                </button>
              )}
            </div>

            {/* DP: only show masked details */}
            {receipt && (
              <div className="account-section" style={{ marginTop: 16 }}>
                <h3 style={{ marginTop: 0 }}>Receipt</h3>
                <p>
                  <strong>Receipt ID: </strong> {receipt.receiptId}
                </p>
                <p>
                  <strong>Invoice: </strong> {receipt.invoiceId}
                </p>
                <p>
                  <strong>Amount: </strong> ${receipt.amount.toFixed(2)}
                </p>
                <p>
                  <strong>Method: </strong>{" "}
                  {receipt.method.toUpperCase()} •••• {receipt.last4}
                </p>
                <p>
                  <strong>Auth Code: </strong> {receipt.networkAuthCode}
                </p>
                <p>
                  <strong>Time: </strong>{" "}
                  {new Date(receipt.createdAt).toLocaleString()}
                </p>
              </div>
            )}

            <p className="privacy-note" style={{ marginTop: 10 }}>
              Card data is used transiently for authorization and not stored.
            </p>
            <p className="offline-note" style={{ marginTop: 6 }}>
              If the network drops during payment, you’ll see an error and can
              retry. 
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ProcessPayments;
