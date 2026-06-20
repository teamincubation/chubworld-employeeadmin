import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Lock, Key, ShieldAlert, CheckCircle, FileText } from 'lucide-react';

export default function ESSProfile() {
  const { request } = useAuth();
  
  // Profile state
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Password reset state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [passSubmitting, setPassSubmitting] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await request('/auth/me');
      
      // Load detailed employee profile using auth.me linked employee
      if (data.employee?.id) {
        const details = await request(`/employees/${data.employee.id}`);
        setProfile(details);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      return setPassError('New password must be at least 6 characters.');
    }
    if (newPassword !== confirmPassword) {
      return setPassError('Confirm password does not match.');
    }

    setPassError('');
    setPassSuccess('');
    setPassSubmitting(true);

    try {
      const res = await request('/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword }
      });
      setPassSuccess(res.message || 'Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPassError(err.message || 'Password update failed.');
    } finally {
      setPassSubmitting(false);
    }
  };

  if (loading) {
    return <p style={{ padding: '20px' }}>Loading profile parameters...</p>;
  }

  if (!profile) {
    return (
      <div className="alert alert-warning">
        <ShieldAlert />
        <span>No linked employee profile was found for this user account. Contact administration.</span>
      </div>
    );
  }

  const { employee, kyc, documents } = profile;

  return (
    <div>
      {/* Header */}
      <div className="flex-between m-b-20">
        <div>
          <h2 style={{ fontSize: '28px', color: 'var(--chub-purple)' }}>My Profile</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Securely access your corporate parameters and update your authorization password.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        
        {/* Left Column: Personal details */}
        <div style={{ flex: 1.5, minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Header Summary */}
          <div className="card" style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '12px',
              background: 'var(--chub-light-lavender)', border: '2px solid var(--chub-pink)',
              display: 'flex', alignItems: 'center', justifyCenter: 'center', justifyContent: 'center',
              overflow: 'hidden', flexShrink: 0
            }}>
              {employee.photo_path ? (
                <img 
                  src={`http://localhost:5000/api/documents/download/${employee.photo_path.split('/').pop()}`} 
                  alt="Avatar" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <User size={36} style={{ color: 'var(--chub-purple)' }} />
              )}
            </div>
            <div>
              <h3 style={{ fontSize: '22px', color: 'var(--chub-purple)', margin: 0 }}>{employee.full_name}</h3>
              <p style={{ color: 'var(--chub-pink)', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase' }}>
                {employee.designation_name} • {employee.department_name}
              </p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px', fontSize: '11px' }}>
                <span className="badge badge-onboarding">{employee.employee_id}</span>
                <span className="badge badge-active">{employee.employment_type}</span>
              </div>
            </div>
          </div>

          {/* Details Section */}
          <div className="card">
            <h4 style={{ fontSize: '15px', color: 'var(--chub-purple)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '16px' }}>
              Official & Personal Information
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', fontSize: '14px' }}>
              <div><strong>Email ID:</strong> <p style={{ color: 'var(--text-muted)' }}>{employee.email}</p></div>
              <div><strong>Mobile Number:</strong> <p style={{ color: 'var(--text-muted)' }}>{employee.mobile}</p></div>
              <div><strong>Residential Address:</strong> <p style={{ color: 'var(--text-muted)' }}>{employee.current_address}</p></div>
              <div><strong>Office Geofence:</strong> <p style={{ color: 'var(--text-muted)' }}>{employee.work_location_name || 'N/A'}</p></div>
              <div><strong>Manager:</strong> <p style={{ color: 'var(--text-muted)' }}>{employee.manager_name || 'None'}</p></div>
              <div><strong>Appointed Date:</strong> <p style={{ color: 'var(--text-muted)' }}>{employee.appointed_date ? new Date(employee.appointed_date).toLocaleDateString() : 'N/A'}</p></div>
              <div><strong>Emergency Contact:</strong> <p style={{ color: 'var(--text-muted)' }}>{employee.emergency_contact_name} ({employee.emergency_contact_number})</p></div>
              <div><strong>Blood Group:</strong> <p style={{ color: 'var(--text-muted)' }}>{employee.blood_group || 'N/A'}</p></div>
            </div>
          </div>

          {/* Masked KYC details */}
          <div className="card" style={{ border: '1px dashed var(--chub-purple)' }}>
            <h4 style={{ fontSize: '15px', color: 'var(--chub-purple)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '16px' }}>
              Masked Sensitive KYC Parameters
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
              <div className="flex-between"><strong>Aadhaar Card:</strong> <span style={{ fontFamily: 'monospace' }}>{kyc.aadhaar}</span></div>
              <div className="flex-between"><strong>PAN Card:</strong> <span style={{ fontFamily: 'monospace' }}>{kyc.pan}</span></div>
              <div className="flex-between"><strong>Bank Account:</strong> <span style={{ fontFamily: 'monospace' }}>{kyc.bank_account}</span></div>
              <div className="flex-between"><strong>UPI Identifier:</strong> <span>{kyc.upi_id || 'N/A'}</span></div>
            </div>
            <div style={{ marginTop: '16px', padding: '10px', backgroundColor: 'var(--chub-light-lavender)', borderRadius: '6px', fontSize: '11px', color: 'var(--chub-purple)', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Lock size={14} />
              <span>Full details are visible only to authorized HR Managers and Financial Auditors.</span>
            </div>
          </div>

        </div>

        {/* Right Column: Password and Documents */}
        <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Change Password Card */}
          <div className="card">
            <h4 style={{ fontSize: '15px', color: 'var(--chub-purple)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '16px' }}>
              Security Credentials Update
            </h4>

            {passError && <div className="alert alert-error"><ShieldAlert /><span>{passError}</span></div>}
            {passSuccess && <div className="alert alert-success"><CheckCircle /><span>{passSuccess}</span></div>}

            <form onSubmit={handleChangePassword}>
              <div className="form-group">
                <label className="form-label">Current password *</label>
                <input 
                  type="password" 
                  className="form-control"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">New secure password *</label>
                <input 
                  type="password" 
                  className="form-control"
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label">Confirm new password *</label>
                <input 
                  type="password" 
                  className="form-control"
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={passSubmitting}>
                {passSubmitting ? 'Updating Key...' : 'Override Password'}
              </button>
            </form>
          </div>

          {/* Documents Registry */}
          <div className="card">
            <h4 style={{ fontSize: '15px', color: 'var(--chub-purple)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '16px' }}>
              My Uploaded Documents
            </h4>
            {documents.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>No attachments found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {documents.map((doc) => (
                  <div key={doc.id} className="flex-between" style={{ padding: '8px 12px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', fontSize: '13px' }}>
                    <span style={{ fontWeight: 600 }}>{doc.document_type}</span>
                    <a 
                      href={`http://localhost:5000/api/documents/download/doc-${doc.id}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--chub-pink)', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <FileText size={14} /> Open file
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
