import React, { useState, useEffect } from 'react';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import { User, Lock, Key, ShieldAlert, CheckCircle, FileText, Camera, LogOut, Settings, Bell } from 'lucide-react';

export default function ESSProfile() {
  const { request, fetchProfile: refreshGlobalProfile, logout } = useAuth();
  
  // Profile state
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Photo upload state
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');

  // Password reset state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [passSubmitting, setPassSubmitting] = useState(false);

  // Notifications toggle state
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await request('/auth/me');
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

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.match(/image\/(jpeg|jpg|png)/i)) {
      return setPhotoError('Only JPG, JPEG, and PNG images are allowed.');
    }
    if (file.size > 2 * 1024 * 1024) {
      return setPhotoError('Image size must be less than 2MB.');
    }

    setPhotoError('');
    setUploadingPhoto(true);

    const formData = new FormData();
    formData.append('photo', file);

    try {
      const res = await fetch(`${API_BASE_URL}/ess/profile/photo`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Photo upload failed.');
      }

      await fetchProfile();
      if (refreshGlobalProfile) {
        await refreshGlobalProfile();
      }
      alert('Profile photo updated successfully!');
    } catch (err) {
      console.error(err);
      setPhotoError(err.message || 'Failed to upload photo.');
    } finally {
      setUploadingPhoto(false);
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

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      logout();
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <p>Loading employee profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="alert alert-warning">
        <ShieldAlert />
        <span>No linked employee profile was found for this user account. Contact administration.</span>
      </div>
    );
  }

  const { employee, kyc } = profile;
  const joinedDate = employee.appointed_date ? new Date(employee.appointed_date).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';

  return (
    <div style={{ padding: '0px' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1A1D20', margin: '0 0 4px 0' }}>Profile Details</h2>
        <p style={{ color: '#6B7280', fontSize: '12px', margin: 0 }}>Manage your personal credentials, profile picture, and security parameters.</p>
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        
        {/* Left Column: Profile Card & Information */}
        <div style={{ flex: 1.4, minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Profile header card layout with center photo */}
          <div className="card ess-profile-header-card">
            <div className="ess-profile-header-card-bg" />
            
            <div className="ess-profile-avatar-wrapper">
              <input 
                type="file" 
                id="profile-photo-input-main" 
                accept="image/*" 
                style={{ display: 'none' }} 
                onChange={handlePhotoUpload} 
              />
              <div 
              className="ess-avatar-uploader" 
              onClick={() => document.getElementById('profile-photo-input-main').click()}
              title="Click to update photo"
              style={{ position: 'relative', overflow: 'hidden' }}
            >
              {employee.photo_path && (
                <img 
                  src={`${API_BASE_URL.replace('/api', '')}/${employee.photo_path}`} 
                  alt={employee.full_name} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )}
              <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #1E50DD 0%, #2E62F6 100%)',
                color: '#FFFFFF',
                fontSize: '24px',
                fontWeight: 'bold'
              }}>
                {employee.full_name?.charAt(0).toUpperCase()}
              </div>
              <div className="ess-avatar-uploader-overlay">
                <Camera size={16} />
              </div>
            </div>
            </div>

            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1A1D20', margin: '4px 0 2px 0' }}>{employee.full_name}</h3>
            <p style={{ color: '#6B7280', fontSize: '11px', margin: '2px 0 6px 0' }}>
              {employee.designation_name} • {employee.department_name}
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <span className="badge" style={{ backgroundColor: '#EFF6FF', color: '#2E62F6', fontSize: '10px' }}>{employee.employee_id}</span>
              <span className="badge" style={{ backgroundColor: '#ECFDF5', color: '#10B981', fontSize: '10px' }}>{employee.employment_type}</span>
            </div>

            {photoError && <p style={{ color: '#EF4444', fontSize: '11px', margin: '8px 0 0 0' }}>{photoError}</p>}
            {uploadingPhoto && <p style={{ color: '#2E62F6', fontSize: '11px', margin: '8px 0 0 0' }}>Uploading photo...</p>}
          </div>

          {/* List info groups: Mobile No, Email ID, DOB, Blood Group */}
          <div className="card" style={{ padding: '0px !important', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px 8px 20px', borderBottom: '1px solid #F1F5F9' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#1A1D20', margin: 0 }}>Corporate & Personal info</h4>
            </div>

            <div className="ess-list-item">
              <span>Mobile No</span>
              <strong>{employee.mobile || 'N/A'}</strong>
            </div>
            <div className="ess-list-item">
              <span>Email ID</span>
              <strong>{employee.email || 'N/A'}</strong>
            </div>
            <div className="ess-list-item">
              <span>DOB / Birthday</span>
              <strong>{employee.dob ? new Date(employee.dob).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}</strong>
            </div>
            <div className="ess-list-item">
              <span>Blood Group</span>
              <strong>{employee.blood_group || 'N/A'}</strong>
            </div>
            <div className="ess-list-item">
              <span>Joined Date</span>
              <strong>{joinedDate}</strong>
            </div>
            <div className="ess-list-item">
              <span>Geofence Location</span>
              <strong>{employee.work_location_name || 'Main Office'}</strong>
            </div>
          </div>

          {/* Masked KYC Card */}
          <div className="card" style={{ border: '1px dashed #D1D5DB' }}>
            <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#1A1D20', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px', marginBottom: '12px' }}>
              Verification & KYC Settings
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6B7280' }}>Aadhaar Number</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{kyc?.aadhaar || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6B7280' }}>PAN Code</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{kyc?.pan || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6B7280' }}>Bank Account</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{kyc?.bank_account || 'N/A'}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Settings & Password Change */}
        <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Action blocks: Notification Switch, Settings, Logout */}
          <div className="card">
            <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#1A1D20', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px', marginBottom: '16px' }}>
              Account Actions
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Notification switch */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Bell size={16} style={{ color: '#2E62F6' }} />
                  <span>Push Notifications</span>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '36px', height: '20px' }}>
                  <input 
                    type="checkbox" 
                    checked={notificationsEnabled} 
                    onChange={(e) => setNotificationsEnabled(e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }} 
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: notificationsEnabled ? '#2E62F6' : '#D1D5DB',
                    transition: '.3s', borderRadius: '20px'
                  }}>
                    <span style={{
                      position: 'absolute', content: '""', height: '14px', width: '14px', left: '3px', bottom: '3px',
                      backgroundColor: '#FFFFFF', transition: '.3s', borderRadius: '50%',
                      transform: notificationsEnabled ? 'translateX(16px)' : 'translateX(0)'
                    }} />
                  </span>
                </label>
              </div>

              {/* Settings Link */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', cursor: 'pointer' }} onClick={() => alert("Settings center under active maintenance.")}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Settings size={16} style={{ color: '#4B5563' }} />
                  <span>App Preferences</span>
                </div>
                <span style={{ color: '#9CA3AF', fontSize: '12px' }}>&gt;</span>
              </div>

              {/* Logout button */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', cursor: 'pointer', color: '#EF4444' }} onClick={handleLogout}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <LogOut size={16} style={{ color: '#EF4444' }} />
                  <span>Disconnect Session</span>
                </div>
                <span style={{ color: '#EF4444', fontWeight: 'bold' }}>Exit</span>
              </div>

            </div>
          </div>

          {/* Change Password Card */}
          <div className="card">
            <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#1A1D20', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px', marginBottom: '16px' }}>
              Security Credentials Update
            </h4>

            {passError && <div className="alert alert-error" style={{ fontSize: '11px', padding: '10px', marginBottom: '14px' }}><ShieldAlert size={14} /><span>{passError}</span></div>}
            {passSuccess && <div className="alert alert-success" style={{ fontSize: '11px', padding: '10px', marginBottom: '14px' }}><CheckCircle size={14} /><span>{passSuccess}</span></div>}

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
              <div className="form-group" style={{ marginBottom: '20px' }}>
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

              <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '38px', borderRadius: '20px' }} disabled={passSubmitting}>
                {passSubmitting ? 'Updating password...' : 'Override Password'}
              </button>
            </form>
          </div>

        </div>

      </div>
    </div>
  );
}
