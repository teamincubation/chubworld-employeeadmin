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

  // Form states
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [medicalProof, setMedicalProof] = useState(null);

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
      setBalances(data.balances);
      setRequests(data.requests);
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

    // Find if selected type is SL
    const activeType = balances.find(b => b.leave_type_id === Number(leaveTypeId));
    if (activeType?.leave_code === 'SL' && totalDays >= 3 && !medicalProof) {
      return setError('Medical certificate attachment is mandatory for sick leaves of 3 days or more.');
    }

    setError('');
    setSubmitting(true);

    try {
      const form = new FormData();
      form.append('leaveTypeId', leaveTypeId);
      form.append('fromDate', fromDate);
      form.append('toDate', toDate);
      form.append('reason', reason);
      if (medicalProof) {
        form.append('medical_proof', medicalProof);
      }

      // Call API using fetch directly since it's FormData
      const res = await fetch('http://localhost:5000/api/leaves/request', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: form
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error submitting leave request.');
      }

      alert('Leave request submitted successfully.');
      // Reset form
      setLeaveTypeId('');
      setFromDate('');
      setToDate('');
      setReason('');
      setMedicalProof(null);
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
    return <p style={{ padding: '20px' }}>Loading leaves logs...</p>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex-between m-b-20">
        <div>
          <h2 style={{ fontSize: '28px', color: 'var(--chub-purple)' }}>Leave Requests</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Monitor remaining balances and submit leave applications.</p>
        </div>
      </div>

      {/* Leave Balances Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {balances.map((b, idx) => {
          const available = b.total_days - b.availed_days - b.pending_days;
          return (
            <div key={idx} className="card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                background: 'var(--chub-light-lavender)', display: 'flex',
                alignItems: 'center', justifyCenter: 'center', justifyContent: 'center', color: 'var(--chub-purple)'
              }}>
                <CalendarDays size={24} />
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  {b.leave_name} ({b.leave_code})
                </span>
                <h4 style={{ fontSize: '24px', margin: 0 }}>{available} / {b.total_days} Days</h4>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Availed: {b.availed_days} | Pending: {b.pending_days}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        {/* Left column: Submit request form */}
        <div className="card" style={{ flex: 1, minWidth: '320px' }}>
          <h3 style={{ fontSize: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px' }}>
            Submit Leave Request
          </h3>

          {error && <div className="alert alert-error"><ShieldAlert /><span>{error}</span></div>}

          <form onSubmit={handleApplyLeave}>
            <div className="form-group">
              <label className="form-label">Leave Category *</label>
              <select className="form-control" value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)} required>
                <option value="">Select Category</option>
                {balances.map(b => <option key={b.leave_type_id} value={b.leave_type_id}>{b.leave_name}</option>)}
              </select>
            </div>

            <div className="form-grid" style={{ marginBottom: '16px' }}>
              <div className="form-group">
                <label className="form-label">From Date *</label>
                <input type="date" className="form-control" value={fromDate} onChange={(e) => setFromDate(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">To Date *</label>
                <input type="date" className="form-control" value={toDate} onChange={(e) => setToDate(e.target.value)} required />
              </div>
            </div>

            {totalDays > 0 && (
              <div className="alert alert-info" style={{ marginBottom: '20px' }}>
                <span>Requested duration: <strong>{totalDays} calendar days</strong></span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Reason / Remarks *</label>
              <textarea className="form-control" rows="3" placeholder="Provide leave request details..." value={reason} onChange={(e) => setReason(e.target.value)} required />
            </div>

            {/* Optional/Mandatory medical upload */}
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label">Medical Certificate (PDF/JPG if Sick Leave (3+ Days))</label>
              <input type="file" className="form-control" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setMedicalProof(e.target.files[0])} />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
              {submitting ? 'Submitting request...' : 'Send Request'}
            </button>
          </form>
        </div>

        {/* Right column: Request history */}
        <div className="card" style={{ flex: 1.5, minWidth: '400px' }}>
          <h3 style={{ fontSize: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px' }}>
            Leave History logs
          </h3>

          {requests.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No previous leave requests submitted.</p>
          ) : (
            <div className="table-container" style={{ border: 'none' }}>
              <table className="custom-table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Dates</th>
                    <th>Days</th>
                    <th>Status</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.leave_code}</td>
                      <td>
                        <div style={{ fontSize: '12px' }}>{new Date(r.from_date).toLocaleDateString()} to {new Date(r.to_date).toLocaleDateString()}</div>
                      </td>
                      <td style={{ fontWeight: 'bold' }}>{r.total_days}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span className={`badge ${
                            r.status === 'Approved' ? 'badge-active' : r.status === 'Rejected' ? 'badge-rejected' : r.status === 'Cancelled' ? 'badge-inactive' : 'badge-pending'
                          }`}>
                            {r.status}
                          </span>
                          {r.status === 'Pending' && (
                            <button 
                              onClick={() => handleCancelRequest(r.id)}
                              className="btn btn-danger"
                              style={{ padding: '2px 8px', fontSize: '10px', borderRadius: '4px' }}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                        <div>{r.reason.substring(0, 30)}</div>
                        {r.remarks && <div style={{ fontStyle: 'italic', marginTop: '4px', color: 'var(--chub-pink)' }}>Mgr: {r.remarks}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
