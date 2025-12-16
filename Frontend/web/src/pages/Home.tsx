import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import PatientAppointmentsWidget from "../widgets/PatientAppointmentsWidget";
import PatientPrescriptionsWidget from "../widgets/PatientPrescriptionsWidget";
import { useCalendar } from "../calendar/useCalendar";
import NotificationIcon from '../components/NotificationIcon';
import { apiUrl } from '../config/api';
import './Home.css';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const monthYear = (d: Date) =>
  d.toLocaleString(undefined, { month: "long", year: "numeric" });

const Home: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [cursor, setCursor] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(iso(new Date()));
  const [slot, setSlot] = useState("09:00");
  const { isAuthenticated, user, logout, hasRole, token } = useAuth();
  const navigate = useNavigate();
  const [totalAppointments, setTotalAppointments] = useState<number>(0);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [upcomingAppointments, setUpcomingAppointments] = useState<any[]>([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);
  const [billDue, setBillDue] = useState<{ amount: number; dueDate: string | null }>({ amount: 0, dueDate: null });
  const [loadingBill, setLoadingBill] = useState(true);

  // Redirect to onboarding if profile is incomplete (for providers)
  useEffect(() => {
    if (isAuthenticated && user) {
      if ((user.role === 'doctor' || user.role === 'clinic_admin') && user.profileComplete === false) {
        navigate('/onboarding');
      }
    }
  }, [isAuthenticated, user, navigate]);

  // Fetch appointments and bills for patients
  useEffect(() => {
    const fetchPatientData = async () => {
      if (!user || !isAuthenticated || user.role !== 'patient' || !token) {
        setLoadingAppointments(false);
        setLoadingUpcoming(false);
        setLoadingBill(false);
        return;
      }
      
      try {
        // Fetch total appointments
        const totalResponse = await fetch(apiUrl('appointments/my-appointments?upcomingOnly=false'), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (totalResponse.ok) {
          const totalData = await totalResponse.json();
          const allAppointments = totalData.appointments || [];
          setTotalAppointments(allAppointments.length);
        }

        // Fetch upcoming appointments
        const upcomingResponse = await fetch(apiUrl('appointments/my-appointments?upcomingOnly=true'), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (upcomingResponse.ok) {
          const upcomingData = await upcomingResponse.json();
          const upcoming = upcomingData.appointments || [];
          // Show only the nearest (first) appointment
          setUpcomingAppointments(upcoming.slice(0, 1));
        }

        // Fetch bills/invoices
        const invoicesResponse = await fetch(apiUrl('invoices'), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (invoicesResponse.ok) {
          const invoicesData = await invoicesResponse.json();
          const invoices = invoicesData.invoices || [];
          
          // Calculate total due from invoices with status DUE or PARTIAL
          const dueInvoices = invoices.filter((inv: any) => 
            inv.status === 'DUE' || inv.status === 'PARTIAL'
          );
          
          const totalDue = dueInvoices.reduce((sum: number, inv: any) => {
            return sum + (inv.balanceDue || inv.patientResponsibility || 0);
          }, 0);
          
          // Get earliest due date
          const dueDates = dueInvoices
            .map((inv: any) => inv.dueDate)
            .filter((date: any) => date)
            .sort();
          
          setBillDue({
            amount: totalDue,
            dueDate: dueDates.length > 0 ? dueDates[0] : null
          });
        }
      } catch (err) {
        console.error('Error fetching patient data:', err);
      } finally {
        setLoadingAppointments(false);
        setLoadingUpcoming(false);
        setLoadingBill(false);
      }
    };

    fetchPatientData();
  }, [user, isAuthenticated, token]);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Role flags
  const isAdmin = hasRole(['admin', 'clinic_admin']);
  const isDoctorOrStaff = hasRole(['doctor', 'clinic_staff']);
  const isProvider = isDoctorOrStaff; // only clinical providers, not admins
  
  // Check if user is marketing admin
  const forcedRole = localStorage.getItem("forcedRole");
  const effectiveRole = forcedRole || user?.role;
  const isMarketingAdmin = !!effectiveRole && (effectiveRole === "marketing_admin" || hasRole(["marketing_admin"]));

  // Calendar functionality for providers (doctors/clinic_staff)
  const {
    providers,
    getAvailability,
    addAvailability,
    blockTime,
    removeAvailability,
  } = useCalendar();

  // Calendar days calculation for marketing admin and providers
  const days = useMemo(() => {
    if (isMarketingAdmin) {
      // Simple calendar for marketing admin without provider functionality
      const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const start = new Date(first);
      start.setDate(first.getDate() - first.getDay());

      return Array.from({ length: 42 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const k = iso(d);

        return {
          d,
          iso: k,
          open: [],
          blocked: new Set(),
          other: d.getMonth() !== cursor.getMonth(),
        };
      });
    }

    if (!isProvider || !providers || providers.length === 0) return [];

    const providerId = providers[0]?.provider?.id ?? "p1";
    const provider = providers.find((p) => p.provider.id === providerId) ?? providers[0];

    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());

    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const k = iso(d);

      const open =
        (typeof getAvailability === "function"
          ? getAvailability(providerId, k)
          : []) ?? [];
      const blocked = new Set((provider?.blocks?.[k] as string[] | undefined) ?? []);

      return {
        d,
        iso: k,
        open,
        blocked,
        other: d.getMonth() !== cursor.getMonth(),
      };
    });
  }, [cursor, providers, getAvailability, isProvider, isMarketingAdmin]);

  // Doctor / Provider Dashboard Content
  const renderDoctorDashboard = () => {
    if (!providers || providers.length === 0) {
      return <div className="dashboard-content">Loading provider schedule…</div>;
    }

    const providerId = providers[0]?.provider?.id ?? "p1";
    const provider = providers.find((p) => p.provider.id === providerId) ?? providers[0];

  return (
      <div className="dashboard-content">
        <div className="widget">
          <div className="widget-header">
            <span className="widget-icon">🗓️</span>
            <h3 className="widget-title">
              {provider.provider.name} — {provider.provider.specialty}
            </h3>
          </div>

          <div className="widget-content">
            {/* Month grid */}
            <div className="calendar-section">
              <div className="calendar-header">
                <span
                  className="calendar-nav"
                  onClick={() =>
                    setCursor(
                      new Date(
                        cursor.getFullYear(),
                        cursor.getMonth() - 1,
                        1
                      )
                    )
                  }
                >
                  ‹
                </span>
                <span className="calendar-month">{monthYear(cursor)}</span>
                <span
                  className="calendar-nav"
                  onClick={() =>
                    setCursor(
                      new Date(
                        cursor.getFullYear(),
                        cursor.getMonth() + 1,
                        1
                      )
                    )
                  }
                >
                  ›
                </span>
              </div>

              <div className="calendar-grid">
                <div className="calendar-days">
                  <span>Su</span>
                  <span>Mo</span>
                  <span>Tu</span>
                  <span>We</span>
                  <span>Th</span>
                  <span>Fr</span>
                  <span>Sa</span>
                </div>
                <div className="calendar-dates">
                  {days.map(({ d, iso, open, blocked, other }) => {
                    const todayISO = new Date().toISOString().slice(0, 10);
                    const dateState =
                      iso === todayISO
                        ? "today"
                        : new Date(iso) < new Date(todayISO)
                        ? "past"
                        : "future";

                    const hasOpen = (open?.length ?? 0) > 0;
                    const hasBlocked = (blocked?.size ?? 0) > 0;

                    const classNames = [
                      other ? "other-month" : "",
                      dateState,
                      hasOpen ? "has-open" : "",
                      hasBlocked ? "has-blocked" : "",
                    ]
                      .join(" ")
                      .trim();

                    return (
                      <span
                        key={iso}
                        className={classNames}
                        onClick={() => setSelectedDate(iso)}
                        title={`Open: ${
                          hasOpen ? open.join(", ") : "-"
                        } | Blocked: ${
                          hasBlocked
                            ? Array.from(blocked).join(", ")
                            : "-"
                        }`}
                      >
                        {d.getDate()}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Controls for selected date */}
            <div className="date-controls">
              <h4>Manage {selectedDate}</h4>
              <div className="date-control-buttons">
                <input
                  type="time"
                  value={slot}
                  onChange={(e) => setSlot(e.target.value)}
                  className="time-input"
                />
                <button
                  onClick={() =>
                    addAvailability(providerId, selectedDate, slot)
                  }
                  className="add-availability-btn"
                >
                  + Add Availability
                </button>
                <button
                  onClick={() =>
                    blockTime(providerId, selectedDate, slot)
                  }
                  className="block-time-btn"
                >
                  Block Time
                </button>
                <button
                  onClick={() =>
                    removeAvailability(providerId, selectedDate, slot)
                  }
                  className="remove-slot-btn"
                >
                  Remove Slot
                </button>
              </div>

              <p className="instructions-text">
                • Adding availability opens slots for patients.
                <br />
                • Blocking time removes it from bookable inventory.
                <br />
                • Changes instantly reflect in the patient dashboard & booking.
              </p>
            </div>
          </div>
        </div>

        {/* Messages Widget – preview for 5.03 Message Patient */}
        <div className="widget messages-widget">
          <div className="widget-header">
            <span className="widget-icon">💬</span>
            <h3 className="widget-title">Messages</h3>
          </div>
          <div className="widget-content">
            {/* DDD: Role-specific message previews */}
            <div className="message-preview-item">
              <div className="message-preview-main">
                <div className="message-preview-name">Jane Doe (Patient)</div>
                <div className="message-preview-snippet">
                  Thank you for the follow-up instructions.
                </div>
              </div>
              <div className="message-preview-meta">
                <span className="message-preview-date">Nov 30</span>
                <span className="message-unread-dot" />
              </div>
            </div>

            <div className="message-preview-item">
              <div className="message-preview-main">
                <div className="message-preview-name">Clinic Administration</div>
                <div className="message-preview-snippet">
                  Schedule update: Room 3 will be unavailable tomorrow.
                </div>
              </div>
              <div className="message-preview-meta">
                <span className="message-preview-date">Nov 29</span>
              </div>
            </div>

            <button
              className="admin-widget-btn"
              style={{ marginTop: 12 }}
              onClick={() => navigate("/messages")}
            >
              <span>📥</span>
              <span>Open Messages</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Admin Dashboard Content (admin / clinic_admin)
  const renderAdminDashboard = () => (
        <div className="dashboard-content">
      {/* Clinic Snapshot */}
      <div className="widget admin-widget">
        <div className="widget-header">
          <span className="widget-icon">📊</span>
          <h3 className="widget-title">Clinic Snapshot (Today)</h3>
        </div>
        <div className="widget-content admin-kpi-row">
          <div className="kpi-card">
            <span className="kpi-label">Appointments</span>
            <span className="kpi-value">42</span>
            <span className="kpi-sub">Scheduled</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Checked-In</span>
            <span className="kpi-value">18</span>
            <span className="kpi-sub">In Clinic</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Waiting</span>
            <span className="kpi-value">6</span>
            <span className="kpi-sub">Lobby</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">No-Shows</span>
            <span className="kpi-value">3</span>
            <span className="kpi-sub">Today</span>
          </div>
        </div>
      </div>

      {/* Operations & Queues */}
            <div className="widget admin-widget">
              <div className="widget-header">
                <span className="widget-icon">🏥</span>
                <h3 className="widget-title">Clinic Operations</h3>
              </div>
        <div className="widget-content admin-ops-grid">
          <div className="admin-ops-column">
            <h4>Check-In / Waitlist</h4>
            <ul className="simple-list">
              <li>Patient A — 09:30 — Waiting</li>
              <li>Patient B — 09:45 — In Room 2</li>
              <li>Walk-in C — Added to waitlist</li>
            </ul>
          </div>
          <div className="admin-ops-column">
            <h4>Operational Actions</h4>
                <button
                  className="admin-widget-btn"
                  onClick={() => navigate('/clinic-operations')}
                >
              🏥 Open Clinic Operations Dashboard
            </button>
            <button
              className="admin-widget-btn"
              onClick={() => navigate('/providers')}
            >
              👨‍⚕️ Manage Providers & Schedules
            </button>
            <button
              className="admin-widget-btn"
              onClick={() => navigate('/billing')}
            >
              💳 Billing & Payments
            </button>
            <button
              className="admin-widget-btn"
              onClick={() => navigate('/reports')}
            >
              📑 Reports & Audit Logs
                </button>
              </div>
        </div>
      </div>

      {/* Staff Overview */}
      <div className="widget admin-widget">
        <div className="widget-header">
          <span className="widget-icon">👥</span>
          <h3 className="widget-title">On-Duty Staff</h3>
        </div>
        <div className="widget-content">
          <div className="provider-item">
            <div className="provider-avatar">👤</div>
            <div className="provider-info">
              <div className="provider-name">Dr. Example</div>
              <div className="provider-specialty">Internal Medicine</div>
            </div>
            <div className="provider-actions">
              <span className="action-icon">📅</span>
              <span className="action-icon">✉️</span>
            </div>
          </div>
          <div className="provider-item">
            <div className="provider-avatar">👤</div>
            <div className="provider-info">
              <div className="provider-name">Nurse Sample</div>
              <div className="provider-specialty">RN</div>
            </div>
            <div className="provider-actions">
              <span className="action-icon">📅</span>
              <span className="action-icon">✉️</span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Widget – preview for 5.03 Message Patient */}
      <div className="widget messages-widget">
        <div className="widget-header">
          <span className="widget-icon">💬</span>
          <h3 className="widget-title">Messages</h3>
        </div>
        <div className="widget-content">
          {/* DDD: Admin-specific message previews */}
          <div className="message-preview-item">
            <div className="message-preview-main">
              <div className="message-preview-name">System Administrator</div>
              <div className="message-preview-snippet">
                Billing system maintenance scheduled for tonight at 11 PM.
              </div>
            </div>
            <div className="message-preview-meta">
              <span className="message-preview-date">Nov 30</span>
              <span className="message-unread-dot" />
            </div>
          </div>

          <div className="message-preview-item">
            <div className="message-preview-main">
              <div className="message-preview-name">Dr. Johnson</div>
              <div className="message-preview-snippet">
                Need approval for new equipment purchase order.
              </div>
            </div>
            <div className="message-preview-meta">
              <span className="message-preview-date">Nov 29</span>
            </div>
          </div>

          <button
            className="admin-widget-btn"
            style={{ marginTop: 12 }}
            onClick={() => navigate("/messages")}
          >
            <span>📥</span>
            <span>Open Messages</span>
          </button>
        </div>
      </div>
    </div>
  );

  // Marketing Admin Dashboard Content
  const renderMarketingDashboard = () => (
    <div className="dashboard-content">
      {/* To Do Widget */}
      <div className="widget todo-widget">
        <div className="widget-header">
          <span className="widget-icon">📝</span>
          <h3 className="widget-title">To Do</h3>
        </div>
        <div className="widget-content">
          <div className="todo-item" style={{ marginBottom: 8, padding: 8, border: "1px solid #e2e8f0", borderRadius: 4, backgroundColor: "#f7fafc" }}>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>Review Q1 campaign performance</div>
            <div style={{ fontSize: 12, color: "#718096" }}>Due: Tomorrow</div>
          </div>
          <div className="todo-item" style={{ marginBottom: 8, padding: 8, border: "1px solid #e2e8f0", borderRadius: 4, backgroundColor: "#f7fafc" }}>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>Prepare flu shot campaign materials</div>
            <div style={{ fontSize: 12, color: "#718096" }}>Due: End of week</div>
          </div>
          <div className="todo-item" style={{ marginBottom: 8, padding: 8, border: "1px solid #e2e8f0", borderRadius: 4, backgroundColor: "#f7fafc" }}>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>Schedule quarterly marketing meeting</div>
            <div style={{ fontSize: 12, color: "#718096" }}>Due: Next week</div>
          </div>
          <div className="todo-item" style={{ padding: 8, border: "1px solid #e2e8f0", borderRadius: 4, backgroundColor: "#f7fafc" }}>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>Update patient communication templates</div>
            <div style={{ fontSize: 12, color: "#718096" }}>Due: Dec 15</div>
          </div>
        </div>
      </div>

      {/* Simple Calendar Widget */}
      <div className="widget">
        <div className="widget-header">
          <span className="widget-icon">🗓️</span>
          <h3 className="widget-title">Calendar</h3>
        </div>
        <div className="widget-content">
          <div className="calendar-section">
            <div className="calendar-header">
              <span
                className="calendar-nav"
                onClick={() =>
                  setCursor(
                    new Date(
                      cursor.getFullYear(),
                      cursor.getMonth() - 1,
                      1
                    )
                  )
                }
              >
                ‹
              </span>
              <span className="calendar-month">{monthYear(cursor)}</span>
              <span
                className="calendar-nav"
                onClick={() =>
                  setCursor(
                    new Date(
                      cursor.getFullYear(),
                      cursor.getMonth() + 1,
                      1
                    )
                  )
                }
              >
                ›
              </span>
            </div>

            <div className="calendar-grid">
              <div className="calendar-days">
                <span>Su</span>
                <span>Mo</span>
                <span>Tu</span>
                <span>We</span>
                <span>Th</span>
                <span>Fr</span>
                <span>Sa</span>
              </div>
              <div className="calendar-dates">
                {days.map(({ d, iso, other }) => {
                  const todayISO = new Date().toISOString().slice(0, 10);
                  const dateState =
                    iso === todayISO
                      ? "today"
                      : new Date(iso) < new Date(todayISO)
                      ? "past"
                      : "future";

                  const classNames = [
                    other ? "other-month" : "",
                    dateState,
                  ]
                    .join(" ")
                    .trim();

                  return (
                    <span
                      key={iso}
                      className={classNames}
                      onClick={() => setSelectedDate(iso)}
                    >
                      {d.getDate()}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12, padding: 8, backgroundColor: "#f7fafc", borderRadius: 4, fontSize: 12, color: "#718096" }}>
            <strong>Selected Date:</strong> {new Date(selectedDate).toLocaleDateString()}
            <br />
          </div>
        </div>
      </div>

      {/* Quick Actions Widget */}
      <div className="widget">
        <div className="widget-header">
          <span className="widget-icon">⚡</span>
          <h3 className="widget-title">Quick Actions</h3>
        </div>
        <div className="widget-content" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            className="admin-widget-btn"
            onClick={() => navigate('/marketing-campaigns')}
            style={{ width: "100%" }}
          >
            <span>📢</span>
            <span>Manage Marketing Campaigns</span>
          </button>
          <button
            className="admin-widget-btn"
            onClick={() => navigate('/account')}
            style={{ width: "100%" }}
          >
            <span>👤</span>
            <span>Update Account Settings</span>
          </button>
        </div>
      </div>
    </div>
  );

  // Patient Dashboard Content
  const renderPatientDashboard = () => (
    <div className="patient-dashboard-content">
      {/* Top Row: 3 Cards */}
      <div className="patient-dashboard-top-row">
        {/* Total Appointments Card */}
        <div className="widget patient-dashboard-card">
          <div className="widget-header">
            <h3 className="widget-title">Total Appointments</h3>
          </div>
          <div className="widget-content">
            {loadingAppointments ? (
              <div className="loading-message">Loading...</div>
            ) : (
              <div className="appointments-count-display">
                <div className="count-number">{totalAppointments}</div>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Appointments Card */}
        <div className="widget patient-dashboard-card">
          <div className="widget-header">
            <h3 className="widget-title">Upcoming Appointments</h3>
          </div>
          <div className="widget-content upcoming-appointments-content">
            {loadingUpcoming ? (
              <div className="loading-message">Loading...</div>
            ) : upcomingAppointments.length === 0 ? (
              <div className="no-data">No upcoming appointments</div>
            ) : (
              <div className="upcoming-appointments-list">
                {upcomingAppointments.map((apt: any) => {
                  const appointmentDate = new Date(apt.start_time || apt.date);
                  return (
                    <div key={apt.id || apt.appt_id} className="upcoming-appointment-item">
                      <div className="appointment-date">
                        <span className="date-label">Date:</span>
                        <span>{appointmentDate.toLocaleDateString()}</span>
                      </div>
                      <div className="appointment-doctor">
                        <span className="doctor-label">Doctor name:</span>
                        <span>{apt.doctor_name || apt.providerName || 'Unknown'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="manage-btn-container">
              <button 
                className="manage-btn"
                onClick={() => navigate('/book-appointment')}
              >
                Manage
              </button>
            </div>
          </div>
        </div>

        {/* Bill Due Card */}
        <div className="widget patient-dashboard-card">
          <div className="widget-header">
            <h3 className="widget-title">
              Bill Due{billDue.amount > 0 && billDue.dueDate ? ' - Date' : ''}
            </h3>
          </div>
          <div className="widget-content">
            {loadingBill ? (
              <div className="loading-message">Loading...</div>
            ) : (
              <div className="bill-due-display">
                <div className="bill-amount">${billDue.amount.toFixed(2)}</div>
                {billDue.amount > 0 && billDue.dueDate && (
                  <div className="bill-date">
                    {new Date(billDue.dueDate).toLocaleDateString()}
                  </div>
                )}
                {billDue.amount === 0 && (
                  <div className="no-bill">No bills due</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Area: Prescriptions */}
      <div className="patient-dashboard-bottom">
        <PatientPrescriptionsWidget />
      </div>
    </div>
  );

  // Decide which dashboard to render
  const renderDashboard = () => {
    if (isAdmin) return renderAdminDashboard();
    if (isProvider) return renderDoctorDashboard();
    if (isMarketingAdmin) return renderMarketingDashboard();
    return renderPatientDashboard();
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar Component */}
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
      />

      {/* Main Content Area */}
      <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Top Header */}
        <header className="header">
          <div className="header-left">
            <h1 className="brand-title">
              MediConnect
              {isAdmin ? ' – Admin' : isProvider ? ' – Provider' : isMarketingAdmin ? ' – Marketing' : ''}
            </h1>
          </div>
          <div className="header-center">
            <div className="search-bar">
              <span className="search-icon">🔍</span>
              <input type="text" placeholder="Search" className="search-input" />
            </div>
          </div>
          <div className="header-right">
            {isAuthenticated ? (
              <div className="user-menu">
                <NotificationIcon />
                <span className="user-name">{user?.name || user?.email}</span>
                <span className="user-role">({user?.role})</span>
                <button className="logout-btn" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            ) : (
              <button className="login-btn" onClick={() => navigate('/login')}>
                Login
              </button>
            )}
          </div>
        </header>

        {/* Dashboard Content - Role-based rendering */}
        {renderDashboard()}
      </div>
    </div>
  );
};

export default Home;
