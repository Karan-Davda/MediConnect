// src/pages/Messages.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import "./Account.css"; // reuse dashboard / header / account-section styles

type MessageSender = "patient" | "provider" | "staff";

type Message = {
  id: string;
  from: MessageSender;
  body: string;
  sentAt: string; // ISO
};

type Thread = {
  threadId: string;
  participantName: string; // provider or clinic team
  participantRole: "Provider" | "Clinic staff";
  lastMessageSnippet: string;
  lastUpdated: string; // ISO
  unreadCount: number;
  messages: Message[];
};

// DDD: mock data for now (no backend yet)
const mockThreads: Thread[] = [
  {
    threadId: "thread-1",
    participantName: "Dr. Alice Martin",
    participantRole: "Provider",
    lastMessageSnippet: "Please schedule a follow-up in 3 months.",
    lastUpdated: "2025-10-12T15:10:00Z",
    unreadCount: 1,
    messages: [
      {
        id: "m1",
        from: "provider",
        body: "Your lab results look stable. Please schedule a follow-up in 3 months.",
        sentAt: "2025-10-12T15:10:00Z",
      },
      {
        id: "m2",
        from: "patient",
        body: "Thank you, doctor. Can I do another blood test before then?",
        sentAt: "2025-10-12T15:15:00Z",
      },
    ],
  },
  {
    threadId: "thread-2",
    participantName: "Clinic Scheduling Team",
    participantRole: "Clinic staff",
    lastMessageSnippet: "Your appointment for Nov 5th is confirmed.",
    lastUpdated: "2025-10-10T10:00:00Z",
    unreadCount: 0,
    messages: [
      {
        id: "m3",
        from: "staff",
        body: "Your appointment for Nov 5th at 10:30 AM is confirmed.",
        sentAt: "2025-10-10T10:00:00Z",
      },
      {
        id: "m4",
        from: "patient",
        body: "Perfect, thank you!",
        sentAt: "2025-10-10T10:05:00Z",
      },
    ],
  },
];

