import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldCheck, Lock, ToggleLeft, ToggleRight, Key, 
  MapPin, Settings, AlertTriangle, ShieldAlert, 
  CheckCircle, Plus, Edit3, Trash2, Building
} from 'lucide-react';

export default function SecurityCenter() {
  const { request, user } = useAuth();
  
  // Data state
  const [audits, setAudits] = useState([]);
  const [users, setUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [settings, setSettings] = useState({});
  const [ipLocations, setIpLocations] = useState({});
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('');
  
  // Organization Modals
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [deptForm, setDeptForm] = useState({ id: null, name: '' });
  const [showDesigModal, setShowDesigModal] = useState(false);
  const [desigForm, setDesigForm] = useState({ id: null, name: '', department_id: '' });
  
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

  // Licensing state
  const [licensingData, setLicensingData] = useState({ modules: [], admin_creation_limit: 3 });
  const [subAdminsList, setSubAdminsList] = useState([]);
  const [selectedSubAdminId, setSelectedSubAdminId] = useState('');
  const [subAdminAccess, setSubAdminAccess] = useState([]);
  const [licensingSaving, setLicensingSaving] = useState(false);

  const handleSelectSubAdmin = async (userId) => {
    setSelectedSubAdminId(userId);
    if (!userId) {
      setSubAdminAccess([]);
      return;
    }
    try {
      const data = await request(`/security/sub-admin-licensing/${userId}`);
      setSubAdminAccess(data || []);
    } catch (err) {
      alert(err.message || 'Error loading sub-admin access settings.');
    }
  };

  const handleSaveLicensing = async (e) => {
    e.preventDefault();
    setLicensingSaving(true);
    try {
      await request('/security/licensing', {
        method: 'PUT',
        body: licensingData
      });
      alert('Licensing details updated successfully.');
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to save licensing settings.');
    } finally {
      setLicensingSaving(false);
    }
  };

  const handleSaveSubAdminAccess = async (e) => {
    e.preventDefault();
    if (!selectedSubAdminId) return;
    setLicensingSaving(true);
    try {
      await request(`/security/sub-admin-licensing/${selectedSubAdminId}`, {
        method: 'PUT',
        body: { modules: subAdminAccess }
      });
      alert('Sub-admin access rules updated successfully.');
    } catch (err) {
      alert(err.message || 'Failed to save sub-admin access.');
    } finally {
      setLicensingSaving(false);
    }
  };
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

  useEffect(() => {
    const resolveIps = async () => {
      const uniqueIps = [...new Set(audits.map(log => log.ip_address).filter(ip => ip && ip !== '127.0.0.1' && ip !== '::1' && ip !== '::ffff:127.0.0.1'))];
      const newLocs = { ...ipLocations };
      let updated = false;
      for (const ip of uniqueIps) {
        if (!newLocs[ip]) {
          try {
            const res = await fetch(`https://freeipapi.com/api/json/${ip}`);
            if (res.ok) {
              const data = await res.json();
              if (data.cityName && data.countryName) {
                newLocs[ip] = `${data.cityName}, ${data.countryName}`;
                updated = true;
              } else {
                newLocs[ip] = 'Unknown Location';
              }
            }
          } catch (e) {
            console.error('IP resolve error for ' + ip, e);
          }
        }
      }
      if (updated) {
        setIpLocations(newLocs);
      }
    };
    if (audits.length > 0) {
      resolveIps();
    }
  }, [audits]);

  const handleSaveDepartment = async (e) => {
    e.preventDefault();
    try {
      if (deptForm.id) {
        await request(`/metadata/departments/${deptForm.id}`, {
          method: 'PUT',
          body: { name: deptForm.name }
        });
        alert('Department updated.');
      } else {
        await request('/metadata/departments', {
          method: 'POST',
          body: { name: deptForm.name }
        });
        alert('Department created.');
      }
      setShowDeptModal(false);
      setDeptForm({ id: null, name: '' });
      fetchData();
    } catch (err) {
      alert(err.message || 'Error saving department.');
    }
  };

  const handleDeleteDepartment = async (id) => {
    if (!window.confirm('Are you sure you want to delete this department? Aligned designations might also be affected.')) return;
    try {
      await request(`/metadata/departments/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      alert(err.message || 'Cannot delete department. Employees are assigned to it.');
    }
  };

  const handleSaveDesignation = async (e) => {
    e.preventDefault();
    try {
      if (desigForm.id) {
        await request(`/metadata/designations/${desigForm.id}`, {
          method: 'PUT',
          body: { name: desigForm.name, department_id: desigForm.department_id }
        });
        alert('Designation updated.');
      } else {
        await request('/metadata/designations', {
          method: 'POST',
          body: { name: desigForm.name, department_id: desigForm.department_id }
        });
        alert('Designation created.');
      }
      setShowDesigModal(false);
      setDesigForm({ id: null, name: '', department_id: '' });
      fetchData();
    } catch (err) {
      alert(err.message || 'Error saving designation.');
    }
  };

  const handleDeleteDesignation = async (id) => {
    if (!window.confirm('Delete this designation?')) return;
    try {
      await request(`/metadata/designations/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      alert(err.message || 'Cannot delete designation. Employees are assigned to it.');
    }
  };

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
      } else if (activeTab === 'organization') {
        const depts = await request('/metadata/departments');
        const desigs = await request('/metadata/designations');
        setDepartments(depts);
        setDesignations(desigs);
      } else if (activeTab === 'settings') {
        const list = await request('/security/settings');
        // Convert array to key-value object
        const obj = {};
        list.forEach(s => { obj[s.setting_key] = s.setting_value; });
        setSettings(obj);
      } else if (activeTab === 'licensing') {
        const lic = await request('/security/licensing');
        setLicensingData(lic || { modules: [], admin_creation_limit: 3 });
        const userList = await request('/security/users');
        const subAdmins = (userList || []).filter(u => u.role_name !== 'Employee' && u.role_name !== 'Super Admin' && u.role_name !== 'Admin Controller');
        setSubAdminsList(subAdmins);
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

  const handleHardDeleteUser = async (id, email) => {
    const confirmation1 = window.confirm(`WARNING: You are about to HARD DELETE user ${email}.\nThis will permanently purge this user account and ALL associated records (including employee profile, KYC data, upload documents, geofence assignments, and attendance logs) from the system database.\nThis action is compliance-logged and CANNOT BE UNDONE.\n\nAre you sure you want to proceed?`);
    if (!confirmation1) return;

    const confirmation2 = window.prompt(`To confirm hard deletion, please type the user's email address (${email}) below:`);
    if (confirmation2 !== email) {
      alert('Email mismatch. Action aborted.');
      return;
    }

    try {
      setLoading(true);
      await request(`/security/users/${id}`, {
        method: 'DELETE'
      });
      alert(`User ${email} and all related records have been completely purged from the system.`);
      fetchData();
    } catch (err) {
      alert(err.message || 'Error purging user data.');
      setLoading(false);
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
          { key: 'organization', name: 'Org Structure', icon: Building },
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
                                {log.ip_address === '127.0.0.1' || log.ip_address === '::1' || log.ip_address === '::ffff:127.0.0.1' ? (
                                  <div style={{ color: 'var(--chub-pink)', fontWeight: 600 }}>Localhost (Developer Session)</div>
                                ) : (
                                  <div style={{ color: 'var(--chub-purple)', fontWeight: 600 }}>
                                    {ipLocations[log.ip_address] || 'Resolving location...'}
                                  </div>
                                )}
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
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span>{usr.full_name}</span>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({usr.employee_id})</span>
                                {usr.is_soft_deleted && (
                                  <span className="badge badge-inactive" style={{ backgroundColor: 'rgba(229, 57, 53, 0.1)', color: '#e53935', fontSize: '10px', padding: '2px 6px', fontWeight: 'bold' }}>
                                    Soft Deleted
                                  </span>
                                )}
                              </div>
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
                              <button 
                                onClick={() => handleHardDeleteUser(usr.id, usr.email)}
                                className="btn btn-secondary"
                                style={{ padding: '6px 12px', fontSize: '12px', borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
                                title="Purge all user database records and files"
                              >
                                <Trash2 size={12} /> Purge All
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

            {/* 3.5. DEPARTMENTS & DESIGNATIONS */}
            {activeTab === 'organization' && (
              <div>
                <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
                  {/* Left Column: Departments list */}
                  <div style={{ flex: 1, minWidth: '320px' }}>
                    <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '18px', margin: 0, color: 'var(--chub-purple)' }}>Departments</h3>
                      <button onClick={() => { setDeptForm({ id: null, name: '' }); setShowDeptModal(true); }} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '13px' }}>
                        <Plus size={14} /> Add Dept
                      </button>
                    </div>

                    <div className="table-container">
                      <table className="custom-table" style={{ fontSize: '13px' }}>
                        <thead>
                          <tr>
                            <th>Department Name</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {departments.map((dept) => (
                            <tr key={dept.id} style={{ backgroundColor: selectedDeptFilter === String(dept.id) ? 'rgba(216, 90, 166, 0.05)' : 'transparent' }}>
                              <td style={{ fontWeight: 600, cursor: 'pointer', color: selectedDeptFilter === String(dept.id) ? 'var(--chub-pink)' : 'inherit' }} onClick={() => setSelectedDeptFilter(selectedDeptFilter === String(dept.id) ? '' : String(dept.id))}>
                                {dept.name}
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button onClick={() => { setDeptForm({ id: dept.id, name: dept.name }); setShowDeptModal(true); }} className="btn btn-secondary" style={{ padding: '4px 8px', border: 'none' }} title="Edit Department">
                                    <Plus size={14} style={{ color: 'var(--chub-pink)' }} />
                                  </button>
                                  <button onClick={() => handleDeleteDepartment(dept.id)} className="btn btn-secondary" style={{ padding: '4px 8px', border: 'none' }} title="Delete Department">
                                    <Trash2 size={14} style={{ color: 'var(--color-error)' }} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right Column: Designations list */}
                  <div style={{ flex: 1.5, minWidth: '360px' }}>
                    <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h3 style={{ fontSize: '18px', margin: 0, color: 'var(--chub-purple)' }}>Designations</h3>
                        <select className="form-control" style={{ padding: '4px 8px', fontSize: '12px', width: 'auto', height: 'auto', display: 'inline-block' }} value={selectedDeptFilter} onChange={(e) => setSelectedDeptFilter(e.target.value)}>
                          <option value="">All Departments</option>
                          {departments.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
                        </select>
                      </div>
                      <button onClick={() => { setDesigForm({ id: null, name: '', department_id: selectedDeptFilter || '' }); setShowDesigModal(true); }} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '13px' }}>
                        <Plus size={14} /> Add Designation
                      </button>
                    </div>

                    <div className="table-container">
                      <table className="custom-table" style={{ fontSize: '13px' }}>
                        <thead>
                          <tr>
                            <th>Designation Name</th>
                            <th>Aligned Department</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {designations
                            .filter(desig => !selectedDeptFilter || String(desig.department_id) === selectedDeptFilter)
                            .map((desig) => (
                              <tr key={desig.id}>
                                <td style={{ fontWeight: 600 }}>{desig.name}</td>
                                <td><span className="badge badge-kyc-pending">{desig.department_name || 'Unassigned'}</span></td>
                                <td>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button onClick={() => { setDesigForm({ id: desig.id, name: desig.name, department_id: desig.department_id || '' }); setShowDesigModal(true); }} className="btn btn-secondary" style={{ padding: '4px 8px', border: 'none' }} title="Edit Designation">
                                      <Plus size={14} style={{ color: 'var(--chub-pink)' }} />
                                    </button>
                                    <button onClick={() => handleDeleteDesignation(desig.id)} className="btn btn-secondary" style={{ padding: '4px 8px', border: 'none' }} title="Delete Designation">
                                      <Trash2 size={14} style={{ color: 'var(--color-error)' }} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
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
                  <div className="form-group">
                    <label className="form-label">SMTP Email Password</label>
                    <input 
                      type="password" 
                      className="form-control"
                      value={settings.smtp_pass || ''}
                      onChange={(e) => setSettings({ ...settings, smtp_pass: e.target.value })}
                      placeholder="SMTP Email account authentication key"
                    />
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

      {/* ADD / EDIT DEPARTMENT MODAL */}
      {showDeptModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '380px' }}>
            <h3 style={{ marginBottom: '20px' }}>
              {deptForm.id ? 'Modify Department' : 'Create New Department'}
            </h3>
            <form onSubmit={handleSaveDepartment}>
              <div className="form-group">
                <label className="form-label">Department Name *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. Engineering"
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowDeptModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT DESIGNATION MODAL */}
      {showDesigModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <h3 style={{ marginBottom: '20px' }}>
              {desigForm.id ? 'Modify Designation' : 'Create New Designation'}
            </h3>
            <form onSubmit={handleSaveDesignation}>
              <div className="form-group">
                <label className="form-label">Designation Title *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. Senior developer"
                  value={desigForm.name}
                  onChange={(e) => setDesigForm({ ...desigForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Align to Department *</label>
                <select 
                  className="form-control" 
                  value={desigForm.department_id}
                  onChange={(e) => setDesigForm({ ...desigForm, department_id: e.target.value })}
                  required
                >
                  <option value="">Select Department Alignment</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowDesigModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Designation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
