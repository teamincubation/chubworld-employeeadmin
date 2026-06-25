import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Clock, MapPin, CheckCircle, ShieldAlert, Navigation, Calendar, ArrowLeft, Plus } from 'lucide-react';

export default function ESSClockIn() {
  const { request } = useAuth();
  const navigate = useNavigate();
  
  // Status state
  const [status, setStatus] = useState('not_clocked_in'); 
  const [loading, setLoading] = useState(false);
  const [record, setRecord] = useState(null);
  const [shift, setShift] = useState(null);
  const [holidayName, setHolidayName] = useState('');
  const [warningNotification, setWarningNotification] = useState(false);
  const [workHours, setWorkHours] = useState({ in: '09:30 AM', out: '05:30 PM' });

  // Live IST Clock
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  // GPS coordinates
  const [coords, setCoords] = useState(null);
  const [gpsError, setGpsError] = useState('');
  const [fetchingGps, setFetchingGps] = useState(false);

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
    fetchStatus();
    acquireGPS();
    
    if (window.Notification && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    const updateTime = () => {
      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const ist = new Date(utc + (3600000 * 5.5));
      setTimeStr(ist.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
      setDateStr(ist.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const data = await request('/attendance/status');
      setStatus(data.status);
      setRecord(data.record);
      setShift(data.shift);
      setWorkHours(data.workHours || { in: '09:30 AM', out: '05:30 PM' });
      setWarningNotification(!!data.warningNotification);
      if (data.status === 'holiday') {
        setHolidayName(data.holidayName || 'Scheduled Holiday');
      }
      if (data.warningNotification) {
        triggerWebNotification();
      }
    } catch (err) {
      console.error(err);
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
        setGpsError('GPS permission denied.');
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
      fetchStatus();
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
      fetchStatus();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '0px' }}>
      
      {/* Header section with back button and plus button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <button 
          onClick={() => navigate('/')} 
          style={{ background: 'none', border: 'none', color: '#1A1D20', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600' }}
        >
          <ArrowLeft size={16} /> Back
        </button>
        <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#1A1D20', margin: 0 }}>Shift Details</h2>
        <button 
          onClick={() => alert("Quick notes or correction submissions can be added here.")} 
          style={{ background: '#EEF2F6', border: 'none', color: '#2E62F6', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyCenter: 'center', justifyContent: 'center' }}
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Live System Time */}
      <div className="card m-b-20" style={{
        background: '#FFFFFF',
        textAlign: 'center',
        padding: '24px 20px',
        border: '1px solid #E5E7EB',
        borderRadius: '16px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
        marginBottom: '20px'
      }}>
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#2E62F6' }}>
          Real-Time IST System Clock
        </span>
        <h1 style={{ fontSize: '32px', color: '#1A1D20', fontFamily: 'Outfit', fontWeight: 'bold', margin: '6px 0 2px 0' }}>
          {timeStr || '00:00:00 AM'}
        </h1>
        <p style={{ color: '#6B7280', fontSize: '11px', margin: 0 }}>{dateStr}</p>
      </div>

      {/* Warning alert banner */}
      {warningNotification && (
        <div className="card m-b-20" style={{
          background: 'linear-gradient(135deg, #7F1D1D 0%, #EF4444 100%)',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <ShieldAlert size={18} style={{ color: '#FFFFFF', flexShrink: 0 }} />
          <span style={{ fontSize: '11px', color: '#FFFFFF', lineHeight: '1.4' }}>
            <strong>Warning:</strong> Active session exceeds 8 hours. Please clock out.
          </span>
        </div>
      )}

      {/* Action Center card */}
      <div className="card m-b-20" style={{ textAlign: 'center', padding: '24px', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '16px', color: '#4B5563' }}>Attendance Actions</h3>

        <div style={{ marginBottom: '20px' }}>
          {status === 'not_clocked_in' && (
            <div>
              <button 
                onClick={handleClockIn} 
                className="btn btn-primary"
                style={{
                  width: '140px',
                  height: '140px',
                  borderRadius: '50%',
                  fontSize: '16px',
                  display: 'inline-flex',
                  flexDirection: 'column',
                  gap: '6px',
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: (loading || fetchingGps) ? '#9CA3AF' : '#2E62F6',
                  color: '#FFFFFF',
                  border: 'none',
                  cursor: (loading || fetchingGps) ? 'not-allowed' : 'pointer',
                  opacity: (loading || fetchingGps) ? 0.7 : 1
                }}
                disabled={loading || fetchingGps}
              >
                <Navigation size={22} style={{ transform: 'rotate(45deg)' }} /> Clock In
              </button>
              <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '12px' }}>Click to register your shift start.</p>
            </div>
          )}

          {status === 'clocked_in' && (
            <div>
              <button 
                onClick={handleClockOut} 
                className="btn btn-danger"
                style={{
                  width: '140px',
                  height: '140px',
                  borderRadius: '50%',
                  fontSize: '16px',
                  display: 'inline-flex',
                  flexDirection: 'column',
                  gap: '6px',
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: (loading || fetchingGps) ? '#9CA3AF' : '#EF4444',
                  color: '#FFFFFF',
                  border: 'none',
                  cursor: (loading || fetchingGps) ? 'not-allowed' : 'pointer',
                  opacity: (loading || fetchingGps) ? 0.7 : 1
                }}
                disabled={loading || fetchingGps}
              >
                Clock Out
              </button>
              <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '12px' }}>Click to register your shift end.</p>
            </div>
          )}

          {status === 'clocked_out' && (
            <div style={{
              width: '130px', height: '130px', borderRadius: '50%',
              backgroundColor: '#EFF6FF', color: '#2E62F6',
              display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: '6px', border: '2px dashed #2E62F6', margin: '0 auto'
            }}>
              <CheckCircle size={28} />
              <span style={{ fontSize: '14px', fontWeight: 'bold' }}>COMPLETED</span>
            </div>
          )}

          {status === 'holiday' && (
            <div style={{
              width: '130px', height: '130px', borderRadius: '50%',
              backgroundColor: '#FEF3C7', color: '#D97706',
              display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: '6px', border: '2px dashed #D97706',
              margin: '0 auto'
            }}>
              <Calendar size={28} />
              <span style={{ fontSize: '14px', fontWeight: 'bold' }}>HOLIDAY</span>
            </div>
          )}
        </div>

        {status === 'holiday' && (
          <div style={{ margin: '12px 0', fontSize: '11px', color: '#B45309', backgroundColor: '#FFFBEB', padding: '8px 12px', borderRadius: '8px' }}>
            Today is a scheduled holiday: <strong>{holidayName}</strong>. Clocking is disabled.
          </div>
        )}

        {/* GPS location diagnostics */}
        <div style={{
          backgroundColor: '#F8FAFC', padding: '12px',
          borderRadius: '10px', border: '1px solid #E5E7EB',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', fontSize: '11px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={14} style={{ color: coords ? '#10B981' : '#F59E0B' }} />
            {fetchingGps ? (
              <span>Locating Satellite...</span>
            ) : coords ? (
              <span>GPS verified: {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}</span>
            ) : (
              <span>Bypass Mode Activated</span>
            )}
          </div>
          <button onClick={acquireGPS} className="btn" style={{ padding: '3px 8px', fontSize: '10px', backgroundColor: '#EEF2F6', color: '#2E62F6', border: 'none', borderRadius: '4px' }} disabled={fetchingGps}>
            Refresh GPS
          </button>
        </div>
      </div>

      {/* Timeline Schedule Layout at the bottom */}
      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '14px', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px', marginBottom: '16px', color: '#1A1D20' }}>
          Shift Timeline Schedule
        </h3>
        
        <div className="ess-schedule-timeline">
          
          <div className="ess-schedule-item">
            <div>
              <strong style={{ display: 'block', fontSize: '12px' }}>Clock-In Target</strong>
              <span style={{ color: '#6B7280', fontSize: '11px' }}>Shift Start Boundary</span>
            </div>
            <span className="badge" style={{ backgroundColor: '#EFF6FF', color: '#2E62F6', fontSize: '10px' }}>
              {workHours.in}
            </span>
          </div>

          <div className="ess-schedule-item">
            <div>
              <strong style={{ display: 'block', fontSize: '12px' }}>Clock-Out Target</strong>
              <span style={{ color: '#6B7280', fontSize: '11px' }}>Shift End Boundary</span>
            </div>
            <span className="badge" style={{ backgroundColor: '#ECFDF5', color: '#10B981', fontSize: '10px' }}>
              {workHours.out}
            </span>
          </div>

        </div>
      </div>

    </div>
  );
}
