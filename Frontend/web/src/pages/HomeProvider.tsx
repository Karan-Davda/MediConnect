import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import { useCalendar } from "../calendar/useCalendar";
import "./Home.css";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const monthYear = (d: Date) =>
  d.toLocaleString(undefined, { month: "long", year: "numeric" });

const HomeProvider: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [cursor, setCursor] = useState(new Date());
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(iso(new Date()));
  const [slot, setSlot] = useState("09:00");

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const {
    providers,
    getAvailability,
    addAvailability,
    blockTime,
    removeAvailability,
  } = useCalendar();

  if (!providers || providers.length === 0) {
    return (
      <div className="dashboard-container">
        <Sidebar
          isCollapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <div
          className={`main-content ${
            sidebarCollapsed ? "sidebar-collapsed" : ""
          }`}
        >
          <header className="header">
            <h1 className="brand-title">MediConnect – Provider</h1>
          </header>
          <div className="dashboard-content">Loading providers…</div>
        </div>
      </div>
    );
  }

  const providerId = providers[0]?.provider?.id ?? "p1";
  const provider =
    providers.find((p) => p.provider.id === providerId) ?? providers[0];

  const days = useMemo(() => {
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
  }, [cursor, providerId, provider?.blocks, getAvailability]);

  return (
    <div className="dashboard-container">
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div
        className={`main-content ${
          sidebarCollapsed ? "sidebar-collapsed" : ""
        }`}
      >
        <header className="header">
          <div className="header-left">
            <h1 className="brand-title">MediConnect – Provider</h1>
          </div>
          <div className="header-center">
            <div className="search-bar">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search"
                className="search-input"
              />
            </div>
          </div>
          <div className="header-right">
            {isAuthenticated ? (
              <div className="user-menu">
                <span className="user-name">
                  {user?.name || user?.email}
                </span>
                <button className="logout-btn" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            ) : (
              <button className="login-btn" onClick={() => navigate("/login")}>
                Login
              </button>
            )}
          </div>
        </header>

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
                      const todayISO = new Date()
                        .toISOString()
                        .slice(0, 10);
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
              <div style={{ marginTop: 16 }}>
                <h4>Manage {selectedDate}</h4>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    margin: "8px 0",
                  }}
                >
                  <input
                    type="time"
                    value={slot}
                    onChange={(e) => setSlot(e.target.value)}
                    style={{ padding: "0.4rem 0.5rem" }}
                  />
                  <button
                    onClick={() =>
                      addAvailability(providerId, selectedDate, slot)
                    }
                  >
                    + Add Availability
                  </button>
                  <button
                    onClick={() =>
                      blockTime(providerId, selectedDate, slot)
                    }
                    style={{ backgroundColor: "#e53e3e" }}
                  >
                    Block Time
                  </button>
                  <button
                    onClick={() =>
                      removeAvailability(providerId, selectedDate, slot)
                    }
                    style={{ backgroundColor: "#a0aec0" }}
                  >
                    Remove Slot
                  </button>
                </div>

                <p style={{ color: "#4a5568", fontSize: "0.9rem" }}>
                  • Adding availability opens slots for patients (DDV/CC).
                  <br />
                  • Blocking time removes it from bookable inventory
                  (DDV/CC).
                  <br />
                  • Changes instantly reflect in the patient dashboard &
                  booking (DF-Out/DF-In).
                </p>
              </div>
            </div>
          </div>
          {/* You can add more provider widgets here */}
        </div>
      </div>
    </div>
  );
};

export default HomeProvider;
