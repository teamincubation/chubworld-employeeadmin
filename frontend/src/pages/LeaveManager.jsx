import React, { useState, useEffect } from 'react';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import { Calendar, FileText, Check, X, ShieldAlert, Plus, Edit3 } from 'lucide-react';

export default function LeaveManager() {
  const { request } = useAuth();
  
  const [requests, setRequests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  
  // UI Tabs
  const [activeTab, setActiveTab] = useState('requests'); // 'requests', 'balances'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Processing notes
  const [remarks, setRemarks] = useState({});
  
  // Balance adjustment modal form
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    employeeId: '',
    leaveTypeId: '',
    adjustmentDays: 0,
    remarks: ''
  });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'requests') {
        const list = await request('/leaves/admin-requests');
        setRequests(list);
      } else if (activeTab === 'balances') {
        const emps = await request('/employees/dropdown');
        const types = await request('/leaves/types');
        setEmployees(emps);
        setLeaveTypes(types);
      }
    } catch (err) {
      setError(err.message || 'Error retrieving leave records.');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessLeave = async (id, status) => {
    const note = remarks[id] || '';
    if (status === 'Rejected' && !note) {
      return alert('Remarks are required for rejecting a leave request.');
    }

    try {
      await request(`/leaves/approve/${id}`, {
        method: 'POST',
        body: { status, remarks: note }
      });
      alert(`Leave request ${status.toLowerCase()} successfully.`);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAdjustBalance = async (e) => {
    e.preventDefault();
    if (!adjustForm.employeeId || !adjustForm.leaveTypeId) {
      return alert('Please select both an employee and leave type.');
    }

    try {
      await request('/leaves/adjust', {
        method: 'POST',
        body: adjustForm
      });
      alert('Leave balance manual adjustment saved in audit logs.');
      setShowAdjust(false);
      setAdjustForm({ employeeId: '', leaveTypeId: '', adjustmentDays: 0, remarks: '' });
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
          <h2 style={{ fontSize: '28px', color: 'var(--chub-purple)' }}>Leave Control Hub</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Review staff leave requests, balance allowances, and audit adjustment histories.</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <button 
          onClick={() => setActiveTab('requests')}
          className={`btn ${activeTab === 'requests' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '8px', padding: '10px 20px' }}
        >
          Approval Queue
        </button>
        <button 
          onClick={() => setActiveTab('balances')}
          className={`btn ${activeTab === 'balances' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '8px', padding: '10px 20px' }}
        >
          Balance Adjustments
        </button>
      </div>

      {error && <div className="alert alert-error"><ShieldAlert /><span>{error}</span></div>}

      <div className="card">
        {loading ? (
          <p>Loading leave modules...</p>
        ) : (
          <div>
            {/* 1. APPROVAL QUEUE PANEL */}
            {activeTab === 'requests' && (
              <div>
                <h3 style={{ fontSize: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
                  Awaiting HR / Manager Approvals
                </h3>
                
                {requests.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No leave requests found.</p>
                ) : (
                  <div className="table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Category</th>
                          <th>Duration Dates</th>
                          <th>Total Days</th>
                          <th>Reason & Attachments</th>
                          <th>Approval Status</th>
                          <th>Actions Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {requests.map((req) => (
                          <tr key={req.id}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{req.full_name}</div>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{req.employee_id}</span>
                            </td>
                            <td>
                              <span className="badge badge-kyc-pending">{req.leave_name} ({req.leave_code})</span>
                            </td>
                            <td>
                              <div>From: <strong>{new Date(req.from_date).toLocaleDateString()}</strong></div>
                              <div>To: <strong>{new Date(req.to_date).toLocaleDateString()}</strong></div>
                            </td>
                            <td style={{ fontWeight: 'bold', fontSize: '15px' }}>{req.total_days} Days</td>
                            <td>
                              <div style={{ fontSize: '13px', maxWidth: '200px', marginBottom: '4px' }}>{req.reason}</div>
                              {req.attachment_path && (
                                <a 
                                  href={`${API_BASE_URL}/documents/download/${req.attachment_path.split('/').pop()}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--chub-pink)', fontWeight: 600 }}
                                >
                                  <FileText size={12} /> View Medical Certificate
                                </a>
                              )}
                            </td>
                            <td>
                              <span className={`badge ${
                                req.status === 'Approved' 
                                  ? 'badge-active' 
                                  : req.status === 'Rejected' 
                                  ? 'badge-rejected' 
                                  : req.status === 'Cancelled'
                                  ? 'badge-inactive'
                                  : 'badge-pending'
                              }`}>
                                {req.status}
                              </span>
                            </td>
                            <td>
                              {req.status === 'Pending' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <input 
                                    type="text" 
                                    className="form-control" 
                                    placeholder="Remarks/notes..."
                                    style={{ padding: '6px 10px', fontSize: '12px' }}
                                    value={remarks[req.id] || ''}
                                    onChange={(e) => setRemarks({ ...remarks, [req.id]: e.target.value })}
                                  />
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button 
                                      onClick={() => handleProcessLeave(req.id, 'Approved')}
                                      className="btn btn-primary"
                                      style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--success-gradient)' }}
                                    >
                                      Approve
                                    </button>
                                    <button 
                                      onClick={() => handleProcessLeave(req.id, 'Rejected')}
                                      className="btn btn-danger"
                                      style={{ padding: '6px 12px', fontSize: '12px' }}
                                    >
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                  <div>Processed by ID: {req.approved_by || 'N/A'}</div>
                                  <div style={{ fontStyle: 'italic' }}>Remarks: {req.remarks || 'None'}</div>
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

            {/* 2. BALANCE ADJUSTMENT PANEL */}
            {activeTab === 'balances' && (
              <div>
                <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '18px', margin: 0 }}>Allocate Leave Balances</h3>
                  <button onClick={() => setShowAdjust(true)} className="btn btn-primary" style={{ padding: '8px 16px' }}>
                    <Plus size={16} /> Adjust Balance Days
                  </button>
                </div>
                
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  Search and adjust allowances manually. When changes are made, they are recorded in the system audit logs. 
                  Select an employee and enter positive days (to allocate) or negative days (to deduct).
                </p>
              </div>
            )}

          </div>
        )}
      </div>

      {/* ADJUST BALANCE MODAL */}
      {showAdjust && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px' }}>Adjust Leave Balance</h3>
            <form onSubmit={handleAdjustBalance}>
              <div className="form-group">
                <label className="form-label">Employee *</label>
                <select 
                  className="form-control"
                  value={adjustForm.employeeId}
                  onChange={(e) => setAdjustForm({ ...adjustForm, employeeId: e.target.value })}
                  required
                >
                  <option value="">Select Employee</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_id})</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Leave Category *</label>
                <select 
                  className="form-control"
                  value={adjustForm.leaveTypeId}
                  onChange={(e) => setAdjustForm({ ...adjustForm, leaveTypeId: e.target.value })}
                  required
                >
                  <option value="">Select Leave Type</option>
                  {leaveTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.name} ({lt.code})</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Adjustment Days *</label>
                <input 
                  type="number" 
                  step="0.5"
                  className="form-control"
                  placeholder="e.g. 5 or -2"
                  value={adjustForm.adjustmentDays}
                  onChange={(e) => setAdjustForm({ ...adjustForm, adjustmentDays: Number(e.target.value) })}
                  required
                />
                <small style={{ color: 'var(--text-muted)' }}>Enter positive value to add, negative value to subtract.</small>
              </div>

              <div className="form-group">
                <label className="form-label">Reason / Remarks *</label>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="Reason for change"
                  value={adjustForm.remarks}
                  onChange={(e) => setAdjustForm({ ...adjustForm, remarks: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowAdjust(false)} className="btn btn-secondary">
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
    </div>
  );
}
