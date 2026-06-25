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
  const [employeesList, setEmployeesList] = useState([]);

  // Selected date filter
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
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

  // Modals for manual attendance entry
  const [showAddManual, setShowAddManual] = useState(false);
  const [showEditManual, setShowEditManual] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [selectedMapLog, setSelectedMapLog] = useState(null);
  
  const [showDeleteLeaveModal, setShowDeleteLeaveModal] = useState(false);
  const [deleteLeaveLog, setDeleteLeaveLog] = useState(null);
  const [deleteLeaveRemark, setDeleteLeaveRemark] = useState('');
  
  const [manualForm, setManualForm] = useState({
    employeeId: '',
    date: new Date().toISOString().split('T')[0],
    clockInTime: '09:00',
    clockOutTime: '18:00',
    clockInLocationStatus: 'Verified-Inside',
    clockOutLocationStatus: 'Verified-Inside'
  });

  const [editForm, setEditForm] = useState({
    id: null,
    employeeId: '',
    employeeName: '',
    date: '',
    clockInTime: '',
    clockOutTime: '',
    clockInLocationStatus: 'Verified-Inside',
    clockOutLocationStatus: 'Verified-Inside'
  });

  useEffect(() => {
    fetchData();
  }, [activeTab, selectedDate]);

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
    return await request(`/attendance/admin-logs?fromDate=${selectedDate}&toDate=${selectedDate}`);
  };

  const fetchEmployees = async () => {
    try {
      const list = await request('/employees/dropdown');
      setEmployeesList(list || []);
    } catch (err) {
      console.error('Failed to load employees for dropdown:', err.message);
    }
  };

  const handleOpenAddManual = () => {
    setManualForm({
      employeeId: '',
      date: selectedDate,
      clockInTime: '09:00',
      clockOutTime: '18:00',
      clockInLocationStatus: 'Verified-Inside',
      clockOutLocationStatus: 'Verified-Inside'
    });
    fetchEmployees();
    setShowAddManual(true);
  };

  const handleSaveManual = async (e) => {
    e.preventDefault();
    try {
      await request('/attendance/admin-add', {
        method: 'POST',
        body: {
          employeeId: Number(manualForm.employeeId),
          date: manualForm.date,
          clockInTime: manualForm.clockInTime,
          clockOutTime: manualForm.clockOutTime || undefined,
          clockInLocationStatus: manualForm.clockInLocationStatus,
          clockOutLocationStatus: manualForm.clockOutLocationStatus
        }
      });
      alert('Attendance record manually added successfully.');
      setShowAddManual(false);
      fetchData();
    } catch (err) {
      alert(err.message || 'Error adding manual attendance.');
    }
  };

  const handleOpenEditManual = (log) => {
    setEditForm({
      id: log.id,
      employeeId: log.employee_id,
      employeeName: log.full_name,
      date: log.date,
      clockInTime: log.clock_in_time || '',
      clockOutTime: log.clock_out_time || '',
      clockInLocationStatus: log.clock_in_location_status || 'Verified-Inside',
      clockOutLocationStatus: log.clock_out_location_status || 'Verified-Inside'
    });
    setShowEditManual(true);
  };

  const handleSaveEditManual = async (e) => {
    e.preventDefault();
    try {
      await request(`/attendance/admin-update/${editForm.id}`, {
        method: 'PUT',
        body: {
          clockInTime: editForm.clockInTime,
          clockOutTime: editForm.clockOutTime || undefined,
          clockInLocationStatus: editForm.clockInLocationStatus,
          clockOutLocationStatus: editForm.clockOutLocationStatus
        }
      });
      alert('Attendance record modified successfully.');
      setShowEditManual(false);
      fetchData();
    } catch (err) {
      alert(err.message || 'Error updating attendance.');
    }
  };

  const handleOpenDeleteLeave = (log) => {
    setDeleteLeaveLog(log);
    setDeleteLeaveRemark('');
    setShowDeleteLeaveModal(true);
  };

  const handleSaveDeleteLeave = async (e) => {
    e.preventDefault();
    if (!deleteLeaveRemark.trim()) {
      alert('Remark is required to mark the attendance as Leave.');
      return;
    }
    try {
      await request(`/attendance/admin-delete-to-leave/${deleteLeaveLog.id}`, {
        method: 'POST',
        body: { remark: deleteLeaveRemark }
      });
      alert('Attendance record marked as Leave successfully.');
      setShowDeleteLeaveModal(false);
      fetchData();
    } catch (err) {
      alert(err.message || 'Error marking attendance as Leave.');
    }
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
                <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '18px', margin: 0 }}>Live Presence Roster</h3>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <label className="form-label" style={{ margin: 0, fontSize: '13px' }}>Date Filter:</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      style={{ width: '140px', height: '36px', padding: '0 8px' }}
                    />
                    <button onClick={handleOpenAddManual} className="btn btn-primary" style={{ padding: '8px 12px', fontSize: '13px' }}>
                      <Plus size={14} /> Add Manual Entry
                    </button>
                  </div>
                </div>
                
                {todayLogs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <AlertCircle size={36} style={{ margin: '0 auto 12px auto', display: 'block' }} />
                    <p>No clock-ins recorded for this date.</p>
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
                          <th style={{ width: '100px', textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {todayLogs.map((log) => {
                          const renderIpBadge = (ip) => {
                            if (!ip) return null;
                            if (ip === 'admin added') {
                              return <span className="badge" style={{ backgroundColor: '#6f42c1', color: '#fff', fontSize: '10px', padding: '2px 6px', display: 'inline-block', marginTop: '2px' }}>Admin Added</span>;
                            }
                            if (ip === 'admin updated') {
                              return <span className="badge" style={{ backgroundColor: '#ff8c00', color: '#fff', fontSize: '10px', padding: '2px 6px', display: 'inline-block', marginTop: '2px' }}>Admin Updated</span>;
                            }
                            return <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>IP: {ip}</div>;
                          };

                          return (
                            <tr key={log.id}>
                              <td style={{ fontWeight: 'bold' }}>{log.employee_id_str || log.employee_id}</td>
                              <td style={{ fontWeight: 600 }}>{log.full_name}</td>
                              <td>
                                <div>{log.clock_in_time || '--:--:--'}</div>
                                {renderIpBadge(log.clock_in_ip)}
                              </td>
                              <td 
                                onClick={() => {
                                  setSelectedMapLog(log);
                                  setShowMapModal(true);
                                }}
                                style={{ cursor: 'pointer' }}
                                title="Click to view Google Maps location"
                              >
                                <span className={`badge ${
                                  log.clock_in_location_status === 'Verified-Inside' 
                                    ? 'badge-active' 
                                    : 'badge-rejected'
                                  }`}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'all 0.2s ease',
                                    border: '1px solid transparent'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--chub-pink)';
                                    e.currentTarget.style.transform = 'scale(1.05)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'transparent';
                                    e.currentTarget.style.transform = 'scale(1)';
                                  }}
                                >
                                  <MapPin size={12} style={{ flexShrink: 0 }} />
                                  {log.clock_in_location_status}
                                </span>
                              </td>
                              <td>
                                {log.clock_out_time ? (
                                  <div 
                                    onClick={() => {
                                      setSelectedMapLog(log);
                                      setShowMapModal(true);
                                    }}
                                    style={{ cursor: 'pointer', display: 'inline-flex', flexDirection: 'column', gap: '2px' }}
                                    title="Click to view Google Maps location"
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <span>{log.clock_out_time}</span>
                                      {log.clock_out_latitude && <MapPin size={12} style={{ color: 'var(--chub-pink)', flexShrink: 0 }} />}
                                    </div>
                                    {renderIpBadge(log.clock_out_ip)}
                                  </div>
                                ) : (
                                  log.status === 'Leave' ? (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>--:--:--</span>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Working...</span>
                                  )
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
                              <td>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                  <button 
                                    onClick={() => handleOpenEditManual(log)}
                                    className="btn btn-secondary"
                                    style={{ padding: '4px 8px', border: 'none' }}
                                    title="Edit Attendance Log"
                                  >
                                    <Plus size={14} style={{ color: 'var(--chub-pink)' }} />
                                  </button>
                                  <button 
                                    onClick={() => handleOpenDeleteLeave(log)}
                                    className="btn btn-danger"
                                    style={{ padding: '4px 8px', border: 'none', backgroundColor: '#FF4D4D' }}
                                    title="Mark as Leave"
                                  >
                                    <Trash2 size={14} style={{ color: '#FFFFFF' }} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
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

      {/* ADD MANUAL ATTENDANCE ENTRY MODAL */}
      {showAddManual && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '460px' }}>
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px' }}>Add Manual Attendance</h3>
            <form onSubmit={handleSaveManual}>
              <div className="form-group">
                <label className="form-label">Select Employee *</label>
                <select 
                  className="form-control"
                  value={manualForm.employeeId}
                  onChange={(e) => setManualForm({ ...manualForm, employeeId: e.target.value })}
                  required
                >
                  <option value="">-- Choose Employee --</option>
                  {employeesList.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.employee_id_str || emp.employee_id})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Date *</label>
                <input 
                  type="date"
                  className="form-control"
                  value={manualForm.date}
                  onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                  required
                />
              </div>

              <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Clock In Time *</label>
                  <input 
                    type="time"
                    className="form-control"
                    value={manualForm.clockInTime}
                    onChange={(e) => setManualForm({ ...manualForm, clockInTime: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Clock Out Time (Optional)</label>
                  <input 
                    type="time"
                    className="form-control"
                    value={manualForm.clockOutTime}
                    onChange={(e) => setManualForm({ ...manualForm, clockOutTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Clock In Location *</label>
                  <select 
                    className="form-control"
                    value={manualForm.clockInLocationStatus}
                    onChange={(e) => setManualForm({ ...manualForm, clockInLocationStatus: e.target.value })}
                    required
                  >
                    <option value="Verified-Inside">Verified Inside</option>
                    <option value="Verified-Outside">Verified Outside</option>
                    <option value="Location Not Verified">Location Not Verified</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Clock Out Location *</label>
                  <select 
                    className="form-control"
                    value={manualForm.clockOutLocationStatus}
                    onChange={(e) => setManualForm({ ...manualForm, clockOutLocationStatus: e.target.value })}
                    required
                  >
                    <option value="Verified-Inside">Verified Inside</option>
                    <option value="Verified-Outside">Verified Outside</option>
                    <option value="Location Not Verified">Location Not Verified</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowAddManual(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MANUAL ATTENDANCE ENTRY MODAL */}
      {showEditManual && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '460px' }}>
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px' }}>Modify Attendance Log</h3>
            <form onSubmit={handleSaveEditManual}>
              <div className="form-group">
                <label className="form-label">Employee</label>
                <input 
                  type="text"
                  className="form-control"
                  value={`${editForm.employeeName} (${editForm.employeeId})`}
                  disabled
                />
              </div>

              <div className="form-group">
                <label className="form-label">Date</label>
                <input 
                  type="text"
                  className="form-control"
                  value={editForm.date}
                  disabled
                />
              </div>

              <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Clock In Time *</label>
                  <input 
                    type="time"
                    className="form-control"
                    value={editForm.clockInTime}
                    onChange={(e) => setEditForm({ ...editForm, clockInTime: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Clock Out Time (Optional)</label>
                  <input 
                    type="time"
                    className="form-control"
                    value={editForm.clockOutTime}
                    onChange={(e) => setEditForm({ ...editForm, clockOutTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Clock In Location *</label>
                  <select 
                    className="form-control"
                    value={editForm.clockInLocationStatus}
                    onChange={(e) => setEditForm({ ...editForm, clockInLocationStatus: e.target.value })}
                    required
                  >
                    <option value="Verified-Inside">Verified Inside</option>
                    <option value="Verified-Outside">Verified Outside</option>
                    <option value="Location Not Verified">Location Not Verified</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Clock Out Location *</label>
                  <select 
                    className="form-control"
                    value={editForm.clockOutLocationStatus}
                    onChange={(e) => setEditForm({ ...editForm, clockOutLocationStatus: e.target.value })}
                    required
                  >
                    <option value="Verified-Inside">Verified Inside</option>
                    <option value="Verified-Outside">Verified Outside</option>
                    <option value="Location Not Verified">Location Not Verified</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowEditManual(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE / MARK AS LEAVE MODAL */}
      {showDeleteLeaveModal && deleteLeaveLog && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '460px' }}>
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px' }}>Mark Attendance as Leave</h3>
            <form onSubmit={handleSaveDeleteLeave}>
              <div style={{ marginBottom: '16px', fontSize: '14px', lineHeight: '1.5' }}>
                You are about to delete/convert the attendance record for <strong>{deleteLeaveLog.full_name}</strong> on <strong>{deleteLeaveLog.date}</strong>. This will:
                <ul style={{ paddingLeft: '20px', marginTop: '8px', marginBottom: '8px', listStyleType: 'disc' }}>
                  <li>Reset both clock-in and clock-out times to <code>--:--</code></li>
                  <li>Clear all recorded geolocations, IP addresses, and active hours</li>
                  <li>Manually set the attendance status to <strong>Leave</strong></li>
                </ul>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>Delete/Leave Remark *</label>
                <textarea 
                  className="form-control"
                  rows={3}
                  style={{ width: '100%', minHeight: '80px', resize: 'vertical', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                  placeholder="Enter reason for converting this attendance to Leave..."
                  value={deleteLeaveRemark}
                  onChange={(e) => setDeleteLeaveRemark(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowDeleteLeaveModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger" style={{ backgroundColor: '#FF4D4D', border: 'none' }}>
                  Mark as Leave
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GOOGLE MAPS PREVIEW MODAL */}
      {showMapModal && selectedMapLog && (
        <div className="modal-overlay" onClick={() => setShowMapModal(false)}>
          <div className="modal-content" style={{ maxWidth: '800px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, textTransform: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={20} style={{ color: 'var(--chub-pink)' }} />
                Shift Location Maps - {selectedMapLog.full_name}
              </h3>
              <button 
                onClick={() => setShowMapModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: '1' }}
              >
                &times;
              </button>
            </div>

            <div style={{ marginBottom: '16px', fontSize: '14px', color: 'var(--text-muted)' }}>
              <strong>Date:</strong> {selectedMapLog.date} &nbsp;|&nbsp; <strong>Employee ID:</strong> {selectedMapLog.employee_id_str || selectedMapLog.employee_id}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
              {/* Clock-In Map */}
              <div className="card" style={{ padding: '16px', backgroundColor: 'var(--bg-primary)' }}>
                <h4 style={{ fontSize: '14px', color: 'var(--chub-purple)', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  Clock-In Geolocation
                </h4>
                <div style={{ fontSize: '13px', marginBottom: '12px', lineHeight: '1.4' }}>
                  <div><strong>Time:</strong> {selectedMapLog.clock_in_time}</div>
                  <div><strong>Status:</strong> {selectedMapLog.clock_in_location_status}</div>
                  {selectedMapLog.clock_in_latitude ? (
                    <>
                      <div><strong>Coordinates:</strong> {selectedMapLog.clock_in_latitude}, {selectedMapLog.clock_in_longitude}</div>
                      <div><strong>Accuracy:</strong> ±{Math.round(selectedMapLog.clock_in_accuracy)} meters</div>
                    </>
                  ) : (
                    <div style={{ color: 'var(--color-warning)', marginTop: '4px' }}>GPS coordinates not recorded for this event.</div>
                  )}
                </div>
                {selectedMapLog.clock_in_latitude && (
                  <iframe
                    title="Clock-In Location Map"
                    width="100%"
                    height="240"
                    style={{ border: '1px solid var(--border-color)', borderRadius: '12px' }}
                    loading="lazy"
                    allowFullScreen
                    src={`https://maps.google.com/maps?q=${selectedMapLog.clock_in_latitude},${selectedMapLog.clock_in_longitude}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                  />
                )}
              </div>

              {/* Clock-Out Map */}
              <div className="card" style={{ padding: '16px', backgroundColor: 'var(--bg-primary)' }}>
                <h4 style={{ fontSize: '14px', color: 'var(--chub-pink)', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  Clock-Out Geolocation
                </h4>
                {selectedMapLog.clock_out_time ? (
                  <>
                    <div style={{ fontSize: '13px', marginBottom: '12px', lineHeight: '1.4' }}>
                      <div><strong>Time:</strong> {selectedMapLog.clock_out_time}</div>
                      <div><strong>Status:</strong> {selectedMapLog.clock_out_location_status}</div>
                      {selectedMapLog.clock_out_latitude ? (
                        <>
                          <div><strong>Coordinates:</strong> {selectedMapLog.clock_out_latitude}, {selectedMapLog.clock_out_longitude}</div>
                          <div><strong>Accuracy:</strong> ±{Math.round(selectedMapLog.clock_out_accuracy)} meters</div>
                        </>
                      ) : (
                        <div style={{ color: 'var(--color-warning)', marginTop: '4px' }}>GPS coordinates not recorded for this event.</div>
                      )}
                    </div>
                    {selectedMapLog.clock_out_latitude && (
                      <iframe
                        title="Clock-Out Location Map"
                        width="100%"
                        height="240"
                        style={{ border: '1px solid var(--border-color)', borderRadius: '12px' }}
                        loading="lazy"
                        allowFullScreen
                        src={`https://maps.google.com/maps?q=${selectedMapLog.clock_out_latitude},${selectedMapLog.clock_out_longitude}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                      />
                    )}
                  </>
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-muted)', minHeight: '260px' }}>
                    <Clock size={36} className="pulse" style={{ color: 'var(--chub-pink)', marginBottom: '12px' }} />
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>Shift Active / In Progress</span>
                    <span style={{ fontSize: '12px', opacity: 0.8 }}>Employee has not checked out yet.</span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <button 
                onClick={() => setShowMapModal(false)}
                className="btn btn-secondary"
                style={{ padding: '8px 24px', borderRadius: '8px' }}
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
