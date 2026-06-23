import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { CalendarDays, AlertTriangle, ShieldAlert, Check, FileText } from 'lucide-react';

export default function ESSLeaveRequest() {
  const { request } = useAuth();
  
  // States
  const [balances, setBalances] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');

  // Form states
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');

  // Calculated count
  const [totalDays, setTotalDays] = useState(0);

  useEffect(() => {
    fetchLeaves();
  }, []);

  useEffect(() => {
    if (fromDate && toDate) {
      const f = new Date(fromDate);
      const t = new Date(toDate);
      if (t >= f) {
        const diff = Math.abs(t - f);
        setTotalDays(Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
      } else {
        setTotalDays(0);
      }
    } else {
      setTotalDays(0);
    }
  }, [fromDate, toDate]);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const data = await request('/leaves/my-leaves');
      setBalances(data.balances || []);
      setRequests(data.requests || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    if (!leaveTypeId || !fromDate || !toDate || !reason) {
      return setError('Please fill in all required fields.');
    }

    setError('');
    setSubmitting(true);

    try {
      const data = await request('/leaves/request', {
        method: 'POST',
        body: {
          leaveTypeId,
          fromDate,
          toDate,
          reason
        }
      });

      alert('Leave request submitted successfully.');
      setLeaveTypeId('');
      setFromDate('');
      setToDate('');
      setReason('');
      fetchLeaves();
    } catch (err) {
      setError(err.message || 'Error submitting request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this pending leave request?')) return;

    try {
      await request(`/leaves/cancel/${id}`, { method: 'POST' });
      alert('Leave request has been cancelled.');
      fetchLeaves();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <p>Loading leaves dashboard...</p>
      </div>
    );
  }

  // Dynamic status indicators
  const totalAllocated = balances.reduce((sum, b) => sum + (b.total_days || 0), 0);
  const totalAvailed = balances.reduce((sum, b) => sum + (b.availed_days || 0), 0);
  const totalPending = balances.reduce((sum, b) => sum + (b.pending_days || 0), 0);
  const totalAvailable = totalAllocated - totalAvailed - totalPending;

  // Filter requests
  const filteredRequests = requests.filter(r => {
    if (filterStatus === 'All') return true;
    return r.status.toLowerCase() === filterStatus.toLowerCase();
  });

  return (
    <div style={{ padding: '0px' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1A1D20', margin: '0 0 4px 0' }}>Leave Status</h2>
        <p style={{ color: '#6B7280', fontSize: '12px', margin: 0 }}>Apply for time-off and track your submitted applications.</p>
      </div>

      {/* Balanced indicators row matching Image 3 Screen 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '12px !important', textAlign: 'center', border: '1px solid #E5E7EB' }}>
          <span style={{ fontSize: '10px', color: '#6B7280', display: 'block', marginBottom: '2px', fontWeight: '600' }}>Total Leave</span>
          <h4 style={{ fontSize: '20px', color: '#1A1D20', margin: 0, fontWeight: '700' }}>{totalAllocated} Days</h4>
        </div>
        <div className="card" style={{ padding: '12px !important', textAlign: 'center', border: '1px solid #E5E7EB' }}>
          <span style={{ fontSize: '10px', color: '#6B7280', display: 'block', marginBottom: '2px', fontWeight: '600' }}>Available</span>
          <h4 style={{ fontSize: '20px', color: '#2E62F6', margin: 0, fontWeight: '700' }}>{totalAvailable} Days</h4>
        </div>
        <div className="card" style={{ padding: '12px !important', textAlign: 'center', border: '1px solid #E5E7EB' }}>
          <span style={{ fontSize: '10px', color: '#6B7280', display: 'block', marginBottom: '2px', fontWeight: '600' }}>Applied</span>
          <h4 style={{ fontSize: '20px', color: '#F59E0B', margin: 0, fontWeight: '700' }}>{totalAvailed + totalPending} Days</h4>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        
        {/* Left column: Submit request form */}
        <div className="card" style={{ flex: 1, minWidth: '300px' }}>
          <h3 style={{ fontSize: '13px', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px', marginBottom: '16px', color: '#1A1D20' }}>
            Submit Leave Request
          </h3>

          {error && <div className="alert alert-error" style={{ fontSize: '11px', padding: '10px', marginBottom: '16px' }}><ShieldAlert size={14} /><span>{error}</span></div>}

          <form onSubmit={handleApplyLeave}>
            <div className="form-group">
              <label className="form-label">Leave Category *</label>
              <select className="form-control" value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)} required>
                <option value="">Select Category</option>
                {balances.map(b => <option key={b.leave_type_id} value={b.leave_type_id}>{b.leave_name}</option>)}
              </select>
            </div>

            <div className="form-grid" style={{ marginBottom: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">From Date *</label>
                <input type="date" className="form-control" value={fromDate} onChange={(e) => setFromDate(e.target.value)} required />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">To Date *</label>
                <input type="date" className="form-control" value={toDate} onChange={(e) => setToDate(e.target.value)} required />
              </div>
            </div>

            {totalDays > 0 && (
              <div className="alert alert-info" style={{ marginBottom: '16px', padding: '8px 12px', fontSize: '11px' }}>
                <span>Requested duration: <strong>{totalDays} calendar days</strong></span>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Reason / Remarks *</label>
              <textarea className="form-control" rows="3" placeholder="Provide leave request details..." value={reason} onChange={(e) => setReason(e.target.value)} required style={{ height: 'auto !important' }} />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '38px', borderRadius: '20px' }} disabled={submitting}>
              {submitting ? 'Submitting request...' : 'Send Request'}
            </button>
          </form>
        </div>

        {/* Right column: Request history list cards */}
        <div className="card" style={{ flex: 1.4, minWidth: '320px' }}>
          <h3 style={{ fontSize: '13px', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px', marginBottom: '16px', color: '#1A1D20' }}>
            Leave History Logs
          </h3>

          {/* Status filters */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
            {['All', 'Pending', 'Approved', 'Rejected'].map(status => (
              <button
                key={status}
                type="button"
                onClick={() => setFilterStatus(status)}
                className="btn"
                style={{
                  padding: '4px 12px',
                  fontSize: '10px',
                  borderRadius: '20px',
                  backgroundColor: filterStatus === status ? '#2E62F6' : '#EEF2F6',
                  color: filterStatus === status ? '#FFFFFF' : '#4B5563',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {status}
              </button>
            ))}
          </div>

          {filteredRequests.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '40px 10px', color: '#6B7280', fontSize: '12px' }}>No leave requests found under this category.</p>
          ) : (
            <div style={{ maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
              {filteredRequests.map((r) => (
                <div 
                  key={r.id} 
                  className="card" 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '8px', 
                    padding: '14px !important', 
                    marginBottom: '10px', 
                    border: '1px solid #E5E7EB',
                    boxShadow: 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '12px', color: '#1A1D20' }}>{r.leave_name || r.leave_code}</strong>
                    <span className={`badge ${
                      r.status === 'Approved' ? 'badge-active' : r.status === 'Rejected' ? 'badge-rejected' : r.status === 'Cancelled' ? 'badge-inactive' : 'badge-pending'
                    }`} style={{ fontSize: '9px', padding: '2px 8px' }}>
                      {r.status}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#6B7280' }}>
                    <span>{new Date(r.from_date).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' })} to {new Date(r.to_date).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' })}</span>
                    <strong style={{ color: '#1A1D20' }}>{r.total_days} Days</strong>
                  </div>

                  <div style={{ fontSize: '11px', color: '#4B5563', borderTop: '1px solid #F1F5F9', paddingTop: '6px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                    <span style={{ maxWidth: '80%', wordBreak: 'break-word' }}>Reason: {r.reason}</span>
                    {r.remarks && <span style={{ fontStyle: 'italic', color: '#B45309', fontWeight: 'bold' }}>Mngr: {r.remarks}</span>}
                  </div>

                  {r.status === 'Pending' && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px', borderTop: '1px solid #F1F5F9', paddingTop: '6px' }}>
                      <button 
                        onClick={() => handleCancelRequest(r.id)}
                        className="btn"
                        style={{ padding: '2px 10px', fontSize: '9px', borderRadius: '4px', backgroundColor: '#FEF2F2', color: '#EF4444', border: 'none', cursor: 'pointer', height: '22px' }}
                      >
                        Cancel Request
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
