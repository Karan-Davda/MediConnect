import { useMemo, useState } from "react";
import { useCalendar, makeICS } from "../calendar/useCalendar";

type Props = { patientId: string };

const monthName = (d: Date) =>
  d.toLocaleString(undefined, { month: "long", year: "numeric" });

export default function PatientAppointmentsWidget({ patientId }: Props) {
  const { appointments, upcomingForPatient, cancelAppointment } = useCalendar();
  const [cursor, setCursor] = useState(new Date());

  const appts = upcomingForPatient(patientId);

  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay()); // start Sunday
    return Array.from({ length: 42 }).map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const items = appts.filter(a => a.date === iso);
      return { d, iso, items, otherMonth: d.getMonth() !== cursor.getMonth() };
    });
  }, [cursor, appts]);

  const exportICS = (apptId: string) => {
    const appt = appointments.find(a => a.id === apptId);
    if (!appt) return;
    const blob = new Blob([makeICS(appt)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `appointment-${appt.id}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="widget appointments-widget">
      <div className="widget-header">
        <span className="widget-icon">📅</span>
        <h3 className="widget-title">Appointments</h3>
      </div>

      <div className="widget-content">
        <div className="calendar-section">
          <div className="calendar-header">
            <span className="calendar-nav" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>‹</span>
            <span className="calendar-month">{monthName(cursor)}</span>
            <span className="calendar-nav" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>›</span>
          </div>

          <div className="calendar-grid">
            <div className="calendar-days">
              <span>Su</span><span>Mo</span><span>Tu</span>
              <span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
            </div>
            <div className="calendar-dates">
              {days.map(({ d, iso, items, otherMonth }) => {
                const today = new Date();
                const todayISO = today.toISOString().slice(0, 10);
                const hasAppt = items.length > 0;
                
                // Determine if this date is in the past, today, or future
                let dateState = "";
                if (iso === todayISO) {
                    dateState = "today";
                } else if (new Date(iso) < today) {
                    dateState = "past";
                } else {
                    dateState = "future";
                }
                
                const classNames = 
                 [
                    otherMonth ? "other-month" : "",
                    hasAppt ? "has-appointment" : "",
                    dateState
                  ].join(" ").trim();
                 return (
                         <span
                             key={iso}
                             className={classNames}
                             title={
                                 hasAppt
                                     ? items.map(a => `${a.time} ${a.providerName}`).join(", ")
                                     : ""
                             }
                         >
                             {d.getDate()}
                         </span>
                 );
               })}

           </div>
       </div>
    </div>
             
        <div className="upcoming-appointments">
          <h4>Upcoming Appointments</h4>
          {appts.length === 0 && (
            <div style={{ color: "#718096", fontSize: "0.95rem" }}>
              No upcoming appointments.
            </div>
          )}

          {appts.map(a => (
            <div className="appointment-item" key={a.id}>
              <div className="appointment-date">
                <span className="date-icon">📅</span>
                <span>{new Date(a.date).toLocaleDateString()} {a.time}</span>
              </div>
              <div className="appointment-provider">
                <span className="provider-icon">👤</span>
                <span>{a.providerName}</span>
              </div>
              <div className="appointment-actions">
                <button className="action-btn" onClick={() => window.location.assign(`/book-appointment?mode=reschedule&id=${a.id}`)}>
                  <span className="btn-icon">📅</span> Reschedule
                </button>
                <button className="action-btn" onClick={() => exportICS(a.id)}>
                  <span className="btn-icon">➕</span> Add to Calendar
                </button>
                <button className="action-btn" onClick={() => cancelAppointment(a.id)}>
                  <span className="btn-icon">✕</span> Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
