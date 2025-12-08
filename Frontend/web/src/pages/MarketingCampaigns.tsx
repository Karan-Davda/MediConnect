import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import "./Account.css";

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
      <div className="dashboard-container">
        <div className="main-content">
          <div className="dashboard-content">
            <p>Checking access…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
      />

      <div className={`main-content ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <header className="header">
          <div className="header-left">
            <h1 className="brand-title">MediConnect – Marketing</h1>
          </div>
        </header>

        <div
          className="dashboard-content"
          style={{ maxWidth: 1200, margin: "0 auto" }}
        >
          <section className="account-section" style={{ marginBottom: 16 }}>
            <h2>Create & Manage Campaigns</h2>
            <p style={{ color: "#4a5568", marginTop: 4 }}>
              Design, schedule, and manage promotional campaigns without exposing PHI. 
              Campaigns target segments (e.g., “patients overdue for annual visit”) rather 
              than individual patient records.
            </p>
          </section>

          <section
            className="account-section"
            style={{ display: "grid", gridTemplateColumns: "1.1fr 1.4fr", gap: 24 }}
          >
            {/* Left: Campaign list (DF-In) */}
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <h3 style={{ margin: 0 }}>Campaigns</h3>
                <button
                  onClick={() => setSelectedId("new")}
                  disabled={saving}
                >
                  + New campaign
                </button>
              </div>

              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  maxHeight: 360,
                  overflowY: "auto",
                }}
              >
                {sortedCampaigns.length === 0 ? (
                  <p style={{ padding: 12, color: "#4a5568" }}>
                    No campaigns yet. Create your first campaign.
                  </p>
                ) : (
                  sortedCampaigns.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      style={{
                        padding: 12,
                        borderBottom: "1px solid #edf2f7",
                        cursor: "pointer",
                        backgroundColor:
                          selectedId === c.id ? "#ebf4ff" : "transparent",
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: "#4a5568", marginTop: 2 }}>
                        {c.status} · {c.channels.join(", ")}
                      </div>
                      <div style={{ fontSize: 12, color: "#718096", marginTop: 2 }}>
                        {c.startDate
                          ? `From ${new Date(c.startDate).toLocaleString()}`
                          : "No start date"}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <p style={{ fontSize: 12, color: "#718096", marginTop: 8 }}>
                Changes are stored locally in this Sprint. Future releases will 
                persist campaigns to the backend and external email/SMS gateways 
                (DF-Out, ET-Ex).
              </p>
            </div>

            {/* Right: Create / Edit form (FV, DP, DDD) */}
            <div>
              <h3 style={{ marginTop: 0 }}>
                {selectedId === "new" ? "New Campaign" : "Edit Campaign"}
              </h3>

              {error && (
                <div
                  className="form-alert error"
                  style={{ marginBottom: 8 }}
                >
                  {error}
                </div>
              )}
              {success && (
                <div
                  className="form-alert success"
                  style={{ marginBottom: 8 }}
                >
                  {success}
                </div>
              )}

              <div style={{ display: "grid", gap: 10 }}>
                <label>
                  <div style={{ fontSize: 13 }}>Campaign name</div>
                  <input
                    className="form-input"
                    value={form.name}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                </label>

                <label>
                  <div style={{ fontSize: 13 }}>Objective</div>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={form.objective}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, objective: e.target.value }))
                    }
                  />
                </label>

                <label>
                  <div style={{ fontSize: 13 }}>Target audience (segment)</div>
                  <input
                    className="form-input"
                    placeholder="e.g., Patients with no annual visit in 12+ months"
                    value={form.audienceSegment}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        audienceSegment: e.target.value,
                      }))
                    }
                  />
                  <small style={{ color: "#718096" }}>
                    DP: Use segments, not individual patient names or IDs.
                  </small>
                </label>

                {/* Channels */}
                <div>
                  <div style={{ fontSize: 13 }}>Channels</div>
                  <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input
                        type="checkbox"
                        checked={form.channels.includes("EMAIL")}
                        onChange={(e) => updateChannel("EMAIL", e.target.checked)}
                      />
                      Email
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input
                        type="checkbox"
                        checked={form.channels.includes("SMS")}
                        onChange={(e) => updateChannel("SMS", e.target.checked)}
                      />
                      SMS
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input
                        type="checkbox"
                        checked={form.channels.includes("IN_APP")}
                        onChange={(e) => updateChannel("IN_APP", e.target.checked)}
                      />
                      In-app
                    </label>
                  </div>
                  <small style={{ color: "#718096" }}>
                    FV: At least one channel is required. SMS has stricter length limits.
                  </small>
                </div>

                {/* Schedule */}
                <div style={{ display: "flex", gap: 12 }}>
                  <label style={{ flex: 1 }}>
                    <div style={{ fontSize: 13 }}>Start date & time</div>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={form.startDate}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, startDate: e.target.value }))
                      }
                    />
                  </label>
                  <label style={{ flex: 1 }}>
                    <div style={{ fontSize: 13 }}>End date & time (optional)</div>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={form.endDate}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, endDate: e.target.value }))
                      }
                    />
                  </label>
                </div>

                {/* Content */}
                <label>
                  <div style={{ fontSize: 13 }}>Subject / Title</div>
                  <input
                    className="form-input"
                    value={form.subject}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, subject: e.target.value }))
                    }
                  />
                </label>

                <label>
                  <div style={{ fontSize: 13 }}>Message body</div>
                  <textarea
                    className="form-input"
                    rows={4}
                    value={form.body}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, body: e.target.value }))
                    }
                  />
                </label>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={handleSaveDraft} disabled={saving}>
                    {saving ? "Saving…" : "Save as draft"}
                  </button>
                  <button onClick={handleSchedule} disabled={saving}>
                    {saving ? "Scheduling…" : "Schedule campaign"}
                  </button>
                </div>

                <p style={{ fontSize: 12, color: "#718096" }}>
                  When integrated with backend services, scheduled campaigns will 
                  automatically send via configured email/SMS gateways (DF-Out, NOT). 
                  This Sprint focuses on UI, validation, and entitlements (ET-In, DP, FV).
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default MarketingCampaigns;
