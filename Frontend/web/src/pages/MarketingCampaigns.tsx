import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import "./MarketingCampaigns.css";

type Channel = "EMAIL" | "SMS" | "IN_APP";
type CampaignStatus = "DRAFT" | "SCHEDULED" | "ACTIVE" | "PAUSED" | "COMPLETED";

type Campaign = {
  id: string;
  name: string;
  objective: string;
  channels: Channel[];
  audienceSegment: string;
  startDate: string;
  endDate?: string;
  status: CampaignStatus;
  subject: string;
  body: string;
  createdBy: string;
  createdAt: string;
};

const mockCampaigns: Campaign[] = [
  {
    id: "cmp-001",
    name: "Annual Checkup Reminder",
    objective: "Encourage overdue patients to schedule annual visits",
    channels: ["EMAIL"],
    audienceSegment: "Patients with no annual visit in 12+ months",
    startDate: "2025-11-01T09:00",
    endDate: "2025-11-15T23:59",
    status: "ACTIVE",
    subject: "It’s time for your annual checkup",
    body: "Hi there, this is a reminder from MediConnect to schedule your annual preventive visit.",
    createdBy: "marketing_admin@clinic.com",
    createdAt: "2025-10-20T10:30",
  },
  {
    id: "cmp-002",
    name: "Flu Shot Campaign",
    objective: "Promote flu vaccinations",
    channels: ["EMAIL", "IN_APP"],
    audienceSegment: "All adult patients",
    startDate: "2025-10-01T09:00",
    endDate: "2025-12-31T23:59",
    status: "PAUSED",
    subject: "Protect yourself this flu season",
    body: "Flu vaccines are now available. Book a quick visit in MediConnect.",
    createdBy: "marketing_admin@clinic.com",
    createdAt: "2025-09-15T14:05",
  },
];

const emptyForm: Omit<Campaign, "id" | "createdBy" | "createdAt"> = {
  name: "",
  objective: "",
  channels: ["EMAIL"],
  audienceSegment: "",
  startDate: "",
  endDate: "",
  status: "DRAFT",
  subject: "",
  body: "",
};

function auditLog(action: string, details: any) {
  console.log("[AUDIT][CAMPAIGN]", {
    action,
    timestamp: new Date().toISOString(),
    details,
  });
}