const Messages: React.FC = () => {
  const { isAuthenticated, hasRole, user } = useAuth();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [threads, setThreads] = useState<Thread[]>(mockThreads);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    mockThreads[0]?.threadId ?? null
  );
  const [composeText, setComposeText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const toggleSidebar = () => setSidebarCollapsed((s) => !s);

  // ET-In / AUT: Allow all authenticated users to view messages
  const canViewMessages = hasRole(["patient", "admin", "clinic_admin", "doctor", "clinic_staff"]);

  // Get role-specific mock data
  const getRoleSpecificThreads = (): Thread[] => {
    if (hasRole(["admin", "clinic_admin"])) {
      return [
        {
          threadId: "admin-thread-1",
          participantName: "System Administrator",
          participantRole: "Clinic staff",
          lastMessageSnippet: "Billing system maintenance scheduled for tonight at 11 PM.",
          lastUpdated: "2025-11-30T14:30:00Z",
          unreadCount: 1,
          messages: [
            {
              id: "admin-m1",
              from: "staff",
              body: "Billing system maintenance scheduled for tonight at 11 PM. Expected downtime: 2 hours.",
              sentAt: "2025-11-30T14:30:00Z",
            },
          ],
        },
        {
          threadId: "admin-thread-2",
          participantName: "Dr. Johnson",
          participantRole: "Provider",
          lastMessageSnippet: "Need approval for new equipment purchase order.",
          lastUpdated: "2025-11-29T16:45:00Z",
          unreadCount: 0,
          messages: [
            {
              id: "admin-m2",
              from: "provider",
              body: "Need approval for new equipment purchase order - ultrasound machine for $45,000.",
              sentAt: "2025-11-29T16:45:00Z",
            },
            {
              id: "admin-m3",
              from: "staff",
              body: "Please submit the full proposal with vendor quotes for review.",
              sentAt: "2025-11-29T17:00:00Z",
            },
          ],
        },
      ];
    }

    if (hasRole(["doctor", "clinic_staff"])) {
      return [
        {
          threadId: "provider-thread-1",
          participantName: "Jane Doe (Patient)",
          participantRole: "Provider",
          lastMessageSnippet: "Thank you for the follow-up instructions.",
          lastUpdated: "2025-11-30T10:15:00Z",
          unreadCount: 1,
          messages: [
            {
              id: "provider-m1",
              from: "provider",
              body: "Your test results are normal. Continue current medication and follow up in 3 months.",
              sentAt: "2025-11-30T09:30:00Z",
            },
            {
              id: "provider-m2",
              from: "patient",
              body: "Thank you for the follow-up instructions. Should I schedule the next appointment now?",
              sentAt: "2025-11-30T10:15:00Z",
            },
          ],
        },
        {
          threadId: "provider-thread-2",
          participantName: "Clinic Administration",
          participantRole: "Clinic staff",
          lastMessageSnippet: "Schedule update: Room 3 will be unavailable tomorrow.",
          lastUpdated: "2025-11-29T13:20:00Z",
          unreadCount: 0,
          messages: [
            {
              id: "provider-m3",
              from: "staff",
              body: "Schedule update: Room 3 will be unavailable tomorrow due to maintenance. Please use Room 5 for your afternoon appointments.",
              sentAt: "2025-11-29T13:20:00Z",
            },
          ],
        },
      ];
    }

    // Default to patient threads
    return mockThreads;
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    if (!canViewMessages) {
      navigate("/home");
      return;
    }
    
    // Set role-specific threads
    setThreads(getRoleSpecificThreads());
    setSelectedThreadId(getRoleSpecificThreads()[0]?.threadId ?? null);
  }, [isAuthenticated, canViewMessages, navigate]);

  if (!isAuthenticated || !canViewMessages) {
    return (
      <div className="dashboard-container">
        <div className="main-content">
          <div className="dashboard-content">
            <p>Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  const selectedThread = useMemo(
    () => threads.find((t) => t.threadId === selectedThreadId) || null,
    [threads, selectedThreadId]
  );

  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
    // DF-In: selecting a thread drives which messages are rendered
    setThreads((prev) =>
      prev.map((t) =>
        t.threadId === threadId ? { ...t, unreadCount: 0 } : t
      )
    );
  };

  // FV + ExHL + DF-Out: sending a message (mock)
  const handleSend = async () => {
    setError(null);
    setInfo(null);

    const trimmed = composeText.trim();
    if (!trimmed) {
      // FV: cannot send empty message
      setError("Message cannot be empty.");
      return;
    }
    if (trimmed.length > 2000) {
      setError("Message is too long (max 2000 characters).");
      return;
    }
    if (!selectedThread) {
      setError("Select a conversation before sending a message.");
      return;
    }

    setSending(true);
    try {
      const nowIso = new Date().toISOString();
      const newMessage: Message = {
        id: `local-${Date.now()}`,
        from: "patient",
        body: trimmed,
        sentAt: nowIso,
      };

      // DF-Out: this object would normally be POSTed to /api/messages
      console.log("[DF-Out] SEND_MESSAGE_PAYLOAD", {
        threadId: selectedThread.threadId,
        message: newMessage,
        actor: user?.id ?? "local-patient",
      });

      // CN / DDD: local-only update (no backend yet)
      setThreads((prev) =>
        prev.map((t) =>
          t.threadId === selectedThread.threadId
            ? {
                ...t,
                messages: [...t.messages, newMessage],
                lastMessageSnippet: trimmed,
                lastUpdated: nowIso,
              }
            : t
        )
      );

      setComposeText("");
      setInfo("Message sent (demo mode – not persisted).");
      setTimeout(() => setInfo(null), 3000);
    } catch (err: any) {
      // ExHL: safe error exposure + logging
      console.error("[MESSAGE_SEND_ERROR]", err);
      setError("We couldn’t send your message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar navigation with entitlements applied */}
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={toggleSidebar} />

      <div className={`main-content ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        {/* Top header (brand only, like Account/Billing) */}
        <header className="header">
          <div className="header-left">
            <h1 className="brand-title">MediConnect</h1>
          </div>
        </header>

        <div className="dashboard-content" style={{ maxWidth: 1200, margin: "0 auto" }}>
          <section className="account-section">
            <h2>Messages</h2>
            <p style={{ color: "#4a5568", marginTop: 4 }}>
              Provides a private, secure channel for messaging with your doctors and clinic
              staff. For emergencies, call 911 or go to the nearest ER.
            </p>
            <p style={{ color: "#718096", fontSize: 12, marginTop: 4 }}>
              Messages are encrypted in transit and stored securely. Notifications can be
              controlled in Account &gt; Notifications. {/* DP, NOT */}
            </p>

            {error && (
              <div
                style={{
                  marginTop: 8,
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "#fed7d7",
                  color: "#742a2a",
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}
            {info && (
              <div
                style={{
                  marginTop: 8,
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "#c6f6d5",
                  color: "#22543d",
                  fontSize: 13,
                }}
              >
                {info}
              </div>
            )}

            <div
              style={{
                marginTop: 16,
                display: "grid",
                gap: 16,
                gridTemplateColumns: "minmax(260px, 320px) 1fr",
                alignItems: "stretch",
              }}
            >
              {/* LEFT: conversation list (DF-In for thread selection, ET-In per patient) */}
              <div
                style={{
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  background: "#f7fafc",
                  display: "flex",
                  flexDirection: "column",
                  maxHeight: 480,
                }}
              >
                <div
                  style={{
                    padding: 12,
                    borderBottom: "1px solid #e2e8f0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 14 }}>Conversations</span>
                </div>

                <div
                  style={{
                    flex: 1,
                    overflowY: "auto",
                  }}
                >
                  {threads.map((t) => (
                    <button
                      key={t.threadId}
                      type="button"
                      onClick={() => handleSelectThread(t.threadId)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 12px",
                        border: "none",
                        borderBottom: "1px solid #e2e8f0",
                        backgroundColor:
                          selectedThreadId === t.threadId ? "#ebf8ff" : "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: "999px",
                              background: "#cbd5e0",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 14,
                              fontWeight: 600,
                              color: "#2d3748",
                            }}
                          >
                            {t.participantName
                              .split(" ")
                              .map((p) => p[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>
                              {t.participantName}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: "#4a5568",
                              }}
                            >
                              {t.participantRole}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: "#718096",
                                marginTop: 2,
                                maxWidth: 190,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {t.lastMessageSnippet}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div
                            style={{
                              fontSize: 11,
                              color: "#a0aec0",
                            }}
                          >
                            {new Date(t.lastUpdated).toLocaleDateString()}
                          </div>
                          {t.unreadCount > 0 && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                marginTop: 4,
                                minWidth: 18,
                                height: 18,
                                borderRadius: "999px",
                                background: "#3182ce",
                                color: "#fff",
                                fontSize: 11,
                                fontWeight: 600,
                              }}
                            >
                              {t.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                  {threads.length === 0 && (
                    <p style={{ padding: 12, fontSize: 13, color: "#4a5568" }}>
                      No conversations yet. Your care team will appear here when they send
                      you a message.
                    </p>
                  )}
                </div>
              </div>

              {/* RIGHT: active conversation + composer */}
              <div
                style={{
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  padding: 16,
                  background: "#ffffff",
                  minHeight: 320,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {!selectedThread ? (
                  <p style={{ color: "#4a5568", fontSize: 14 }}>
                    Select a conversation on the left to view and send messages.
                  </p>
                ) : (
                  <>
                    <div
                      style={{
                        marginBottom: 8,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                      }}
                    >
                      <div>
                        <h3
                          style={{
                            margin: 0,
                            fontSize: 16,
                          }}
                        >
                          {selectedThread.participantName}
                        </h3>
                        <p
                          style={{
                            margin: "4px 0 0 0",
                            fontSize: 12,
                            color: "#4a5568",
                          }}
                        >
                          {selectedThread.participantRole} · Secure message thread
                        </p>
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          color: "#a0aec0",
                        }}
                      >
                        Last updated{" "}
                        {new Date(selectedThread.lastUpdated).toLocaleString()}
                      </span>
                    </div>

                    {/* Message history */}
                    <div
                      style={{
                        flex: 1,
                        borderRadius: 8,
                        border: "1px solid #edf2f7",
                        padding: 8,
                        marginBottom: 8,
                        overflowY: "auto",
                        maxHeight: 320,
                        background: "#f7fafc",
                      }}
                    >
                      {selectedThread.messages.map((m) => {
                        const isPatient = m.from === "patient";
                        return (
                          <div
                            key={m.id}
                            style={{
                              display: "flex",
                              justifyContent: isPatient ? "flex-end" : "flex-start",
                              marginBottom: 8,
                            }}
                          >
                            <div
                              style={{
                                maxWidth: "70%",
                                padding: "6px 10px",
                                borderRadius: 12,
                                backgroundColor: isPatient ? "#667eea" : "#e2e8f0",
                                color: isPatient ? "#fff" : "#2d3748",
                                fontSize: 13,
                                whiteSpace: "pre-wrap",
                              }}
                            >
                              <div>{m.body}</div>
                              <div
                                style={{
                                  marginTop: 4,
                                  fontSize: 10,
                                  opacity: 0.8,
                                  textAlign: "right",
                                }}
                              >
                                {new Date(m.sentAt).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {selectedThread.messages.length === 0 && (
                        <p style={{ fontSize: 13, color: "#4a5568" }}>
                          No messages yet. Start the conversation below.
                        </p>
                      )}
                    </div>

                    {/* Composer – DF-In (message body), FV, ExHL */}
                    <div>
                      <textarea
                        value={composeText}
                        onChange={(e) => setComposeText(e.target.value)}
                        rows={3}
                        placeholder="Type your message to your care team…"
                        style={{
                          width: "100%",
                          padding: 8,
                          borderRadius: 8,
                          border: "1px solid #cbd5e0",
                          fontSize: 13,
                          resize: "vertical",
                        }}
                      />
                      <div
                        style={{
                          marginTop: 8,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ fontSize: 11, color: "#718096" }}>
                          Do not use messaging for emergencies. Call your clinic or 911.
                        </span>
                        <button
                          onClick={handleSend}
                          disabled={sending}
                          style={{ minWidth: 110 }}
                        >
                          {sending ? "Sending…" : "Send"}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Messages;
