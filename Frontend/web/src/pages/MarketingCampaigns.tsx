import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import "./MarketingCampaigns.css";

type Channel = "EMAIL" | "SMS" | "IN_APP";
type CampaignStatus = "DRAFT" | "SCHEDULED" | "ACTIVE" | "PAUSED" | "COMPLETED";

type TargetAudience = {
  ageRange?: { min?: number; max?: number };
  genders?: string[];
  locations?: string[];
  insuranceTypes?: string[];
  medicalConditions?: string[];
  lastVisitRange?: { from?: string; to?: string };
  customSegment?: string;
};

type Campaign = {
  id: string;
  name: string;
  objective: string;
  channels: Channel[];
  targetAudience: TargetAudience;
  startDate: string;
  endDate?: string;
  status: CampaignStatus;
  subject: string;
  body: string;
  estimatedReach?: number;
  actualReach?: number;
  createdBy: string;
  createdAt: string;
};

const emptyTargetAudience: TargetAudience = {
  ageRange: { min: undefined, max: undefined },
  genders: [],
  locations: [],
  insuranceTypes: [],
  medicalConditions: [],
  lastVisitRange: { from: undefined, to: undefined },
  customSegment: "",
};

const emptyForm: Omit<Campaign, "id" | "createdBy" | "createdAt" | "estimatedReach" | "actualReach"> = {
  name: "",
  objective: "",
  channels: ["EMAIL"],
  targetAudience: emptyTargetAudience,
  startDate: "",
  endDate: "",
  status: "DRAFT",
  subject: "",
  body: "",
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

const GENDER_OPTIONS = ["Male", "Female", "Other", "Prefer not to say"];
const LOCATION_OPTIONS = ["Boston", "Cambridge", "Somerville", "All"];
const INSURANCE_OPTIONS = ["Blue Cross", "Aetna", "UnitedHealth", "Cigna", "All"];
const CONDITION_OPTIONS = ["Diabetes", "Hypertension", "Asthma", "High Cholesterol"];

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
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedId, setSelectedId] = useState<string | "new">("new");
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingReach, setLoadingReach] = useState(false);

  const toggleSidebar = () => setSidebarCollapsed((s) => !s);

  const forcedRole = localStorage.getItem("forcedRole");
  const effectiveRole = forcedRole || user?.role;
  const isMarketingAdmin =
    !!effectiveRole && (effectiveRole === "marketing_admin" || effectiveRole === "admin" || hasRole(["marketing_admin", "admin"]));

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

  useEffect(() => {
    if (isMarketingAdmin) {
      loadCampaigns();
    }
  }, [isMarketingAdmin]);

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
    const { id, createdBy, createdAt, estimatedReach, actualReach, ...rest } = found;
    setForm(rest);
    setError(null);
    setSuccess(null);
  }, [selectedId, campaigns]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (hasTargetAudienceCriteria()) {
        previewAudience();
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [hasTargetAudienceCriteria, previewAudience]);

  const currentUserEmail = user?.email || "marketing_admin@clinic.com";

  async function loadCampaigns() {
    try {
      const response = await fetch(`${API_BASE}/campaigns`);
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data);
      } else {
        setError("Failed to load campaigns. Please refresh the page.");
      }
    } catch (err) {
      console.error("[LOAD_CAMPAIGNS_ERROR]", err);
      setError("Failed to connect to the server. Please check your connection.");
    }
  }

  const hasTargetAudienceCriteria = useCallback((): boolean => {
    const ta = form.targetAudience;
    return !!(
      (ta.ageRange?.min !== undefined && ta.ageRange?.min !== null) ||
      (ta.ageRange?.max !== undefined && ta.ageRange?.max !== null) ||
      (ta.genders && ta.genders.length > 0) ||
      (ta.locations && ta.locations.length > 0) ||
      (ta.insuranceTypes && ta.insuranceTypes.length > 0) ||
      (ta.medicalConditions && ta.medicalConditions.length > 0) ||
      (ta.lastVisitRange?.from) ||
      (ta.lastVisitRange?.to)
    );
  }, [form.targetAudience]);

  const previewAudience = useCallback(async () => {
    if (!hasTargetAudienceCriteria()) {
      setForm(prev => ({ ...prev, estimatedReach: 0 }));
      return;
    }

    setLoadingReach(true);
    try {
      const response = await fetch(`${API_BASE}/campaigns/preview-audience`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetAudience: form.targetAudience }),
      });

      if (response.ok) {
        const data = await response.json();
        setForm(prev => ({ ...prev, estimatedReach: data.count }));
      } else {
        setForm(prev => ({ ...prev, estimatedReach: 0 }));
      }
    } catch (err) {
      console.error("[PREVIEW_AUDIENCE_ERROR]", err);
      setForm(prev => ({ ...prev, estimatedReach: 0 }));
    } finally {
      setLoadingReach(false);
    }
  }, [hasTargetAudienceCriteria, form.targetAudience]);

  function updateChannel(ch: Channel, checked: boolean) {
    setForm((prev) => {
      const set = new Set(prev.channels);
      if (checked) set.add(ch);
      else set.delete(ch);
      if (set.size === 0) set.add("EMAIL");
      return { ...prev, channels: Array.from(set) as Channel[] };
    });
  }

  function updateGender(gender: string, checked: boolean) {
    setForm(prev => {
      const genders = checked
        ? [...(prev.targetAudience.genders || []), gender]
        : (prev.targetAudience.genders || []).filter(g => g !== gender);
      return {
        ...prev,
        targetAudience: { ...prev.targetAudience, genders }
      };
    });
  }

  function updateLocation(location: string, checked: boolean) {
    setForm(prev => {
      const locations = checked
        ? [...(prev.targetAudience.locations || []), location]
        : (prev.targetAudience.locations || []).filter(l => l !== location);
      return {
        ...prev,
        targetAudience: { ...prev.targetAudience, locations }
      };
    });
  }

  function updateInsurance(insurance: string, checked: boolean) {
    setForm(prev => {
      const insuranceTypes = checked
        ? [...(prev.targetAudience.insuranceTypes || []), insurance]
        : (prev.targetAudience.insuranceTypes || []).filter(i => i !== insurance);
      return {
        ...prev,
        targetAudience: { ...prev.targetAudience, insuranceTypes }
      };
    });
  }

  function updateCondition(condition: string, checked: boolean) {
    setForm(prev => {
      const medicalConditions = checked
        ? [...(prev.targetAudience.medicalConditions || []), condition]
        : (prev.targetAudience.medicalConditions || []).filter(c => c !== condition);
      return {
        ...prev,
        targetAudience: { ...prev.targetAudience, medicalConditions }
      };
    });
  }

  function validate(): string | null {
    if (!form.name.trim()) return "Campaign name is required.";
    if (!form.objective.trim()) return "Objective is required.";
    if (!hasTargetAudienceCriteria())
      return "Please select at least one targeting criterion.";
    if (!form.startDate) return "Start date/time is required.";
    if (!form.subject.trim()) return "Subject is required.";
    if (!form.body.trim()) return "Message body is required.";
    if (!form.channels || form.channels.length === 0)
      return "Select at least one channel.";

    if (form.endDate && form.endDate < form.startDate) {
      return "End date cannot be before start date.";
    }

    if (form.channels.includes("SMS") && form.body.length > 320) {
      return "For SMS campaigns, the body should be under 320 characters.";
    }

    if (form.targetAudience.ageRange) {
      const { min, max } = form.targetAudience.ageRange;

      if (min !== undefined && min !== null && min < 0) {
        return "Minimum age cannot be negative.";
      }

      if (max !== undefined && max !== null && max < 0) {
        return "Maximum age cannot be negative.";
      }

      if (min !== undefined && min !== null && min > 120) {
        return "Minimum age cannot exceed 120.";
      }

      if (max !== undefined && max !== null && max > 120) {
        return "Maximum age cannot exceed 120.";
      }

      if (min !== undefined && min !== null && max !== undefined && max !== null && min > max) {
        return "Minimum age cannot be greater than maximum age.";
      }
    }

    return null;
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
      const payload = {
        ...form,
        status: "DRAFT" as CampaignStatus,
        createdBy: currentUserEmail,
      };

      const method = selectedId === "new" ? "POST" : "PUT";
      const url = selectedId === "new"
        ? `${API_BASE}/campaigns`
        : `${API_BASE}/campaigns/${selectedId}`;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to save campaign");
      }

      const saved = await response.json();

      setCampaigns((prev) => {
        const idx = prev.findIndex((c) => c.id === saved.id);
        if (idx === -1) return [...prev, saved];
        const clone = [...prev];
        clone[idx] = saved;
        return clone;
      });

      setSelectedId(saved.id);
      auditLog("SAVE_DRAFT", { id: saved.id, status: saved.status });

      setSuccess("Draft saved successfully.");
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
      const payload = {
        ...form,
        status: "SCHEDULED" as CampaignStatus,
        createdBy: currentUserEmail,
      };

      const method = selectedId === "new" ? "POST" : "PUT";
      const url = selectedId === "new"
        ? `${API_BASE}/campaigns`
        : `${API_BASE}/campaigns/${selectedId}`;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to schedule campaign");
      }

      const saved = await response.json();

      setCampaigns((prev) => {
        const idx = prev.findIndex((c) => c.id === saved.id);
        if (idx === -1) return [...prev, saved];
        const clone = [...prev];
        clone[idx] = saved;
        return clone;
      });

      setSelectedId(saved.id);
      auditLog("SCHEDULE_CAMPAIGN", {
        id: saved.id,
        startDate: saved.startDate,
      });

      setSuccess("Campaign scheduled successfully.");
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
              Design, schedule, and manage promotional campaigns with demographic targeting.
            </p>
          </section>

          <section className="marketing-section">
            <div className="marketing-grid">
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
                          {c.estimatedReach !== undefined && (
                            <span>Reach: {c.estimatedReach} · </span>
                          )}
                          {c.startDate
                            ? `From ${new Date(c.startDate).toLocaleString()}`
                            : "No start date"}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

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

                  <div className="marketing-form-section">
                    <div className="marketing-form-label-text">Target Audience Demographics</div>

                    <div className="marketing-demographic-group">
                      <label className="marketing-demographic-label">Age Range</label>
                      <div className="marketing-age-inputs">
                        <input
                          type="number"
                          className="marketing-form-input"
                          placeholder="Min"
                          min="0"
                          max="120"
                          value={form.targetAudience.ageRange?.min || ""}
                          onChange={(e) =>
                            setForm(prev => ({
                              ...prev,
                              targetAudience: {
                                ...prev.targetAudience,
                                ageRange: {
                                  ...prev.targetAudience.ageRange,
                                  min: e.target.value ? parseInt(e.target.value) : undefined
                                }
                              }
                            }))
                          }
                        />
                        <span>to</span>
                        <input
                          type="number"
                          className="marketing-form-input"
                          placeholder="Max"
                          min="0"
                          max="120"
                          value={form.targetAudience.ageRange?.max || ""}
                          onChange={(e) =>
                            setForm(prev => ({
                              ...prev,
                              targetAudience: {
                                ...prev.targetAudience,
                                ageRange: {
                                  ...prev.targetAudience.ageRange,
                                  max: e.target.value ? parseInt(e.target.value) : undefined
                                }
                              }
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="marketing-demographic-group">
                      <label className="marketing-demographic-label">Gender</label>
                      <div className="marketing-checkbox-group">
                        {GENDER_OPTIONS.map(gender => (
                          <label key={gender} className="marketing-checkbox-label">
                            <input
                              type="checkbox"
                              checked={form.targetAudience.genders?.includes(gender) || false}
                              onChange={(e) => updateGender(gender, e.target.checked)}
                            />
                            {gender}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="marketing-demographic-group">
                      <label className="marketing-demographic-label">Location</label>
                      <div className="marketing-checkbox-group">
                        {LOCATION_OPTIONS.map(location => (
                          <label key={location} className="marketing-checkbox-label">
                            <input
                              type="checkbox"
                              checked={form.targetAudience.locations?.includes(location) || false}
                              onChange={(e) => updateLocation(location, e.target.checked)}
                            />
                            {location}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="marketing-demographic-group">
                      <label className="marketing-demographic-label">Insurance Provider</label>
                      <div className="marketing-checkbox-group">
                        {INSURANCE_OPTIONS.map(insurance => (
                          <label key={insurance} className="marketing-checkbox-label">
                            <input
                              type="checkbox"
                              checked={form.targetAudience.insuranceTypes?.includes(insurance) || false}
                              onChange={(e) => updateInsurance(insurance, e.target.checked)}
                            />
                            {insurance}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="marketing-demographic-group">
                      <label className="marketing-demographic-label">Medical Conditions</label>
                      <div className="marketing-checkbox-group">
                        {CONDITION_OPTIONS.map(condition => (
                          <label key={condition} className="marketing-checkbox-label">
                            <input
                              type="checkbox"
                              checked={form.targetAudience.medicalConditions?.includes(condition) || false}
                              onChange={(e) => updateCondition(condition, e.target.checked)}
                            />
                            {condition}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="marketing-demographic-group">
                      <label className="marketing-demographic-label">Last Visit Date Range</label>
                      <div className="marketing-date-inputs">
                        <input
                          type="date"
                          className="marketing-form-input"
                          value={form.targetAudience.lastVisitRange?.from || ""}
                          onChange={(e) =>
                            setForm(prev => ({
                              ...prev,
                              targetAudience: {
                                ...prev.targetAudience,
                                lastVisitRange: {
                                  ...prev.targetAudience.lastVisitRange,
                                  from: e.target.value
                                }
                              }
                            }))
                          }
                        />
                        <span>to</span>
                        <input
                          type="date"
                          className="marketing-form-input"
                          value={form.targetAudience.lastVisitRange?.to || ""}
                          onChange={(e) =>
                            setForm(prev => ({
                              ...prev,
                              targetAudience: {
                                ...prev.targetAudience,
                                lastVisitRange: {
                                  ...prev.targetAudience.lastVisitRange,
                                  to: e.target.value
                                }
                              }
                            }))
                          }
                        />
                      </div>
                    </div>

                    {hasTargetAudienceCriteria() && (
                      <div className="marketing-reach-indicator">
                        <span>Estimated Reach: </span>
                        <strong>
                          {loadingReach ? "Calculating..." : `${form.estimatedReach || 0} patients`}
                        </strong>
                      </div>
                    )}
                  </div>

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