const MarketingCampaigns: React.FC = () => {
  const { isAuthenticated, user, hasRole } = useAuth();
  const navigate = useNavigate();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>(mockCampaigns);
  const [selectedId, setSelectedId] = useState<string | "new">("new");
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleSidebar = () => setSidebarCollapsed((s) => !s);

  // support forced role from Login for demo (clinic admin choosing marketing)
  const forcedRole = localStorage.getItem("forcedRole");
  const effectiveRole = forcedRole || user?.role;
  const isMarketingAdmin =
    !!effectiveRole && (effectiveRole === "marketing_admin" || effectiveRole === "admin" || hasRole(["marketing_admin", "admin"]));

  // ET-In / AUT: guard access
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    if (!isMarketingAdmin) {
      navigate("/home");
      return;
    }
  }, [isAuthenticated, isMarketingAdmin, navigate]);

  // Load selected campaign into form (DF-In)
  useEffect(() => {
    if (selectedId === "new") {
      setForm(emptyForm);
      setError(null);
      setSuccess(null);
      return;
    }
    const found = campaigns.find((c) => c.id === selectedId);
    if (!found) {
      setSelectedId("new");
      setForm(emptyForm);
      return;
    }
    const { id, createdBy, createdAt, ...rest } = found;
    setForm(rest);
    setError(null);
    setSuccess(null);
  }, [selectedId, campaigns]);

  const currentUserEmail = user?.email || "marketing_admin@clinic.com";

  function updateChannel(ch: Channel, checked: boolean) {
    setForm((prev) => {
      const set = new Set(prev.channels);
      if (checked) set.add(ch);
      else set.delete(ch);
      // FV / DDD: ensure at least one channel
      if (set.size === 0) set.add("EMAIL");
      return { ...prev, channels: Array.from(set) as Channel[] };
    });
  }

  function validate(): string | null {
    // FV: required fields
    if (!form.name.trim()) return "Campaign name is required.";
    if (!form.objective.trim()) return "Objective is required.";
    if (!form.audienceSegment.trim())
      return "Target audience segment is required.";
    if (!form.startDate) return "Start date/time is required.";
    if (!form.subject.trim()) return "Subject is required.";
    if (!form.body.trim()) return "Message body is required.";
    if (!form.channels || form.channels.length === 0)
      return "Select at least one channel.";

    // FV: date logic
    if (form.endDate && form.endDate < form.startDate) {
      return "End date cannot be before start date.";
    }

    // FV: SMS length constraint (simple)
    if (form.channels.includes("SMS") && form.body.length > 320) {
      return "For SMS campaigns, the body should be under 320 characters.";
    }

    return null;
  }

  function buildPayload(statusOverride?: CampaignStatus): Campaign {
    const now = new Date().toISOString();
    const status = statusOverride ?? form.status;

    if (selectedId === "new") {
      return {
        id: `cmp-${Math.random().toString(36).slice(2, 8)}`,
        createdBy: currentUserEmail,
        createdAt: now,
        ...form,
        status,
      };
    }

    const existing = campaigns.find((c) => c.id === selectedId)!;
    return {
      ...existing,
      ...form,
      status,
    };
  }

  async function handleSaveDraft() {
    setError(null);
    setSuccess(null);

    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload("DRAFT");

      // DF-Out: would POST/PUT to /api/campaigns (mocked)
      console.log("[DF-Out] SAVE_DRAFT_CAMPAIGN", payload);

      setCampaigns((prev) => {
        const idx = prev.findIndex((c) => c.id === payload.id);
        if (idx === -1) return [...prev, payload];
        const clone = [...prev];
        clone[idx] = payload;
        return clone;
      });

      setSelectedId(payload.id);
      auditLog("SAVE_DRAFT", { id: payload.id, status: payload.status });

      setSuccess("Draft saved locally.");
    } catch (err: any) {
      console.error("[CAMPAIGN_SAVE_ERROR]", err);
      setError("We could not save the campaign. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSchedule() {
    setError(null);
    setSuccess(null);

    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload("SCHEDULED");

      // DF-Out: would POST to /api/campaigns/schedule (mocked)
      console.log("[DF-Out] SCHEDULE_CAMPAIGN", payload);

      setCampaigns((prev) => {
        const idx = prev.findIndex((c) => c.id === payload.id);
        if (idx === -1) return [...prev, payload];
        const clone = [...prev];
        clone[idx] = payload;
        return clone;
      });

      setSelectedId(payload.id);
      auditLog("SCHEDULE_CAMPAIGN", {
        id: payload.id,
        startDate: payload.startDate,
      });

      setSuccess("Campaign scheduled (demo mode – not sent to real patients).");
    } catch (err: any) {
      console.error("[CAMPAIGN_SCHEDULE_ERROR]", err);
      setError("We could not schedule the campaign. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const sortedCampaigns = useMemo(
    () =>
      [...campaigns].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [campaigns]
  );

  if (!isAuthenticated || !isMarketingAdmin) {
    // Simple guard state while redirecting
    return (
      <div className="marketing-dashboard-container">
        <div className="marketing-main-content">
          <div className="marketing-dashboard-content">
            <div className="marketing-loading-state">
              <p>Checking access…</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="marketing-dashboard-container">
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
      />

      <div className={`marketing-main-content ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <header className="marketing-header">
          <div className="marketing-header-left">
            <h1>MediConnect – Marketing</h1>
          </div>
        </header>

        <div className="marketing-dashboard-content">
          <section className="marketing-section">
            <h2>Create & Manage Campaigns</h2>
            <p>
              Design, schedule, and manage promotional campaigns.
            </p>
          </section>

          <section className="marketing-section">
            <div className="marketing-grid">
              {/* Left: Campaign list (DF-In) */}
              <div className="marketing-campaigns-list">
                <div className="marketing-campaigns-header">
                  <h3>Campaigns</h3>
                  <button
                    className="marketing-new-campaign-btn"
                    onClick={() => setSelectedId("new")}
                    disabled={saving}
                  >
                    + New campaign
                  </button>
                </div>

                <div className="marketing-campaigns-container">
                  {sortedCampaigns.length === 0 ? (
                    <p className="marketing-campaigns-empty">
                      No campaigns yet. Create your first campaign.
                    </p>
                  ) : (
                    sortedCampaigns.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => setSelectedId(c.id)}
                        className={`marketing-campaign-item ${selectedId === c.id ? "selected" : ""}`}
                      >
                        <div className="marketing-campaign-name">{c.name}</div>
                        <div className="marketing-campaign-status">
                          {c.status} · {c.channels.join(", ")}
                        </div>
                        <div className="marketing-campaign-date">
                          {c.startDate
                            ? `From ${new Date(c.startDate).toLocaleString()}`
                            : "No start date"}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right: Create / Edit form (FV, DP, DDD) */}
              <div className="marketing-form-container">
                <h3 className="marketing-form-title">
                  {selectedId === "new" ? "New Campaign" : "Edit Campaign"}
                </h3>

                {error && (
                  <div className="marketing-form-alert error">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="marketing-form-alert success">
                    {success}
                  </div>
                )}

                <div className="marketing-form-grid">
                  <label className="marketing-form-label">
                    <div className="marketing-form-label-text">Campaign name</div>
                    <input
                      className="marketing-form-input"
                      value={form.name}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                    />
                  </label>

                  <label className="marketing-form-label">
                    <div className="marketing-form-label-text">Objective</div>
                    <textarea
                      className="marketing-form-textarea"
                      rows={2}
                      value={form.objective}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, objective: e.target.value }))
                      }
                    />
                  </label>

                  <label className="marketing-form-label">
                    <div className="marketing-form-label-text">Target audience (segment)</div>
                    <input
                      className="marketing-form-input"
                      placeholder="e.g., Patients with no annual visit in 12+ months"
                      value={form.audienceSegment}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          audienceSegment: e.target.value,
                        }))
                      }
                    />
                  </label>

                  {/* Channels */}
                  <div className="marketing-channels-container">
                    <div className="marketing-form-label-text">Channels</div>
                    <div className="marketing-channels-options">
                      <label className="marketing-checkbox-label">
                        <input
                          type="checkbox"
                          checked={form.channels.includes("EMAIL")}
                          onChange={(e) => updateChannel("EMAIL", e.target.checked)}
                        />
                        Email
                      </label>
                      <label className="marketing-checkbox-label">
                        <input
                          type="checkbox"
                          checked={form.channels.includes("SMS")}
                          onChange={(e) => updateChannel("SMS", e.target.checked)}
                        />
                        SMS
                      </label>
                      <label className="marketing-checkbox-label">
                        <input
                          type="checkbox"
                          checked={form.channels.includes("IN_APP")}
                          onChange={(e) => updateChannel("IN_APP", e.target.checked)}
                        />
                        In-app
                      </label>
                    </div>
                  </div>

                  {/* Schedule */}
                  <div className="marketing-schedule-container">
                    <label className="marketing-form-label marketing-schedule-field">
                      <div className="marketing-form-label-text">Start date & time</div>
                      <input
                        type="datetime-local"
                        className="marketing-form-input"
                        value={form.startDate}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, startDate: e.target.value }))
                        }
                      />
                    </label>
                    <label className="marketing-form-label marketing-schedule-field">
                      <div className="marketing-form-label-text">End date & time (optional)</div>
                      <input
                        type="datetime-local"
                        className="marketing-form-input"
                        value={form.endDate}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, endDate: e.target.value }))
                        }
                      />
                    </label>
                  </div>

                  {/* Content */}
                  <label className="marketing-form-label">
                    <div className="marketing-form-label-text">Subject / Title</div>
                    <input
                      className="marketing-form-input"
                      value={form.subject}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, subject: e.target.value }))
                      }
                    />
                  </label>

                  <label className="marketing-form-label">
                    <div className="marketing-form-label-text">Message body</div>
                    <textarea
                      className="marketing-form-textarea"
                      rows={4}
                      value={form.body}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, body: e.target.value }))
                      }
                    />
                  </label>

                  {/* Actions */}
                  <div className="marketing-actions">
                    <button 
                      className="marketing-action-btn secondary"
                      onClick={handleSaveDraft} 
                      disabled={saving}
                    >
                      {saving ? "Saving…" : "Save as draft"}
                    </button>
                    <button 
                      className="marketing-action-btn"
                      onClick={handleSchedule} 
                      disabled={saving}
                    >
                      {saving ? "Scheduling…" : "Schedule campaign"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default MarketingCampaigns;
