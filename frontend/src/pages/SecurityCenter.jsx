import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldCheck, Lock, ToggleLeft, ToggleRight, Key, 
  MapPin, Settings, AlertTriangle, ShieldAlert, 
  CheckCircle, Plus, Edit3, Trash2
} from 'lucide-react';

export default function SecurityCenter() {
  const { request } = useAuth();
  
  // Data state
  const [audits, setAudits] = useState([]);
  const [users, setUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [settings, setSettings] = useState({});
  
  // Tab control
  const [activeTab, setActiveTab] = useState('audits'); // 'audits', 'users', 'locations', 'settings'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter state for audit logs
  const [filterUser, setFilterUser] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');

  // Reset password modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [targetUserId, setTargetUserId] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  // Add / Edit location modal state
  const [showLocModal, setShowLocModal] = useState(false);
  const [locForm, setLocForm] = useState({
    id: null, name: '', latitude: '', longitude: '', radiusMeters: 100, allowWithoutLocation: false
  });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'audits') {
        const list = await request(`/security/audit-logs?user=${filterUser}&actionType=${filterAction}&fromDate=${filterFromDate}&toDate=${filterToDate}`);
        setAudits(list);
      } else if (activeTab === 'users') {
        const list = await request('/security/users');
        setUsers(list);
      } else if (activeTab === 'locations') {
        const list = await request('/metadata/work-locations');
        setLocations(list);
      } else if (activeTab === 'settings') {
        const list = await request('/security/settings');
        // Convert array to key-value object
        const obj = {};
        list.forEach(s => { obj[s.setting_key] = s.setting_value; });
        setSettings(obj);
      }
    } catch (err) {
      setError(err.message || 'Error retrieving security parameters.');
    } finally {
      setLoading(false);
    }
  };

  const handleAuditSearch = (e) => {
    e.preventDefault();
    fetchData();
  };

  const handleToggleUserStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    if (!window.confirm(`Are you sure you want to change user status to ${nextStatus.toUpperCase()}?`)) return;

    try {
      await request(`/security/users/${id}/status`, {
        method: 'POST',
        body: { status: nextStatus }
      });
      alert(`User status changed successfully.`);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAdminResetPassword = async (e) => {
    e.preventDefault();
    try {
      await request(`/security/users/${targetUserId}/reset-password`, {
        method: 'POST',
        body: { newPassword }
      });
      alert('Password forcefully updated.');
      setShowResetModal(false);
      setNewPassword('');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSaveLocation = async (e) => {
    e.preventDefault();
    try {
      if (locForm.id) {
        // Edit location
        await request(`/metadata/work-locations/${locForm.id}`, {
          method: 'PUT',
          body: locForm
        });
        alert('Work location updated.');
      } else {
        // Create location
        await request('/metadata/work-locations', {
          method: 'POST',
          body: locForm
        });
        alert('Work location configured.');
      }
      setShowLocModal(false);
      setLocForm({ id: null, name: '', latitude: '', longitude: '', radiusMeters: 100, allowWithoutLocation: false });
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteLocation = async (id) => {
    if (!window.confirm('Delete this work site location?')) return;
    try {
      await request(`/metadata/work-locations/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      alert(err.message || 'Cannot delete. Location is mapped to active employees.');
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      await request('/security/settings', {
        method: 'PUT',
        body: { settings }
      });
      alert('System configurations saved successfully.');
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex-between m-b-20">
        <div>
          <h2 style={{ fontSize: '28px', color: 'var(--chub-purple)' }}>Security & Encryption Center</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Monitor immutable audit trail logs, modify system keys, and manage login authorization parameters.</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { key: 'audits', name: 'Operational Audit logs', icon: ShieldCheck },
          { key: 'users', name: 'Login Credentials', icon: Lock },
          { key: 'locations', name: 'Geofence Boundaries', icon: MapPin },
          { key: 'settings', name: 'System Parameters', icon: Settings }
        ].map(t => {
          const Icon = t.icon;
          return (
            <button 
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`btn ${activeTab === t.key ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: '8px', padding: '10px 20px' }}
            >
              <Icon size={16} /> {t.name}
            </button>
          );
        })}
      </div>

      {error && <div className="alert alert-error"><ShieldAlert /><span>{error}</span></div>}

      <div className="card">
        {loading ? (
          <p>Loading security modules...</p>
        ) : (
          <div>
            
            {/* 1. AUDIT LOGS TAB */}
            {activeTab === 'audits' && (
              <div>
                <h3 style={{ fontSize: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
                  Immutable Operations Audit Trail
                </h3>

                {/* Audit Search form */}
                <form onSubmit={handleAuditSearch} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end', marginBottom: '24px' }}>
                  <div style={{ flex: 1, minWidth: '150px' }}>
                    <label className="form-label">User / Role</label>
                    <input type="text" className="form-control" placeholder="Search Email/Role" value={filterUser} onChange={(e) => setFilterUser(e.target.value)} />
                  </div>
                  <div style={{ flex: 1, minWidth: '150px' }}>
                    <label className="form-label">Action type</label>
                    <input type="text" className="form-control" placeholder="e.g. VIEW_SENSITIVE_KYC" value={filterAction} onChange={(e) => setFilterAction(e.target.value)} />
                  </div>
                  <div style={{ flex: 1, minWidth: '120px' }}>
                    <label className="form-label">From Date</label>
                    <input type="date" className="form-control" value={filterFromDate} onChange={(e) => setFilterFromDate(e.target.value)} />
                  </div>
                  <div style={{ flex: 1, minWidth: '120px' }}>
                    <label className="form-label">To Date</label>
                    <input type="date" className="form-control" value={filterToDate} onChange={(e) => setFilterToDate(e.target.value)} />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ padding: '12px 20px' }}>
                    Filter Logs
                  </button>
                </form>

                {audits.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No audit events found matching parameters.</p>
                ) : (
                  <div className="table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Timestamp (IST)</th>
                          <th>Action Type</th>
                          <th>Performed By</th>
                          <th>Target Node</th>
                          <th>Security Metadata</th>
                        </tr>
                      </thead>
                      <tbody>
                        {audits.map((log) => (
                          <tr key={log.id}>
                            <td style={{ fontSize: '12px' }}>{new Date(log.created_at).toLocaleString()}</td>
                            <td style={{ fontWeight: 'bold', color: 'var(--chub-purple)' }}>{log.action_type}</td>
                            <td>
                              <div><strong>{log.performed_by}</strong></div>
                              <span style={{ fontSize: '11px', color: 'var(--chub-pink)', textTransform: 'uppercase', fontWeight: 600 }}>{log.role}</span>
                            </td>
                            <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{log.target_record || 'N/A'}</td>
                            <td>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                <div>IP: {log.ip_address}</div>
                                <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '250px' }}>UA: {log.user_agent}</div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 2. USER CREDENTIALS MANAGEMENT */}
            {activeTab === 'users' && (
              <div>
                <h3 style={{ fontSize: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
                  Login Credentials Ledger
                </h3>

                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Account Email</th>
                        <th>Linked Employee</th>
                        <th>System Role</th>
                        <th>Authorization Status</th>
                        <th>Credentials Control</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((usr) => (
                        <tr key={usr.id}>
                          <td style={{ fontWeight: 600 }}>{usr.email}</td>
                          <td>
                            {usr.full_name ? (
                              <div>{usr.full_name} <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({usr.employee_id})</span></div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>System Account</span>
                            )}
                          </td>
                          <td><span className="badge badge-kyc-pending">{usr.role_name}</span></td>
                          <td>
                            <span className={`badge ${usr.status === 'active' ? 'badge-active' : 'badge-inactive'}`}>
                              {usr.status}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button 
                                onClick={() => handleToggleUserStatus(usr.id, usr.status)}
                                className="btn btn-secondary"
                                style={{ padding: '6px 12px', fontSize: '12px' }}
                              >
                                {usr.status === 'active' ? 'Deactivate' : 'Activate'}
                              </button>
                              <button 
                                onClick={() => { setTargetUserId(usr.id); setShowResetModal(true); }}
                                className="btn btn-primary"
                                style={{ padding: '6px 12px', fontSize: '12px' }}
                              >
                                <Key size={12} /> Force Reset
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. GEOFENCE BOUNDARIES */}
            {activeTab === 'locations' && (
              <div>
                <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '18px', margin: 0 }}>Geofenced Office Coordinates</h3>
                  <button onClick={() => {
                    setLocForm({ id: null, name: '', latitude: '', longitude: '', radiusMeters: 100, allowWithoutLocation: false });
                    setShowLocModal(true);
                  }} className="btn btn-primary">
                    <Plus size={16} /> Configure Worksite
                  </button>
                </div>

                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Location Name</th>
                        <th>Coordinates (Lat / Lon)</th>
                        <th>Allowed Boundary Radius</th>
                        <th>Bypass Location Allowed</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {locations.map((loc) => (
                        <tr key={loc.id}>
                          <td style={{ fontWeight: 600 }}>{loc.name}</td>
                          <td style={{ fontFamily: 'monospace' }}>{loc.latitude} , {loc.longitude}</td>
                          <td><strong>{loc.radius_meters} Meters</strong></td>
                          <td>
                            <span className={`badge ${loc.allow_without_location ? 'badge-pending' : 'badge-active'}`}>
                              {loc.allow_without_location ? 'Allowed' : 'Strict Geofence'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button 
                                onClick={() => {
                                  setLocForm({
                                    id: loc.id, name: loc.name, latitude: loc.latitude, longitude: loc.longitude,
                                    radiusMeters: loc.radius_meters, allowWithoutLocation: !!loc.allow_without_location
                                  });
                                  setShowLocModal(true);
                                }}
                                className="btn btn-secondary"
                                style={{ padding: '6px 12px', border: 'none' }}
                                title="Edit Location Settings"
                              >
                                <Plus size={16} style={{ color: 'var(--chub-pink)' }} />
                              </button>
                              <button 
                                onClick={() => handleDeleteLocation(loc.id)}
                                className="btn btn-secondary"
                                style={{ padding: '6px 12px', border: 'none' }}
                                title="Delete Location"
                              >
                                <Trash2 size={16} style={{ color: 'var(--color-error)' }} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4. SYSTEM PARAMETERS */}
            {activeTab === 'settings' && (
              <div>
                <h3 style={{ fontSize: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '20px' }}>
                  Global System Parameters
                </h3>
                <form onSubmit={handleSaveSettings} style={{ maxWidth: '550px' }}>
                  <div className="form-group">
                    <label className="form-label">Corporate Display Name</label>
                    <input 
                      type="text" 
                      className="form-control"
                      value={settings.company_name || ''}
                      onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Brand Tagline</label>
                    <input 
                      type="text" 
                      className="form-control"
                      value={settings.tagline || ''}
                      onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Enforce GPS Geofencing Globally</label>
                    <select 
                      className="form-control"
                      value={settings.geofence_enforced || 'true'}
                      onChange={(e) => setSettings({ ...settings, geofence_enforced: e.target.value })}
                    >
                      <option value="true">Enforced (Coordinates Verified)</option>
                      <option value="false">Disabled (Open Clockings)</option>
                    </select>
                  </div>
                  <h4 style={{ color: 'var(--chub-purple)', fontSize: '14px', margin: '24px 0 12px 0' }}>SMTP E-Mail Server Settings (Hostinger Config)</h4>
                  <div className="form-group">
                    <label className="form-label">SMTP Host</label>
                    <input 
                      type="text" 
                      className="form-control"
                      value={settings.smtp_host || ''}
                      onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                    />
                  </div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">SMTP User</label>
                      <input 
                        type="text" 
                        className="form-control"
                        value={settings.smtp_user || ''}
                        onChange={(e) => setSettings({ ...settings, smtp_user: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">SMTP Secure Port</label>
                      <input 
                        type="text" 
                        className="form-control"
                        value={settings.smtp_port || ''}
                        onChange={(e) => setSettings({ ...settings, smtp_port: e.target.value })}
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ marginTop: '20px' }}>
                    Save Configuration Settings
                  </button>
                </form>
              </div>
            )}

          </div>
        )}
      </div>

      {/* FORCE RESET PASSWORD MODAL */}
      {showResetModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '380px' }}>
            <h3 style={{ marginBottom: '16px' }}>Force Password Reset</h3>
            <form onSubmit={handleAdminResetPassword}>
              <div className="form-group">
                <label className="form-label">New Secure Password *</label>
                <input 
                  type="password" 
                  className="form-control" 
                  placeholder="Enter at least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowResetModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Override Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT LOCATION MODAL */}
      {showLocModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <h3 style={{ marginBottom: '20px' }}>
              {locForm.id ? 'Edit Location Geofence' : 'Configure New Worksite'}
            </h3>
            <form onSubmit={handleSaveLocation}>
              <div className="form-group">
                <label className="form-label">Location Site Name *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. Kochi Infopark Main Gate"
                  value={locForm.name}
                  onChange={(e) => setLocForm({ ...locForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Latitude *</label>
                  <input 
                    type="number" 
                    step="0.00000001"
                    className="form-control" 
                    placeholder="e.g. 10.0104"
                    value={locForm.latitude}
                    onChange={(e) => setLocForm({ ...locForm, latitude: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Longitude *</label>
                  <input 
                    type="number" 
                    step="0.00000001"
                    className="form-control" 
                    placeholder="e.g. 76.3618"
                    value={locForm.longitude}
                    onChange={(e) => setLocForm({ ...locForm, longitude: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Radius (Allowed boundary meters) *</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="e.g. 100"
                  value={locForm.radiusMeters}
                  onChange={(e) => setLocForm({ ...locForm, radiusMeters: Number(e.target.value) })}
                  required
                />
              </div>

              <div className="form-group">
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox"
                    checked={locForm.allowWithoutLocation}
                    onChange={(e) => setLocForm({ ...locForm, allowWithoutLocation: e.target.checked })}
                  /> 
                  <span>Allow bypass (Skip coordinates validation if GPS denied)</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowLocModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
