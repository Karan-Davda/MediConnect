import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import "../pages/Account.css";

// --- Types ---
type Provider = {
  id: string;
  name: string;
  specialty: string;
  location: string;
  baseFee: number; // CL: base calculation for visit fee
  slots: Record<string, string[]>; // availability by date
};

type AppointmentStatus = "REQUESTED" | "CONFIRMED" | "CANCELLED";

type Appointment = {
  id: string;
  providerId: string;
  providerName: string;
  date: string;
  time: string;
  reason: string;
  fee: number;
  status: AppointmentStatus;
};

// --- Mock data / session state (DF-In, CS, ET-In) ---
const mockPatient = {
  isAuthenticated: true, // flip to false to test entitlement
  id: "patient-123",
  name: "Jane Doe",
  insurance: "Blue Cross PPO",
};

const mockProviders: Provider[] = [
  {
    id: "p1",
    name: "Dr. Alice Martin",
    specialty: "Primary Care",
    location: "Clinic East, Room 12A",
    baseFee: 120,
    slots: {
      "2025-10-22": ["09:00", "09:30", "10:00"],
      "2025-10-23": ["14:00", "14:30"],
    },
  },
  {
    id: "p2",
    name: "Dr. Brian Patel",
    specialty: "Cardiology",
    location: "Heart Center, Floor 3",
    baseFee: 180,
    slots: {
      "2025-10-22": ["10:00", "10:30"],
      "2025-10-24": ["15:00", "15:30", "16:00"],
    },
  },
];

// Pretend user already has one appt (used for reschedule/cancel demo)
const mockExistingAppt: Appointment | null = {
  id: "appt-555",
  providerId: "p1",
  providerName: "Dr. Alice Martin",
  date: "2025-10-22",
  time: "09:30",
  reason: "Follow-up on bloodwork",
  fee: 120,
  status: "CONFIRMED",
};

// helper for <input type="date" min=...>
const todayStr = new Date().toISOString().split("T")[0];

