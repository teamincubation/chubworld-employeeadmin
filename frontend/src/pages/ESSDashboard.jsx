import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Clock, Calendar, ShieldCheck, UserCheck, Milestone, User, Download, Smartphone, ShieldAlert } from 'lucide-react';

export default function ESSDashboard() {
  const { request } = useAuth();
  
  // Dashboard details
  const [profile, setProfile] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

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

    // Request Notification permission on mount
    if (window.Notification && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Check if user is on Android device
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const isAndroidDevice = /android/i.test(ua);
    const dismissed = localStorage.getItem('chub_ess_pwa_dismissed');

    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Show the install banner if not dismissed and user is on Android or for debugging/desktop testing
      if (!dismissed) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Fallback: If it is an Android device and not already in standalone mode,
    // we want to recommend downloading/installing the app even if the beforeinstallprompt hasn't fired yet
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isAndroidDevice && !isStandalone && !dismissed) {
      setShowInstallBanner(true);
    }

    return () => {
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
    } catch (err) {
      console.error('Error fetching employee dashboard metrics:', err);
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

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '85vh' }}>
        <p>Initializing ESS Dashboard...</p>
      </div>
    );
  }

  const name = profile?.employee?.full_name || profile?.user?.email?.split('@')[0] || '';
  const empId = profile?.employee?.employee_id || 'CHUB-EMP';
  const role = profile?.user?.role || 'Employee';

  return (
    <div>
      {/* Android/Mobile PWA Recommendation Banner */}
      {showInstallBanner && (
        <div className="card m-b-20" style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)',
          color: '#FFFFFF',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '24px',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
        }}>
          {/* Background ambient light */}
          <div style={{
            position: 'absolute',
            top: '-50px',
            right: '-50px',
            width: '150px',
            height: '150px',
            background: 'rgba(168, 85, 247, 0.3)',
            filter: 'blur(40px)',
            borderRadius: '50%',
            pointerEvents: 'none'
          }} />

          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#4ADE80' // Android green
            }}>
              <Smartphone size={32} />
            </div>
            <div style={{ flex: 1, paddingRight: '20px' }}>
              <span style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                fontWeight: 700,
                letterSpacing: '1px',
                color: '#4ADE80',
                display: 'block',
                marginBottom: '4px'
              }}>
                Android PWA App Available
              </span>
              <h3 style={{ fontSize: '18px', color: '#FFFFFF', fontWeight: 600, margin: '0 0 8px 0' }}>
                Download C-Hub ESS App
              </h3>
              <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.8)', lineHeight: '1.5', margin: '0 0 16px 0' }}>
                Install the web app to your Android device for a smooth, fast, and native-like check-in & check-out experience every day.
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={handleInstallClick} 
                  className="btn btn-primary" 
                  style={{
                    backgroundColor: '#22C55E',
                    borderColor: '#22C55E',
                    color: '#FFFFFF',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Download size={16} />
                  Install App
                </button>
                <button 
                  onClick={handleDismissBanner} 
                  className="btn btn-secondary" 
                  style={{
                    backgroundColor: 'transparent',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    color: 'rgba(255, 255, 255, 0.6)',
                    padding: '8px 16px',
                    fontSize: '13px',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </div>
          
          {/* Close close X button */}
          <button 
            onClick={handleDismissBanner}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: 'none',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.4)',
              cursor: 'pointer',
              fontSize: '18px',
              lineHeight: 1,
              padding: '4px'
            }}
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      )}

      {/* 8+ Hours Urgent Warning Alert Banner */}
      {attendance?.warningNotification && (
        <div className="card m-b-20" style={{
          background: 'linear-gradient(135deg, #7f1d1d 0%, #b91c1c 100%)',
          color: '#FFFFFF',
          border: '1px solid rgba(248, 113, 113, 0.4)',
          borderRadius: '16px',
          padding: '20px',
          animation: 'pulse 2s infinite',
          boxShadow: '0 8px 32px 0 rgba(239, 68, 68, 0.2)'
        }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '50%',
              padding: '10px',
              color: '#fca5a5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <ShieldAlert size={28} />
            </div>
            <div style={{ flex: 1, minWidth: '240px' }}>
              <h4 style={{ margin: '0 0 4px 0', color: '#FFFFFF', fontWeight: 'bold', fontSize: '16px', textTransform: 'none' }}>
                Urgent Clock-out Warning
              </h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#fca5a5', lineHeight: '1.4' }}>
                You have been clocked in for over 8 hours. Please clock out immediately if you have finished your work to ensure your timesheet is recorded correctly.
              </p>
            </div>
            <Link to="/ess/clock" className="btn" style={{
              backgroundColor: '#FFFFFF',
              color: '#b91c1c',
              fontWeight: 'bold',
              padding: '10px 20px',
              borderRadius: '30px',
              textDecoration: 'none',
              fontSize: '13px',
              flexShrink: 0
            }}>
              Clock Out Now
            </Link>
          </div>
        </div>
      )}

      {/* Welcome Banner Card */}
      <div className="card m-b-20" style={{
        background: 'linear-gradient(135deg, var(--chub-purple) 0%, var(--chub-pink) 100%)',
        color: '#FFFFFF',
        border: 'none',
        padding: '30px'
      }}>
        <h2 style={{ fontSize: '32px', color: '#FFFFFF', marginBottom: '8px' }}>Welcome, {name}</h2>
        <p style={{ opacity: 0.9, fontSize: '15px', maxWidth: '600px', lineHeight: '1.6', marginBottom: '24px' }}>
          This is your personal Employee Self-Service (ESS) hub. Monitor your check-in records, submit leaves, and manage your credentials securely.
        </p>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <span className="badge" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#FFFFFF' }}>{empId}</span>
          <span className="badge" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#FFFFFF' }}>Role: {role}</span>
          <span className="badge" style={{ backgroundColor: '#22C55E', color: '#FFFFFF' }}>Onboarding Verified</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '24px' }}>
        
        {/* Column 1: Today's Action Center */}
        <div className="card" style={{ flex: 1.2, minWidth: '320px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '16px' }}>
              Today's Attendance Status
            </h3>
            
            {attendance?.status === 'not_clocked_in' && (
              <div style={{ padding: '20px 0', textAlign: 'center' }}>
                <Clock size={40} style={{ color: 'var(--chub-muted)', marginBottom: '8px' }} />
                <p style={{ fontWeight: 600, color: 'var(--text-main)' }}>You have not clocked in for today yet.</p>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Assigned Shift: {attendance.shift?.name || 'General Shift'}</span>
              </div>
            )}

            {attendance?.status === 'clocked_in' && (
              <div style={{ padding: '20px 0', textAlign: 'center' }}>
                <UserCheck size={40} style={{ color: 'var(--color-success)', marginBottom: '8px' }} />
                <p style={{ fontWeight: 600, color: 'var(--color-success)' }}>System Clock Active</p>
                <span style={{ fontSize: '13px' }}>Clocked In at: <strong>{attendance.record?.clock_in_time} IST</strong></span>
              </div>
            )}

            {attendance?.status === 'clocked_out' && (
              <div style={{ padding: '20px 0', textAlign: 'center' }}>
                <ShieldCheck size={40} style={{ color: 'var(--chub-pink)', marginBottom: '8px' }} />
                <p style={{ fontWeight: 600 }}>Shift Completed</p>
                <span style={{ fontSize: '13px' }}>Clocked Out: <strong>{attendance.record?.clock_out_time} IST</strong> | Hours: <strong>{attendance.record?.total_hours} hrs</strong></span>
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px' }}>
            <Link to="/ess/clock" className="btn btn-primary" style={{ width: '100%' }}>
              Go to Attendance Center
            </Link>
          </div>
        </div>

        {/* Column 2: Leave Balances */}
        <div className="card" style={{ flex: 1.5, minWidth: '320px' }}>
          <h3 style={{ fontSize: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '16px' }}>
            Remaining Leave Balances (CL / SL / EL)
          </h3>

          {leaves.length === 0 ? (
            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>No leave balance allocated for this year yet.</p>
          ) : (
            <div className="ess-balances-grid">

              {leaves.map((bal, idx) => {
                const available = bal.total_days - bal.availed_days - bal.pending_days;
                return (
                  <div key={idx} style={{ padding: '16px 12px', backgroundColor: 'var(--chub-light-lavender)', borderRadius: '12px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--chub-purple)', textTransform: 'uppercase' }}>
                      {bal.leave_name || bal.leave_code}
                    </span>
                    <h4 style={{ fontSize: '28px', color: 'var(--chub-purple)', margin: '8px 0 2px 0' }}>{available}</h4>
                    <span style={{ fontSize: '10px', color: 'var(--chub-muted)' }}>Available Days</span>
                  </div>
                );
              })}
            </div>
          )}

          <Link to="/ess/leaves" className="btn btn-secondary" style={{ width: '100%' }}>
            Apply for Leave
          </Link>
        </div>

      </div>

      {/* Grid of Shortcuts */}
      <div className="grid-cols-4">
        <Link to="/ess/performance" className="card card-hover" style={{ display: 'flex', flexDirection: 'column', gap: '10px', color: 'inherit' }}>
          <Milestone size={24} style={{ color: 'var(--chub-pink)' }} />
          <strong>Performance & Logs</strong>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Analyze monthly active hours and print attendance sheets.</span>
        </Link>
        
        <Link to="/ess/profile" className="card card-hover" style={{ display: 'flex', flexDirection: 'column', gap: '10px', color: 'inherit' }}>
          <User size={24} style={{ color: 'var(--chub-purple)' }} />
          <strong>My Profile details</strong>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>View read-only personal details and masked KYC.</span>
        </Link>

        <Link to="/ess/password" className="card card-hover" style={{ display: 'flex', flexDirection: 'column', gap: '10px', color: 'inherit' }}>
          <Clock size={24} style={{ color: 'var(--color-success)' }} />
          <strong>Change Password</strong>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Securely update account credentials.</span>
        </Link>
      </div>

    </div>
  );
}
