import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import { apiUrl } from "../config/api";
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



// helper for <input type="date" min=...>
const todayStr = new Date().toISOString().split("T")[0];

const BookAppointment: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  // matches Sidebar collapse behavior in Account view
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);

  // this page = ONE feature surface:
  // "Allows users to book, reschedule, or cancel appointments based on the provider's availability."
  // (02.01 Book Appointments for patient stakeholder 1.2) :contentReference[oaicite:1]{index=1}
  const [mode, setMode] = useState<"book" | "reschedule" | "cancel">("book");

  // Fetch doctors from database
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [doctorsError, setDoctorsError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        setLoadingDoctors(true);
        setDoctorsError(null);
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        
        const response = await fetch(apiUrl('appointments/doctors'), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch doctors');
        }

        const data = await response.json();
        
        // Convert database doctors to Provider format
        const formattedProviders: Provider[] = data.doctors.map((doctor: any) => ({
          id: doctor.id || `doctor_${doctor.doctor_id}`,
          name: doctor.name || 'Unknown Doctor',
          specialty: doctor.specialty || 'General Practice',
          location: doctor.location || 'Location not specified',
          baseFee: doctor.fees || 120, // Use fees from database
          slots: {} // Will be populated when date is selected
        }));

        setProviders(formattedProviders);
      } catch (err: any) {
        console.error('Error fetching doctors:', err);
        setDoctorsError(err.message || 'Failed to load doctors');
        // Fallback to empty array on error
        setProviders([]);
      } finally {
        setLoadingDoctors(false);
      }
    };

    fetchDoctors();
  }, []);

  // form state
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [date, setDate] = useState<string>(todayStr);
  const [time, setTime] = useState<string>("");
  const [reason, setReason] = useState<string>("");

  // data-driven defaults (DDD, CL)
  const [visitLocation, setVisitLocation] = useState<string>("");
  const [visitFee, setVisitFee] = useState<number>(0);

  // ui state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Patient appointments for cancel/reschedule mode
  const [patientAppointments, setPatientAppointments] = useState<any[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<number | null>(null);
  const [rescheduleAppointmentId, setRescheduleAppointmentId] = useState<number | null>(null);
  const [currentAppointment, setCurrentAppointment] = useState<any | null>(null);

  // Fetch patient appointments when cancel or reschedule mode is selected
  useEffect(() => {
    const fetchPatientAppointments = async () => {
      if ((mode !== "cancel" && mode !== "reschedule") || !isAuthenticated) {
        setPatientAppointments([]);
        return;
      }

      try {
        setLoadingAppointments(true);
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        
        console.log('[DEBUG] Fetching appointments for', mode, 'mode...');
        const response = await fetch(apiUrl('appointments/my-appointments?upcomingOnly=true'), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        console.log('[DEBUG] Response status:', response.status, response.statusText);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('[DEBUG] Error response:', errorData);
          throw new Error(errorData.error || 'Failed to fetch appointments');
        }

        const data = await response.json();
        console.log('[DEBUG] Appointments data received:', data);
        console.log('[DEBUG] Number of appointments:', data.appointments?.length || 0);
        setPatientAppointments(data.appointments || []);
      } catch (err: any) {
        console.error('[ERROR] Error fetching appointments:', err);
        console.error('[ERROR] Error details:', err.message, err.stack);
        setPatientAppointments([]);
      } finally {
        setLoadingAppointments(false);
      }
    };

    fetchPatientAppointments();
  }, [mode, isAuthenticated]);

  // Fetch current appointment details when reschedule appointment is selected
  useEffect(() => {
    const fetchCurrentAppointment = async () => {
      if (mode !== "reschedule" || !rescheduleAppointmentId || !isAuthenticated) {
        setCurrentAppointment(null);
        return;
      }

      try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const response = await fetch(apiUrl(`appointments/${rescheduleAppointmentId}`), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          setCurrentAppointment(data.appointment);
          // Pre-fill form with current appointment details
          if (data.appointment) {
            const apptDate = new Date(data.appointment.start_time);
            setDate(apptDate.toISOString().split('T')[0]);
            // Pre-select the doctor and disable dropdown
            setSelectedProviderId(`doctor_${data.appointment.doctor_id}`);
            // Don't set time - let user select new time
            setTime("");
          }
        }
      } catch (err: any) {
        console.error('Error fetching appointment:', err);
      }
    };

    fetchCurrentAppointment();
  }, [mode, rescheduleAppointmentId, isAuthenticated]);

  // audit trail (ADT-In)
  function auditLog(action: string, details: any) {
    console.log("[AUDIT]", {
      action,
      actor: user?.email || user?.id || 'unknown',
      timestamp: new Date().toISOString(),
      details,
    });
  }

  // which provider is currently selected
  const provider = providers.find((p) => p.id === selectedProviderId);

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

  // Fetch available slots from API when provider and date are selected
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    const fetchAvailableSlots = async () => {
      if (!provider || !date) {
        setAvailableSlots([]);
        return;
      }

      try {
        setLoadingSlots(true);
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        
        // Extract doctor_id from provider.id (format: "doctor_123")
        const doctorId = provider.id.replace('doctor_', '');
        
        const response = await fetch(
          `${apiUrl('appointments/available-slots')}/${doctorId}?date=${date}&duration=30`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('Error fetching slots:', errorData);
          throw new Error(errorData.error || 'Failed to fetch available slots');
        }

        const data = await response.json();
        console.log('Available slots response:', data);
        
        // Use slots from API response
        if (data.slots && Array.isArray(data.slots)) {
          let filteredSlots = data.slots;
          
          // If selected date is today, filter out past time slots
          const selectedDate = new Date(date + 'T00:00:00');
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const isToday = selectedDate.getTime() === today.getTime();
          
          if (isToday) {
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            
            filteredSlots = data.slots.filter((slot: string) => {
              // Parse slot time - handle formats like "09:00", "9:00 AM", "21:00"
              let slotHour: number;
              let slotMinute: number;
              
              // Check if it's 12-hour format (contains AM/PM)
              if (slot.includes('AM') || slot.includes('PM')) {
                const timePart = slot.trim().split(' ')[0]; // Get "HH:MM" part
                const [hour, minute] = timePart.split(':').map(Number);
                const isPM = slot.toUpperCase().includes('PM');
                
                if (isPM && hour !== 12) {
                  slotHour = hour + 12;
                } else if (!isPM && hour === 12) {
                  slotHour = 0;
                } else {
                  slotHour = hour;
                }
                slotMinute = minute;
              } else {
                // 24-hour format "HH:MM"
                const [hour, minute] = slot.split(':').map(Number);
                slotHour = hour;
                slotMinute = minute;
              }
              
              // Compare times: slot must be after current time
              if (slotHour > currentHour) return true;
              if (slotHour === currentHour && slotMinute > currentMinute) return true;
              return false;
            });
            console.log(`Filtered ${data.slots.length} slots to ${filteredSlots.length} future slots for today (current time: ${currentHour}:${String(currentMinute).padStart(2, '0')})`);
          }
          
          setAvailableSlots(filteredSlots);
          console.log(`Loaded ${filteredSlots.length} available slots for ${date}`);
        } else {
          console.warn('No slots in response or invalid format:', data);
          setAvailableSlots([]);
        }
      } catch (err: any) {
        console.error('Error fetching available slots:', err);
        setAvailableSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchAvailableSlots();
  }, [provider, date]);

  // validation (FV, DDV, CC, ET-In/CS, DP)
  function validate(): string | null {
    // ET-In / CS: must be signed in to take action
    if (!isAuthenticated) {
      return "You must sign in to manage appointments.";
    }

    if (mode === "cancel") {
      if (!selectedAppointmentId) {
        return "Please select an appointment to cancel.";
      }
      return null;
    }

    if (mode === "reschedule") {
      if (!rescheduleAppointmentId) {
        return "Please select an appointment to reschedule.";
      }
      if (!selectedProviderId) return "Please select a provider.";
      if (!date) return "Please choose a new date.";
      if (date < todayStr) return "You cannot pick a past date.";
      if (!time) return "Please choose a new time.";
      if (!reason.trim()) return "Please enter a reason for your visit.";

      if (!availableSlots.includes(time)) {
        return "That time is no longer available. Please pick another slot.";
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
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');

      if (mode === "cancel") {
        if (!selectedAppointmentId) {
          setErrorMsg("Please select an appointment to cancel.");
          setSubmitting(false);
          return;
        }

        const response = await fetch(`${apiUrl('appointments')}/${selectedAppointmentId}/cancel`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ reason: 'Cancelled by patient' })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to cancel appointment');
        }

        const cancelledAppointment = await response.json();
        
        auditLog("CANCEL_APPOINTMENT", {
          apptId: selectedAppointmentId,
          appointment: cancelledAppointment
        });

        setSuccessMsg("Appointment cancelled successfully! The slot has been freed for other patients.");
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Refresh appointments list and reset selection
        setTimeout(() => {
          setSelectedAppointmentId(null);
          // Trigger refetch of appointments
          const fetchAppointments = async () => {
            try {
              const response = await fetch(apiUrl('appointments/my-appointments?upcomingOnly=true'), {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });
              if (response.ok) {
                const data = await response.json();
                setPatientAppointments(data.appointments || []);
              }
            } catch (err) {
              console.error('Error refreshing appointments:', err);
            }
          };
          fetchAppointments();
          setSuccessMsg(null);
        }, 3000);
        
        setSubmitting(false);
        return;
      } else if (mode === "reschedule") {
        if (!rescheduleAppointmentId) {
          setErrorMsg("Please select an appointment to reschedule.");
          setSubmitting(false);
          return;
        }

        if (!selectedProviderId || !date || !time) {
          setErrorMsg("Please select a new date and time.");
          setSubmitting(false);
          return;
        }

        // Combine date and time into ISO datetime string
        const startTime = new Date(`${date}T${time}:00`).toISOString();
        const endTime = new Date(new Date(startTime).getTime() + 30 * 60000).toISOString();

        const response = await fetch(`${apiUrl('appointments')}/${rescheduleAppointmentId}/reschedule`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            start_time: startTime,
            end_time: endTime,
            duration_minutes: 30
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to reschedule appointment');
        }

        const appointmentData = await response.json();
        
        auditLog("RESCHEDULE_APPOINTMENT", {
          apptId: rescheduleAppointmentId,
          appointment: appointmentData
        });

        setSuccessMsg("Appointment rescheduled successfully! Notification sent via SMS and email.");
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Reset form and refresh appointments list
        setTimeout(() => {
          setRescheduleAppointmentId(null);
          setCurrentAppointment(null);
          setDate(todayStr);
          setTime("");
          setSelectedProviderId("");
          setReason("");
          // Refresh appointments list
          const fetchAppointments = async () => {
            try {
              const response = await fetch(apiUrl('appointments/my-appointments?upcomingOnly=true'), {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });
              if (response.ok) {
                const data = await response.json();
                setPatientAppointments(data.appointments || []);
              }
            } catch (err) {
              console.error('Error refreshing appointments:', err);
            }
          };
          fetchAppointments();
          setSuccessMsg(null);
        }, 3000);
        
        setSubmitting(false);
        return;
      } else {
        // Extract doctor_id from selectedProviderId (format: "doctor_123")
        const doctorId = selectedProviderId.replace('doctor_', '');
        
        // Combine date and time into ISO datetime string
        const startTime = new Date(`${date}T${time}:00`).toISOString();
        
        const payload = {
          doctor_id: parseInt(doctorId),
          speciality_id: null, // Can be added if specialty is tracked
          start_time: startTime,
          duration_minutes: 30,
          appointment_type: "in_person",
          reason: reason,
          notes: null
        };

        const response = await fetch(apiUrl('appointments'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create appointment');
        }

        const appointmentData = await response.json();

        auditLog("BOOK_APPOINTMENT", appointmentData);

        setSuccessMsg("Appointment confirmed! Notification sent via SMS and email.");
      }

      // DF-Out: dashboard/upcoming appointments would refresh after this
      // navigate("/home");
    } catch (err: any) {
      console.error("Appointment action failed:", err);
      setErrorMsg(
        err.message || "We couldn't reach the server. Please check your connection and try again."
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
                  disabled={!isAuthenticated}
                  title={
                    isAuthenticated
                      ? ""
                      : "You must sign in to reschedule appointments."
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
                  disabled={!isAuthenticated}
                  title={
                    isAuthenticated
                      ? ""
                      : "You must sign in to cancel appointments."
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

          {/* CARD 2: Either cancel summary, reschedule form, or booking form */}
          <section className="account-section">
            {mode === "cancel" ? (
              <>
                <h3 style={{ marginBottom: "1rem", color: "#2d3748", fontSize: "1.1rem", fontWeight: 600 }}>
                  Select Appointment to Cancel
                </h3>
                {loadingAppointments ? (
                  <div style={{ padding: "2rem", textAlign: "center", color: "#718096" }}>
                    Loading your appointments...
                  </div>
                ) : patientAppointments.length === 0 ? (
                  <div style={{ 
                    padding: "2rem", 
                    textAlign: "center", 
                    backgroundColor: "#f7fafc",
                    borderRadius: "10px",
                    border: "2px solid #e2e8f0"
                  }}>
                    <p style={{ color: "#4a5568", marginBottom: "0.5rem", fontSize: "1rem" }}>
                      No upcoming appointments found.
                    </p>
                    <p style={{ color: "#718096", fontSize: "0.9rem" }}>
                      You don't have any upcoming appointments to cancel.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {patientAppointments.map((appt: any) => {
                      const apptDate = new Date(appt.start_time);
                      const isSelected = selectedAppointmentId === appt.appt_id;
                      
                      return (
                        <div
                          key={appt.appt_id}
                          onClick={() => setSelectedAppointmentId(appt.appt_id)}
                          style={{
                            padding: "1rem 1.25rem",
                            border: isSelected ? "2px solid #667eea" : "2px solid #e2e8f0",
                            borderRadius: "12px",
                            backgroundColor: isSelected ? "#edf2ff" : "#fff",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            boxShadow: isSelected ? "0 2px 8px rgba(102, 126, 234, 0.2)" : "none"
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.borderColor = "#667eea";
                              e.currentTarget.style.backgroundColor = "#f7faff";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.borderColor = "#e2e8f0";
                              e.currentTarget.style.backgroundColor = "#fff";
                            }
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ 
                                display: "flex", 
                                alignItems: "center", 
                                gap: "0.5rem", 
                                marginBottom: "0.5rem" 
                              }}>
                                <span style={{ fontSize: "1.2rem" }}>👤</span>
                                <strong style={{ color: "#2d3748", fontSize: "1rem" }}>
                                  {appt.doctor_name || "Unknown Doctor"}
                                </strong>
                              </div>
                              <div style={{ 
                                display: "flex", 
                                alignItems: "center", 
                                gap: "0.5rem", 
                                marginBottom: "0.5rem",
                                color: "#4a5568",
                                fontSize: "0.9rem"
                              }}>
                                <span style={{ fontSize: "1.1rem" }}>📅</span>
                                <span>
                                  {apptDate.toLocaleDateString('en-US', { 
                                    weekday: 'long', 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                  })}
                                </span>
                              </div>
                              <div style={{ 
                                display: "flex", 
                                alignItems: "center", 
                                gap: "0.5rem",
                                color: "#4a5568",
                                fontSize: "0.9rem"
                              }}>
                                <span style={{ fontSize: "1.1rem" }}>🕐</span>
                                <span>
                                  {apptDate.toLocaleTimeString('en-US', { 
                                    hour: 'numeric', 
                                    minute: '2-digit',
                                    hour12: true 
                                  })}
                                </span>
                              </div>
                              {appt.reason && (
                                <div style={{ 
                                  marginTop: "0.5rem",
                                  padding: "0.5rem",
                                  backgroundColor: "#f7fafc",
                                  borderRadius: "6px",
                                  fontSize: "0.85rem",
                                  color: "#718096"
                                }}>
                                  <strong>Reason:</strong> {appt.reason}
                                </div>
                              )}
                            </div>
                            {isSelected && (
                              <div style={{
                                width: "24px",
                                height: "24px",
                                borderRadius: "50%",
                                backgroundColor: "#667eea",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#fff",
                                fontSize: "0.9rem",
                                fontWeight: "bold"
                              }}>
                                ✓
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {patientAppointments.length > 0 && (
                  <p
                    style={{
                      marginTop: "1rem",
                      color: "#e53e3e",
                      fontSize: "0.9rem",
                      lineHeight: 1.4,
                    }}
                  >
                    ⚠️ Cancelling will notify the provider and free the slot for other patients.
                  </p>
                )}
              </>
            ) : mode === "reschedule" ? (
              <>
                <h3 style={{ marginBottom: "1rem", color: "#2d3748", fontSize: "1.1rem", fontWeight: 600 }}>
                  Select Appointment to Reschedule
                </h3>
                {loadingAppointments ? (
                  <div style={{ padding: "2rem", textAlign: "center", color: "#718096" }}>
                    Loading your appointments...
                  </div>
                ) : patientAppointments.length === 0 ? (
                  <div style={{ 
                    padding: "2rem", 
                    textAlign: "center", 
                    backgroundColor: "#f7fafc",
                    borderRadius: "10px",
                    border: "2px solid #e2e8f0"
                  }}>
                    <p style={{ color: "#4a5568", marginBottom: "0.5rem", fontSize: "1rem" }}>
                      No upcoming appointments found.
                    </p>
                    <p style={{ color: "#718096", fontSize: "0.9rem" }}>
                      You don't have any upcoming appointments to reschedule.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {patientAppointments.map((appt: any) => {
                      const apptDate = new Date(appt.start_time);
                      const isSelected = rescheduleAppointmentId === appt.appt_id;
                      
                      return (
                        <div
                          key={appt.appt_id}
                          onClick={() => setRescheduleAppointmentId(appt.appt_id)}
                          style={{
                            padding: "1rem 1.25rem",
                            border: isSelected ? "2px solid #667eea" : "2px solid #e2e8f0",
                            borderRadius: "12px",
                            backgroundColor: isSelected ? "#edf2ff" : "#fff",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            boxShadow: isSelected ? "0 2px 8px rgba(102, 126, 234, 0.2)" : "none"
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.borderColor = "#667eea";
                              e.currentTarget.style.backgroundColor = "#f7faff";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.borderColor = "#e2e8f0";
                              e.currentTarget.style.backgroundColor = "#fff";
                            }
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ 
                                display: "flex", 
                                alignItems: "center", 
                                gap: "0.5rem", 
                                marginBottom: "0.5rem" 
                              }}>
                                <span style={{ fontSize: "1.2rem" }}>👤</span>
                                <strong style={{ color: "#2d3748", fontSize: "1rem" }}>
                                  {appt.doctor_name || "Unknown Doctor"}
                                </strong>
                              </div>
                              <div style={{ 
                                display: "flex", 
                                alignItems: "center", 
                                gap: "0.5rem", 
                                marginBottom: "0.5rem",
                                color: "#4a5568",
                                fontSize: "0.9rem"
                              }}>
                                <span style={{ fontSize: "1.1rem" }}>📅</span>
                                <span>
                                  {apptDate.toLocaleDateString('en-US', { 
                                    weekday: 'long', 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                  })}
                                </span>
                              </div>
                              <div style={{ 
                                display: "flex", 
                                alignItems: "center", 
                                gap: "0.5rem",
                                color: "#4a5568",
                                fontSize: "0.9rem"
                              }}>
                                <span style={{ fontSize: "1.1rem" }}>🕐</span>
                                <span>
                                  {apptDate.toLocaleTimeString('en-US', { 
                                    hour: 'numeric', 
                                    minute: '2-digit',
                                    hour12: true 
                                  })}
                                </span>
                              </div>
                              {appt.reason && (
                                <div style={{ 
                                  marginTop: "0.5rem",
                                  padding: "0.5rem",
                                  backgroundColor: "#f7fafc",
                                  borderRadius: "6px",
                                  fontSize: "0.85rem",
                                  color: "#718096"
                                }}>
                                  <strong>Reason:</strong> {appt.reason}
                                </div>
                              )}
                            </div>
                            {isSelected && (
                              <div style={{
                                width: "24px",
                                height: "24px",
                                borderRadius: "50%",
                                backgroundColor: "#667eea",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#fff",
                                fontSize: "0.9rem",
                                fontWeight: "bold"
                              }}>
                                ✓
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {currentAppointment && (
                  <>
                    <div style={{ 
                      marginTop: "1.5rem", 
                      padding: "1.25rem", 
                      backgroundColor: "#f0f4ff", 
                      borderRadius: "12px",
                      border: "2px solid #667eea"
                    }}>
                      <h4 style={{ 
                        marginBottom: "0.75rem", 
                        color: "#2d3748", 
                        fontSize: "1rem", 
                        fontWeight: 600 
                      }}>
                        Current Appointment Details:
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", color: "#4a5568" }}>
                        <div>
                          <strong>Doctor:</strong> {currentAppointment.doctor_name || "Unknown Doctor"}
                        </div>
                        <div>
                          <strong>Date:</strong> {new Date(currentAppointment.start_time).toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </div>
                        <div>
                          <strong>Time:</strong> {new Date(currentAppointment.start_time).toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit',
                            hour12: true 
                          })}
                        </div>
                        {currentAppointment.reason && (
                          <div>
                            <strong>Reason:</strong> {currentAppointment.reason}
                          </div>
                        )}
                      </div>
                      <p style={{ 
                        marginTop: "1rem", 
                        color: "#667eea", 
                        fontSize: "0.9rem",
                        fontWeight: 500
                      }}>
                        ↓ Select a new date and time below to reschedule
                      </p>
                    </div>

                    {/* Booking Form for Reschedule */}
                    <div style={{ marginTop: "2rem" }}>
                      <h3 style={{ marginBottom: "1rem", color: "#2d3748", fontSize: "1.1rem", fontWeight: 600 }}>
                        Select New Date & Time
                      </h3>

                      {/* Provider - Disabled in reschedule mode */}
                      <label htmlFor="provider-select-reschedule" style={{ 
                        display: 'block', 
                        marginBottom: '0.5rem', 
                        fontWeight: '600',
                        color: '#2d3748',
                        fontSize: '0.95rem'
                      }}>
                        1. Provider (Cannot be changed)
                      </label>
                      <select
                        id="provider-select-reschedule"
                        value={selectedProviderId}
                        disabled={true}
                        style={{
                          width: '100%',
                          padding: '0.75rem 1rem',
                          border: '2px solid #cbd5e0',
                          borderRadius: '10px',
                          fontSize: '1rem',
                          fontFamily: 'inherit',
                          backgroundColor: '#f7fafc',
                          cursor: 'not-allowed',
                          color: '#4a5568',
                          appearance: 'none',
                          backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%23a0aec0\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 1rem center',
                          paddingRight: '2.5rem'
                        }}
                      >
                        {providers.map((doc) => (
                          <option key={doc.id} value={doc.id}>
                            {doc.name} – {doc.specialty}
                          </option>
                        ))}
                      </select>
                      <p style={{ 
                        marginTop: "0.5rem",
                        color: "#718096",
                        fontSize: "0.85rem",
                        fontStyle: "italic"
                      }}>
                        The provider cannot be changed when rescheduling
                      </p>

                      {provider && (
                        <div
                          style={{
                            backgroundColor: "#f0f4ff",
                            border: "2px solid #667eea",
                            borderRadius: "12px",
                            padding: "1rem 1.25rem",
                            marginTop: "1rem",
                            fontSize: "0.9rem",
                            lineHeight: 1.6,
                            color: "#2d3748",
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '1.2rem' }}>📍</span>
                            <div>
                              <strong style={{ color: '#667eea' }}>Location:</strong> {visitLocation}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '1.2rem' }}>💰</span>
                            <div>
                              <strong style={{ color: '#667eea' }}>Est. Fee:</strong> ${visitFee}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Date */}
                      <label htmlFor="date-input-reschedule" style={{ 
                        display: 'block', 
                        marginTop: '1.5rem',
                        marginBottom: '0.5rem', 
                        fontWeight: '600',
                        color: '#2d3748',
                        fontSize: '0.95rem'
                      }}>
                        2. New Appointment Date
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          ref={dateInputRef}
                          id="date-input-reschedule"
                          type="date"
                          value={date}
                          min={todayStr}
                          onChange={(e) => {
                            setDate(e.target.value);
                            setTime("");
                          }}
                          onClick={(e) => {
                            e.currentTarget.showPicker?.();
                          }}
                          style={{
                            width: '100%',
                            padding: '0.75rem 1rem',
                            border: '2px solid #e2e8f0',
                            borderRadius: '10px',
                            fontSize: '1rem',
                            fontFamily: 'inherit',
                            backgroundColor: '#fff',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            outline: 'none'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#667eea';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#e2e8f0';
                          }}
                        />
                      </div>

                      {/* Time */}
                      {date && (
                        <>
                          <label htmlFor="time-select-reschedule" style={{ 
                            display: 'block', 
                            marginTop: '1.5rem',
                            marginBottom: '0.5rem', 
                            fontWeight: '600',
                            color: '#2d3748',
                            fontSize: '0.95rem'
                          }}>
                            3. New Appointment Time
                          </label>
                          {loadingSlots ? (
                            <div style={{ 
                              padding: '0.75rem 1rem',
                              color: '#718096',
                              fontSize: '0.9rem'
                            }}>
                              Loading available slots...
                            </div>
                          ) : availableSlots.length === 0 ? (
                            <div style={{ 
                              padding: '0.75rem 1rem',
                              color: '#e53e3e',
                              fontSize: '0.9rem',
                              backgroundColor: '#fed7d7',
                              borderRadius: '8px'
                            }}>
                              No available slots for this date. Please select another date.
                            </div>
                          ) : (
                            <select
                              id="time-select-reschedule"
                              value={time}
                              onChange={(e) => setTime(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '0.75rem 1rem',
                                border: '2px solid #e2e8f0',
                                borderRadius: '10px',
                                fontSize: '1rem',
                                fontFamily: 'inherit',
                                backgroundColor: '#fff',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                outline: 'none',
                                appearance: 'none',
                                backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%23667eea\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 1rem center',
                                paddingRight: '2.5rem'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = '#667eea';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = '#e2e8f0';
                              }}
                            >
                              <option value="">Choose a time</option>
                              {availableSlots.map((slot) => (
                                <option key={slot} value={slot}>
                                  {slot}
                                </option>
                              ))}
                            </select>
                          )}
                        </>
                      )}

                      {/* Reason */}
                      <label htmlFor="reason-textarea-reschedule" style={{ 
                        display: 'block', 
                        marginTop: '1.5rem',
                        marginBottom: '0.5rem', 
                        fontWeight: '600',
                        color: '#2d3748',
                        fontSize: '0.95rem'
                      }}>
                        4. Reason for Visit
                      </label>
                      <textarea
                        id="reason-textarea-reschedule"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Briefly describe the reason for your visit..."
                        rows={4}
                        style={{
                          width: '100%',
                          padding: '0.75rem 1rem',
                          border: '2px solid #e2e8f0',
                          borderRadius: '10px',
                          fontSize: '1rem',
                          fontFamily: 'inherit',
                          backgroundColor: '#fff',
                          resize: 'vertical',
                          transition: 'all 0.2s ease',
                          outline: 'none'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#667eea';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#e2e8f0';
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = '#667eea';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = '#e2e8f0';
                        }}
                      />
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                {/* Provider */}
                <label htmlFor="provider-select" style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: '600',
                  color: '#2d3748',
                  fontSize: '0.95rem'
                }}>
                  1. Select Provider
                </label>
                <select
                  id="provider-select"
                  value={selectedProviderId}
                  onChange={(e) => {
                    setSelectedProviderId(e.target.value);
                    setTime("");
                  }}
                  disabled={
                    !isAuthenticated || loadingDoctors
                  }
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '10px',
                    fontSize: '1rem',
                    fontFamily: 'inherit',
                    backgroundColor: '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    outline: 'none',
                    appearance: 'none',
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%23667eea\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 1rem center',
                    paddingRight: '2.5rem'
                  }}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.borderColor = '#667eea';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                >
                  <option value="">
                    {loadingDoctors ? "Loading doctors..." : "Choose a doctor"}
                  </option>
                  {providers.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name} – {doc.specialty}
                    </option>
                  ))}
                </select>
                {doctorsError && (
                  <div
                    style={{
                      marginTop: "0.5rem",
                      color: "#e53e3e",
                      fontSize: "0.9rem",
                    }}
                  >
                    {doctorsError}
                  </div>
                )}
                {!loadingDoctors && providers.length === 0 && !doctorsError && (
                  <div
                    style={{
                      marginTop: "0.5rem",
                      color: "#718096",
                      fontSize: "0.9rem",
                    }}
                  >
                    No doctors available. Please contact support.
                  </div>
                )}

                {provider && (
                  <div
                    style={{
                      backgroundColor: "#f0f4ff",
                      border: "2px solid #667eea",
                      borderRadius: "12px",
                      padding: "1rem 1.25rem",
                      marginTop: "1rem",
                      fontSize: "0.9rem",
                      lineHeight: 1.6,
                      color: "#2d3748",
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '1.2rem' }}>📍</span>
                      <div>
                        <strong style={{ color: '#667eea' }}>Location:</strong> {visitLocation}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '1.2rem' }}>💰</span>
                      <div>
                        <strong style={{ color: '#667eea' }}>Est. Fee:</strong> ${visitFee}
                      </div>
                    </div>
                  </div>
                )}

                {/* Date */}
                <label htmlFor="date-input" style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: '600',
                  color: '#2d3748',
                  fontSize: '0.95rem'
                }}>
                  2. Appointment Date
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={dateInputRef}
                    id="date-input"
                    type="date"
                    min={todayStr}
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      setTime("");
                    }}
                    onClick={(e) => {
                      // Always open calendar picker when clicking anywhere in the field
                      const input = e.currentTarget;
                      try {
                        if (input.showPicker && typeof input.showPicker === 'function') {
                          input.showPicker();
                        } else {
                          input.focus();
                        }
                      } catch (err) {
                        input.focus();
                      }
                    }}
                    onFocus={(e) => {
                      // Open calendar on focus as well
                      const input = e.currentTarget;
                      try {
                        if (input.showPicker && typeof input.showPicker === 'function') {
                          input.showPicker();
                        }
                      } catch (err) {
                        // Ignore errors
                      }
                    }}
                    style={{
                      cursor: 'pointer',
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '10px',
                      fontSize: '1rem',
                      fontFamily: 'inherit',
                      backgroundColor: '#fff',
                      transition: 'all 0.2s ease',
                      outline: 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#667eea';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                    }}
                    disabled={
                      !isAuthenticated
                    }
                  />
                  <span style={{
                    position: 'absolute',
                    right: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    fontSize: '1.2rem',
                    color: '#667eea'
                  }}>
                    📅
                  </span>
                </div>

                {/* Time slots */}
                <label style={{ 
                  display: 'block', 
                  marginTop: "1.5rem", 
                  marginBottom: '0.5rem',
                  fontWeight: '600',
                  color: '#2d3748',
                  fontSize: '0.95rem'
                }}>
                  3. Select Time Slot
                </label>
                {loadingSlots && (
                  <div
                    style={{
                      fontSize: "0.9rem",
                      color: "#718096",
                      marginTop: "0.5rem",
                    }}
                  >
                    Loading available slots...
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                    marginTop: "0.5rem",
                  }}
                >
                  {!loadingSlots && availableSlots.length === 0 && provider && date && (
                    <div
                      style={{
                        fontSize: "0.9rem",
                        color: "#718096",
                      }}
                    >
                      No open slots for that date. Please select another date.
                    </div>
                  )}
                  {!loadingSlots && !provider && (
                    <div
                      style={{
                        fontSize: "0.9rem",
                        color: "#718096",
                      }}
                    >
                      Please select a doctor first.
                    </div>
                  )}
                  {!loadingSlots && provider && !date && (
                    <div
                      style={{
                        fontSize: "0.9rem",
                        color: "#718096",
                      }}
                    >
                      Please select a date to see available time slots.
                    </div>
                  )}

                  {!loadingSlots && availableSlots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setTime(slot)}
                      disabled={!isAuthenticated}
                      style={{
                        color: time === slot ? "#667eea" : "#2d3748",
                        border:
                          time === slot
                            ? "2px solid #667eea"
                            : "2px solid #e2e8f0",
                        backgroundColor:
                          time === slot ? "#edf2ff" : "#fff",
                        borderRadius: "10px",
                        padding: "0.75rem 1.25rem",
                        fontSize: "0.95rem",
                        fontWeight: time === slot ? 600 : 500,
                        minWidth: "5rem",
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: time === slot ? '0 2px 8px rgba(102, 126, 234, 0.2)' : 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (time !== slot && !e.currentTarget.disabled) {
                          e.currentTarget.style.borderColor = '#667eea';
                          e.currentTarget.style.backgroundColor = '#f7faff';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (time !== slot) {
                          e.currentTarget.style.borderColor = '#e2e8f0';
                          e.currentTarget.style.backgroundColor = '#fff';
                        }
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
                <label htmlFor="reason-input" style={{ 
                  display: 'block', 
                  marginTop: "1.5rem", 
                  marginBottom: '0.5rem',
                  fontWeight: '600',
                  color: '#2d3748',
                  fontSize: '0.95rem'
                }}>
                  4. Reason for Visit
                </label>
                <textarea
                  id="reason-input"
                  rows={4}
                  placeholder="Example: Follow-up on bloodwork results, annual checkup, etc."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={!isAuthenticated}
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    border: "2px solid #e2e8f0",
                    borderRadius: "10px",
                    fontSize: "1rem",
                    fontFamily: "inherit",
                    resize: 'vertical',
                    transition: 'all 0.2s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#667eea';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
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
                    marginTop: "2rem",
                    backgroundColor: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    background: "#667eea",
                    border: "none",
                    borderRadius: "16px",
                    padding: "1.5rem 1.75rem",
                    lineHeight: 1.6,
                    fontSize: "0.95rem",
                    color: "#fff",
                    boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)",
                  }}
                >
                  <h3 style={{ 
                    margin: "0 0 1rem 0", 
                    fontSize: "1.1rem", 
                    fontWeight: 600,
                    color: "#fff"
                  }}>
                    Appointment Summary
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "0.75rem",
                      paddingBottom: "0.75rem",
                      borderBottom: "1px solid rgba(255, 255, 255, 0.2)",
                    }}
                  >
                    <span style={{ opacity: 0.9 }}>Provider</span>
                    <span style={{ fontWeight: 600 }}>{provider ? provider.name : "—"}</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "0.75rem",
                      paddingBottom: "0.75rem",
                      borderBottom: "1px solid rgba(255, 255, 255, 0.2)",
                    }}
                  >
                    <span style={{ opacity: 0.9 }}>Date &amp; Time</span>
                    <span style={{ fontWeight: 600 }}>
                      {date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "—"} {time || ""}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "0.75rem",
                      paddingBottom: "0.75rem",
                      borderBottom: "1px solid rgba(255, 255, 255, 0.2)",
                    }}
                  >
                    <span style={{ opacity: 0.9 }}>Location</span>
                    <span style={{ fontWeight: 600 }}>{visitLocation || "—"}</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: "0.75rem",
                      paddingTop: "0.75rem",
                      borderTop: "2px solid rgba(255, 255, 255, 0.3)",
                    }}
                  >
                    <span style={{ fontSize: "1.05rem", fontWeight: 600 }}>Estimated Fee</span>
                    <span style={{ fontSize: "1.2rem", fontWeight: 700 }}>${visitFee || 0}</span>
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
