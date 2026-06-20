import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Clock, MapPin, CheckCircle, ShieldAlert, Navigation } from 'lucide-react';

export default function ESSClockIn() {
  const { request } = useAuth();
  
  // Status state
  const [status, setStatus] = useState('not_clocked_in'); // 'not_clocked_in', 'clocked_in', 'clocked_out'
  const [record, setRecord] = useState(null);
  const [shift, setShift] = useState(null);
  const [loading, setLoading] = useState(true);

  // Live IST Clock
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  // GPS coordinates
  const [coords, setCoords] = useState(null);
  const [gpsError, setGpsError] = useState('');
  const [fetchingGps, setFetchingGps] = useState(false);

  useEffect(() => {
    fetchStatus();
    acquireGPS();
    
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
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const data = await request('/attendance/status');
      setStatus(data.status);
      setRecord(data.record);
      setShift(data.shift);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const acquireGPS = () => {
    if (!navigator.geolocation) {
      return setGpsError('Browser does not support Geolocation API.');
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
        setGpsError('GPS permission denied. Mark as Location Not Verified.');
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
    <div style={{ maxWidth: '650px', margin: '0 auto' }}>
      {/* Time display card */}
      <div className="card m-b-20" style={{
        background: 'linear-gradient(135deg, #42174F 0%, #D85AA6 100%)',
        color: '#FFFFFF',
        border: 'none',
        textAlign: 'center',
        padding: '40px 20px'
      }}>
        <span style={{ fontSize: '13px', fontWeight: 600, opacity: 0.8, letterSpacing: '1px', textTransform: 'uppercase' }}>
          Real-Time IST System Clock
        </span>
        <h1 style={{ fontSize: '56px', color: '#FFFFFF', fontFamily: 'Oswald', margin: '12px 0', letterSpacing: '1px' }}>
          {timeStr || '00:00:00 AM'}
        </h1>
        <p style={{ opacity: 0.9, fontSize: '16px', fontWeight: 500 }}>{dateStr}</p>
      </div>

      {/* Main clock actions */}
      <div className="card m-b-20" style={{ textAlign: 'center', padding: '30px' }}>
        <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Attendance Action Center</h3>

        {/* Big Action buttons */}
        <div style={{ marginBottom: '24px' }}>
          {status === 'not_clocked_in' && (
            <button 
              onClick={handleClockIn} 
              className="btn btn-primary"
              style={{
                width: '180px', height: '180px', borderRadius: '50%',
                fontSize: '22px', fontFamily: 'Oswald', display: 'inline-flex',
                flexDirection: 'column', gap: '8px', boxShadow: '0 10px 25px rgba(216, 90, 166, 0.4)'
              }}
              disabled={loading || fetchingGps}
            >
              <Navigation size={28} /> Clock In
            </button>
          )}

          {status === 'clocked_in' && (
            <button 
              onClick={handleClockOut} 
              className="btn"
              style={{
                width: '180px', height: '180px', borderRadius: '50%',
                fontSize: '22px', fontFamily: 'Oswald', display: 'inline-flex',
                flexDirection: 'column', gap: '8px', background: 'linear-gradient(135deg, #F15BC4 0%, #D85AA6 100%)',
                color: '#FFFFFF', boxShadow: '0 10px 25px rgba(241, 91, 196, 0.4)'
              }}
              disabled={loading || fetchingGps}
            >
              <Navigation size={28} style={{ transform: 'rotate(180deg)' }} /> Clock Out
            </button>
          )}

          {status === 'clocked_out' && (
            <div style={{
              width: '180px', height: '180px', borderRadius: '50%',
              backgroundColor: 'var(--chub-light-lavender)', color: 'var(--chub-purple)',
              display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: '8px', border: '3px dashed var(--chub-purple)'
            }}>
              <CheckCircle size={36} />
              <span style={{ fontSize: '18px', fontFamily: 'Oswald', fontWeight: 'bold' }}>COMPLETED</span>
            </div>
          )}
        </div>

        {/* GPS location diagnostics */}
        <div style={{
          backgroundColor: 'var(--bg-primary)', padding: '16px',
          borderRadius: '12px', border: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <MapPin size={16} style={{ color: coords ? 'var(--color-success)' : 'var(--color-warning)' }} />
            {fetchingGps ? (
              <span>Locating satellite...</span>
            ) : coords ? (
              <span>
                <strong>GPS Status:</strong> Lat {coords.latitude.toFixed(4)}, Lon {coords.longitude.toFixed(4)} (±{Math.round(coords.accuracy)}m)
              </span>
            ) : (
              <span style={{ color: 'var(--color-warning)' }}>Location not shared (Bypass Mode activated)</span>
            )}
          </div>
          <button onClick={acquireGPS} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} disabled={fetchingGps}>
            Refresh GPS
          </button>
        </div>

        <small style={{ display: 'block', marginTop: '16px', color: 'var(--text-muted)' }}>
          * Attendance coordinates are verified against your assigned worksite. 
          Make sure location permissions are enabled.
        </small>
      </div>

      {/* Shift details card */}
      <div className="card">
        <h3 style={{ fontSize: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '16px' }}>
          Assigned Shift Information
        </h3>
        {shift ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '14px' }}>
            <div><strong>Active Shift:</strong> <p>{shift.name}</p></div>
            <div><strong>Allowed Hours:</strong> <p>{shift.start_time} to {shift.end_time}</p></div>
            <div><strong>Grace Allowed:</strong> <p>{shift.grace_period_minutes} Minutes</p></div>
            {record?.clock_in_time && (
              <div><strong>Clocked In Today:</strong> <p>{record.clock_in_time} IST ({record.status})</p></div>
            )}
          </div>
        ) : (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No shift assignment found. Contact HR Manager.</p>
        )}
      </div>

      <div className="alert alert-info" style={{ marginTop: '20px' }}>
        <Clock size={18} />
        <span>Attendance time is recorded using secure server-side IST timestamp.</span>
      </div>
    </div>
  );
}
