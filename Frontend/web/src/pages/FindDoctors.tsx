import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { apiUrl } from "../config/api";
import "../pages/Account.css";

type Doctor = {
  id: string;
  doctor_id: number;
  name: string;
  specialty: string;
  location: string;
  clinic: string;
  clinic_id?: number;
  baseFee: number;
  availableDates: string[];
  email?: string;
  phone?: string;
};

const FindDoctors: React.FC = () => {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchSpecialty, setSearchSpecialty] = useState("");
  const [searchLocation, setSearchLocation] = useState("");
  const [searchClinic, setSearchClinic] = useState("");
  const [searchDate, setSearchDate] = useState("");

  // Fetch doctors from database
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        setLoading(true);
        setError(null);
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
        
        // Fetch available dates for each doctor (limit to next 14 days for performance)
        const doctorsWithDates = await Promise.all(
          data.doctors.map(async (doctor: any) => {
            try {
              // Get available dates for next 14 days (reduced from 30 for better performance)
              const today = new Date();
              const futureDate = new Date();
              futureDate.setDate(today.getDate() + 14);
              
              const availableDates: string[] = [];
              
              // Check each day for availability (batch requests with Promise.all for better performance)
              const dateChecks = [];
              for (let d = new Date(today); d <= futureDate; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().split('T')[0];
                dateChecks.push(
                  fetch(
                    `${apiUrl('appointments/available-slots')}/${doctor.doctor_id}?date=${dateStr}&duration=30`,
                    {
                      headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                      }
                    }
                  ).then(async (response) => {
                    if (response.ok) {
                      const slotsData = await response.json();
                      if (slotsData.slots && slotsData.slots.length > 0) {
                        return dateStr;
                      }
                    }
                    return null;
                  }).catch(() => null)
                );
              }
              
              const results = await Promise.all(dateChecks);
              results.forEach((dateStr) => {
                if (dateStr) {
                  availableDates.push(dateStr);
                }
              });
              
              return {
                id: doctor.id || `doctor_${doctor.doctor_id}`,
                doctor_id: doctor.doctor_id,
                name: doctor.name || 'Unknown Doctor',
                specialty: doctor.specialty || 'General Practice',
                location: doctor.location || 'Location not specified',
                clinic: doctor.clinic || 'Not specified',
                clinic_id: doctor.clinic_id,
                baseFee: doctor.fees || 120,
                availableDates: availableDates,
                email: doctor.email,
                phone: doctor.phone
              };
            } catch (err) {
              console.error(`Error fetching dates for doctor ${doctor.doctor_id}:`, err);
              return {
                id: doctor.id || `doctor_${doctor.doctor_id}`,
                doctor_id: doctor.doctor_id,
                name: doctor.name || 'Unknown Doctor',
                specialty: doctor.specialty || 'General Practice',
                location: doctor.location || 'Location not specified',
                clinic: doctor.clinic || 'Not specified',
                clinic_id: doctor.clinic_id,
                baseFee: doctor.fees || 120,
                availableDates: [],
                email: doctor.email,
                phone: doctor.phone
              };
            }
          })
        );

        setDoctors(doctorsWithDates);
      } catch (err: any) {
        console.error('Error fetching doctors:', err);
        setError(err.message || 'Failed to load doctors');
        setDoctors([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDoctors();
  }, []);

  const specialties = Array.from(new Set(doctors.map((d) => d.specialty)));
  const locations = Array.from(new Set(doctors.map((d) => d.location)));
  const clinics = Array.from(new Set(doctors.map((d) => d.clinic)));

  const filteredDoctors = doctors.filter((doctor) => {
    const matchesSpecialty =
      !searchSpecialty || doctor.specialty === searchSpecialty;
    const matchesLocation =
      !searchLocation || doctor.location === searchLocation;
    const matchesClinic = !searchClinic || doctor.clinic === searchClinic;
    const matchesDate =
      !searchDate || doctor.availableDates.includes(searchDate);

    return matchesSpecialty && matchesLocation && matchesClinic && matchesDate;
  });

  const handleClearFilters = () => {
    setSearchSpecialty("");
    setSearchLocation("");
    setSearchClinic("");
    setSearchDate("");
  };

  const handleBookAppointment = (doctorId: string) => {
    navigate("/book-appointment", { state: { doctorId } });
  };

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="dashboard-container">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={toggleSidebar} />

      <div
        className={`main-content ${
          sidebarCollapsed ? "sidebar-collapsed" : ""
        }`}
      >
        <header className="header">
          <div className="header-left">
            <h1 className="brand-title">MediConnect</h1>
          </div>
        </header>

        <div className="dashboard-content">
          <section className="account-section">
            <h2 style={{ marginBottom: "0.5rem" }}>Find a Doctor</h2>
            <p
              style={{
                color: "#4a5568",
                fontSize: "0.95rem",
                lineHeight: 1.4,
              }}
            >
              Search for doctors by specialty, location, clinic, or availability
            </p>
          </section>

          {error && (
            <section className="account-section">
              <div
                style={{
                  backgroundColor: "#fed7d7",
                  color: "#742a2a",
                  borderRadius: "8px",
                  padding: "0.75rem 1rem",
                  fontSize: "0.9rem",
                  fontWeight: 500,
                }}
              >
                {error}
              </div>
            </section>
          )}

          {loading && (
            <section className="account-section">
              <div style={{ padding: "2rem", textAlign: "center", color: "#718096" }}>
                Loading doctors...
              </div>
            </section>
          )}

          <section className="account-section">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "1rem",
              }}
            >
              <div>
                <label htmlFor="specialty-filter">Specialty</label>
                <select
                  id="specialty-filter"
                  value={searchSpecialty}
                  onChange={(e) => setSearchSpecialty(e.target.value)}
                >
                  <option value="">All Specialties</option>
                  {specialties.map((spec) => (
                    <option key={spec} value={spec}>
                      {spec}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="location-filter">Location</label>
                <select
                  id="location-filter"
                  value={searchLocation}
                  onChange={(e) => setSearchLocation(e.target.value)}
                >
                  <option value="">All Locations</option>
                  {locations.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="clinic-filter">Clinic</label>
                <select
                  id="clinic-filter"
                  value={searchClinic}
                  onChange={(e) => setSearchClinic(e.target.value)}
                >
                  <option value="">All Clinics</option>
                  {clinics.map((clinic) => (
                    <option key={clinic} value={clinic}>
                      {clinic}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="date-filter">Available On</label>
                <input
                  id="date-filter"
                  type="date"
                  min={todayStr}
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                />
              </div>
            </div>

            <button
              onClick={handleClearFilters}
              style={{
                backgroundColor: "#a0aec0",
                color: "white",
                border: "none",
                padding: "0.75rem 1.5rem",
                borderRadius: "8px",
                fontSize: "1rem",
                fontWeight: "600",
                marginTop: "1rem",
              }}
            >
              Clear Filters
            </button>
          </section>

          {!loading && (
            <section className="account-section">
              <h3 style={{ marginBottom: "1rem" }}>
                Results ({filteredDoctors.length} doctors found)
              </h3>

              {filteredDoctors.length === 0 ? (
                <p style={{ color: "#718096", fontSize: "0.95rem" }}>
                  {doctors.length === 0 
                    ? "No doctors available at this time."
                    : "No doctors found matching your criteria. Try adjusting your filters."}
                </p>
              ) : (
              <div
                style={{
                  display: "grid",
                  gap: "1rem",
                }}
              >
                {filteredDoctors.map((doctor) => (
                  <div
                    key={doctor.id}
                    style={{
                      backgroundColor: "#f7fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      padding: "1rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        gap: "1rem",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: "200px" }}>
                        <h4
                          style={{
                            fontSize: "1.1rem",
                            marginBottom: "0.5rem",
                            color: "#2d3748",
                          }}
                        >
                          {doctor.name}
                        </h4>
                        <p
                          style={{
                            color: "#4a5568",
                            fontSize: "0.9rem",
                            marginBottom: "0.25rem",
                          }}
                        >
                          <strong>Specialty:</strong> {doctor.specialty}
                        </p>
                        <p
                          style={{
                            color: "#4a5568",
                            fontSize: "0.9rem",
                            marginBottom: "0.25rem",
                          }}
                        >
                          <strong>Clinic:</strong> {doctor.clinic}
                        </p>
                        <p
                          style={{
                            color: "#4a5568",
                            fontSize: "0.9rem",
                            marginBottom: "0.25rem",
                          }}
                        >
                          <strong>Location:</strong> {doctor.location}
                        </p>
                        <p
                          style={{
                            color: "#4a5568",
                            fontSize: "0.9rem",
                          }}
                        >
                          <strong>Base Fee:</strong> ${doctor.baseFee}
                        </p>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.5rem",
                        }}
                      >
                        <button
                          onClick={() => handleBookAppointment(doctor.id)}
                          style={{
                            backgroundColor: "#667eea",
                            color: "white",
                            border: "none",
                            padding: "0.75rem 1.25rem",
                            borderRadius: "8px",
                            fontSize: "0.95rem",
                            fontWeight: "600",
                          }}
                        >
                          Book Appointment
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: "0.75rem",
                        paddingTop: "0.75rem",
                        borderTop: "1px solid #e2e8f0",
                      }}
                    >
                      <p
                        style={{
                          fontSize: "0.85rem",
                          color: "#718096",
                          marginBottom: "0.5rem",
                        }}
                      >
                        Available dates:
                      </p>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "0.5rem",
                        }}
                      >
                        {doctor.availableDates.map((date) => (
                          <span
                            key={date}
                            style={{
                              backgroundColor: "#edf2ff",
                              color: "#4c51bf",
                              padding: "0.25rem 0.5rem",
                              borderRadius: "4px",
                              fontSize: "0.85rem",
                            }}
                          >
                            {date}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default FindDoctors;
