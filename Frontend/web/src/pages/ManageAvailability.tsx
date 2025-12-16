import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../config/api';
import Sidebar from '../components/Sidebar';
import NotificationIcon from '../components/NotificationIcon';
import './ManageAvailability.css';
import './Home.css';

interface Slot {
  availability_id: number;
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
}

interface DateGroupedSlots {
  date: string;
  slots: Slot[];
}

const ManageAvailability: React.FC = () => {
  const auth = useAuth(); // Keep auth context active
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [loadingDoctorId, setLoadingDoctorId] = useState(true);

  // Wait for auth to load before fetching doctor ID
  useEffect(() => {
    if (!auth.isLoading && auth.isAuthenticated) {
      loadDoctorId();
    } else if (!auth.isLoading && !auth.isAuthenticated) {
      setError('Please log in to access this page.');
      setLoadingDoctorId(false);
    }
  }, [auth.isLoading, auth.isAuthenticated]);

  // Filter states for Show Slots
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [showDayDropdown, setShowDayDropdown] = useState(false);
  
  // Add Slots Modal states
  const [showAddSlotsModal, setShowAddSlotsModal] = useState(false);
  const [addFromDate, setAddFromDate] = useState<string>('');
  const [addToDate, setAddToDate] = useState<string>('');
  const [addSelectedDays, setAddSelectedDays] = useState<string[]>([]);
  const [showAddDayDropdown, setShowAddDayDropdown] = useState(false);
  const [slotDuration, setSlotDuration] = useState<number>(30);
  const [fromTime, setFromTime] = useState<string>('09:00');
  const [toTime, setToTime] = useState<string>('17:00');

  // Displayed slots (grouped by date)
  const [groupedSlots, setGroupedSlots] = useState<DateGroupedSlots[]>([]);
  const [showSlots, setShowSlots] = useState(false);

  // loadDoctorId function is defined below

  const loadDoctorId = async () => {
    try {
      setLoadingDoctorId(true);
      setError(null);
      
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      
      if (!token) {
        setError('No authentication token found. Please log in again.');
        setLoadingDoctorId(false);
        return;
      }
      
      // Use the correct endpoint: /api/auth/me which returns doctor_id
      const response = await fetch(apiUrl('auth/me'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.doctor_id) {
          setDoctorId(data.doctor_id);
          setError(null);
        } else {
          console.warn('Doctor ID not found in response:', data);
          setError('Doctor profile not found. Please complete your doctor profile first.');
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Error loading doctor ID:', errorData);
        
        if (response.status === 404) {
          setError('Doctor profile not found. Please complete your doctor profile first.');
        } else if (response.status === 401) {
          setError('Authentication failed. Please log in again.');
        } else {
          setError(errorData.error || 'Failed to load doctor information.');
        }
      }
    } catch (err: any) {
      console.error('Error loading doctor ID:', err);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoadingDoctorId(false);
    }
  };

  // Convert day name to ISO 8601 day of week (Monday=1, Tuesday=2, ..., Sunday=7)
  const getDayOfWeekNumber = (day: string): number => {
    const days: Record<string, number> = {
      monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
      friday: 5, saturday: 6, sunday: 7
    };
    return days[day.toLowerCase()];
  };

  // Convert JavaScript getDay() (Sunday=0, Monday=1, ..., Saturday=6) to ISO (Monday=1, ..., Sunday=7)
  const jsDayToIso = (jsDay: number): number => {
    return jsDay === 0 ? 7 : jsDay;
  };

  // Convert ISO day (Monday=1, ..., Sunday=7) to JavaScript getDay() (Sunday=0, Monday=1, ..., Saturday=6)
  const isoDayToJs = (isoDay: number): number => {
    return isoDay === 7 ? 0 : isoDay;
  };

  // Get day of week from a date string (YYYY-MM-DD) without timezone issues
  const getDayOfWeekFromDateString = (dateStr: string): number => {
    // Parse date string as local date to avoid timezone issues
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed in JS
    return date.getDay(); // Returns 0 (Sunday) to 6 (Saturday)
  };

  const getDatesForDayInRange = (fromDate: string, toDate: string, isoDayOfWeek: number): string[] => {
    const dates: string[] = [];
    
    // Parse dates as local dates to avoid timezone issues
    const [startYear, startMonth, startDay] = fromDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = toDate.split('-').map(Number);
    
    const start = new Date(startYear, startMonth - 1, startDay); // month is 0-indexed
    const end = new Date(endYear, endMonth - 1, endDay);
    
    // Convert ISO day to JavaScript day for comparison
    const jsDayOfWeek = isoDayToJs(isoDayOfWeek);
    
    // Find first occurrence of the day
    while (start.getDay() !== jsDayOfWeek && start <= end) {
      start.setDate(start.getDate() + 1);
    }
    
    // Collect all occurrences
    while (start <= end) {
      // Format as YYYY-MM-DD without timezone conversion
      const year = start.getFullYear();
      const month = String(start.getMonth() + 1).padStart(2, '0');
      const day = String(start.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
      start.setDate(start.getDate() + 7); // Next week same day
    }
    
    return dates;
  };

  const handleShowSlots = async () => {
    if (!fromDate || !toDate) {
      setError('Please fill in From Date and To Date');
      return;
    }

    if (new Date(fromDate) > new Date(toDate)) {
      setError('From Date must be before To Date');
      return;
    }

    if (!doctorId) {
      setError('Doctor ID not loaded. Please refresh the page.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      
      // Convert selected days to day of week numbers, or use all days if none selected
      let dayOfWeekParams = '';
      if (selectedDays.length > 0) {
        const dayNumbers = selectedDays.map(day => getDayOfWeekNumber(day));
        dayOfWeekParams = dayNumbers.join(',');
      }

      // Use the new endpoint to fetch slots by date range in a single query
      let url = `${apiUrl('appointments/availability')}/${doctorId}/by-date-range?fromDate=${fromDate}&toDate=${toDate}`;
      if (dayOfWeekParams) {
        url += `&dayOfWeek=${dayOfWeekParams}`;
      }
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch slots');
      }

      const data = await response.json();
      console.log('API Response:', data);
      console.log('Selected days:', selectedDays);
      console.log('Day of week params:', dayOfWeekParams);
      
      const allSlots: Slot[] = [];

      // Get selected day numbers in ISO format (Monday=1, ..., Sunday=7) for filtering
      const selectedDayNumbers = selectedDays.length > 0 
        ? selectedDays.map(day => getDayOfWeekNumber(day))
        : null; // null means show all days

      // Convert to Slot format with date from slot_date
      // Backend returns { count, slots: [...] }
      (data.slots || []).forEach((avail: any) => {
        console.log('Processing availability:', avail);
        
        // Extract date from date field (backend returns 'date' not 'slot_date')
        // IMPORTANT: Use UTC methods to avoid timezone conversion issues
        let slotDateStr = avail.date || avail.slot_date;
        if (!slotDateStr) {
          console.warn('Slot missing date field:', avail);
          return; // Skip slots without date
        }
        
        if (typeof slotDateStr === 'string') {
          // If it's already a date string (YYYY-MM-DD), use it directly
          if (slotDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // Already in correct format, use as-is
          } else if (slotDateStr.includes('T')) {
            slotDateStr = slotDateStr.split('T')[0];
          } else if (slotDateStr.includes(' ')) {
            slotDateStr = slotDateStr.split(' ')[0];
          }
        } else if (slotDateStr instanceof Date) {
          // Use UTC methods to avoid timezone shift
          const year = slotDateStr.getUTCFullYear();
          const month = String(slotDateStr.getUTCMonth() + 1).padStart(2, '0');
          const day = String(slotDateStr.getUTCDate()).padStart(2, '0');
          slotDateStr = `${year}-${month}-${day}`;
        }
        
        // Normalize date format to YYYY-MM-DD
        const normalizedDate = slotDateStr;
        
        // Additional frontend filtering: verify the slot's day_of_week matches selected days
        if (selectedDayNumbers !== null) {
          // Get the actual day of week for this date
          const actualDayOfWeek = jsDayToIso(getDayOfWeekFromDateString(normalizedDate));
          
          // Also check the stored day_of_week from backend
          const storedDayOfWeek = avail.day_of_week;
          
          // Include slot if either the actual date's day or stored day_of_week matches
          const dayMatches = selectedDayNumbers.includes(actualDayOfWeek) || 
                            (storedDayOfWeek && selectedDayNumbers.includes(storedDayOfWeek));
          
          if (!dayMatches) {
            console.log(`Filtering out slot: date=${normalizedDate}, actualDay=${actualDayOfWeek}, storedDay=${storedDayOfWeek}, selected=${selectedDayNumbers}`);
            return; // Skip this slot - doesn't match selected days
          }
        }
        
        // Process all slots (backend returns date field, not slot_date)
        // Calculate duration from start and end time
        const start = new Date(`2000-01-01T${avail.start_time}`);
        const end = new Date(`2000-01-01T${avail.end_time}`);
        const durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
        
        allSlots.push({
          availability_id: avail.availability_id,
          date: normalizedDate,
          start_time: avail.start_time,
          end_time: avail.end_time,
          duration_minutes: durationMinutes || 30
        });
      });

      console.log('All slots processed:', allSlots);

      // Group slots by date - use all dates from the response, not just the calculated dates
      const dateMap = new Map<string, Slot[]>();
      
      allSlots.forEach(slot => {
        if (!dateMap.has(slot.date)) {
          dateMap.set(slot.date, []);
        }
        dateMap.get(slot.date)!.push(slot);
      });
      
      // Convert map to array and sort by date
      const grouped: DateGroupedSlots[] = Array.from(dateMap.entries())
        .map(([date, slots]) => ({ date, slots }))
        .sort((a, b) => a.date.localeCompare(b.date));
      
      console.log('Grouped slots:', grouped);

      setGroupedSlots(grouped);
      setShowSlots(true);
      setSuccess(`Found ${allSlots.length} slot(s) across ${grouped.length} date(s)`);
    } catch (err: any) {
      setError(err.message || 'Failed to load slots');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSlots = async () => {
    if (!addFromDate || !addToDate || !slotDuration) {
      setError('Please fill in From Date, To Date, and Duration');
      return;
    }

    if (new Date(addFromDate) > new Date(addToDate)) {
      setError('From Date must be before To Date');
      return;
    }

    if (!doctorId) {
      setError('Doctor ID not loaded. Please refresh the page.');
      return;
    }

    setGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      
      // Get all days to generate slots for
      // If no days selected, generate for all days of week (ISO: Monday=1, ..., Sunday=7)
      const daysToGenerate = addSelectedDays.length > 0 
        ? addSelectedDays.map(day => getDayOfWeekNumber(day))
        : [1, 2, 3, 4, 5, 6, 7]; // All days if none selected (Monday=1, Tuesday=2, ..., Sunday=7)
      
      // Get all dates for all selected days (or all days)
      const allDates: string[] = [];
      daysToGenerate.forEach(dayOfWeek => {
        const dates = getDatesForDayInRange(addFromDate, addToDate, dayOfWeek);
        allDates.push(...dates);
      });
      
      // Remove duplicates and sort
      const uniqueDates = Array.from(new Set(allDates)).sort();

      // Generate time slots based on fromTime, toTime, and duration
      const [fromHour, fromMin] = fromTime.split(':').map(Number);
      const [toHour, toMin] = toTime.split(':').map(Number);
      
      const fromMinutes = fromHour * 60 + fromMin;
      const toMinutes = toHour * 60 + toMin;
      
      const generatedSlots: Array<{ fromTime: string; toTime: string; duration: number }> = [];
      
      for (let current = fromMinutes; current + slotDuration <= toMinutes; current += slotDuration) {
        const startHour = Math.floor(current / 60);
        const startMin = current % 60;
        const endHour = Math.floor((current + slotDuration) / 60);
        const endMin = (current + slotDuration) % 60;
        
        generatedSlots.push({
          fromTime: `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00`,
          toTime: `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00`,
          duration: slotDuration
        });
      }

      // Save slots for each date
      let totalSaved = 0;
      const errors: string[] = [];
      
      for (const date of uniqueDates) {
        try {
          // Get the day of week for this date (convert from JS format to ISO format)
          // Use local date parsing to avoid timezone issues
          const jsDay = getDayOfWeekFromDateString(date); // JavaScript: Sunday=0, Monday=1, ..., Saturday=6
          const dayOfWeekForDate = jsDayToIso(jsDay); // ISO: Monday=1, Tuesday=2, ..., Sunday=7
          
          const response = await fetch(
            `${apiUrl('appointments/availability')}/${doctorId}/save-slots-for-date`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                date: date,
                day_of_week: dayOfWeekForDate,
                slots: generatedSlots
              })
            }
          );

          if (response.ok) {
            const responseData = await response.json();
            totalSaved += responseData.saved || generatedSlots.length;
            if (responseData.errors && responseData.errors.length > 0) {
              errors.push(...responseData.errors.map((e: string) => `${date}: ${e}`));
            }
          } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            const errorMsg = `Failed to save slots for ${date}: ${errorData.error || 'Unknown error'}`;
            errors.push(errorMsg);
            console.error(errorMsg, errorData);
          }
        } catch (err: any) {
          const errorMsg = `Error saving slots for ${date}: ${err.message || 'Network error'}`;
          errors.push(errorMsg);
          console.error(errorMsg, err);
        }
      }

      if (errors.length > 0 && totalSaved === 0) {
        setError(`Failed to create slots. Errors: ${errors.join('; ')}`);
      } else if (errors.length > 0) {
        setSuccess(`Successfully created ${totalSaved} slot(s) across ${uniqueDates.length} date(s), but some errors occurred.`);
        setError(`Some errors: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`);
      }

      if (totalSaved > 0 && errors.length === 0) {
        setSuccess(`Successfully created ${totalSaved} slot(s) across ${uniqueDates.length} date(s)!`);
      }
      
      // Close modal and clear form
      setShowAddSlotsModal(false);
      setAddFromDate('');
      setAddToDate('');
      setAddSelectedDays([]);
      setSlotDuration(30);
      setFromTime('09:00');
      setToTime('17:00');
      
      // Refresh displayed slots if filters are set
      if (showSlots && fromDate && toDate) {
        handleShowSlots();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate slots');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteSlot = async (availabilityId: number, date: string) => {
    if (!window.confirm(`Are you sure you want to delete this slot for ${new Date(date).toLocaleDateString()}?`)) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      
      const response = await fetch(
        `${apiUrl('appointments/availability')}/${doctorId}/slots?availability_id=${availabilityId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete slot');
      }

      setSuccess('Slot deleted successfully!');
      
      // Refresh displayed slots
      if (showSlots) {
        handleShowSlots();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete slot');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (time: string): string => {
    // Handle different time formats
    if (time.includes('T')) {
      time = time.split('T')[1];
    }
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDate = (dateString: string): string => {
    // Parse date string as UTC to avoid timezone conversion issues
    // dateString should be in YYYY-MM-DD format
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC' // Use UTC to prevent timezone shift
    });
  };

  // Show loading state while auth is loading or fetching doctor ID
  if (auth.isLoading || loadingDoctorId) {
    return (
      <div className="dashboard-container">
        <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <div className={`main-content ${sidebarCollapsed ? 'expanded' : ''}`}>
          <header className="header">
            <div className="header-left">
              <h1 className="brand-title">MediConnect - Manage Availability</h1>
            </div>
            <div className="header-right">
              <div className="user-menu">
                <NotificationIcon />
                <span className="user-name">{auth.user?.name || auth.user?.email}</span>
                <button onClick={auth.logout} className="logout-btn">Logout</button>
              </div>
            </div>
          </header>
          <div className="dashboard-content" style={{ padding: '2rem', maxWidth: '100%' }}>
            <h1>Manage my Availability</h1>
            <p>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <div className={`main-content ${sidebarCollapsed ? 'expanded' : ''}`}>
        {/* Top Header/Navbar */}
        <header className="header">
          <div className="header-left">
            <h1 className="brand-title">MediConnect - Manage Availability</h1>
          </div>
          <div className="header-right">
            <div className="user-menu">
              <NotificationIcon />
              <span className="user-name">{auth.user?.name || auth.user?.email}</span>
              <button onClick={auth.logout} className="logout-btn">Logout</button>
            </div>
          </div>
        </header>

        <div className="dashboard-content" style={{ padding: '2rem', maxWidth: '100%' }}>
          <h1>Manage my Availability</h1>
          <p>View and manage your availability slots by date range and day of week.</p>

          {error && (
            <div style={{ 
              padding: '1rem', 
              backgroundColor: '#fee2e2', 
              color: '#991b1b', 
              borderRadius: '8px',
              marginBottom: '1rem'
            }}>
              {error}
              {error.includes('Doctor profile not found') && (
                <div style={{ marginTop: '0.5rem' }}>
                  <a 
                    href="/onboarding" 
                    style={{ 
                      color: '#991b1b', 
                      textDecoration: 'underline',
                      fontWeight: 'bold'
                    }}
                  >
                    Complete your doctor profile here
                  </a>
                </div>
              )}
              {error.includes('Authentication failed') && (
                <div style={{ marginTop: '0.5rem' }}>
                  <a 
                    href="/login" 
                    style={{ 
                      color: '#991b1b', 
                      textDecoration: 'underline',
                      fontWeight: 'bold'
                    }}
                  >
                    Log in again
                  </a>
                </div>
              )}
            </div>
          )}

          {!doctorId && !loadingDoctorId && (
            <div style={{ 
              padding: '1rem', 
              backgroundColor: '#fef3c7', 
              color: '#92400e', 
              borderRadius: '8px',
              marginBottom: '1rem'
            }}>
              Unable to load doctor information. Please refresh the page or contact support.
            </div>
          )}

          {success && (
            <div style={{ 
              padding: '1rem', 
              backgroundColor: '#d1fae5', 
              color: '#065f46', 
              borderRadius: '8px',
              marginBottom: '1rem'
            }}>
              {success}
            </div>
          )}

          {/* Filters Section */}
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            marginTop: '2rem',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'flex-end',
            gap: '1.5rem',
            flexWrap: 'wrap'
          }}>
            <div style={{ flex: '1', minWidth: '180px' }}>
              <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: '500', fontSize: '1rem' }}>
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                onClick={(e) => {
                  const input = e.currentTarget;
                  if (input.showPicker && typeof input.showPicker === 'function') {
                    try {
                      input.showPicker();
                    } catch (err) {
                      input.focus();
                    }
                  } else {
                    input.focus();
                  }
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              />
            </div>

            <div style={{ flex: '1', minWidth: '180px' }}>
              <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: '500', fontSize: '1rem' }}>
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                onClick={(e) => {
                  const input = e.currentTarget;
                  if (input.showPicker && typeof input.showPicker === 'function') {
                    try {
                      input.showPicker();
                    } catch (err) {
                      input.focus();
                    }
                  } else {
                    input.focus();
                  }
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              />
            </div>

            <div style={{ flex: '1', minWidth: '200px', position: 'relative' }}>
              <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: '500', fontSize: '1rem' }}>
                Day
              </label>
              <div style={{ position: 'relative' }}>
                <div
                  onClick={() => setShowDayDropdown(!showDayDropdown)}
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: '48px',
                    transition: 'border-color 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#9ca3af';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#d1d5db';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, flexWrap: 'wrap' }}>
                    {selectedDays.length === 0 ? (
                      <span style={{ color: '#9ca3af' }}>Select days</span>
                    ) : (
                      <span style={{
                        backgroundColor: '#374151',
                        color: 'white',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.875rem',
                        fontWeight: '500'
                      }}>
                        {selectedDays.length} x
                      </span>
                    )}
                  </div>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    style={{
                      transform: showDayDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                      flexShrink: 0
                    }}
                  >
                    <path
                      d="M4 6L8 10L12 6"
                      stroke="#6b7280"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                
                {showDayDropdown && (
                  <>
                    <div
                      style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 999
                      }}
                      onClick={() => setShowDayDropdown(false)}
                    />
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '0.25rem',
                      backgroundColor: 'white',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                      zIndex: 1000,
                      maxHeight: '240px',
                      overflowY: 'auto'
                    }}>
                      {(() => {
                        const dayLabels: Record<string, string> = {
                          monday: 'Monday',
                          tuesday: 'Tuesday',
                          wednesday: 'Wednesday',
                          thursday: 'Thursday',
                          friday: 'Friday',
                          saturday: 'Saturday',
                          sunday: 'Sunday'
                        };
                        const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                        const allSelected = selectedDays.length === allDays.length;
                        const someSelected = selectedDays.length > 0 && selectedDays.length < allDays.length;
                        
                        // Sort: selected first, then unselected
                        const sortedDays = [...allDays].sort((a, b) => {
                          const aSelected = selectedDays.includes(a);
                          const bSelected = selectedDays.includes(b);
                          if (aSelected && !bSelected) return -1;
                          if (!aSelected && bSelected) return 1;
                          return 0;
                        });
                        
                        return (
                          <>
                            <label
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '0.75rem',
                                cursor: 'pointer',
                                borderBottom: '1px solid #e5e7eb',
                                backgroundColor: '#f9fafb'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                            >
                              <input
                                type="checkbox"
                                checked={allSelected}
                                ref={(input) => {
                                  if (input) input.indeterminate = someSelected;
                                }}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedDays([...allDays]);
                                  } else {
                                    setSelectedDays([]);
                                  }
                                }}
                                style={{
                                  marginRight: '0.75rem',
                                  width: '18px',
                                  height: '18px',
                                  cursor: 'pointer',
                                  accentColor: '#667eea'
                                }}
                              />
                              <span style={{ fontSize: '0.9375rem', fontWeight: '500', color: '#374151' }}>
                                Select All
                              </span>
                            </label>
                            {sortedDays.map((day) => {
                              const isSelected = selectedDays.includes(day);
                              return (
                                <label
                                  key={day}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '0.75rem',
                                    cursor: 'pointer',
                                    backgroundColor: isSelected ? '#eff6ff' : 'white',
                                    transition: 'background-color 0.15s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isSelected) {
                                      e.currentTarget.style.backgroundColor = '#f9fafb';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isSelected) {
                                      e.currentTarget.style.backgroundColor = 'white';
                                    }
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedDays([...selectedDays, day]);
                                      } else {
                                        setSelectedDays(selectedDays.filter(d => d !== day));
                                      }
                                    }}
                                    style={{
                                      marginRight: '0.75rem',
                                      width: '18px',
                                      height: '18px',
                                      cursor: 'pointer',
                                      accentColor: '#667eea'
                                    }}
                                  />
                                  <span style={{ fontSize: '0.9375rem', color: isSelected ? '#1e40af' : '#374151' }}>
                                    {dayLabels[day]}
                                  </span>
                                </label>
                              );
                            })}
                          </>
                        );
                      })()}
                    </div>
                  </>
                )}
              </div>

            </div>

            <button
              onClick={handleShowSlots}
              disabled={loading || !fromDate || !toDate}
              style={{
                padding: '0.875rem 2.5rem',
                fontSize: '1rem',
                fontWeight: '500',
                backgroundColor: loading || !fromDate || !toDate ? '#9ca3af' : '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading || !fromDate || !toDate ? 'not-allowed' : 'pointer',
                opacity: loading || !fromDate || !toDate ? 0.6 : 1,
                whiteSpace: 'nowrap',
                minWidth: '140px'
              }}
            >
              {loading ? 'Loading...' : 'Show Slots'}
            </button>

            <button
              onClick={() => setShowAddSlotsModal(true)}
              style={{
                padding: '0.875rem 2.5rem',
                fontSize: '1rem',
                fontWeight: '500',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                minWidth: '140px'
              }}
            >
              Add Slots
            </button>
          </div>

          {/* Display Slots Section */}
          {showSlots && groupedSlots.length > 0 && (
            <div style={{
              backgroundColor: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h2 style={{ marginBottom: '1rem' }}>Available Slots</h2>
              
              {groupedSlots.map((group) => (
                <div key={group.date} style={{ marginBottom: '2rem' }}>
                  <h3 style={{ 
                    marginBottom: '1rem', 
                    paddingBottom: '0.5rem',
                    borderBottom: '2px solid #e5e7eb'
                  }}>
                    {formatDate(group.date)}
                  </h3>
                  
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      marginBottom: '1rem'
                    }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f9fafb' }}>
                          <th style={{ 
                            padding: '0.75rem', 
                            textAlign: 'left', 
                            borderBottom: '2px solid #e5e7eb',
                            fontWeight: '600'
                          }}>
                            Start Time
                          </th>
                          <th style={{ 
                            padding: '0.75rem', 
                            textAlign: 'left', 
                            borderBottom: '2px solid #e5e7eb',
                            fontWeight: '600'
                          }}>
                            End Time
                          </th>
                          <th style={{ 
                            padding: '0.75rem', 
                            textAlign: 'left', 
                            borderBottom: '2px solid #e5e7eb',
                            fontWeight: '600'
                          }}>
                            Duration
                          </th>
                          <th style={{ 
                            padding: '0.75rem', 
                            textAlign: 'left', 
                            borderBottom: '2px solid #e5e7eb',
                            fontWeight: '600'
                          }}>
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.slots.map((slot) => (
                          <tr key={slot.availability_id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '0.75rem' }}>
                              {formatTime(slot.start_time)}
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                              {formatTime(slot.end_time)}
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                              {slot.duration_minutes} minutes
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                              <button
                                onClick={() => handleDeleteSlot(slot.availability_id, group.date)}
                                disabled={loading}
                                style={{
                                  padding: '0.5rem 1rem',
                                  fontSize: '0.875rem',
                                  backgroundColor: '#fee2e2',
                                  color: '#991b1b',
                                  border: '1px solid #fecaca',
                                  borderRadius: '4px',
                                  cursor: loading ? 'not-allowed' : 'pointer',
                                  opacity: loading ? 0.6 : 1
                                }}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showSlots && groupedSlots.length === 0 && (
            <div style={{
              backgroundColor: 'white',
              padding: '2rem',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              textAlign: 'center',
              color: '#6b7280'
            }}>
              No slots found for the selected criteria.
            </div>
          )}

          {/* Add Slots Modal */}
          {showAddSlotsModal && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }} onClick={() => setShowAddSlotsModal(false)}>
              <div style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                padding: '2rem',
                maxWidth: '600px',
                width: '90%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
              }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ margin: 0 }}>Add Slots</h2>
                  <button
                    onClick={() => setShowAddSlotsModal(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '1.5rem',
                      cursor: 'pointer',
                      color: '#6b7280',
                      padding: '0.25rem 0.5rem'
                    }}
                  >
                    ×
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                      From Date *
                    </label>
                    <input
                      type="date"
                      value={addFromDate}
                      onChange={(e) => setAddFromDate(e.target.value)}
                      onClick={(e) => {
                        const input = e.currentTarget;
                        if (input.showPicker && typeof input.showPicker === 'function') {
                          try {
                            input.showPicker();
                          } catch (err) {
                            input.focus();
                          }
                        } else {
                          input.focus();
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '1rem',
                        cursor: 'pointer'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                      To Date *
                    </label>
                    <input
                      type="date"
                      value={addToDate}
                      onChange={(e) => setAddToDate(e.target.value)}
                      onClick={(e) => {
                        const input = e.currentTarget;
                        if (input.showPicker && typeof input.showPicker === 'function') {
                          try {
                            input.showPicker();
                          } catch (err) {
                            input.focus();
                          }
                        } else {
                          input.focus();
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '1rem',
                        cursor: 'pointer'
                      }}
                    />
                  </div>

                  <div style={{ position: 'relative' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                      Day *
                    </label>
                    <div style={{ position: 'relative' }}>
                      <div
                        onClick={() => setShowAddDayDropdown(!showAddDayDropdown)}
                        style={{
                          width: '100%',
                          padding: '0.875rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '1rem',
                          backgroundColor: 'white',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          minHeight: '48px',
                          transition: 'border-color 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#9ca3af';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#d1d5db';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, flexWrap: 'wrap' }}>
                          {addSelectedDays.length === 0 ? (
                            <span style={{ color: '#9ca3af' }}>Select days</span>
                          ) : (
                            <span style={{
                              backgroundColor: '#374151',
                              color: 'white',
                              padding: '0.25rem 0.75rem',
                              borderRadius: '9999px',
                              fontSize: '0.875rem',
                              fontWeight: '500'
                            }}>
                              {addSelectedDays.length} x
                            </span>
                          )}
                        </div>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          style={{
                            transform: showAddDayDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                            flexShrink: 0
                          }}
                        >
                          <path
                            d="M4 6L8 10L12 6"
                            stroke="#6b7280"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      
                      {showAddDayDropdown && (
                        <>
                          <div
                            style={{
                              position: 'fixed',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              zIndex: 999
                            }}
                            onClick={() => setShowAddDayDropdown(false)}
                          />
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            marginTop: '0.25rem',
                            backgroundColor: 'white',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                            zIndex: 1000,
                            maxHeight: '240px',
                            overflowY: 'auto'
                          }}>
                            {(() => {
                              const dayLabels: Record<string, string> = {
                                monday: 'Monday',
                                tuesday: 'Tuesday',
                                wednesday: 'Wednesday',
                                thursday: 'Thursday',
                                friday: 'Friday',
                                saturday: 'Saturday',
                                sunday: 'Sunday'
                              };
                              const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                              const allSelected = addSelectedDays.length === allDays.length;
                              const someSelected = addSelectedDays.length > 0 && addSelectedDays.length < allDays.length;
                              
                              // Sort: selected first, then unselected
                              const sortedDays = [...allDays].sort((a, b) => {
                                const aSelected = addSelectedDays.includes(a);
                                const bSelected = addSelectedDays.includes(b);
                                if (aSelected && !bSelected) return -1;
                                if (!aSelected && bSelected) return 1;
                                return 0;
                              });
                              
                              return (
                                <>
                                  <label
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      padding: '0.75rem',
                                      cursor: 'pointer',
                                      borderBottom: '1px solid #e5e7eb',
                                      backgroundColor: '#f9fafb'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={allSelected}
                                      ref={(input) => {
                                        if (input) input.indeterminate = someSelected;
                                      }}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setAddSelectedDays([...allDays]);
                                        } else {
                                          setAddSelectedDays([]);
                                        }
                                      }}
                                      style={{
                                        marginRight: '0.75rem',
                                        width: '18px',
                                        height: '18px',
                                        cursor: 'pointer',
                                        accentColor: '#10b981'
                                      }}
                                    />
                                    <span style={{ fontSize: '0.9375rem', fontWeight: '500', color: '#374151' }}>
                                      Select All
                                    </span>
                                  </label>
                                  {sortedDays.map((day) => {
                                    const isSelected = addSelectedDays.includes(day);
                                    return (
                                      <label
                                        key={day}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          padding: '0.75rem',
                                          cursor: 'pointer',
                                          backgroundColor: isSelected ? '#d1fae5' : 'white',
                                          transition: 'background-color 0.15s ease'
                                        }}
                                        onMouseEnter={(e) => {
                                          if (!isSelected) {
                                            e.currentTarget.style.backgroundColor = '#f9fafb';
                                          }
                                        }}
                                        onMouseLeave={(e) => {
                                          if (!isSelected) {
                                            e.currentTarget.style.backgroundColor = 'white';
                                          }
                                        }}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setAddSelectedDays([...addSelectedDays, day]);
                                            } else {
                                              setAddSelectedDays(addSelectedDays.filter(d => d !== day));
                                            }
                                          }}
                                          style={{
                                            marginRight: '0.75rem',
                                            width: '18px',
                                            height: '18px',
                                            cursor: 'pointer',
                                            accentColor: '#10b981'
                                          }}
                                        />
                                        <span style={{ fontSize: '0.9375rem', color: isSelected ? '#065f46' : '#374151' }}>
                                          {dayLabels[day]}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </>
                              );
                            })()}
                          </div>
                        </>
                      )}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem', marginBottom: 0 }}>
                      Leave all unchecked to generate slots for all days
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                        From Time
                      </label>
                      <input
                        type="time"
                        value={fromTime}
                        onChange={(e) => setFromTime(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '1rem'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                        To Time
                      </label>
                      <input
                        type="time"
                        value={toTime}
                        onChange={(e) => setToTime(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '1rem'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                      Duration (minutes) *
                    </label>
                    <input
                      type="number"
                      min="15"
                      max="120"
                      step="15"
                      value={slotDuration}
                      onChange={(e) => setSlotDuration(parseInt(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '1rem'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button
                      onClick={() => {
                        setShowAddSlotsModal(false);
                        setAddFromDate('');
                        setAddToDate('');
                        setSlotDuration(30);
                        setFromTime('09:00');
                        setToTime('17:00');
                      }}
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        fontSize: '1rem',
                        backgroundColor: '#f3f4f6',
                        color: '#374151',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleGenerateSlots}
                      disabled={generating || !addFromDate || !addToDate || !slotDuration}
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        fontSize: '1rem',
                        backgroundColor: generating || !addFromDate || !addToDate || !slotDuration ? '#9ca3af' : '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: generating || !addFromDate || !addToDate || !slotDuration ? 'not-allowed' : 'pointer',
                        opacity: generating || !addFromDate || !addToDate || !slotDuration ? 0.6 : 1
                      }}
                    >
                      {generating ? 'Generating...' : 'Generate Slots'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManageAvailability;