const BookAppointment: React.FC = () => {
  const navigate = useNavigate();

  // matches Sidebar collapse behavior in Account view
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);

  // this page = ONE feature surface:
  // "Allows users to book, reschedule, or cancel appointments based on the provider's availability."
  // (02.01 Book Appointments for patient stakeholder 1.2) :contentReference[oaicite:1]{index=1}
  const [mode, setMode] = useState<"book" | "reschedule" | "cancel">(
    mockExistingAppt ? "reschedule" : "book"
  );

  // form state with reschedule defaults
  const [selectedProviderId, setSelectedProviderId] = useState<string>(
    mockExistingAppt ? mockExistingAppt.providerId : ""
  );
  const [date, setDate] = useState<string>(
    mockExistingAppt ? mockExistingAppt.date : ""
  );
  const [time, setTime] = useState<string>(
    mockExistingAppt ? mockExistingAppt.time : ""
  );
  const [reason, setReason] = useState<string>(
    mockExistingAppt ? mockExistingAppt.reason : ""
  );

  // data-driven defaults (DDD, CL)
  const [visitLocation, setVisitLocation] = useState<string>("");
  const [visitFee, setVisitFee] = useState<number>(0);

  // ui state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // audit trail (ADT-In)
  function auditLog(action: string, details: any) {
    console.log("[AUDIT]", {
      action,
      actor: mockPatient.id,
      timestamp: new Date().toISOString(),
      details,
    });
  }

  // which provider is currently selected
  const provider = mockProviders.find((p) => p.id === selectedProviderId);

  // whenever provider changes, auto-fill location/fee (DDD + CL)
  useEffect(() => {
    if (!provider) {
      setVisitLocation("");
      setVisitFee(0);
      return;
    }
    setVisitLocation(provider.location);
    setVisitFee(provider.baseFee);
  }, [provider]);

  // available slots for chosen provider/date (DDV + CC source of truth)
  const availableSlots: string[] = useMemo(() => {
    if (!provider || !date) return [];
    return provider.slots[date] || [];
  }, [provider, date]);

  // validation (FV, DDV, CC, ET-In/CS, DP)
  function validate(): string | null {
    // ET-In / CS: must be signed in to take action
    if (!mockPatient.isAuthenticated) {
      return "You must sign in to manage appointments.";
    }

    if (mode === "cancel") {
      if (!mockExistingAppt) {
        return "No appointment selected to cancel.";
      }
      return null;
    }

    if (!selectedProviderId) return "Please select a provider.";
    if (!date) return "Please choose a date.";
    if (date < todayStr) return "You cannot pick a past date.";
    if (!time) return "Please choose a time.";
    if (!reason.trim()) return "Please enter a reason for your visit.";

    if (!availableSlots.includes(time)) {
      return "That time is no longer available. Please pick another slot.";
    }
    return null;
  }

  // submit handler (CN, DF-Out, DF-In, NOT, ALR, ExHL)
  async function handleSubmit() {
    const problem = validate();
    if (problem) {
      setErrorMsg(problem);
      setSuccessMsg(null);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (mode === "cancel") {
        auditLog("CANCEL_APPOINTMENT", {
          apptId: mockExistingAppt?.id,
          providerId: mockExistingAppt?.providerId,
        });

        setSuccessMsg(
          "Your appointment has been canceled. The provider has been notified and the slot is now available to other patients."
        );
      } else {
        const payload = {
          patientId: mockPatient.id, // DF-In from Account/Profile (insurance, etc.)
          providerId: selectedProviderId,
          date,
          time,
          reason,
          fee: visitFee,
          mode,
        };

        // CC: backend will lock slot to whoever confirms first
        // CN / ExHL: if backend down, we catch in catch block
        auditLog(
          mode === "book"
            ? "BOOK_APPOINTMENT"
            : "RESCHEDULE_APPOINTMENT",
          payload
        );

        setSuccessMsg(
          mode === "book"
            ? "Your appointment request was submitted. You'll receive a confirmation and reminders."
            : "Your reschedule request was submitted. You'll receive an updated confirmation and reminders."
        );
      }

      // DF-Out: dashboard/upcoming appointments would refresh after this
      // navigate("/home");
    } catch (err: any) {
      console.error("Appointment action failed:", err);
      setErrorMsg(
        "We couldn't reach the server. Please check your connection and try again."
      );
      setSuccessMsg(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dashboard-container">
      {/* LEFT SIDEBAR (same component everywhere) */}
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
      />

      {/* RIGHT PANE */}
      <div
        className={`main-content ${
          sidebarCollapsed ? "sidebar-collapsed" : ""
        }`}
      >
        {/* STICKY HEADER BAR */}
        <header className="header">
          <div className="header-left">
            <h1 className="brand-title">MediConnect</h1>
          </div>
        </header>

        {/* PAGE BODY */}
        <div className="dashboard-content">
          {/* CARD 1: Title + mode tabs + alerts */}
          <section className="account-section">
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "1rem",
              }}
            >
              <div>
                <h2 style={{ marginBottom: "0.5rem" }}>
                  {mode === "book"
                    ? "Book an Appointment"
                    : mode === "reschedule"
                    ? "Reschedule Appointment"
                    : "Cancel Appointment"}
                </h2>
                <p
                  style={{
                    color: "#4a5568",
                    fontSize: "0.95rem",
                    maxWidth: "480px",
                    lineHeight: 1.4,
                  }}
                >
                  Book, reschedule, or cancel your visit based on real-time
                  provider availability.
                </p>
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  className={`${
                    mode === "book" ? "" : ""
                  }`}
                  style={{
                    backgroundColor:
                      mode === "book" ? "#667eea" : "#a0aec0",
                  }}
                  onClick={() => setMode("book")}
                >
                  Book
                </button>
                <button
                  style={{
                    backgroundColor:
                      mode === "reschedule" ? "#667eea" : "#a0aec0",
                  }}
                  onClick={() => setMode("reschedule")}
                  disabled={!mockExistingAppt}
                  title={
                    mockExistingAppt
                      ? ""
                      : "You don't have an appointment to reschedule."
                  }
                >
                  Reschedule
                </button>
                <button
                  style={{
                    backgroundColor:
                      mode === "cancel" ? "#667eea" : "#a0aec0",
                  }}
                  onClick={() => setMode("cancel")}
                  disabled={!mockExistingAppt}
                  title={
                    mockExistingAppt
                      ? ""
                      : "You don't have an appointment to cancel."
                  }
                >
                  Cancel
                </button>
              </div>
            </div>

            {/* inline alerts */}
            {errorMsg && (
              <div
                style={{
                  marginTop: "1rem",
                  backgroundColor: "#fed7d7",
                  color: "#742a2a",
                  borderRadius: "8px",
                  padding: "0.75rem 1rem",
                  fontSize: "0.9rem",
                  fontWeight: 500,
                }}
                role="alert"
                aria-live="assertive"
              >
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div
                style={{
                  marginTop: "1rem",
                  backgroundColor: "#c6f6d5",
                  color: "#22543d",
                  borderRadius: "8px",
                  padding: "0.75rem 1rem",
                  fontSize: "0.9rem",
                  fontWeight: 500,
                }}
                role="status"
                aria-live="polite"
              >
                {successMsg}
              </div>
            )}
          </section>

          {/* CARD 2: Either cancel summary, or booking form */}
          <section className="account-section">
            {mode === "cancel" ? (
              <>
                {mockExistingAppt ? (
                  <>
                    <p style={{ color: "#4e7ac5ff", lineHeight: 1.5 }}>
                      You are canceling your appointment with{" "}
                      <strong>{mockExistingAppt.providerName}</strong> on{" "}
                      <strong>{mockExistingAppt.date}</strong> at{" "}
                      <strong>{mockExistingAppt.time}</strong>.
                    </p>
                    <p
                      style={{
                        marginTop: "0.75rem",
                        color: "#e53e3e",
                        fontSize: "0.9rem",
                        lineHeight: 1.4,
                      }}
                    >
                      This will notify the provider and free the slot for
                      other patients.
                    </p>
                  </>
                ) : (
                  <p>No appointment found to cancel.</p>
                )}
              </>
            ) : (
              <>
                {/* Provider */}
                <label htmlFor="provider-select">1. Provider</label>
                <select
                  id="provider-select"
                  value={selectedProviderId}
                  onChange={(e) => {
                    setSelectedProviderId(e.target.value);
                    setTime("");
                  }}
                  disabled={
                    !mockPatient.isAuthenticated && mode !== "book"
                  }
                >
                  <option value="">Select a doctor</option>
                  {mockProviders.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name} – {doc.specialty}
                    </option>
                  ))}
                </select>

                {provider && (
                  <div
                    style={{
                      backgroundColor: "#f7fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      padding: "0.75rem 1rem",
                      marginTop: "0.75rem",
                      fontSize: "0.9rem",
                      lineHeight: 1.4,
                      color: "#2d3748",
                    }}
                  >
                    <div>
                      <strong>Location:</strong> {visitLocation}
                    </div>
                    <div>
                      <strong>Est. Fee:</strong> ${visitFee}
                    </div>
                    <div>
                      <strong>Insurance on file:</strong>{" "}
                      {mockPatient.insurance}
                    </div>
                  </div>
                )}

                {/* Date */}
                <label htmlFor="date-input">2. Date</label>
                <input
                  id="date-input"
                  type="date"
                  min={todayStr}
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setTime("");
                  }}
                  disabled={
                    !mockPatient.isAuthenticated && mode !== "book"
                  }
                />

                {/* Time slots */}
                <label style={{ marginTop: "1rem" }}>3. Time</label>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                    marginTop: "0.5rem",
                  }}
                >
                  {availableSlots.length === 0 && (
                    <div
                      style={{
                        fontSize: "0.9rem",
                        color: "#718096",
                      }}
                    >
                      No open slots for that date.
                    </div>
                  )}

                  {availableSlots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setTime(slot)}
                      disabled={!mockPatient.isAuthenticated}
                      style={{
                        color: "#0b0c0e",
                        border:
                          time === slot
                            ? "2px solid #667eea"
                            : "1px solid #cbd5e0",
                        backgroundColor:
                          time === slot ? "#edf2ff" : "#fff",
                        borderRadius: "8px",
                        padding: "0.5rem 0.75rem",
                        fontSize: "0.9rem",
                        fontWeight: 500,
                        minWidth: "4.5rem",
                      }}
                      aria-pressed={time === slot}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "#0b0c0eff",
                    marginTop: "0.5rem",
                    lineHeight: 1.4,
                  }}
                >
                  Slots are first-come, first-served. If someone else confirms
                  first, you’ll be asked to pick another.
                </div>

                {/* Reason */}
                <label htmlFor="reason-input">4. Reason for visit</label>
                <textarea
                  id="reason-input"
                  rows={3}
                  placeholder="Example: Follow-up on bloodwork results"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={!mockPatient.isAuthenticated}
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.75rem",
                    border: "1px solid #cbd5e0",
                    borderRadius: "8px",
                    marginTop: "0.4rem",
                    fontSize: "1rem",
                    fontFamily: "inherit",
                  }}
                />
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "#4a5568",
                    marginTop: "0.5rem",
                    lineHeight: 1.4,
                  }}
                >
                  This note is securely shared with your provider only.
                </div>

                {/* Summary */}
                <div
                  style={{
                    marginTop: "1.5rem",
                    backgroundColor: "#f7fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    padding: "1rem 1.25rem",
                    lineHeight: 1.5,
                    fontSize: "0.95rem",
                    color: "#2d3748",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <span>Provider</span>
                    <span>{provider ? provider.name : "—"}</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <span>Date &amp; Time</span>
                    <span>
                      {date || "—"} {time || ""}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <span>Location</span>
                    <span>{visitLocation || "—"}</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>Estimated Fee</span>
                    <span>${visitFee || 0}</span>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "#4a5568",
                    marginTop: "0.75rem",
                    lineHeight: 1.4,
                  }}
                >
                  You’ll receive confirmation and reminder notifications. If
                  this is urgent, contact a clinic directly or call emergency
                  services.
                </div>
              </>
            )}
          </section>

          {/* CARD 3: Actions */}
          <section className="account-section">
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.75rem",
              }}
            >
              <button
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting
                  ? "Submitting..."
                  : mode === "cancel"
                  ? "Confirm Cancel"
                  : mode === "reschedule"
                  ? "Confirm Reschedule"
                  : "Confirm Appointment"}
              </button>

              <button
                style={{
                  backgroundColor: "#a0aec0",
                }}
                onClick={() => navigate("/home")}
                disabled={submitting}
              >
                Back to Dashboard
              </button>
            </div>

            <p
              style={{
                fontSize: "0.8rem",
                color: "#4a5568",
                marginTop: "1rem",
                lineHeight: 1.4,
              }}
            >
              If you’re offline when you submit, nothing will be scheduled.
              You’ll see an error and can try again once you’re reconnected.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default BookAppointment;
