import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Users, UserCheck, UserMinus, UserPlus, 
  CalendarClock, Clock, UserX, AlertTriangle,
  ArrowRight, ShieldAlert, Plus, CheckCircle, FileText
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminDashboard() {
  const { request } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await request('/dashboard/stats');
      setStats(data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch dashboard overview metrics.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <p style={{ fontWeight: 600, color: 'var(--chub-purple)' }}>LOADING METRICS...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <ShieldAlert />
        <span>{error}</span>
      </div>
    );
  }

  const { employees, attendance, departments, recentActivities, securityAlerts } = stats;

  return (
    <div>
      {/* Header and Quick Actions */}
      <div className="flex-between m-b-20">
        <div>
          <h2 style={{ fontSize: '28px', color: 'var(--chub-purple)' }}>Dashboard Overview</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Welcome back, administrator. Here are today's operations details.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link to="/employees?add=true" className="btn btn-primary">
            <Plus size={16} /> Add Employee
          </Link>
          <Link to="/leaves" className="btn btn-secondary">
            <CalendarClock size={16} /> Leave Actions
          </Link>
        </div>
      </div>

      {/* Grid of Key Statistics (Rounded Gradient Cards) */}
      <div className="grid-cols-4 m-b-20">
        {/* Total Employees */}
        <div className="card card-hover" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '12px',
            background: 'rgba(66, 23, 79, 0.08)', display: 'flex',
            alignItems: 'center', justifyCenter: 'center', justifyContent: 'center', color: 'var(--chub-purple)'
          }}>
            <Users size={28} />
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Register</span>
            <h3 style={{ fontSize: '32px', margin: 0, fontWeight: 700 }}>{employees.total}</h3>
          </div>
        </div>

        {/* Active Employees */}
        <div className="card card-hover" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '12px',
            background: 'rgba(34, 197, 94, 0.08)', display: 'flex',
            alignItems: 'center', justifyCenter: 'center', justifyContent: 'center', color: 'var(--color-success)'
          }}>
            <UserCheck size={28} />
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Active Employees</span>
            <h3 style={{ fontSize: '32px', margin: 0, fontWeight: 700 }}>{employees.active}</h3>
          </div>
        </div>

        {/* Onboarding Pending */}
        <div className="card card-hover" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '12px',
            background: 'rgba(245, 158, 11, 0.08)', display: 'flex',
            alignItems: 'center', justifyCenter: 'center', justifyContent: 'center', color: 'var(--color-warning)'
          }}>
            <UserPlus size={28} />
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>KYC & Onboarding</span>
            <h3 style={{ fontSize: '32px', margin: 0, fontWeight: 700 }}>{employees.pendingOnboarding}</h3>
          </div>
        </div>

        {/* Today's Attendance */}
        <div className="card card-hover" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(66, 23, 79, 0.1) 0%, rgba(216, 90, 166, 0.1) 100%)', display: 'flex',
            alignItems: 'center', justifyCenter: 'center', justifyContent: 'center', color: 'var(--chub-pink)'
          }}>
            <Clock size={28} />
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Today Present</span>
            <h3 style={{ fontSize: '32px', margin: 0, fontWeight: 700 }}>{attendance.todayPresent}</h3>
          </div>
        </div>
      </div>

      {/* Grid of Secondary Attendance Details */}
      <div className="grid-cols-4 m-b-20">
        {/* Late arrivals */}
        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--color-warning)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>LATE ARRIVALS</span>
          <h4 style={{ fontSize: '24px', margin: '4px 0 0 0' }}>{attendance.lateArrivals}</h4>
        </div>
        {/* Employees on Leave */}
        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--chub-pink)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>EMPLOYEES ON LEAVE</span>
          <h4 style={{ fontSize: '24px', margin: '4px 0 0 0' }}>{attendance.employeesOnLeave}</h4>
        </div>
        {/* Pending Leaves requests */}
        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--color-info)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>PENDING LEAVE REQUESTS</span>
          <h4 style={{ fontSize: '24px', margin: '4px 0 0 0' }}>{attendance.pendingLeaveRequests}</h4>
        </div>
        {/* Onboarding Completed */}
        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--color-success)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>ONBOARDING COMPLETED</span>
          <h4 style={{ fontSize: '24px', margin: '4px 0 0 0' }}>{employees.completedOnboarding}</h4>
        </div>
      </div>

      {/* Main Grid: Left Side Departments distribution, Right side audit & alerts */}
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        
        {/* Department-wise staff counts */}
        <div className="card" style={{ flex: 1, minWidth: '320px' }}>
          <h3 style={{ fontSize: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
            Department Analytics
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {departments.map((dept, idx) => {
              const maxCount = Math.max(...departments.map(d => d.count), 1);
              const percentage = Math.round((dept.count / maxCount) * 100);
              return (
                <div key={idx}>
                  <div className="flex-between" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    <span>{dept.name}</span>
                    <span style={{ color: 'var(--chub-pink)' }}>{dept.count} Staff</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--chub-light-lavender)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${percentage}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, var(--chub-purple) 0%, var(--chub-pink) 100%)',
                      borderRadius: '4px',
                      transition: 'width 0.5s ease'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Security alerts and audit tracker */}
        <div style={{ flex: 1.5, minWidth: '400px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Security alerts */}
          {securityAlerts.length > 0 && (
            <div className="card" style={{ border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '18px', color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={18} /> Active Security Alerts
                </h3>
                <span className="badge badge-rejected">{securityAlerts.length} Threats</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '180px', overflowY: 'auto' }}>
                {securityAlerts.map((alert, idx) => (
                  <div key={idx} style={{
                    display: 'flex', gap: '12px', padding: '10px', 
                    backgroundColor: 'rgba(239, 68, 68, 0.04)', borderRadius: '6px', fontSize: '13px'
                  }}>
                    <ShieldAlert size={16} style={{ color: 'var(--color-error)', flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{alert.event_type} <span style={{ color: 'var(--color-error)' }}>({alert.severity})</span></div>
                      <div style={{ color: 'var(--text-muted)' }}>{alert.details}</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>IP: {alert.ip_address} | {new Date(alert.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Audit Activities */}
          <div className="card">
            <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px' }}>Recent Operational Activities</h3>
              <Link to="/security" style={{ fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                View All <ArrowRight size={12} />
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '250px', overflowY: 'auto' }}>
              {recentActivities.map((act, idx) => (
                <div key={idx} style={{
                  borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', fontSize: '13px'
                }}>
                  <div className="flex-between" style={{ marginBottom: '2px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--chub-purple)' }}>{act.action_type}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {new Date(act.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-muted)' }}>
                    Performed by: <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{act.performed_by}</span> ({act.role})
                  </div>
                  {act.target_record && (
                    <div style={{ fontSize: '11px', color: 'var(--chub-pink)', marginTop: '2px' }}>
                      Target: {act.target_record}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
