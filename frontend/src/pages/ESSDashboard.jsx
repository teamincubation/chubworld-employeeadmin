import React, { useState, useEffect } from 'react';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Clock, Calendar, ShieldCheck, UserCheck, Milestone, User, Download, Smartphone, ShieldAlert, Navigation, ChevronRight, Bell, MapPin } from 'lucide-react';

export default function ESSDashboard() {
  const { request } = useAuth();
  
  // Dashboard details
  const [profile, setProfile] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [monthlyStats, setMonthlyStats] = useState({ present: 0, absent: 0, late: 0 });
  const [workMode, setWorkMode] = useState('Office'); // Home vs Office toggle

  // Live IST Clock
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  // GPS coordinates
  const [coords, setCoords] = useState(null);
  const [gpsError, setGpsError] = useState('');
  const [fetchingGps, setFetchingGps] = useState(false);

  // PWA & Android Installation Banner State
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const triggerWebNotification = () => {
    if (window.Notification) {
      if (Notification.permission === 'granted') {
        new Notification("Urgent Clockout Warning", {
          body: "You have been clocked in for over 8 hours. Please clock out to confirm your working time.",
          tag: "clockout-warning",
          requireInteraction: true
        });
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification("Urgent Clockout Warning", {
              body: "You have been clocked in for over 8 hours. Please clock out to confirm your working time.",
              tag: "clockout-warning",
              requireInteraction: true
            });
          }
        });
      }
    }
  };

  useEffect(() => {
    fetchDashboardData();
    acquireGPS();

    // Request Notification permission on mount
    if (window.Notification && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Live Clock interval
    const updateTime = () => {
      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const ist = new Date(utc + (3600000 * 5.5));
      setTimeStr(ist.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
      setDateStr(ist.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    // Check if user is on Android device
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const isAndroidDevice = /android/i.test(ua);
    const dismissed = localStorage.getItem('chub_ess_pwa_dismissed');

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!dismissed) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isAndroidDevice && !isStandalone && !dismissed) {
      setShowInstallBanner(true);
    }

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const userDetails = await request('/auth/me');
      setProfile(userDetails);

      // Fetch today's clock status
      const attStatus = await request('/attendance/status');
      setAttendance(attStatus);

      if (attStatus && attStatus.warningNotification) {
        triggerWebNotification();
      }

      // Fetch leave balances
      const leaveData = await request('/leaves/my-leaves');
      setLeaves(leaveData.balances);

      // Fetch logs for current month stats
      const logsData = await request('/attendance/my-logs');
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();

      const thisMonthLogs = logsData.filter(log => {
        const d = new Date(log.date);
        const istYear = parseInt(d.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric' }), 10);
        const istMonth = parseInt(d.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', month: 'numeric' }), 10) - 1;
        return istYear === currentYear && istMonth === currentMonth;
      });

      let presentCount = 0;
      let absentCount = 0;
      let lateCount = 0;

      thisMonthLogs.forEach(log => {
        if (log.status === 'Present') presentCount++;
        else if (log.status === 'Late') { presentCount++; lateCount++; }
        else if (log.status === 'Half Day') { presentCount++; }
        else if (log.status === 'Absent') absentCount++;
        else if (log.status === 'Location Not Verified') { presentCount++; }
      });

      setMonthlyStats({ present: presentCount, absent: absentCount, late: lateCount });
    } catch (err) {
      console.error('Error fetching employee dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const acquireGPS = () => {
    if (!navigator.geolocation) {
      return setGpsError('Browser does not support Geolocation.');
    }

    setFetchingGps(true);
    setGpsError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
        setFetchingGps(false);
      },
      (err) => {
        console.warn(err);
        setGpsError('GPS permission denied. Location Not Verified.');
        setFetchingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleClockIn = async () => {
    try {
      setLoading(true);
      const payload = coords ? {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy
      } : {};

      const res = await request('/attendance/clock-in', {
        method: 'POST',
        body: payload
      });

      alert(res.message);
      fetchDashboardData();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    try {
      setLoading(true);
      const payload = coords ? {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy
      } : {};

      const res = await request('/attendance/clock-out', {
        method: 'POST',
        body: payload
      });

      alert(res.message);
      fetchDashboardData();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert("To install: Tap the three dots (menu icon) in your browser and select 'Add to Home screen' or 'Install app'.");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA install prompt outcome: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const handleDismissBanner = () => {
    localStorage.setItem('chub_ess_pwa_dismissed', 'true');
    setShowInstallBanner(false);
  };

  if (loading && !profile) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <p>Loading your dashboard details...</p>
      </div>
    );
  }

  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // distance in meters
  };

  const renderLocationStatus = () => {
    const wl = attendance?.workLocation;
    if (!wl) return 'No Assigned Location Geofence';

    const locationName = wl.name || 'Office Geofence';
    if (fetchingGps) {
      return `${locationName} (Locating GPS...)`;
    }
    if (!coords) {
      return `${locationName} (GPS not acquired)`;
    }

    if (wl.latitude && wl.longitude) {
      const dist = getDistance(coords.latitude, coords.longitude, wl.latitude, wl.longitude);
      const radius = wl.radius_meters || 100;
      if (dist <= radius) {
        return `${locationName} (Inside boundary)`;
      } else {
        const outsideMeters = Math.round(dist - radius);
        if (outsideMeters >= 1000) {
          return `${locationName} (${(outsideMeters / 1000).toFixed(1)} km outside boundary)`;
        } else {
          return `${locationName} (${outsideMeters}m outside boundary)`;
        }
      }
    }
    return locationName;
  };

  const name = profile?.employee?.full_name || profile?.user?.email?.split('@')[0] || '';
  const designation = profile?.employee?.designation_name || 'Team Associate';
  const empId = profile?.employee?.employee_id || 'CHUB-EMP';
  const role = profile?.user?.role || 'Employee';

  const isClockInDisabled = loading || fetchingGps || attendance?.status === 'clocked_in' || attendance?.status === 'clocked_out' || attendance?.status === 'holiday';
  const isClockOutDisabled = loading || fetchingGps || attendance?.status !== 'clocked_in';

  return (
    <div style={{ padding: '0px' }}>
      
      {/* Android/Mobile PWA Recommendation Banner */}
      {showInstallBanner && (
        <div className="card m-b-20" style={{
          background: 'linear-gradient(135deg, #1E50DD 0%, #2E62F6 100%)',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: '16px',
          padding: '16px 20px',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              padding: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF'
            }}>
              <Smartphone size={24} />
            </div>
            <div style={{ flex: 1, paddingRight: '20px' }}>
              <span style={{
                fontSize: '10px',
                textTransform: 'uppercase',
                fontWeight: 700,
                letterSpacing: '0.5px',
                color: 'rgba(255, 255, 255, 0.8)',
                display: 'block',
                marginBottom: '2px'
              }}>
                Android Mobile App Available
              </span>
              <h3 style={{ fontSize: '15px', color: '#FFFFFF', fontWeight: 600, margin: '0 0 4px 0' }}>
                Download C-Hub ESS App
              </h3>
              <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.9)', lineHeight: '1.4', margin: '0 0 12px 0' }}>
                Install to your home screen for quick, reliable daily clock-ins.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={handleInstallClick} 
                  className="btn" 
                  style={{
                    backgroundColor: '#FFFFFF',
                    color: '#2E62F6',
                    padding: '6px 14px',
                    fontSize: '11px',
                    fontWeight: 600,
                    borderRadius: '20px',
                    cursor: 'pointer'
                  }}
                >
                  Install Now
                </button>
                <button 
                  onClick={handleDismissBanner} 
                  className="btn" 
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '6px 14px',
                    fontSize: '11px',
                    borderRadius: '20px',
                    cursor: 'pointer'
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8+ Hours Urgent Warning Alert Banner */}
      {attendance?.warningNotification && (
        <div className="card m-b-20" style={{
          background: 'linear-gradient(135deg, #7F1D1D 0%, #EF4444 100%)',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: '16px',
          padding: '16px 20px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '50%',
              padding: '8px',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <ShieldAlert size={20} />
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <h4 style={{ margin: '0 0 2px 0', color: '#FFFFFF', fontWeight: 'bold', fontSize: '14px', textTransform: 'none' }}>
                Urgent Clock-out Warning
              </h4>
              <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255, 255, 255, 0.9)', lineHeight: '1.4' }}>
                System indicates active clock-in exceeding 8 hours. Please check out to ensure accurate timesheet tracking.
              </p>
            </div>
            <button onClick={handleClockOut} className="btn" style={{
              backgroundColor: '#FFFFFF',
              color: '#EF4444',
              fontWeight: 'bold',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '11px',
              flexShrink: 0
            }}>
              Clock Out
            </button>
          </div>
        </div>
      )}

      {/* Royal Blue Top Header Banner showing Employee welcome */}
      <div className="ess-blue-header-block" style={{ marginTop: '-24px', marginLeft: '-24px', marginRight: '-24px', padding: '24px 24px 30px 24px', borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px', color: '#FFFFFF', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '10px', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>Employee Self-Service Workspace</span>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#FFFFFF', margin: '4px 0 2px 0', textTransform: 'none' }}>Welcome, {name}</h2>
            <span style={{ fontSize: '11px', opacity: 0.9 }}>{designation} • {empId}</span>
          </div>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            border: '2px solid #FFFFFF',
            overflow: 'hidden',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {profile?.employee?.photo_path && (
                <img 
                  src={`${API_BASE_URL.replace('/api', '')}/${profile.employee.photo_path}`}
                  alt={name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )}
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1E50DD 0%, #2E62F6 100%)', color: '#FFFFFF', fontSize: '18px', fontWeight: 'bold' }}>
                {name.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '20px' }}>
        
        {/* Left Column: Today's Action Center Card */}
        <div className="card" style={{ flex: 1.2, minWidth: '300px', display: 'flex', flexDirection: 'column' }}>
          
          {/* Geofence Location Display (replacing Home/Office toggle) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: '#EFF6FF',
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1px solid #BFDBFE',
            marginBottom: '16px'
          }}>
            <MapPin size={18} style={{ color: '#2E62F6', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '10px', color: '#1E40AF', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Assigned Geofence
              </span>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#1E3A8A' }}>
                {renderLocationStatus()}
              </span>
            </div>
          </div>

          {/* Centered Shift tag */}
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <span className="ess-shift-tag">GENERAL SHIFT</span>
          </div>

          {/* Live Clock Display */}
          <div style={{ textAlign: 'center', margin: '8px 0 16px 0' }}>
            <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#1A1D20', margin: 0, fontFamily: 'Outfit' }}>
              {timeStr || '00:00:00 AM'}
            </h1>
            <p style={{ color: '#6B7280', fontSize: '11px', margin: '4px 0 0 0' }}>{dateStr}</p>
          </div>

          {/* Action buttons matching exact requirements (Break button removed) */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', margin: '8px 0 16px 0' }}>
            <button 
              onClick={handleClockIn} 
              className="btn btn-primary"
              disabled={isClockInDisabled}
              style={{
                flex: 1,
                height: '38px',
                borderRadius: '20px',
                fontSize: '11px',
                backgroundColor: isClockInDisabled ? '#9CA3AF' : '#2E62F6',
                color: '#FFFFFF',
                border: 'none',
                cursor: isClockInDisabled ? 'not-allowed' : 'pointer',
                opacity: isClockInDisabled ? 0.7 : 1,
                boxShadow: isClockInDisabled ? 'none' : '0 2px 4px rgba(46, 98, 246, 0.2)'
              }}
            >
              <Navigation size={12} style={{ transform: 'rotate(45deg)' }} /> Clock In
            </button>
            <button 
              onClick={handleClockOut} 
              className="btn btn-danger"
              disabled={isClockOutDisabled}
              style={{
                flex: 1,
                height: '38px',
                borderRadius: '20px',
                fontSize: '11px',
                backgroundColor: isClockOutDisabled ? '#9CA3AF' : '#EF4444',
                color: '#FFFFFF',
                border: 'none',
                cursor: isClockOutDisabled ? 'not-allowed' : 'pointer',
                opacity: isClockOutDisabled ? 0.7 : 1,
                boxShadow: isClockOutDisabled ? 'none' : '0 2px 4px rgba(239, 68, 68, 0.2)'
              }}
            >
              Clock Out
            </button>
          </div>

          {/* Geolocation status diagnostics */}
          <div style={{
            backgroundColor: '#F8FAFC', padding: '10px 12px',
            borderRadius: '10px', border: '1px solid #E2E8F0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', fontSize: '11px', marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4B5563' }}>
              <MapPin size={14} style={{ color: coords ? '#10B981' : '#F59E0B' }} />
              {fetchingGps ? (
                <span>Locating Satellite...</span>
              ) : coords ? (
                <span>GPS verified (±{Math.round(coords.accuracy)}m)</span>
              ) : (
                <span style={{ color: '#B45309' }}>Bypass geofence mode</span>
              )}
            </div>
            <button onClick={acquireGPS} className="btn" style={{ padding: '2px 8px', fontSize: '9px', backgroundColor: '#EEF2F6', border: 'none', color: '#2E62F6', borderRadius: '4px' }} disabled={fetchingGps}>
              Refresh
            </button>
          </div>

          {/* 3-column clocking stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', borderTop: '1px solid #F1F5F9', paddingTop: '16px', marginTop: 'auto', textAlign: 'center' }}>
            <div>
              <span style={{ fontSize: '10px', color: '#6B7280', display: 'block', marginBottom: '2px' }}>Clock In</span>
              <strong style={{ fontSize: '13px', color: '#1A1D20' }}>{attendance?.record?.clock_in_time || '--:--'}</strong>
            </div>
            <div>
              <span style={{ fontSize: '10px', color: '#6B7280', display: 'block', marginBottom: '2px' }}>Clock Out</span>
              <strong style={{ fontSize: '13px', color: '#1A1D20' }}>{attendance?.record?.clock_out_time || '--:--'}</strong>
            </div>
            <div>
              <span style={{ fontSize: '10px', color: '#6B7280', display: 'block', marginBottom: '2px' }}>Working Hrs</span>
              <strong style={{ fontSize: '13px', color: '#1A1D20' }}>{attendance?.record?.total_hours ? `${attendance.record.total_hours} hrs` : '0.0 hrs'}</strong>
            </div>
          </div>

        </div>

        {/* Right Column: Leave Balances & Shortcuts */}
        <div style={{ flex: 1.5, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Leave Balances Card */}
          <div className="card" style={{ flex: 1 }}>
            <h3 style={{ fontSize: '14px', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px', marginBottom: '16px' }}>
              Allocated Leave Balances (CL / SL / EL)
            </h3>

            {leaves.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#6B7280' }}>No leave balance allocated for this session yet.</p>
            ) : (
              <div className="ess-balances-grid" style={{ marginBottom: '0px' }}>
                {leaves.map((bal, idx) => {
                  const available = bal.total_days - bal.availed_days - bal.pending_days;
                  return (
                    <div key={idx} style={{ padding: '12px 10px', backgroundColor: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: '12px', textAlign: 'center' }}>
                      <span style={{ fontSize: '9px', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', display: 'block' }}>
                        {bal.leave_name || bal.leave_code}
                      </span>
                      <h4 style={{ fontSize: '22px', color: '#2E62F6', margin: '4px 0' }}>{available}</h4>
                      <span style={{ fontSize: '9px', color: '#9CA3AF' }}>Available Days</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Month Attendance Card */}
          <div className="card">
            <div className="flex-between" style={{ marginBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#1A1D20', margin: 0 }}>Attendance for this Month</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', backgroundColor: '#EEF2F6', borderRadius: '16px', fontSize: '10px', color: '#4B5563', fontWeight: 'bold' }}>
                <span>{new Date().toLocaleString('en-US', { month: 'short' }).toUpperCase()}</span>
                <Calendar size={11} />
              </div>
            </div>

            <div className="ess-stats-container">
              <div className="ess-stat-box present">
                <span>Present</span>
                <strong>{monthlyStats.present}</strong>
              </div>
              <div className="ess-stat-box absent">
                <span>Absents</span>
                <strong>{monthlyStats.absent}</strong>
              </div>
              <div className="ess-stat-box late">
                <span>Late In</span>
                <strong>{monthlyStats.late}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', borderTop: '1px solid #F1F5F9', paddingTop: '12px' }}>
              <span style={{ color: '#6B7280', fontSize: '11px' }}>Need time off from duty?</span>
              <Link to="/ess/leaves" className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: '10px', borderRadius: '20px' }}>
                + Request
              </Link>
            </div>
          </div>

        </div>

      </div>

      {/* Grid of Shortcuts */}
      <div className="grid-cols-4">
        <Link to="/ess/performance" className="card card-hover" style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: 'inherit', textDecoration: 'none' }}>
          <Milestone size={20} style={{ color: '#2E62F6' }} />
          <strong style={{ fontSize: '12px' }}>Performance & Logs</strong>
          <span style={{ fontSize: '11px', color: '#6B7280' }}>Analyze active hours and view print sheets.</span>
        </Link>
        
        <Link to="/ess/profile" className="card card-hover" style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: 'inherit', textDecoration: 'none' }}>
          <User size={20} style={{ color: '#10B981' }} />
          <strong style={{ fontSize: '12px' }}>My Profile Details</strong>
          <span style={{ fontSize: '11px', color: '#6B7280' }}>View personal details and KYC parameters.</span>
        </Link>

        <Link to="/ess/profile" className="card card-hover" style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: 'inherit', textDecoration: 'none' }}>
          <Clock size={20} style={{ color: '#F59E0B' }} />
          <strong style={{ fontSize: '12px' }}>Change Password</strong>
          <span style={{ fontSize: '11px', color: '#6B7280' }}>Securely update corporate access passwords.</span>
        </Link>
      </div>

    </div>
  );
}
