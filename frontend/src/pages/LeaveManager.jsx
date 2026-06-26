import React, { useState, useEffect } from 'react';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import { Calendar, FileText, Check, X, ShieldAlert, Plus, Edit3 } from 'lucide-react';

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parts[2];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[monthIndex];
    if (month) {
      return `${day.padStart(2, '0')}/${month}/${year}`;
    }
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = String(date.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export default function LeaveManager() {
  const { request } = useAuth();
  
  const [requests, setRequests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  
  const [selectedBalances, setSelectedBalances] = useState([]);
  const [selectedEmpName, setSelectedEmpName] = useState('');
  const [showBalancesModal, setShowBalancesModal] = useState(false);
  const [fetchingBalances, setFetchingBalances] = useState(false);
  
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
        const [emps, types] = await Promise.all([
          request('/employees/dropdown'),
          request('/leaves/types')
        ]);
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

  const handleViewBalances = async (employeeId, name) => {
    setSelectedEmpName(name);
    setFetchingBalances(true);
    setShowBalancesModal(true);
    try {
      const data = await request(`/leaves/employee/${employeeId}`);
      setSelectedBalances(data || []);
    } catch (err) {
      alert(err.message || 'Error fetching leave balances.');
      setShowBalancesModal(false);
    } finally {
      setFetchingBalances(false);
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
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>{req.employee_id_str || req.employee_id}</span>
                              <button
                                onClick={() => handleViewBalances(req.employee_id, req.full_name)}
                                className="btn btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '10px', height: 'auto', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                View Leave Status
                              </button>
                            </td>
                            <td>
                              <span className="badge badge-kyc-pending">{req.leave_name} ({req.leave_code})</span>
                            </td>
                            <td>
                              <div>From: <strong>{formatDate(req.from_date)}</strong></div>
                              <div>To: <strong>{formatDate(req.to_date)}</strong></div>
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

      {/* VIEW LEAVE STATUS / BALANCE MODAL */}
      {showBalancesModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', color: 'var(--chub-purple)', margin: 0 }}>Leave Balance Status</h3>
              <button 
                onClick={() => setShowBalancesModal(false)} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Employee:</span>
              <strong style={{ fontSize: '16px', color: 'var(--text-main)', marginLeft: '8px' }}>{selectedEmpName}</strong>
            </div>

            {fetchingBalances ? (
              <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Retrieving leave balances...</p>
            ) : selectedBalances.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No leave balance records found for the current year.</p>
            ) : (
              <div className="table-container">
                <table className="custom-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '10px 12px', fontSize: '11px' }}>Category</th>
                      <th style={{ padding: '10px 12px', fontSize: '11px', textAlign: 'center' }}>Allocated</th>
                      <th style={{ padding: '10px 12px', fontSize: '11px', textAlign: 'center' }}>Taken</th>
                      <th style={{ padding: '10px 12px', fontSize: '11px', textAlign: 'center' }}>Pending</th>
                      <th style={{ padding: '10px 12px', fontSize: '11px', textAlign: 'center' }}>Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBalances.map((bal) => {
                      const allocated = Number(bal.total_days) || 0;
                      const availed = Number(bal.availed_days) || 0;
                      const pending = Number(bal.pending_days) || 0;
                      const remaining = Math.max(0, allocated - availed - pending);

                      return (
                        <tr key={bal.id}>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                            {bal.leave_name} <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'normal' }}>({bal.leave_code})</span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 'bold' }}>{allocated}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', color: availed > 0 ? 'var(--color-warning)' : 'inherit' }}>{availed}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', color: pending > 0 ? 'var(--color-info)' : 'inherit' }}>{pending}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 'bold', color: remaining > 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                            {remaining}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button onClick={() => setShowBalancesModal(false)} className="btn btn-primary" style={{ padding: '8px 24px' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
