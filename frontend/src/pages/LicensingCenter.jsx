import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, ShieldAlert, CheckCircle, Plus, Edit3, Trash2, Key, Users, Settings } from 'lucide-react';

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

  useEffect(() => {
    fetchData();
  }, [activeSubTab]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      if (activeSubTab === 'controller') {
        const lic = await request('/security/licensing');
        setLicensingData(lic || { modules: [], admin_creation_limit: 3 });
      } else if (activeSubTab === 'subadmins') {
        // Fetch Admin Controller license modules to show which modules can be shared
        const lic = await request('/security/licensing');
        setLicensingData(lic || { modules: [], admin_creation_limit: 3 });
        
        // Fetch users list and filter sub-admins
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
                <h3 style={{ fontSize: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '20px', color: 'var(--chub-purple)' }}>
                  Admin Controller Subscription Settings
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

                      const updateModuleField = (field, val) => {
                        const newModules = [...(licensingData.modules || [])];
                        if (idx >= 0) {
                          newModules[idx] = { ...newModules[idx], [field]: val };
                        } else {
                          newModules.push({
                            module_key: m.key,
                            is_enabled: false,
                            subscription_start_date: null,
                            subscription_end_date: null,
                            feature_label: null,
                            [field]: val
                          });
                        }
                        setLicensingData({ ...licensingData, modules: newModules });
                      };

                      const hasNoValidity = end === null;

                      return (
                        <div key={m.key} className="card" style={{ padding: '16px', backgroundColor: 'var(--bg-primary)', border: isEnabled ? '1px solid var(--chub-pink)' : '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, minWidth: '220px' }}>
                              <input 
                                type="checkbox" 
                                checked={isEnabled} 
                                onChange={(e) => updateModuleField('is_enabled', e.target.checked)} 
                              />
                              {m.name}
                            </label>

                            <div style={{ flex: 1, minWidth: '220px', display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Start Date</label>
                                <input 
                                  type="date" 
                                  className="form-control" 
                                  value={start ? start.split('T')[0] : ''} 
                                  onChange={(e) => updateModuleField('subscription_start_date', e.target.value)} 
                                  style={{ height: '32px', padding: '4px 8px', fontSize: '12px' }}
                                />
                              </div>
                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>End Date</label>
                                <input 
                                  type="date" 
                                  className="form-control" 
                                  disabled={hasNoValidity}
                                  value={end ? end.split('T')[0] : ''} 
                                  onChange={(e) => updateModuleField('subscription_end_date', e.target.value || null)} 
                                  style={{ height: '32px', padding: '4px 8px', fontSize: '12px' }}
                                />
                              </div>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer', paddingBottom: '8px' }}>
                                <input 
                                  type="checkbox" 
                                  checked={hasNoValidity}
                                  onChange={(e) => updateModuleField('subscription_end_date', e.target.checked ? null : '')}
                                />
                                No Validity
                              </label>
                            </div>

                            <div style={{ minWidth: '130px' }}>
                              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Feature Label</label>
                              <select 
                                className="form-control" 
                                value={label || ''} 
                                onChange={(e) => updateModuleField('feature_label', e.target.value || null)} 
                                style={{ height: '32px', padding: '4px 8px', fontSize: '12px' }}
                              >
                                <option value="">No Label</option>
                                <option value="Beta">Beta</option>
                                <option value="Trial">Trial</option>
                                <option value="Premium">Premium</option>
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

                            const updateSubModuleField = (field, val) => {
                              const newAccess = [...subAdminAccess];
                              if (idx >= 0) {
                                newAccess[idx] = { ...newAccess[idx], [field]: val };
                              } else {
                                newAccess.push({
                                  module_key: m.module_key,
                                  is_enabled: false,
                                  subscription_start_date: null,
                                  subscription_end_date: null,
                                  feature_label: null,
                                  [field]: val
                                });
                              }
                              setSubAdminAccess(newAccess);
                            };

                            const hasNoValidity = end === null;

                            return (
                              <div key={m.module_key} style={{ padding: '12px 16px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-primary)' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, minWidth: '180px' }}>
                                    <input 
                                      type="checkbox" 
                                      checked={isEnabled} 
                                      onChange={(e) => updateSubModuleField('is_enabled', e.target.checked)} 
                                    />
                                    {m.module_key.toUpperCase()}
                                  </label>

                                  <div style={{ flex: 1, display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                                    <div>
                                      <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Start</label>
                                      <input 
                                        type="date" 
                                        className="form-control" 
                                        value={start ? start.split('T')[0] : ''} 
                                        onChange={(e) => updateSubModuleField('subscription_start_date', e.target.value)} 
                                        style={{ height: '30px', padding: '2px 6px', fontSize: '11px' }}
                                      />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>End</label>
                                      <input 
                                        type="date" 
                                        className="form-control" 
                                        disabled={hasNoValidity}
                                        value={end ? end.split('T')[0] : ''} 
                                        onChange={(e) => updateSubModuleField('subscription_end_date', e.target.value || null)} 
                                        style={{ height: '30px', padding: '2px 6px', fontSize: '11px' }}
                                      />
                                    </div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer', paddingBottom: '6px' }}>
                                      <input 
                                        type="checkbox" 
                                        checked={hasNoValidity}
                                        onChange={(e) => updateSubModuleField('subscription_end_date', e.target.checked ? null : '')}
                                      />
                                      No Validity
                                    </label>
                                  </div>

                                  <div>
                                    <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Label</label>
                                    <select 
                                      className="form-control" 
                                      value={label || ''} 
                                      onChange={(e) => updateSubModuleField('feature_label', e.target.value || null)} 
                                      style={{ height: '30px', padding: '2px 6px', fontSize: '11px' }}
                                    >
                                      <option value="">No Label</option>
                                      <option value="Beta">Beta</option>
                                      <option value="Trial">Trial</option>
                                      <option value="Premium">Premium</option>
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
          </div>
        )}
      </div>
    </div>
  );
}
