import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Clock, Calendar, ShieldCheck, UserCheck, Milestone, User } from 'lucide-react';

export default function ESSDashboard() {
  const { request } = useAuth();
  
  // Dashboard details
  const [profile, setProfile] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const userDetails = await request('/auth/me');
      setProfile(userDetails);

      // Fetch today's clock status
      const attStatus = await request('/attendance/status');
      setAttendance(attStatus);

      // Fetch leave balances
      const leaveData = await request('/leaves/my-leaves');
      setLeaves(leaveData.balances);
    } catch (err) {
      console.error('Error fetching employee dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '85vh' }}>
        <p>Initializing ESS Dashboard...</p>
      </div>
    );
  }

  const name = profile?.employee?.full_name || profile?.user?.email.split('@')[0];
  const empId = profile?.employee?.employee_id || 'CHUB-EMP';
  const role = profile?.user?.role || 'Employee';

  return (
    <div>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', textAlign: 'center', marginBottom: '16px' }}>
              {leaves.map((bal, idx) => {
                const available = bal.total_days - bal.availed_days - bal.pending_days;
                return (
                  <div key={idx} style={{ padding: '16px 12px', backgroundColor: 'var(--chub-light-lavender)', borderRadius: '12px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--chub-purple)', textTransform: 'uppercase' }}>
                      {bal.leave_code}
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
