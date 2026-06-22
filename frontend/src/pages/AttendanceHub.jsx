import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Clock, MapPin, Check, X, AlertCircle, 
  Calendar, CheckCircle, ShieldAlert, Plus, Trash2
} from 'lucide-react';

export default function AttendanceHub() {
  const { request } = useAuth();
  
  // Data lists
  const [todayLogs, setTodayLogs] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [corrections, setCorrections] = useState([]);
  
  // Tab toggler
  const [activeTab, setActiveTab] = useState('today'); // 'today', 'corrections', 'shifts'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Form for new shift
  const [showAddShift, setShowAddShift] = useState(false);
  const [newShift, setNewShift] = useState({
    name: '', startTime: '09:00', endTime: '18:00', gracePeriodMinutes: 15
  });

  // Correction remarks field
  const [remarks, setRemarks] = useState({});

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'today') {
        const logs = await dbTodayLogs();
        setTodayLogs(logs);
      } else if (activeTab === 'shifts') {
        const list = await request('/metadata/shifts');
        setShifts(list);
      } else if (activeTab === 'corrections') {
        const list = await request('/attendance/corrections');
        setCorrections(list);
      }
    } catch (err) {
      setError(err.message || 'Error loading attendance metadata.');
    } finally {
      setLoading(false);
    }
  };

  const dbTodayLogs = async () => {
    // Return today's logs using helper
    const today = new Date().toISOString().split('T')[0];
    return await request(`/attendance/admin-logs?fromDate=${today}&toDate=${today}`);
  };

  const handleCreateShift = async (e) => {
    e.preventDefault();
    try {
      await request('/metadata/shifts', {
        method: 'POST',
        body: {
          name: newShift.name,
          startTime: newShift.startTime + ':00',
          endTime: newShift.endTime + ':00',
          gracePeriodMinutes: newShift.gracePeriodMinutes
        }
      });
      alert('Shift configuration registered.');
      setShowAddShift(false);
      setNewShift({ name: '', startTime: '09:00', endTime: '18:00', gracePeriodMinutes: 15 });
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteShift = async (id) => {
    if (!window.confirm('Delete this shift assignment rule?')) return;
    try {
      await request(`/metadata/shifts/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleProcessCorrection = async (id, status) => {
    const remark = remarks[id] || '';
    if (status === 'Rejected' && !remark) {
      return alert('Please write rejection remarks/reasons.');
    }
    
    try {
      await request(`/attendance/corrections/${id}/approve`, {
        method: 'POST',
        body: { status, remarks: remark }
      });
      alert(`Correction request has been ${status.toLowerCase()}.`);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex-between m-b-20">
        <div>
          <h2 style={{ fontSize: '28px', color: 'var(--chub-purple)' }}>Attendance Action Center</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Track daily logs, geofencing statuses, correction workflow, and shifts.</p>
        </div>
      </div>

      <div className="alert alert-info">
        <Clock size={18} />
        <span>Attendance time is recorded using secure server-side IST timestamp.</span>
      </div>

      {/* Tabs Switcher Card */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        {[
          { key: 'today', name: "Today's Presence" },
          { key: 'corrections', name: 'Correction Requests' },
          { key: 'shifts', name: 'Shift Management' }
        ].map(t => (
          <button 
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`btn ${activeTab === t.key ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: '8px', padding: '10px 20px' }}
          >
            {t.name}
          </button>
        ))}
      </div>

      {error && <div className="alert alert-error"><ShieldAlert /><span>{error}</span></div>}

      {/* Content Panels */}
      <div className="card">
        {loading ? (
          <p>Loading attendance data...</p>
        ) : (
          <div>
            {/* 1. TODAY'S ATTENDANCE TAB */}
            {activeTab === 'today' && (
              <div>
                <h3 style={{ fontSize: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
                  Live Presence Roster
                </h3>
                
                {todayLogs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <AlertCircle size={36} style={{ margin: '0 auto 12px auto', display: 'block' }} />
                    <p>No clock-ins recorded yet for today.</p>
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Emp ID</th>
                          <th>Full Name</th>
                          <th>Clock In</th>
                          <th>In Geofence</th>
                          <th>Clock Out</th>
                          <th>Hours</th>
                          <th>Record Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {todayLogs.map((log) => (
                          <tr key={log.id}>
                            <td style={{ fontWeight: 'bold' }}>{log.employee_id}</td>
                            <td style={{ fontWeight: 600 }}>{log.full_name}</td>
                            <td>
                              <div>{log.clock_in_time}</div>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>IP: {log.clock_in_ip}</div>
                            </td>
                            <td>
                              <span className={`badge ${
                                log.clock_in_location_status === 'Verified-Inside' 
                                  ? 'badge-active' 
                                  : 'badge-rejected'
                              }`}>
                                {log.clock_in_location_status}
                              </span>
                            </td>
                            <td>
                              {log.clock_out_time ? (
                                <div>
                                  <div>{log.clock_out_time}</div>
                                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>IP: {log.clock_out_ip}</div>
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Working...</span>
                              )}
                            </td>
                            <td>{log.total_hours ? `${log.total_hours} hrs` : '--'}</td>
                            <td>
                              <span className={`badge ${
                                log.status === 'Present' 
                                  ? 'badge-active' 
                                  : log.status === 'Late' 
                                  ? 'badge-pending' 
                                  : 'badge-rejected'
                              }`}>
                                {log.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 2. CORRECTION REQUESTS TAB */}
            {activeTab === 'corrections' && (
              <div>
                <h3 style={{ fontSize: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
                  Pending Manual Adjustments
                </h3>
                
                {corrections.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No correction requests submitted.</p>
                ) : (
                  <div className="table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Log Date</th>
                          <th>Requested Clock In/Out</th>
                          <th>Reason</th>
                          <th>Status</th>
                          <th>Manager Action Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {corrections.map((corr) => (
                          <tr key={corr.id}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{corr.full_name}</div>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{corr.employee_id}</span>
                            </td>
                            <td><strong>{new Date(corr.date).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' })}</strong></td>
                            <td>
                              <span className="badge badge-kyc-pending" style={{ fontSize: '11px' }}>
                                IN: {corr.requested_clock_in || 'N/A'} | OUT: {corr.requested_clock_out || 'N/A'}
                              </span>
                            </td>
                            <td style={{ fontSize: '13px', maxWidth: '200px' }}>{corr.reason}</td>
                            <td>
                              <span className={`badge ${
                                corr.status === 'Approved' 
                                  ? 'badge-active' 
                                  : corr.status === 'Rejected' 
                                  ? 'badge-rejected' 
                                  : 'badge-pending'
                              }`}>
                                {corr.status}
                              </span>
                            </td>
                            <td>
                              {corr.status === 'Pending' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <input 
                                    type="text" 
                                    className="form-control" 
                                    placeholder="Write approval/rejection notes..."
                                    style={{ padding: '6px 10px', fontSize: '12px' }}
                                    value={remarks[corr.id] || ''}
                                    onChange={(e) => setRemarks({ ...remarks, [corr.id]: e.target.value })}
                                  />
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button 
                                      onClick={() => handleProcessCorrection(corr.id, 'Approved')}
                                      className="btn btn-primary"
                                      style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--success-gradient)' }}
                                    >
                                      Approve
                                    </button>
                                    <button 
                                      onClick={() => handleProcessCorrection(corr.id, 'Rejected')}
                                      className="btn btn-danger"
                                      style={{ padding: '6px 12px', fontSize: '12px' }}
                                    >
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ fontSize: '12px' }}>
                                  <div>Processed by ID: {corr.approved_by || 'N/A'}</div>
                                  <div style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Remarks: {corr.remarks || 'None'}</div>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 3. SHIFT MANAGEMENT TAB */}
            {activeTab === 'shifts' && (
              <div>
                <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '18px', margin: 0 }}>Active Corporate Shifts</h3>
                  <button onClick={() => setShowAddShift(true)} className="btn btn-primary" style={{ padding: '8px 16px' }}>
                    <Plus size={16} /> Add Shift Rule
                  </button>
                </div>

                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Shift Name</th>
                        <th>Start Hour</th>
                        <th>End Hour</th>
                        <th>Grace Allowed</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shifts.map((s) => (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 600 }}>{s.name}</td>
                          <td><strong>{s.start_time}</strong></td>
                          <td><strong>{s.end_time}</strong></td>
                          <td>{s.grace_period_minutes} Minutes</td>
                          <td>
                            <button 
                              onClick={() => handleDeleteShift(s.id)}
                              className="btn btn-secondary"
                              style={{ padding: '6px 12px', border: 'none' }}
                              title="Delete Shift Rule"
                            >
                              <Trash2 size={16} style={{ color: 'var(--color-error)' }} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* ADD SHIFT MODAL POPUP */}
      {showAddShift && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px' }}>Config New Shift Type</h3>
            <form onSubmit={handleCreateShift}>
              <div className="form-group">
                <label className="form-label">Shift Label *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. Night Shift"
                  value={newShift.name}
                  onChange={(e) => setNewShift({ ...newShift, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Start Time *</label>
                  <input 
                    type="time" 
                    className="form-control"
                    value={newShift.startTime}
                    onChange={(e) => setNewShift({ ...newShift, startTime: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">End Time *</label>
                  <input 
                    type="time" 
                    className="form-control"
                    value={newShift.endTime}
                    onChange={(e) => setNewShift({ ...newShift, endTime: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Grace Period (Minutes)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  value={newShift.gracePeriodMinutes}
                  onChange={(e) => setNewShift({ ...newShift, gracePeriodMinutes: Number(e.target.value) })}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowAddShift(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Shift Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
