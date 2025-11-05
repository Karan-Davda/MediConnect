import { useState } from "react";

/** Types */
export type ProviderId = string;
export type ISODate = string;   // "YYYY-MM-DD"
export type Slot = string;      // "HH:mm"

export type Appointment = {
  id: string;
  patientId: string;
  providerId: ProviderId;
  providerName: string;
  date: ISODate;
  time: Slot;
  reason: string;
  status: "REQUESTED" | "CONFIRMED" | "CANCELLED";
};

export type ProviderAvailability = Record<ISODate, Slot[]>;

export type ProviderMeta = {
  id: ProviderId;
  name: string;
  specialty: string;
};

export type ProviderCalendar = {
  provider: ProviderMeta;
  availability: ProviderAvailability; // bookable time inventory
  blocks: Record<ISODate, Slot[]>;    // provider-only blocked slots
};

/** Mock seed (DF-In stand-in) */
const seedProviders: ProviderCalendar[] = [
  {
    provider: { id: "p1", name: "Dr. Alice Martin", specialty: "Primary Care" },
    availability: {
      "2025-10-22": ["09:00", "09:30", "10:00"],
      "2025-10-23": ["14:00", "14:30"],
    },
    blocks: {
      "2025-10-23": ["10:00"],
    },
  },
  {
    provider: { id: "p2", name: "Dr. Brian Patel", specialty: "Cardiology" },
    availability: {
      "2025-10-22": ["10:00", "10:30"],
      "2025-10-24": ["15:00", "15:30", "16:00"],
    },
    blocks: {},
  },
];

const seedAppointments: Appointment[] = [
  {
    id: "appt-555",
    patientId: "patient-123",
    providerId: "p1",
    providerName: "Dr. Alice Martin",
    date: "2025-10-22",
    time: "09:30",
    reason: "Follow-up on bloodwork",
    status: "CONFIRMED",
  },
];

/** Utilities */
const auditLog = (action: string, details: any) =>
  console.log("[AUDIT]", { action, ts: new Date().toISOString(), details });

const byDateAsc = (a: Appointment, b: Appointment) =>
  (a.date + a.time).localeCompare(b.date + b.time);

export function makeICS(appt: Appointment) {
  const datePart = appt.date.replace(/-/g, "");
  const timePart = appt.time.replace(":", "") + "00";
  const start = `${datePart}T${timePart}Z`;
  const endMin = String(Number(timePart.slice(2, 4)) + 30).padStart(2, "0");
  const end = `${datePart}T${timePart.slice(0, 2)}${endMin}00Z`;
  const uid = `${appt.id}@mediconnect`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MediConnect//Appointments//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${start}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:Appointment with ${appt.providerName}`,
    `DESCRIPTION:${appt.reason || "Medical appointment"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/** Hook (simple module-level singletons as faux-global store) */
let _providers = seedProviders;
let _appointments = seedAppointments;

export function useCalendar() {
  const [providers, setProviders] = useState<ProviderCalendar[]>(_providers);
  const [appointments, setAppointments] = useState<Appointment[]>(_appointments);

  const syncProviders = (next: ProviderCalendar[]) => {
    _providers = next;
    setProviders(next);
  };
  const syncAppointments = (next: Appointment[]) => {
    _appointments = next;
    setAppointments(next);
  };

  const getProvider = (providerId: ProviderId) =>
    providers.find(p => p.provider.id === providerId);

  /** DDV/CC: availability = published availability – blocks – not-cancelled appts */
  const getAvailability = (providerId: ProviderId, date: ISODate): Slot[] => {
    const p = getProvider(providerId);
    if (!p) return [];
    const open = new Set(p.availability[date] || []);
    const blocked = new Set(p.blocks[date] || []);
    appointments
      .filter(a => a.providerId === providerId && a.date === date && a.status !== "CANCELLED")
      .forEach(a => open.delete(a.time));
    blocked.forEach(s => open.delete(s));
    return Array.from(open).sort();
  };

  /* Provider actions */
  const addAvailability = (providerId: ProviderId, date: ISODate, slot: Slot) => {
    auditLog("ADD_AVAILABILITY", { providerId, date, slot });
    const next = providers.map(p => {
      if (p.provider.id !== providerId) return p;
      const day = new Set(p.availability[date] || []);
      day.add(slot);
      return { ...p, availability: { ...p.availability, [date]: Array.from(day).sort() } };
    });
    syncProviders(next);
  };

  const removeAvailability = (providerId: ProviderId, date: ISODate, slot: Slot) => {
    auditLog("REMOVE_AVAILABILITY", { providerId, date, slot });
    const next = providers.map(p => {
      if (p.provider.id !== providerId) return p;
      const day = new Set(p.availability[date] || []);
      day.delete(slot);
      return { ...p, availability: { ...p.availability, [date]: Array.from(day).sort() } };
    });
    syncProviders(next);
  };

  const blockTime = (providerId: ProviderId, date: ISODate, slot: Slot) => {
    auditLog("BLOCK_TIME", { providerId, date, slot });
    const next = providers.map(p => {
      if (p.provider.id !== providerId) return p;
      const day = new Set(p.blocks[date] || []);
      day.add(slot);
      return { ...p, blocks: { ...p.blocks, [date]: Array.from(day).sort() } };
    });
    syncProviders(next);
    removeAvailability(providerId, date, slot);
  };

  /* Patient actions */
  const confirmAppointment = (appt: Appointment) => {
    const open = getAvailability(appt.providerId, appt.date);
    if (!open.includes(appt.time)) throw new Error("Slot no longer available.");
    auditLog("CONFIRM_APPOINTMENT", appt);
    const next = [...appointments, { ...appt, status: "CONFIRMED" }].sort(byDateAsc);
    syncAppointments(next);
  };

  const rescheduleAppointment = (apptId: string, newDate: ISODate, newTime: Slot) => {
    const appt = appointments.find(a => a.id === apptId);
    if (!appt) throw new Error("Appointment not found.");
    const open = getAvailability(appt.providerId, newDate);
    if (!open.includes(newTime)) throw new Error("Slot no longer available.");
    auditLog("RESCHEDULE_APPOINTMENT", { apptId, newDate, newTime });
    const next = appointments
      .map(a => (a.id === apptId ? { ...a, date: newDate, time: newTime } : a))
      .sort(byDateAsc);
    syncAppointments(next);
  };

  const cancelAppointment = (apptId: string) => {
    auditLog("CANCEL_APPOINTMENT", { apptId });
    const next = appointments.map(a => (a.id === apptId ? { ...a, status: "CANCELLED" } : a));
    syncAppointments(next);
  };

  const upcomingForPatient = (patientId: string) =>
    appointments.filter(a => a.patientId === patientId && a.status !== "CANCELLED").sort(byDateAsc);

  return {
    providers,
    appointments,
    getProvider,
    getAvailability,
    addAvailability,
    removeAvailability,
    blockTime,
    confirmAppointment,
    rescheduleAppointment,
    cancelAppointment,
    upcomingForPatient,
  };
}
