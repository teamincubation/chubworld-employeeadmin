import React, { useState, useEffect } from 'react';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import { 
  ShieldCheck, ShieldAlert, CheckCircle, Plus, Edit3, Trash2, 
  Key, Users, Settings, Play, Pause, Power, Ban, Clock 
} from 'lucide-react';

export default function LicensingCenter() {
  const { request, user } = useAuth();
  
  // Tab control
  const [activeSubTab, setActiveSubTab] = useState('controller'); // 'controller', 'subadmins'
    // Licensing Data state
  const [licensingData, setLicensingData] = useState({ modules: [], admin_creation_limit: 3 });
  const [subAdminsList, setSubAdminsList] = useState([]);
  const [selectedSubAdminId, setSelectedSubAdminId] = useState('');
  const [subAdminAccess, setSubAdminAccess] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [licensingSaving, setLicensingSaving] = useState(false);

  // Wiping confirmation modal states
  const [showWipeModal, setShowWipeModal] = useState(false); // false, 'database', 'employees'
  const [confirmInput, setConfirmInput] = useState('');
  const [wipeLoading, setWipeLoading] = useState(false);
  // Admin Controller specific states
  const [employeesList, setEmployeesList] = useState([]);
  const [adminController, setAdminController] = useState(null);
  const [adminCtrlName, setAdminCtrlName] = useState('');
  const [adminCtrlEmail, setAdminCtrlEmail] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [statusUpdating, setStatusUpdating] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeSubTab]);

  useEffect(() => {
    let timer;
    if (activeSubTab === 'controller' && adminController && adminController.status === 'Active' && adminController.activated_at) {
      timer = setInterval(() => {
        const start = new Date(adminController.activated_at).getTime();
        const elapsed = Math.floor((Date.now() - start) / 1000);
        const base = adminController.total_active_seconds || 0;
        setElapsedSeconds(base + (elapsed > 0 ? elapsed : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [activeSubTab, adminController]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      if (activeSubTab === 'controller') {
        const lic = await request('/security/licensing');
        setLicensingData(lic || { modules: [], admin_creation_limit: 3 });

        // Fetch active employees dropdown list
        const emps = await request('/employees/dropdown');
        setEmployeesList(emps || []);

        // Fetch current Admin Controller details
        const controller = await request('/security/admin-controller');
        setAdminController(controller);
        if (controller) {
          setElapsedSeconds(controller.accumulated_seconds || 0);
          setAdminCtrlName(controller.full_name || '');
          setAdminCtrlEmail(controller.email || '');
          setInputPassword(controller.password_plain || '');
        } else {
          setElapsedSeconds(0);
          setAdminCtrlName('');
          setAdminCtrlEmail('');
          setInputPassword('');
        }
      } else if (activeSubTab === 'subadmins') {
        const lic = await request('/security/licensing');
        setLicensingData(lic || { modules: [], admin_creation_limit: 3 });
        
        const userList = await request('/security/users');
        const subAdmins = (userList || []).filter(u => u.role_name !== 'Employee' && u.role_name !== 'Super Admin' && u.role_name !== 'Admin Controller');
        setSubAdminsList(subAdmins);
        setSelectedSubAdminId('');
        setSubAdminAccess([]);
      }
    } catch (err) {
      setError(err.message || 'Error retrieving licensing settings.');
    } finally {
      setLoading(false);
    }
  };

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

  const handlePerformWipe = async (e) => {
    if (e) e.preventDefault();
    if (showWipeModal === 'database' && confirmInput !== 'CLEAR DATABASE') {
      alert('Confirmation text mismatch. Action aborted.');
      return;
    }
    if (showWipeModal === 'employees' && confirmInput !== 'CLEAR EMPLOYEES') {
      alert('Confirmation text mismatch. Action aborted.');
      return;
    }

    setWipeLoading(true);
    try {
      const endpoint = showWipeModal === 'database' ? '/security/clear-database' : '/security/clear-employees';
      const res = await request(endpoint, {
        method: 'POST'
      });
      alert(res.message || 'Data cleared successfully.');
      setShowWipeModal(false);
      setConfirmInput('');
      fetchData();
    } catch (err) {
      alert(err.message || 'Wiping operation failed.');
    } finally {
      setWipeLoading(false);
    }
  };

  const handleAssignAdminController = async (e) => {
    e.preventDefault();
    if (!adminCtrlName || !adminCtrlEmail || !inputPassword) {
      alert('Please fill out the name, email, and password fields.');
      return;
    }
    setLicensingSaving(true);
    try {
      await request('/security/admin-controller', {
        method: 'POST',
        body: { name: adminCtrlName, email: adminCtrlEmail, password: inputPassword }
      });
      alert('Admin Controller assigned successfully.');
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to assign Admin Controller.');
    } finally {
      setLicensingSaving(false);
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    if (!adminController) return;
    if (newStatus === 'Paused' && !window.confirm('Emergency Action: Are you sure you want to PAUSE Admin Controller access? This will lock out all employees and sub-admins from signing in or managing data.')) {
      return;
    }
    setStatusUpdating(true);
    try {
      await request('/security/admin-controller/status', {
        method: 'POST',
        body: { status: newStatus }
      });
      alert(`Admin Controller status changed to ${newStatus}.`);
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to update access status.');
    } finally {
      setStatusUpdating(false);
    }
  };

  const formatDuration = (totalSeconds) => {
    if (!totalSeconds || totalSeconds < 0) return '0 seconds';
    const days = Math.floor(totalSeconds / (3600 * 24));
    const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hr${hours > 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} min${minutes > 1 ? 's' : ''}`);
    parts.push(`${seconds} sec`);

    return parts.join(', ');
  };

  if (user?.role !== 'Super Admin') {
    return (
      <div className="alert alert-error" style={{ marginTop: '40px' }}>
        <ShieldAlert />
        <span>Access Denied: This administrative panel is restricted to the system developer/Super Admin.</span>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex-between m-b-20">
        <div>
          <h2 style={{ fontSize: '28px', color: 'var(--chub-purple)' }}>Portal Licensing & Module Manager</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Configure subscription bounds, feature tiers, and system access policies for administrative accounts.</p>
        </div>
      </div>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <button 
          onClick={() => setActiveSubTab('controller')}
          className={`btn ${activeSubTab === 'controller' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '8px', padding: '10px 20px' }}
        >
          <Settings size={16} /> Admin Controller License
        </button>
        <button 
          onClick={() => setActiveSubTab('subadmins')}
          className={`btn ${activeSubTab === 'subadmins' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '8px', padding: '10px 20px' }}
        >
          <Users size={16} /> Sub-Admin Module Access
        </button>
        <button 
          onClick={() => setActiveSubTab('wiping')}
          className={`btn ${activeSubTab === 'wiping' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '8px', padding: '10px 20px' }}
        >
          <Trash2 size={16} /> Database Maintenance
        </button>
      </div>
      {error && <div className="alert alert-error"><ShieldAlert /><span>{error}</span></div>}

      <div className="card">
        {loading ? (
          <p>Loading licensing information...</p>
        ) : (
          <div>
            {/* 1. ADMIN CONTROLLER LICENSE MANAGER */}
            {activeSubTab === 'controller' && (
              <div>
                {/* Admin Controller configuration panel */}
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '32px' }}>
                  
                  {/* Left Column: Configure assignment */}
                  <div className="card" style={{ flex: 1, minWidth: '300px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '20px', color: 'var(--chub-purple)' }}>
                      Configure Admin Controller Assignment
                    </h3>
                    <form onSubmit={handleAssignAdminController}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>Admin Controller Name</label>
                        <input 
                          type="text"
                          className="form-control"
                          placeholder="Admin name"
                          value={adminCtrlName}
                          onChange={(e) => setAdminCtrlName(e.target.value)}
                          required
                        />
                        <small style={{ color: 'var(--text-muted)' }}>Standalone administrative name for the Controller.</small>
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>Admin Controller Email ID</label>
                        <input 
                          type="email"
                          className="form-control"
                          placeholder="admin@chubworld.com"
                          value={adminCtrlEmail}
                          onChange={(e) => setAdminCtrlEmail(e.target.value)}
                          required
                        />
                        <small style={{ color: 'var(--text-muted)' }}>Standalone login email ID for the Admin Controller.</small>
                      </div>

                      <div className="form-group" style={{ marginBottom: '24px' }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>Assign Admin Password</label>
                        <input 
                          type="text" 
                          className="form-control"
                          placeholder="Provide login password"
                          value={inputPassword}
                          onChange={(e) => setInputPassword(e.target.value)}
                          required
                        />
                        <small style={{ color: 'var(--text-muted)' }}>Provides plain administrative login credentials password to Controller.</small>
                      </div>

                      <button type="submit" className="btn btn-primary" disabled={licensingSaving} style={{ width: '100%', background: 'var(--chub-gradient)' }}>
                        {licensingSaving ? 'Assigning...' : 'Save & Assign Controller'}
                      </button>
                    </form>
                  </div>

                  {/* Right Column: Emergency Access Controls */}
                  <div className="card" style={{ flex: 1.2, minWidth: '320px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--border-color)' }}>
                    <div>
                      <h3 style={{ fontSize: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '20px', color: 'var(--chub-purple)' }}>
                        Emergency Access Controls
                      </h3>

                      {adminController ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '14px' }}>
                          <div className="flex-between">
                            <strong>Controller Profile:</strong>
                            <span style={{ fontWeight: 600, color: 'var(--chub-pink)' }}>
                              {adminController.full_name} ({adminController.employee_id})
                            </span>
                          </div>
                          <div className="flex-between">
                            <strong>Controller Email:</strong>
                            <span style={{ fontFamily: 'monospace' }}>{adminController.email}</span>
                          </div>
                          <div className="flex-between">
                            <strong>Access status:</strong>
                            <span className={`badge ${
                              adminController.status === 'Active' ? 'badge-active' :
                              adminController.status === 'Paused' ? 'badge-pending' :
                              'badge-rejected'
                            }`}>
                              {adminController.status}
                            </span>
                          </div>

                          <div style={{ 
                            marginTop: '8px', 
                            padding: '12px', 
                            backgroundColor: 'var(--chub-light-lavender)', 
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            border: '1px solid var(--border-color)'
                          }}>
                            <Clock size={18} className={adminController.status === 'Active' ? 'pulse' : ''} style={{ color: 'var(--chub-purple)' }} />
                            <div>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>TOTAL ACCUMULATED ACTIVE DURATION</span>
                              <strong style={{ fontSize: '15px', color: 'var(--chub-purple)', fontFamily: 'monospace' }}>
                                {formatDuration(elapsedSeconds)}
                              </strong>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No Admin Controller currently configured.</p>
                      )}
                    </div>

                    {adminController && (
                      <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                        <label className="form-label" style={{ fontWeight: 600, marginBottom: '10px' }}>Emergency Toggles</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                          <button 
                            onClick={() => handleUpdateStatus('Active')}
                            className="btn btn-secondary"
                            disabled={adminController.status === 'Active' || statusUpdating}
                            style={{ 
                              borderColor: 'var(--color-success)', 
                              color: adminController.status === 'Active' ? 'var(--text-muted)' : 'var(--color-success)',
                              fontSize: '11px',
                              padding: '8px 12px'
                            }}
                          >
                            <Play size={12} /> Resume
                          </button>
                          <button 
                            onClick={() => handleUpdateStatus('Paused')}
                            className="btn btn-secondary"
                            disabled={adminController.status === 'Paused' || statusUpdating}
                            style={{ 
                              borderColor: 'var(--color-warning)', 
                              color: adminController.status === 'Paused' ? 'var(--text-muted)' : 'var(--color-warning)',
                              fontSize: '11px',
                              padding: '8px 12px'
                            }}
                          >
                            <Pause size={12} /> Pause
                          </button>
                          <button 
                            onClick={() => handleUpdateStatus('Deactivated')}
                            className="btn btn-secondary"
                            disabled={adminController.status === 'Deactivated' || statusUpdating}
                            style={{ 
                              borderColor: 'var(--text-muted)', 
                              color: adminController.status === 'Deactivated' ? 'var(--text-muted)' : 'var(--text-muted)',
                              fontSize: '11px',
                              padding: '8px 12px'
                            }}
                          >
                            <Power size={12} /> Deactivate
                          </button>
                          <button 
                            onClick={() => handleUpdateStatus('Revoked')}
                            className="btn btn-danger"
                            disabled={adminController.status === 'Revoked' || statusUpdating}
                            style={{ 
                              fontSize: '11px',
                              padding: '8px 12px'
                            }}
                          >
                            <Ban size={12} /> Revoke
                          </button>
                        </div>

                        {adminController.status === 'Paused' && (
                          <div className="alert alert-warning" style={{ marginTop: '12px', padding: '8px 12px', fontSize: '11px', marginBottom: 0 }}>
                            <ShieldAlert size={14} style={{ flexShrink: 0 }} />
                            <span><strong>Emergency lock:</strong> Employees, sub-admins & controller are blocked from signing in or managing data.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                </div>

                <h3 style={{ fontSize: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '20px', color: 'var(--chub-purple)' }}>
                  Admin Controller License Settings
                </h3>

                <form onSubmit={handleSaveLicensing} style={{ maxWidth: '700px' }}>
                  <div className="form-group" style={{ marginBottom: '24px' }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>Max Sub-Admins Creation Limit</label>
                    <input 
                      type="number" 
                      className="form-control" 
                      value={licensingData.admin_creation_limit || 0}
                      onChange={(e) => setLicensingData({ ...licensingData, admin_creation_limit: parseInt(e.target.value, 10) })}
                      style={{ maxWidth: '150px' }}
                    />
                    <small style={{ color: 'var(--text-muted)' }}>Sets the count limit of admins the Admin Controller can add to manage the system.</small>
                  </div>


                  <h4 style={{ fontSize: '15px', color: 'var(--chub-pink)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Module Access Config for Admin Controller
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                    {[
                      { key: 'dashboard', name: 'Dashboard Module' },
                      { key: 'employees', name: 'Employee Lifecycle Module' },
                      { key: 'attendance', name: 'Attendance Hub Module' },
                      { key: 'leaves', name: 'Leave Manager Module' },
                      { key: 'security', name: 'Security & Audits Module' },
                      { key: 'reports', name: 'Reports Module' }
                    ].map((m) => {
                      const idx = (licensingData.modules || []).findIndex(item => item.module_key === m.key);
                      const isEnabled = idx >= 0 ? licensingData.modules[idx].is_enabled : false;
                      const start = idx >= 0 ? licensingData.modules[idx].subscription_start_date : '';
                      const end = idx >= 0 ? licensingData.modules[idx].subscription_end_date : '';
                      const label = idx >= 0 ? licensingData.modules[idx].feature_label : '';

                      const updateModuleFields = (fieldsObj) => {
                        setLicensingData(prev => {
                          const newModules = [...(prev.modules || [])];
                          const latestIdx = newModules.findIndex(item => item.module_key === m.key);
                          if (latestIdx >= 0) {
                            newModules[latestIdx] = { ...newModules[latestIdx], ...fieldsObj };
                          } else {
                            newModules.push({
                              module_key: m.key,
                              is_enabled: false,
                              subscription_start_date: null,
                              subscription_end_date: null,
                              feature_label: null,
                              ...fieldsObj
                            });
                          }
                          return { ...prev, modules: newModules };
                        });
                      };

                      const hasNoValidity = end === null || end === '';

                      return (
                        <div key={m.key} className="card" style={{ padding: '16px', backgroundColor: 'var(--bg-primary)', border: isEnabled ? '1px solid var(--chub-pink)' : '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, minWidth: '220px' }}>
                              <input 
                                type="checkbox" 
                                checked={isEnabled} 
                                onChange={(e) => {
                                  const updates = { is_enabled: e.target.checked };
                                  if (e.target.checked) {
                                    updates.subscription_start_date = new Date().toISOString().split('T')[0];
                                  }
                                  updateModuleFields(updates);
                                }} 
                              />
                              {m.name}
                            </label>

                            <div style={{ flex: 1, minWidth: '220px', display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>End Date</label>
                                <input 
                                  type="date" 
                                  className="form-control" 
                                  disabled={!isEnabled || hasNoValidity}
                                  value={end ? end.split('T')[0] : ''} 
                                  onChange={(e) => updateModuleFields({ subscription_end_date: e.target.value || null })} 
                                  style={{ height: '32px', padding: '4px 8px', fontSize: '12px' }}
                                />
                              </div>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer', paddingBottom: '8px' }}>
                                <input 
                                  type="checkbox" 
                                  disabled={!isEnabled}
                                  checked={hasNoValidity}
                                  onChange={(e) => updateModuleFields({ subscription_end_date: e.target.checked ? null : new Date().toISOString().split('T')[0] })}
                                />
                                No Validity
                              </label>
                            </div>

                            <div style={{ minWidth: '130px' }}>
                              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Feature Label</label>
                              <select 
                                className="form-control" 
                                value={label || ''} 
                                onChange={(e) => updateModuleFields({ feature_label: e.target.value || null })} 
                                style={{ height: '32px', padding: '4px 8px', fontSize: '12px' }}
                              >
                                <option value="">No Label</option>
                                <option value="Beta">Beta</option>
                                <option value="Trial">Trial</option>
                                <option value="Premium">Premium</option>
                                <option value="New">New</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button type="submit" className="btn btn-primary" disabled={licensingSaving} style={{ background: 'var(--chub-gradient)' }}>
                    {licensingSaving ? 'Saving...' : 'Save Controller Licensing'}
                  </button>
                </form>
              </div>
            )}

            {/* 2. SUB-ADMIN ACCESS CONFIG (SUPER ADMIN VIEW) */}
            {activeSubTab === 'subadmins' && (
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                {/* Sub Admins list panel */}
                <div className="card" style={{ flex: 1.2, minWidth: '280px' }}>
                  <h4 style={{ fontSize: '15px', color: 'var(--chub-purple)', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    Select Sub-Admin
                  </h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Configure custom sharing privileges for system sub-admins.
                  </p>

                  {subAdminsList.length === 0 ? (
                    <p style={{ fontStyle: 'italic', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                      No active sub-admins found in system.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {subAdminsList.map((sa) => (
                        <button 
                          key={sa.id}
                          onClick={() => handleSelectSubAdmin(sa.id)}
                          className={`btn ${selectedSubAdminId === sa.id ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ width: '100%', textAlign: 'left', display: 'flex', flexDirection: 'column', padding: '10px 16px', borderRadius: '8px', alignItems: 'flex-start', border: 'none' }}
                        >
                          <span style={{ fontWeight: 600 }}>{sa.full_name || 'System User'}</span>
                          <span style={{ fontSize: '10px', color: selectedSubAdminId === sa.id ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)' }}>
                            {sa.email} | {sa.role_name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Shared Access controls panel */}
                <div className="card" style={{ flex: 2, minWidth: '320px' }}>
                  {selectedSubAdminId ? (
                    <form onSubmit={handleSaveSubAdminAccess}>
                      <h4 style={{ fontSize: '15px', color: 'var(--chub-purple)', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                        Shared Modules Mapping
                      </h4>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
                        {licensingData.modules
                          .filter(m => m.is_enabled) // Can only share modules enabled for Admin Controller
                          .map((m) => {
                            const idx = subAdminAccess.findIndex(sa => sa.module_key === m.module_key);
                            const isEnabled = idx >= 0 ? subAdminAccess[idx].is_enabled : false;
                            const start = idx >= 0 ? subAdminAccess[idx].subscription_start_date : '';
                            const end = idx >= 0 ? subAdminAccess[idx].subscription_end_date : '';
                            const label = idx >= 0 ? subAdminAccess[idx].feature_label : '';

                            const updateSubModuleFields = (fieldsObj) => {
                              setSubAdminAccess(prev => {
                                const newAccess = [...prev];
                                const latestIdx = newAccess.findIndex(sa => sa.module_key === m.module_key);
                                if (latestIdx >= 0) {
                                  newAccess[latestIdx] = { ...newAccess[latestIdx], ...fieldsObj };
                                } else {
                                  newAccess.push({
                                    module_key: m.module_key,
                                    is_enabled: false,
                                    subscription_start_date: null,
                                    subscription_end_date: null,
                                    feature_label: null,
                                    ...fieldsObj
                                  });
                                }
                                return newAccess;
                              });
                            };

                            const hasNoValidity = end === null || end === '';

                            return (
                              <div key={m.module_key} style={{ padding: '12px 16px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-primary)' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, minWidth: '180px' }}>
                                    <input 
                                      type="checkbox" 
                                      checked={isEnabled} 
                                      onChange={(e) => {
                                        const updates = { is_enabled: e.target.checked };
                                        if (e.target.checked) {
                                          updates.subscription_start_date = new Date().toISOString().split('T')[0];
                                        }
                                        updateSubModuleFields(updates);
                                      }} 
                                    />
                                    {m.module_key.toUpperCase()}
                                  </label>

                                  <div style={{ flex: 1, display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                                    <div>
                                      <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>End</label>
                                      <input 
                                        type="date" 
                                        className="form-control" 
                                        disabled={!isEnabled || hasNoValidity}
                                        value={end ? end.split('T')[0] : ''} 
                                        onChange={(e) => updateSubModuleFields({ subscription_end_date: e.target.value || null })} 
                                        style={{ height: '30px', padding: '2px 6px', fontSize: '11px' }}
                                      />
                                    </div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer', paddingBottom: '6px' }}>
                                      <input 
                                        type="checkbox" 
                                        disabled={!isEnabled}
                                        checked={hasNoValidity}
                                        onChange={(e) => updateSubModuleFields({ subscription_end_date: e.target.checked ? null : new Date().toISOString().split('T')[0] })}
                                      />
                                      No Validity
                                    </label>
                                  </div>

                                  <div>
                                    <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Label</label>
                                    <select 
                                      className="form-control" 
                                      value={label || ''} 
                                      onChange={(e) => updateSubModuleFields({ feature_label: e.target.value || null })} 
                                      style={{ height: '30px', padding: '2px 6px', fontSize: '11px' }}
                                    >
                                      <option value="">No Label</option>
                                      <option value="Beta">Beta</option>
                                      <option value="Trial">Trial</option>
                                      <option value="Premium">Premium</option>
                                      <option value="New">New</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>

                      <button type="submit" className="btn btn-primary" disabled={licensingSaving}>
                        {licensingSaving ? 'Saving...' : 'Apply Sub-Admin Privileges'}
                      </button>
                    </form>
                  ) : (
                    <p style={{ fontStyle: 'italic', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '50px' }}>
                      Select a sub-admin from the left list to assign modules, validity dates, and feature labels.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* 3. DATABASE MAINTENANCE TAB */}
            {activeSubTab === 'wiping' && (
              <div>
                <h3 style={{ fontSize: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '20px', color: 'var(--chub-purple)' }}>
                  Dangerous Database Maintenance purging tools
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
                  Perform irreversible hard purges on transaction data, employee lists, KYC registers, configurations, and user logs.
                </p>

                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                  
                  {/* Card 1: Clear Database */}
                  <div className="card" style={{ flex: 1, minWidth: '300px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: 'var(--bg-primary)' }}>
                    <div>
                      <h4 style={{ color: 'var(--color-error)', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <ShieldAlert size={20} /> Purge Entire Database
                      </h4>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '20px' }}>
                        Deletes all transactional data including attendance logs, correction requests, leaves, documents numbers, KYC records, departments, designations, geofence locations, and administrative credentials.
                        <strong>Excludes the Super Admin user account (chub.admin@adloaf.com) and System Parameters configurations.</strong>
                      </p>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => { setShowWipeModal('database'); setConfirmInput(''); }}
                      className="btn btn-danger"
                      style={{ width: '100%', padding: '10px' }}
                    >
                      Clear Database
                    </button>
                  </div>

                  {/* Card 2: Clear Employees */}
                  <div className="card" style={{ flex: 1, minWidth: '300px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: 'var(--bg-primary)' }}>
                    <div>
                      <h4 style={{ color: 'var(--color-error)', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <Users size={20} /> Clear All Employees
                      </h4>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '20px' }}>
                        Deletes all employee profiles, their KYC details, document reference numbers, shift assignments, leave balances, leave requests, and attendance logs. 
                        <strong>Keeps organizational structures (departments, designations, geofences) and user logins intact (except deleted employees' login credentials).</strong>
                      </p>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => { setShowWipeModal('employees'); setConfirmInput(''); }}
                      className="btn btn-danger"
                      style={{ width: '100%', padding: '10px' }}
                    >
                      Clear All Employees
                    </button>
                  </div>

                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* WIPING CONFIRMATION MODAL */}
      {showWipeModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px', textAlign: 'center' }}>
            <ShieldAlert size={48} style={{ color: 'var(--color-error)', margin: '0 auto 16px auto', display: 'block' }} />
            <h3 style={{ marginBottom: '12px', color: 'var(--color-error)' }}>
              {showWipeModal === 'database' ? 'Confirm Database Purge' : 'Confirm Employee Clearing'}
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.5' }}>
              {showWipeModal === 'database' 
                ? 'Warning: This will purge all transaction data, structural configurations, audit trails, and administrative login credentials. Only the Super Admin and system parameters will remain.' 
                : 'Warning: This will delete all employee profiles, KYC data, leave details, attendance sheets, and employee logins. Geofences and department structures will remain.'}
            </p>
            
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label" style={{ fontWeight: 'bold' }}>
                To proceed, type <span style={{ color: 'var(--color-error)' }}>
                  {showWipeModal === 'database' ? 'CLEAR DATABASE' : 'CLEAR EMPLOYEES'}
                </span> below:
              </label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="Type the confirmation string..." 
                value={confirmInput} 
                onChange={(e) => setConfirmInput(e.target.value)} 
                style={{ textAlign: 'center', fontWeight: 'bold', letterSpacing: '0.5px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                type="button" 
                onClick={() => { setShowWipeModal(false); setConfirmInput(''); }} 
                className="btn btn-secondary"
                disabled={wipeLoading}
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handlePerformWipe} 
                className="btn btn-danger"
                disabled={
                  wipeLoading || 
                  (showWipeModal === 'database' && confirmInput !== 'CLEAR DATABASE') ||
                  (showWipeModal === 'employees' && confirmInput !== 'CLEAR EMPLOYEES')
                }
              >
                {wipeLoading ? 'Purging...' : 'Yes, Purge Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
