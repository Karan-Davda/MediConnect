import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import "./Account.css"; 

type Provider = {
  id: string;
  name: string;
  specialty?: string;
};

type MedicalID = {
  insuranceProvider?: string;
  insuranceNumber?: string;
  primaryCare?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
};

type Notifications = {
  emailReminders?: boolean;
  smsReminders?: boolean;
};

type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role?: string;
  phone?: string;
  dob?: string;
  address?: string;
  medical?: MedicalID;
  notifications?: Notifications;
  twoFactorEnabled?: boolean;
  dataSharingConsent?: boolean;
  connectedProviders?: Provider[];
};

const DEFAULT_LOCAL_USER: User = {
  id: "local",
  name: "Patient Name",
  email: "you@example.com",
  avatarUrl: undefined,
  role: "Patient",
  phone: "",
  dob: "",
  address: "",
  medical: {},
  notifications: { emailReminders: false, smsReminders: false },
  twoFactorEnabled: false,
  dataSharingConsent: false,
  connectedProviders: [],
};

const Account: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const toggleSidebar = () => setSidebarCollapsed((s) => !s);

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingSection, setEditingSection] = useState<
    "personal" | "medical" | "notifications" | "privacy" | null
  >(null);
  const [form, setForm] = useState<Partial<User>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) throw new Error(`Failed to load profile (${res.status})`);
        const data: User = await res.json();
        if (!mounted) return;
        data.role = "Patient";
        setUser(data);
      } catch {
        // local fallback (no backend)
        setError(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  function getInitials(name = "") {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 0) return "--";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function onFieldChange<K extends keyof Partial<User>>(key: K, value: any) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  function onMedicalChange(field: keyof MedicalID, value: string) {
    setForm((s) => ({
      ...s,
      medical: { ...(s.medical || user?.medical || {}), [field]: value },
    }));
  }

  function onNotificationsChange(field: keyof Notifications, value: boolean) {
    setForm((s) => ({
      ...s,
      notifications: {
        ...(s.notifications || user?.notifications || {}),
        [field]: value,
      },
    }));
  }

  async function saveSection() {
    const displayUser = user ?? DEFAULT_LOCAL_USER;
    setSaving(true);
    setError(null);
    setSuccess(null);

    // local-only
    if (!user) {
      try {
        const updated: User = {
          ...displayUser,
          ...form,
          medical: { ...(displayUser.medical || {}), ...(form.medical || {}) },
          notifications: {
            ...(displayUser.notifications || {}),
            ...(form.notifications || {}),
          },
        };
        updated.role = "Patient";
        setUser(updated);
        setEditingSection(null);
        setForm({});
        setSuccess("Saved (local)");
        setTimeout(() => setSuccess(null), 3000);
      } catch (err: any) {
        setError(err?.message ?? "Failed to save (local)");
      } finally {
        setSaving(false);
      }
      return;
    }

    // server-backed
    try {
      const payload = { ...form };
      const res = await fetch(`/api/users/${displayUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Save failed (${res.status})`);
      }
      const updated: User = await res.json();
      updated.role = "Patient";
      setUser(updated);
      setEditingSection(null);
      setForm({});
      setSuccess("Saved");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function toggleTwoFactor() {
    const displayUser = user ?? DEFAULT_LOCAL_USER;
    setSaving(true);
    setError(null);

    if (!user) {
      try {
        const updated = {
          ...displayUser,
          twoFactorEnabled: !displayUser.twoFactorEnabled,
        };
        setUser(updated);
        setSuccess(
          updated.twoFactorEnabled ? "2FA enabled (local)" : "2FA disabled (local)"
        );
        setTimeout(() => setSuccess(null), 3000);
      } catch (err: any) {
        setError(err?.message ?? "Failed to update 2FA (local)");
      } finally {
        setSaving(false);
      }
      return;
    }

    try {
      const res = await fetch(`/api/users/${displayUser.id}/2fa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enable: !displayUser.twoFactorEnabled }),
      });
      if (!res.ok) throw new Error("Failed to update 2FA");
      const json = await res.json();
      setUser((u) => (u ? { ...u, twoFactorEnabled: json.twoFactorEnabled } : u));
      setSuccess(json.twoFactorEnabled ? "2FA enabled" : "2FA disabled");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message ?? "Failed to update 2FA");
    } finally {
      setSaving(false);
    }
  }

  async function toggleDataSharing(value: boolean) {
    const displayUser = user ?? DEFAULT_LOCAL_USER;
    setSaving(true);
    setError(null);

    if (!user) {
      try {
        const updated = { ...displayUser, dataSharingConsent: value };
        setUser(updated);
        setSuccess("Preference saved (local)");
        setTimeout(() => setSuccess(null), 3000);
      } catch (err: any) {
        setError(err?.message ?? "Failed to save preference (local)");
      } finally {
        setSaving(false);
      }
      return;
    }

    try {
      const res = await fetch(`/api/users/${displayUser.id}/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataSharingConsent: value }),
      });
      if (!res.ok) throw new Error("Failed to update consent");
      setUser((u) => (u ? { ...u, dataSharingConsent: value } : u));
      setSuccess("Preference saved");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message ?? "Failed to save preference");
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      navigate("/login", { replace: true });
    }
  }

  function goHelp() {
    navigate("/support");
  }

  if (loading) {
    return (
      <div className="dashboard-container">
        <Sidebar isCollapsed={sidebarCollapsed} onToggle={toggleSidebar} />
        <div className={`main-content ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
          <header className="header">
            <div className="header-left">
              <h1 className="brand-title">MediConnect</h1>
            </div>
          </header>

          <div className="dashboard-content" style={{ padding: 24 }}>
            <h1>Account</h1>
            <p>Loading profile…</p>
          </div>
        </div>
      </div>
    );
  }

  const displayUser: User = user ?? DEFAULT_LOCAL_USER;

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      {/* Main */}
      <div className={`main-content ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        {/* Top Header (same as Home) */}
        <header className="header">
          <div className="header-left">
            <h1 className="brand-title">MediConnect</h1>
          </div>
        </header>

        {/* Account Content */}
        <div className="dashboard-content" style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
          {/* Profile Header */}
          <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 20 }}>
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: "50%",
                overflow: "hidden",
                background: "#eee",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                color: "#444",
                flexShrink: 0,
              }}
            >
              {displayUser.avatarUrl ? (
                <img
                  src={displayUser.avatarUrl}
                  alt="avatar"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span>{getInitials(displayUser.name)}</span>
              )}
            </div>

            <div style={{ flex: 1 }}>
              <h1 style={{ margin: 0 }}>{displayUser.name}</h1>
              <p style={{ margin: "6px 0", color: "#666" }}>{displayUser.email}</p>
              <small style={{ color: "#888" }}>Role: Patient</small>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setEditingSection("personal")}>Edit Profile</button>
              <button onClick={() => navigate("/account/change-password")}>Change password</button>
            </div>
          </div>

          {error && <div style={{ color: "crimson", marginBottom: 12 }}>{error}</div>}
          {success && <div style={{ color: "green", marginBottom: 12 }}>{success}</div>}

          <section style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 360px", marginBottom: 20 }}>
            <div>
              <h2>Account settings</h2>

              {/* Personal Information */}
              <div style={{ border: "1px solid #eee", padding: 16, borderRadius: 8, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>Personal Information</strong>
                  <button
                    onClick={() => {
                      setEditingSection((s) => (s === "personal" ? null : "personal"));
                      setForm({
                        name: displayUser.name,
                        phone: displayUser.phone,
                        dob: displayUser.dob,
                        address: displayUser.address,
                      });
                    }}
                  >
                    {editingSection === "personal" ? "Close" : "Edit"}
                  </button>
                </div>

                {!editingSection || editingSection !== "personal" ? (
                  <div style={{ marginTop: 10 }}>
                    <p style={{ margin: "6px 0" }}>
                      <strong>Name:</strong> {displayUser.name}
                    </p>
                    <p style={{ margin: "6px 0" }}>
                      <strong>DOB:</strong> {displayUser.dob ?? "—"}
                    </p>
                    <p style={{ margin: "6px 0" }}>
                      <strong>Phone:</strong> {displayUser.phone ?? "—"}
                    </p>
                    <p style={{ margin: "6px 0" }}>
                      <strong>Address:</strong> {displayUser.address ?? "—"}
                    </p>
                  </div>
                ) : (
                  <div style={{ marginTop: 10 }}>
                    <label style={{ display: "block", marginBottom: 8 }}>
                      <div style={{ fontSize: 13 }}>Full name</div>
                      <input
                        value={form.name ?? ""}
                        onChange={(e) => onFieldChange("name", e.target.value)}
                        style={{ width: "100%", padding: 8, marginTop: 6 }}
                      />
                    </label>
                    <label style={{ display: "block", marginBottom: 8 }}>
                      <div style={{ fontSize: 13 }}>DOB</div>
                      <input
                        type="date"
                        value={form.dob ?? ""}
                        onChange={(e) => onFieldChange("dob", e.target.value)}
                        style={{ padding: 8, marginTop: 6 }}
                      />
                    </label>
                    <label style={{ display: "block", marginBottom: 8 }}>
                      <div style={{ fontSize: 13 }}>Phone</div>
                      <input
                        value={form.phone ?? ""}
                        onChange={(e) => onFieldChange("phone", e.target.value)}
                        style={{ width: "100%", padding: 8, marginTop: 6 }}
                      />
                    </label>
                    <label style={{ display: "block", marginBottom: 8 }}>
                      <div style={{ fontSize: 13 }}>Address</div>
                      <input
                        value={form.address ?? ""}
                        onChange={(e) => onFieldChange("address", e.target.value)}
                        style={{ width: "100%", padding: 8, marginTop: 6 }}
                      />
                    </label>
                    <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                      <button onClick={saveSection} disabled={saving}>
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={() => {
                          setEditingSection(null);
                          setForm({});
                        }}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Medical ID */}
              <div style={{ border: "1px solid #eee", padding: 16, borderRadius: 8, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>Medical ID</strong>
                  <button
                    onClick={() => {
                      setEditingSection((s) => (s === "medical" ? null : "medical"));
                      setForm({ medical: displayUser.medical || {} });
                    }}
                  >
                    {editingSection === "medical" ? "Close" : "Edit"}
                  </button>
                </div>

                {!editingSection || editingSection !== "medical" ? (
                  <div style={{ marginTop: 10 }}>
                    <p style={{ margin: "6px 0" }}>
                      <strong>Insurance:</strong>{" "}
                      {displayUser.medical?.insuranceProvider ?? "—"}
                    </p>
                    <p style={{ margin: "6px 0" }}>
                      <strong>Policy #:</strong>{" "}
                      {displayUser.medical?.insuranceNumber ?? "—"}
                    </p>
                    <p style={{ margin: "6px 0" }}>
                      <strong>Primary care:</strong>{" "}
                      {displayUser.medical?.primaryCare ?? "—"}
                    </p>
                    <p style={{ margin: "6px 0" }}>
                      <strong>Emergency contact:</strong>{" "}
                      {displayUser.medical?.emergencyContactName ?? "—"}{" "}
                      {displayUser.medical?.emergencyContactPhone
                        ? `(${displayUser.medical?.emergencyContactPhone})`
                        : ""}
                    </p>
                  </div>
                ) : (
                  <div style={{ marginTop: 10 }}>
                    <label style={{ display: "block", marginBottom: 8 }}>
                      <div style={{ fontSize: 13 }}>Insurance provider</div>
                      <input
                        value={form.medical?.insuranceProvider ?? ""}
                        onChange={(e) => onMedicalChange("insuranceProvider", e.target.value)}
                        style={{ width: "100%", padding: 8, marginTop: 6 }}
                      />
                    </label>
                    <label style={{ display: "block", marginBottom: 8 }}>
                      <div style={{ fontSize: 13 }}>Insurance number</div>
                      <input
                        value={form.medical?.insuranceNumber ?? ""}
                        onChange={(e) => onMedicalChange("insuranceNumber", e.target.value)}
                        style={{ width: "100%", padding: 8, marginTop: 6 }}
                      />
                    </label>
                    <label style={{ display: "block", marginBottom: 8 }}>
                      <div style={{ fontSize: 13 }}>Primary care physician</div>
                      <input
                        value={form.medical?.primaryCare ?? ""}
                        onChange={(e) => onMedicalChange("primaryCare", e.target.value)}
                        style={{ width: "100%", padding: 8, marginTop: 6 }}
                      />
                    </label>
                    <label style={{ display: "block", marginBottom: 8 }}>
                      <div style={{ fontSize: 13 }}>Emergency contact (name)</div>
                      <input
                        value={form.medical?.emergencyContactName ?? ""}
                        onChange={(e) => onMedicalChange("emergencyContactName", e.target.value)}
                        style={{ width: "100%", padding: 8, marginTop: 6 }}
                      />
                    </label>
                    <label style={{ display: "block", marginBottom: 8 }}>
                      <div style={{ fontSize: 13 }}>Emergency contact (phone)</div>
                      <input
                        value={form.medical?.emergencyContactPhone ?? ""}
                        onChange={(e) => onMedicalChange("emergencyContactPhone", e.target.value)}
                        style={{ width: "100%", padding: 8, marginTop: 6 }}
                      />
                    </label>
                    <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                      <button onClick={saveSection} disabled={saving}>
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={() => {
                          setEditingSection(null);
                          setForm({});
                        }}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Notifications */}
              <div style={{ border: "1px solid #eee", padding: 16, borderRadius: 8, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>Notifications</strong>
                  <button
                    onClick={() => {
                      setEditingSection((s) => (s === "notifications" ? null : "notifications"));
                      setForm({ notifications: displayUser.notifications || {} });
                    }}
                  >
                    {editingSection === "notifications" ? "Close" : "Edit"}
                  </button>
                </div>
                <div style={{ marginTop: 10 }}>
                  {!editingSection || editingSection !== "notifications" ? (
                    <>
                      <p style={{ margin: "6px 0" }}>
                        <strong>Email reminders:</strong>{" "}
                        {displayUser.notifications?.emailReminders ? "On" : "Off"}
                      </p>
                      <p style={{ margin: "6px 0" }}>
                        <strong>SMS reminders:</strong>{" "}
                        {displayUser.notifications?.smsReminders ? "On" : "Off"}
                      </p>
                    </>
                  ) : (
                    <div>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <input
                          type="checkbox"
                          checked={!!form.notifications?.emailReminders}
                          onChange={(e) => onNotificationsChange("emailReminders", e.target.checked)}
                        />
                        <span>Email reminders</span>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <input
                          type="checkbox"
                          checked={!!form.notifications?.smsReminders}
                          onChange={(e) => onNotificationsChange("smsReminders", e.target.checked)}
                        />
                        <span>SMS reminders</span>
                      </label>
                      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                        <button onClick={saveSection} disabled={saving}>
                          {saving ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={() => {
                            setEditingSection(null);
                            setForm({});
                          }}
                          disabled={saving}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Connected Providers */}
              <div style={{ border: "1px solid #eee", padding: 16, borderRadius: 8, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>Connected Providers</strong>
                  <button onClick={() => navigate("/account/providers")}>Manage</button>
                </div>
                <div style={{ marginTop: 10 }}>
                  {displayUser.connectedProviders && displayUser.connectedProviders.length > 0 ? (
                    <ul style={{ paddingLeft: 18, margin: 0 }}>
                      {displayUser.connectedProviders.map((p) => (
                        <li key={p.id} style={{ marginBottom: 6 }}>
                          {p.name}
                          {p.specialty ? ` — ${p.specialty}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ margin: 0 }}>No providers connected.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Right column */}
            <aside>
              <h2>Security & privacy</h2>
              <div style={{ border: "1px solid #eee", padding: 16, borderRadius: 8, marginBottom: 12 }}>
                <p style={{ margin: "6px 0" }}>
                  <strong>Two-factor authentication:</strong>{" "}
                  {displayUser.twoFactorEnabled ? "Enabled" : "Disabled"}
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={toggleTwoFactor} disabled={saving}>
                    {displayUser.twoFactorEnabled ? "Disable 2FA" : "Enable 2FA"}
                  </button>
                  <button onClick={() => navigate("/account/change-password")}>
                    Reset password
                  </button>
                </div>
              </div>

              <div style={{ border: "1px solid #eee", padding: 16, borderRadius: 8, marginBottom: 12 }}>
                <p style={{ margin: "6px 0" }}>
                  <strong>Data sharing consent:</strong>{" "}
                  {displayUser.dataSharingConsent ? "Allowed" : "Not allowed"}
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={() => toggleDataSharing(true)} disabled={saving}>
                    Allow
                  </button>
                  <button onClick={() => toggleDataSharing(false)} disabled={saving}>
                    Revoke
                  </button>
                </div>
              </div>

              <div style={{ border: "1px solid #eee", padding: 16, borderRadius: 8 }}>
                <h3 style={{ marginTop: 0 }}>Support</h3>
                <p style={{ margin: "6px 0" }}>Need help? Visit our FAQ or contact support.</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={goHelp}>Help & support</button>
                  <button onClick={() => navigate("/account/activity")}>Activity</button>
                </div>
              </div>

              <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
                <button onClick={signOut} style={{ background: "#d33", color: "#fff" }}>
                  Logout
                </button>
              </div>
            </aside>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Account;
