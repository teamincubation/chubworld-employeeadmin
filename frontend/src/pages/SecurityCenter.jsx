import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldCheck, Lock, ToggleLeft, ToggleRight, Key, 
  MapPin, Settings, AlertTriangle, ShieldAlert, 
  CheckCircle, Plus, Edit3, Trash2, Building, Users, Calendar
} from 'lucide-react';

export default function SecurityCenter() {
  const { request, user } = useAuth();
  
  // Data state
  const [audits, setAudits] = useState([]);
  const [selectedLogIds, setSelectedLogIds] = useState([]);
  const [users, setUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [settings, setSettings] = useState({});
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [holidayYear, setHolidayYear] = useState(new Date().getFullYear());
  const [ipLocations, setIpLocations] = useState({});
  const [showAuditMapModal, setShowAuditMapModal] = useState(false);
  const [selectedAuditLog, setSelectedAuditLog] = useState(null);
  const [selectedAuditLoc, setSelectedAuditLoc] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('');
  
  // Holiday Modals & Forms
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidayForm, setHolidayForm] = useState({ id: null, name: '', date: '', description: '', type: 'Public Holiday', is_paid: true });
  const [showGenerateWeekendsModal, setShowGenerateWeekendsModal] = useState(false);
  const [weekendsType, setWeekendsType] = useState('both'); // 'sunday' or 'both'
  const [showCloneHolidaysModal, setShowCloneHolidaysModal] = useState(false);
  const [cloneTargetYear, setCloneTargetYear] = useState(new Date().getFullYear() + 1);

  // Organization Modals
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [deptForm, setDeptForm] = useState({ id: null, name: '' });
  const [showDesigModal, setShowDesigModal] = useState(false);
  const [desigForm, setDesigForm] = useState({ id: null, name: '', department_id: '' });
  
  // Tab control
  const [activeTab, setActiveTab] = useState('audits'); // 'audits', 'users', 'locations', 'organization', 'settings', 'sessions', 'subadmins', 'holidays'
  const [sessionsList, setSessionsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter state for audit logs
  const [filterUser, setFilterUser] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');

  // Pagination states for audit logs
  const [auditPage, setAuditPage] = useState(1);
  const [auditLimit, setAuditLimit] = useState(100);
  const [totalAuditLogs, setTotalAuditLogs] = useState(0);

  // Reset password modal state
  const [showResetModal, setShowResetModal] = useState(false);

  // Licensing state
  const [licensingData, setLicensingData] = useState({ modules: [], admin_creation_limit: 3 });
  const [subAdminsList, setSubAdminsList] = useState([]);
  const [selectedSubAdminId, setSelectedSubAdminId] = useState('');
  const [subAdminAccess, setSubAdminAccess] = useState([]);
  const [licensingSaving, setLicensingSaving] = useState(false);

  // Sub-admins management specific states
  const [showSubAdminModal, setShowSubAdminModal] = useState(false);
  const [subAdminForm, setSubAdminForm] = useState({ id: null, name: '', email: '', password: '', roleId: '2' });
  const [adminCreationLimit, setAdminCreationLimit] = useState(3);
  const [subAdminAccessSaving, setSubAdminAccessSaving] = useState(false);

  const handleOpenAddSubAdmin = () => {
    setSubAdminForm({ id: null, name: '', email: '', password: '', roleId: '2' });
    setShowSubAdminModal(true);
  };

  const handleOpenEditSubAdmin = (sa) => {
    const roleIdMap = {
      'Admin': '2',
      'HR Manager': '3',
      'Department Manager': '4',
      'Finance Manager': '5'
    };
    setSubAdminForm({
      id: sa.id,
      name: sa.full_name || '',
      email: sa.email || '',
      password: '', // Blank by default on edit
      roleId: roleIdMap[sa.role_name] || '2'
    });
    setShowSubAdminModal(true);
  };

  const handleSaveSubAdmin = async (e) => {
    e.preventDefault();
    try {
      if (subAdminForm.id) {
        await request(`/security/sub-admins/${subAdminForm.id}`, {
          method: 'PUT',
          body: {
            name: subAdminForm.name,
            email: subAdminForm.email,
            password: subAdminForm.password || undefined,
            roleId: subAdminForm.roleId
          }
        });
        alert('Sub-admin account updated.');
      } else {
        await request('/security/sub-admins', {
          method: 'POST',
          body: {
            name: subAdminForm.name,
            email: subAdminForm.email,
            password: subAdminForm.password,
            roleId: subAdminForm.roleId
          }
        });
        alert('Sub-admin account created.');
      }
      setShowSubAdminModal(false);
      fetchData();
    } catch (err) {
      alert(err.message || 'Error saving sub-admin details.');
    }
  };

  const handleToggleSubModule = (moduleKey, isChecked) => {
    const idx = subAdminAccess.findIndex(sa => sa.module_key === moduleKey);
    const newAccess = [...subAdminAccess];
    if (idx >= 0) {
      newAccess[idx] = { ...newAccess[idx], is_enabled: isChecked };
    } else {
      newAccess.push({
        module_key: moduleKey,
        is_enabled: isChecked,
        subscription_start_date: null,
        subscription_end_date: null,
        feature_label: null
      });
    }
    setSubAdminAccess(newAccess);
  };

  const handleSaveSubAdminPermissions = async (e) => {
    e.preventDefault();
    if (!selectedSubAdminId) return;
    setSubAdminAccessSaving(true);
    try {
      await request(`/security/sub-admin-licensing/${selectedSubAdminId}`, {
        method: 'PUT',
        body: { modules: subAdminAccess }
      });
      alert('Sub-admin access rules updated successfully.');
    } catch (err) {
      alert(err.message || 'Failed to save sub-admin permissions.');
    } finally {
      setSubAdminAccessSaving(false);
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
  const [targetUserId, setTargetUserId] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  // Add / Edit location modal state
  const [showLocModal, setShowLocModal] = useState(false);
  const [locForm, setLocForm] = useState({
    id: null, name: '', latitude: '', longitude: '', radiusMeters: 100, allowWithoutLocation: false
  });

  useEffect(() => {
    fetchData();
  }, [activeTab, holidayYear, auditPage, auditLimit]);

  useEffect(() => {
    const resolveIps = async () => {
      const uniqueIps = [...new Set(audits.map(log => log.ip_address).filter(ip => ip && ip !== '127.0.0.1' && ip !== '::1' && ip !== '::ffff:127.0.0.1'))];
      const newLocs = { ...ipLocations };
      let updated = false;
      for (const ip of uniqueIps) {
        if (!newLocs[ip]) {
          let locationResolved = false;
          try {
            const res = await fetch(`https://freeipapi.com/api/json/${ip}`);
            if (res.ok) {
              const data = await res.json();
              if (data.cityName && data.countryName) {
                newLocs[ip] = {
                  name: `${data.cityName}, ${data.countryName}`,
                  latitude: data.latitude,
                  longitude: data.longitude
                };
                locationResolved = true;
                updated = true;
              }
            }
          } catch (e) {
            console.warn('Primary IP resolve failed for ' + ip + ', attempting fallback...', e);
          }

          if (!locationResolved) {
            try {
              const res = await fetch(`https://ipapi.co/${ip}/json/`);
              if (res.ok) {
                const data = await res.json();
                if (data.city && data.country_name) {
                  newLocs[ip] = {
                    name: `${data.city}, ${data.country_name}`,
                    latitude: data.latitude,
                    longitude: data.longitude
                  };
                  locationResolved = true;
                  updated = true;
                }
              }
            } catch (e2) {
              console.error('Fallback IP resolve failed for ' + ip, e2);
            }
          }

          if (!locationResolved) {
            newLocs[ip] = {
              name: 'Unknown Location',
              latitude: null,
              longitude: null
            };
            updated = true;
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

  const handleExportCSV = async () => {
    try {
      const res = await request(`/security/audit-logs?user=${filterUser}&actionType=${filterAction}&fromDate=${filterFromDate}&toDate=${filterToDate}&exportAll=true`);
      const allLogs = res.logs || [];
      if (allLogs.length === 0) {
        alert('No audit logs available to export.');
        return;
      }

      const headers = ['Timestamp (IST)', 'Action Type', 'Performed By', 'Role', 'IP Address', 'Location Coordinates', 'Target Node', 'User Agent'];
      const rows = allLogs.map(log => [
        new Date(log.created_at).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
        log.action_type,
        log.performed_by,
        log.role,
        log.ip_address,
        log.latitude && log.longitude ? `${log.latitude};${log.longitude}` : 'N/A',
        log.target_record || 'N/A',
        log.user_agent.replace(/"/g, '""')
      ]);

      const csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(','), ...rows.map(r => r.map(val => `"${val || ''}"`).join(','))].join('\n');
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `audit_trail_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Export CSV failed: ' + err.message);
    }
  };

  const handleExportPDF = async () => {
    try {
      const res = await request(`/security/audit-logs?user=${filterUser}&actionType=${filterAction}&fromDate=${filterFromDate}&toDate=${filterToDate}&exportAll=true`);
      const allLogs = res.logs || [];
      if (allLogs.length === 0) {
        alert('No audit logs available to export.');
        return;
      }

      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>C-Hub Audit Logs Report</title>
            <style>
              body {
                font-family: 'Inter', sans-serif;
                color: #101010;
                padding: 40px;
                background-color: #ffffff;
              }
              .header {
                display: flex;
                align-items: center;
                border-bottom: 2px solid #42174F;
                padding-bottom: 20px;
                margin-bottom: 30px;
              }
              .logo {
                width: 60px;
                height: 60px;
                border-radius: 12px;
                margin-right: 20px;
              }
              .title-area h1 {
                margin: 0;
                font-size: 24px;
                color: #42174F;
                text-transform: uppercase;
                font-family: 'Outfit', sans-serif;
              }
              .title-area span {
                font-size: 12px;
                color: #D85AA6;
                font-weight: bold;
                text-transform: uppercase;
                letter-spacing: 1px;
              }
              .meta-info {
                margin-left: auto;
                text-align: right;
                font-size: 13px;
                line-height: 1.5;
              }
              .custom-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
                font-size: 11px;
              }
              .custom-table th {
                background-color: #f5e8f7;
                color: #42174F;
                font-weight: 600;
                text-align: left;
                padding: 10px 12px;
                border-bottom: 2px solid #e2d9e5;
                text-transform: uppercase;
              }
              .custom-table td {
                padding: 10px 12px;
                border-bottom: 1px solid #e2d9e5;
                color: #101010;
              }
              .custom-table tr:nth-child(even) {
                background-color: #faf8fb;
              }
              .badge {
                font-size: 10px;
                padding: 4px 8px;
                border-radius: 4px;
                font-weight: 600;
                background-color: #e2d9e5;
                color: #42174F;
              }
              .footer {
                margin-top: 40px;
                border-top: 1px solid #e2d9e5;
                padding-top: 15px;
                font-size: 11px;
                color: #6b6470;
                display: flex;
                justify-content: space-between;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <img src="/logo.jpeg" class="logo" alt="Logo" />
              <div class="title-area">
                <h1>C-Hub Operations Audit Report</h1>
                <span>Creating Wow World</span>
              </div>
              <div class="meta-info">
                <div><strong>Exported By:</strong> \${user?.email || 'Administrator'}</div>
                <div><strong>Date:</strong> \${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })}</div>
                <div><strong>Total Logs:</strong> \${allLogs.length}</div>
              </div>
            </div>
            
            <table class="custom-table">
              <thead>
                <tr>
                  <th>Timestamp (IST)</th>
                  <th>Action Type</th>
                  <th>Performed By</th>
                  <th>Role</th>
                  <th>IP Address</th>
                  <th>Coordinates</th>
                  <th>Target Node</th>
                </tr>
              </thead>
              <tbody>
                \${allLogs.map(log => \`
                  <tr>
                    <td>\${new Date(log.created_at).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })}</td>
                    <td><strong>\${log.action_type}</strong></td>
                    <td>\${log.performed_by}</td>
                    <td><span class="badge">\${log.role}</span></td>
                    <td>\${log.ip_address}</td>
                    <td>\${log.latitude && log.longitude ? \`\${log.latitude.toFixed(5)}, \${log.longitude.toFixed(5)}\` : 'N/A'}</td>
                    <td><code>\${log.target_record || 'N/A'}</code></td>
                  </tr>
                \`).join('')}
              </tbody>
            </table>

            <div class="footer">
              <span>Generated from C-Hub Security & Audits Management Center</span>
              <span>Standard timezone: IST (Asia/Kolkata)</span>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    } catch (err) {
      alert('Export PDF failed: ' + err.message);
    }
  };

  const isSubAdminRole = (role) => {
    return role && role !== 'Employee' && role !== 'Super Admin' && role !== 'Admin Controller';
  };

  const canManageUser = (action, targetUser) => {
    if (!user || !targetUser) return false;
    
    const actorRole = user.role;
    const actorId = parseInt(user.id, 10);
    const targetId = parseInt(targetUser.id, 10);
    const targetRole = targetUser.role_name;

    // 1. Self-management check
    if (actorId === targetId) return false;

    // 2. Super Admin target
    if (targetRole === 'Super Admin') {
      if (action === 'purge') return false;
      return actorRole === 'Super Admin';
    }

    // 3. Admin Controller target
    if (targetRole === 'Admin Controller') {
      return actorRole === 'Super Admin';
    }

    // 4. Sub-admin target
    if (isSubAdminRole(targetRole)) {
      return actorRole === 'Super Admin' || actorRole === 'Admin Controller';
    }

    // 5. Employee target
    if (targetRole === 'Employee') {
      return actorRole === 'Super Admin' || actorRole === 'Admin Controller' || isSubAdminRole(actorRole);
    }

    return false;
  };

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'audits') {
        const res = await request(`/security/audit-logs?user=${filterUser}&actionType=${filterAction}&fromDate=${filterFromDate}&toDate=${filterToDate}&page=${auditPage}&limit=${auditLimit}`);
        setAudits(res.logs || []);
        setTotalAuditLogs(res.total || 0);
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
        
        const lts = await request('/leaves/types');
        setLeaveTypes(lts || []);
      } else if (activeTab === 'holidays') {
        const list = await request(`/security/holidays?year=${holidayYear}`);
        setHolidays(list || []);
      } else if (activeTab === 'sessions') {
        const list = await request('/security/active-sessions');
        setSessionsList(list || []);
      } else if (activeTab === 'subadmins' || activeTab === 'licensing') {
        const lic = await request('/security/licensing');
        setLicensingData(lic || { modules: [], admin_creation_limit: 3 });
        if (lic?.admin_creation_limit !== undefined) {
          setAdminCreationLimit(lic.admin_creation_limit);
        }
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
    if (auditPage === 1) {
      fetchData();
    } else {
      setAuditPage(1);
    }
  };

  const handleDeleteLogs = async (logIds) => {
    if (!logIds || logIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${logIds.length} audit log(s)?`)) return;

    try {
      await request('/security/audit-logs', {
        method: 'DELETE',
        body: { ids: logIds }
      });
      alert('Audit log(s) deleted successfully.');
      setSelectedLogIds(prev => prev.filter(id => !logIds.includes(id)));
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to delete audit logs.');
    }
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
      await request('/leaves/types', {
        method: 'PUT',
        body: { leaveTypes }
      });
      alert('System configurations saved successfully.');
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSaveHoliday = async (e) => {
    e.preventDefault();
    try {
      if (holidayForm.id) {
        await request(`/security/holidays/${holidayForm.id}`, {
          method: 'PUT',
          body: holidayForm
        });
        alert('Holiday updated successfully.');
      } else {
        await request('/security/holidays', {
          method: 'POST',
          body: holidayForm
        });
        alert('Holiday created successfully.');
      }
      setShowHolidayModal(false);
      fetchData();
    } catch (err) {
      alert(err.message || 'Error saving holiday.');
    }
  };

  const handleDeleteHoliday = async (id) => {
    if (!window.confirm('Are you sure you want to delete this holiday?')) return;
    try {
      await request(`/security/holidays/${id}`, {
        method: 'DELETE'
      });
      alert('Holiday deleted successfully.');
      fetchData();
    } catch (err) {
      alert(err.message || 'Error deleting holiday.');
    }
  };

  const handleGenerateWeekends = async (e) => {
    e.preventDefault();
    try {
      const res = await request('/security/holidays/generate-weekends', {
        method: 'POST',
        body: { year: holidayYear, weekendsType }
      });
      alert(res.message);
      setShowGenerateWeekendsModal(false);
      fetchData();
    } catch (err) {
      alert(err.message || 'Error generating weekends.');
    }
  };

  const handleCloneHolidays = async (e) => {
    e.preventDefault();
    try {
      const res = await request('/security/holidays/clone', {
        method: 'POST',
        body: { fromYear: holidayYear, toYear: cloneTargetYear }
      });
      alert(res.message);
      setShowCloneHolidaysModal(false);
      fetchData();
    } catch (err) {
      alert(err.message || 'Error copying holidays.');
    }
  };

  const handleFetchNagerHolidays = async () => {
    if (!window.confirm(`Do you want to fetch and import standard Indian public holidays for ${holidayYear}?`)) return;
    try {
      setLoading(true);
      const res = await fetch(`https://date.nager.at/api/v3/publicholidays/${holidayYear}/IN`);
      if (!res.ok) throw new Error('Failed to retrieve holidays from Nager.Date API.');
      const data = await res.json();
      
      let importCount = 0;
      for (const h of data) {
        try {
          await request('/security/holidays', {
            method: 'POST',
            body: {
              name: h.localName || h.name,
              date: h.date,
              description: 'National Public Holiday',
              type: 'Public Holiday',
              is_paid: true
            }
          });
          importCount++;
        } catch (err) {
          // Ignore duplicate records
        }
      }
      
      alert(`Imported ${importCount} public holidays for India successfully.`);
      fetchData();
    } catch (err) {
      alert(err.message || 'Error fetching holidays.');
    } finally {
      setLoading(false);
    }
  };

  const handleForceSignout = async (sessionId, name) => {
    if (!sessionId) return;
    if (!window.confirm(`Are you sure you want to FORCE SIGN-OUT user "${name}"?\nThis will immediately terminate their current session and log them out.`)) return;

    try {
      setLoading(true);
      await request('/security/force-signout', {
        method: 'POST',
        body: { sessionId }
      });
      alert(`User "${name}" has been forcefully signed out.`);
      // Refresh session list
      const list = await request('/security/active-sessions');
      setSessionsList(list || []);
    } catch (err) {
      alert(err.message || 'Error forcing sign-out.');
    } finally {
      setLoading(false);
    }
  };

  const handleForceClockout = async (employeeId, name) => {
    if (!employeeId) return;
    if (!window.confirm(`Are you sure you want to FORCE CLOCK-OUT employee "${name}"?\nThis will end their attendance shift log for today.`)) return;

    try {
      setLoading(true);
      await request('/security/force-clockout', {
        method: 'POST',
        body: { employeeId }
      });
      alert(`Employee "${name}" has been forcefully clocked out.`);
      // Refresh session list
      const list = await request('/security/active-sessions');
      setSessionsList(list || []);
    } catch (err) {
      alert(err.message || 'Error forcing clock-out.');
    } finally {
      setLoading(false);
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
          { key: 'settings', name: 'System Parameters', icon: Settings },
          { key: 'holidays', name: 'Holiday Calendar', icon: Calendar },
          ...((user?.role === 'Super Admin' || user?.role === 'Admin Controller') ? [
            { key: 'sessions', name: 'Active Sessions', icon: ShieldAlert },
            { key: 'subadmins', name: 'Manage Sub-Admins', icon: Users }
          ] : [])
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
                  <>
                    {user?.role === 'Super Admin' && selectedLogIds.length > 0 && (
                      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-start' }}>
                        <button 
                          onClick={() => handleDeleteLogs(selectedLogIds)}
                          className="btn btn-danger"
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '13px' }}
                        >
                          <Trash2 size={14} /> Delete Selected ({selectedLogIds.length})
                        </button>
                      </div>
                    )}

                    <div className="table-container">
                      <table className="custom-table">
                        <thead>
                          <tr>
                            {user?.role === 'Super Admin' && (
                              <th style={{ width: '40px', textAlign: 'center' }}>
                                <input 
                                  type="checkbox" 
                                  checked={audits.length > 0 && selectedLogIds.length === audits.length}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedLogIds(audits.map(log => log.id));
                                    } else {
                                      setSelectedLogIds([]);
                                    }
                                  }}
                                />
                              </th>
                            )}
                            <th>Timestamp (IST)</th>
                            <th>Action Type</th>
                            <th>Performed By</th>
                            <th>IP Location</th>
                            <th>Target Node</th>
                            <th>Security Metadata</th>
                            {user?.role === 'Super Admin' && <th style={{ width: '80px', textAlign: 'center' }}>Actions</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {audits.map((log) => (
                            <tr key={log.id}>
                              {user?.role === 'Super Admin' && (
                                <td style={{ textAlign: 'center' }}>
                                  <input 
                                    type="checkbox" 
                                    checked={selectedLogIds.includes(log.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedLogIds(prev => [...prev, log.id]);
                                      } else {
                                        setSelectedLogIds(prev => prev.filter(id => id !== log.id));
                                      }
                                    }}
                                  />
                                </td>
                              )}
                              <td style={{ fontSize: '12px' }}>{new Date(log.created_at).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })}</td>
                              <td style={{ fontWeight: 'bold', color: 'var(--chub-purple)' }}>{log.action_type}</td>
                              <td>
                                <div><strong>{log.performed_by}</strong></div>
                                <span style={{ fontSize: '11px', color: 'var(--chub-pink)', textTransform: 'uppercase', fontWeight: 600 }}>{log.role}</span>
                              </td>
                              <td>
                                {log.ip_address === '127.0.0.1' || log.ip_address === '::1' || log.ip_address === '::ffff:127.0.0.1' ? (
                                  <span className="badge badge-inactive">Localhost</span>
                                ) : (
                                  <span 
                                    className="badge badge-active" 
                                    style={{ 
                                      fontSize: '11px', 
                                      fontWeight: 600, 
                                      color: 'var(--chub-purple)',
                                      cursor: ipLocations[log.ip_address]?.latitude ? 'pointer' : 'default',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      transition: 'all 0.2s ease',
                                      border: '1px solid transparent'
                                    }}
                                    onMouseEnter={(e) => {
                                      if (ipLocations[log.ip_address]?.latitude) {
                                        e.currentTarget.style.borderColor = 'var(--chub-pink)';
                                        e.currentTarget.style.transform = 'scale(1.03)';
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.borderColor = 'transparent';
                                      e.currentTarget.style.transform = 'scale(1)';
                                    }}
                                    onClick={() => {
                                      const loc = ipLocations[log.ip_address];
                                      if (loc && loc.latitude) {
                                        setSelectedAuditLog(log);
                                        setSelectedAuditLoc(loc);
                                        setShowAuditMapModal(true);
                                      }
                                    }}
                                    title={ipLocations[log.ip_address]?.latitude ? "Click to view Google Maps location" : "IP Location details"}
                                  >
                                    <MapPin size={10} style={{ flexShrink: 0 }} />
                                    {ipLocations[log.ip_address]?.name || ipLocations[log.ip_address] || 'Resolving...'}
                                  </span>
                                )}
                              </td>
                              <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{log.target_record || 'N/A'}</td>
                              <td>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  <div>IP: {log.ip_address}</div>
                                  <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '250px' }} title={log.user_agent}>
                                    UA: {log.user_agent}
                                  </div>
                                </div>
                              </td>
                              {user?.role === 'Super Admin' && (
                                <td style={{ textAlign: 'center' }}>
                                  <button 
                                    onClick={() => handleDeleteLogs([log.id])} 
                                    className="btn btn-secondary" 
                                    style={{ padding: '4px 8px', borderColor: 'var(--color-error)', color: 'var(--color-error)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                    title="Delete log"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ACTIVE SESSIONS TAB */}
            {activeTab === 'sessions' && (
              <div>
                <h3 style={{ fontSize: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
                  {user?.role === 'Super Admin' ? 'Active Online User Sessions' : 'Active Clocked-In Employees'}
                </h3>
                
                {sessionsList.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No active sessions or clocked-in employees found.
                  </p>
                ) : (
                  <div className="table-container">
                    <table className="custom-table">
                      <thead>
                        {user?.role === 'Super Admin' ? (
                          <tr>
                            <th>User Name / Email</th>
                            <th>Role</th>
                            <th>Current Location</th>
                            <th>Active From (IST)</th>
                            <th>Active Duration</th>
                            <th>Client Info</th>
                            <th style={{ width: '120px', textAlign: 'center' }}>Actions</th>
                          </tr>
                        ) : (
                          <tr>
                            <th>Employee ID</th>
                            <th>Employee Name</th>
                            <th>Department</th>
                            <th>Clock-In Time</th>
                            <th>Assigned Location</th>
                            <th>Active From (IST)</th>
                            <th>Active Duration</th>
                            <th style={{ width: '220px', textAlign: 'center' }}>Actions</th>
                          </tr>
                        )}
                      </thead>
                      <tbody>
                        {sessionsList.map((item, idx) => {
                          const uniqueKey = item.session_id || item.employee_id || idx;
                          if (user?.role === 'Super Admin') {
                            return (
                              <tr key={uniqueKey}>
                                <td>
                                  <div style={{ fontWeight: 600 }}>{item.name}</div>
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.email}</span>
                                </td>
                                <td>
                                  <span className={`badge ${item.role === 'Employee' ? 'badge-kyc-pending' : 'badge-active'}`}>
                                    {item.role}
                                  </span>
                                </td>
                                <td style={{ fontWeight: 500, color: 'var(--chub-purple)' }}>{item.location}</td>
                                <td style={{ fontSize: '12px' }}>{item.active_from}</td>
                                <td style={{ fontWeight: 600, color: 'var(--chub-pink)' }}>{item.active_duration}</td>
                                <td>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    <div>IP: {item.ip_address}</div>
                                    <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '200px' }} title={item.user_agent}>
                                      {item.user_agent}
                                    </div>
                                  </div>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  {item.session_id ? (
                                    <button
                                      onClick={() => handleForceSignout(item.session_id, item.name)}
                                      className="btn btn-danger"
                                      style={{ padding: '6px 12px', fontSize: '12px' }}
                                    >
                                      Force Signout
                                    </button>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)' }}>Offline</span>
                                  )}
                                </td>
                              </tr>
                            );
                          } else {
                            // Admin Controller view
                            return (
                              <tr key={uniqueKey}>
                                <td style={{ fontWeight: 600 }}>{item.employee_id_str}</td>
                                <td style={{ fontWeight: 600 }}>{item.name}</td>
                                <td>{item.department}</td>
                                <td style={{ fontWeight: 600, color: 'var(--chub-purple)' }}>{item.clock_in_time} IST</td>
                                <td>{item.assigned_location}</td>
                                <td style={{ fontSize: '12px' }}>{item.active_from}</td>
                                <td style={{ fontWeight: 600, color: 'var(--chub-pink)' }}>{item.active_duration}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                    <button
                                      onClick={() => handleForceClockout(item.employee_id, item.name)}
                                      className="btn btn-secondary"
                                      style={{ padding: '6px 12px', fontSize: '12px', borderColor: 'var(--chub-purple)', color: 'var(--chub-purple)' }}
                                    >
                                      Force Clock-out
                                    </button>
                                    {item.session_id ? (
                                      <button
                                        onClick={() => handleForceSignout(item.session_id, item.name)}
                                        className="btn btn-danger"
                                        style={{ padding: '6px 12px', fontSize: '12px' }}
                                      >
                                        Force Signout
                                      </button>
                                    ) : (
                                      <button
                                        className="btn btn-secondary"
                                        style={{ padding: '6px 12px', fontSize: '12px', opacity: 0.5, cursor: 'not-allowed' }}
                                        disabled
                                        title="Employee is not currently signed in"
                                      >
                                        Offline
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          }
                        })}
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
                                style={{ padding: '6px 12px', fontSize: '12px', opacity: canManageUser('status', usr) ? 1 : 0.5, cursor: canManageUser('status', usr) ? 'pointer' : 'not-allowed' }}
                                disabled={!canManageUser('status', usr)}
                              >
                                {usr.status === 'active' ? 'Deactivate' : 'Activate'}
                              </button>
                              <button 
                                onClick={() => { setTargetUserId(usr.id); setShowResetModal(true); }}
                                className="btn btn-primary"
                                style={{ padding: '6px 12px', fontSize: '12px', opacity: canManageUser('reset', usr) ? 1 : 0.5, cursor: canManageUser('reset', usr) ? 'pointer' : 'not-allowed' }}
                                disabled={!canManageUser('reset', usr)}
                              >
                                <Key size={12} /> Force Reset
                              </button>
                              <button 
                                onClick={() => handleHardDeleteUser(usr.id, usr.email)}
                                className="btn btn-secondary"
                                style={{ padding: '6px 12px', fontSize: '12px', borderColor: 'var(--color-error)', color: 'var(--color-error)', opacity: canManageUser('purge', usr) ? 1 : 0.5, cursor: canManageUser('purge', usr) ? 'pointer' : 'not-allowed' }}
                                title={canManageUser('purge', usr) ? "Purge all user database records and files" : "Unauthorized to purge this account"}
                                disabled={!canManageUser('purge', usr)}
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
                  <div className="form-group">
                    <label className="form-label">Auto Clock-out Duration Threshold (Hours)</label>
                    <input 
                      type="number"
                      step="0.5"
                      min="1"
                      className="form-control"
                      value={settings.auto_clockout_duration || '12'}
                      onChange={(e) => setSettings({ ...settings, auto_clockout_duration: e.target.value })}
                      placeholder="e.g. 12"
                    />
                  </div>
                  {/* Default Base Leaves Allocation */}
                  <h4 style={{ color: 'var(--chub-purple)', fontSize: '14px', margin: '24px 0 12px 0' }}>Default Base Leaves Allocation (New Onboardings)</h4>
                  <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
                    {leaveTypes.map((lt, idx) => (
                      <div className="form-group" key={lt.id}>
                        <label className="form-label">{lt.name} ({lt.code})</label>
                        <input 
                          type="number" 
                          className="form-control" 
                          value={lt.max_days} 
                          onChange={(e) => {
                            const newList = [...leaveTypes];
                            newList[idx].max_days = parseInt(e.target.value, 10) || 0;
                            setLeaveTypes(newList);
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Non-Paid Leave Salary Cut Policies */}
                  <h4 style={{ color: 'var(--chub-purple)', fontSize: '14px', margin: '24px 0 12px 0' }}>Non-Paid Leave Salary Cut Policies</h4>
                  <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
                    <div className="form-group">
                      <label className="form-label">Unexcused Absence Cut (%)</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        value={settings.paycut_absent === undefined ? 100 : settings.paycut_absent} 
                        onChange={(e) => setSettings({ ...settings, paycut_absent: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Loss of Pay (LOP) Cut (%)</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        value={settings.paycut_lop === undefined ? 100 : settings.paycut_lop} 
                        onChange={(e) => setSettings({ ...settings, paycut_lop: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Half Day Work Cut (%)</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        value={settings.paycut_half_day === undefined ? 50 : settings.paycut_half_day} 
                        onChange={(e) => setSettings({ ...settings, paycut_half_day: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Common Working Hour Assignation */}
                  <h4 style={{ color: 'var(--chub-purple)', fontSize: '14px', margin: '24px 0 12px 0' }}>Employment Common Working Hours</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '12px' }}>
                    Specify the default shift timelines (Clock-in and Clock-out times) per employment type. Note: These are informational and displayed on the ESS shift timeline.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '8px' }}>
                    {[
                      { type: 'Full-time', label: 'Full-Time' },
                      { type: 'Part-time', label: 'Part-Time' },
                      { type: 'Intern', label: 'Intern' },
                      { type: 'Consultant', label: 'Consultant' },
                      { type: 'Contract', label: 'Contract' },
                      { type: 'Probation', label: 'Probation' },
                      { type: 'Remote (WFH)', label: 'Remote (WFH)' }
                    ].map(({ type, label }) => {
                      const suffix = type.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
                      const keyIn = `work_hours_${suffix}_in`;
                      const keyOut = `work_hours_${suffix}_out`;
                      
                      return (
                        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', borderBottom: '1px dashed var(--border-color)', paddingBottom: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', width: '130px' }}>{label}</span>
                          <div style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '200px' }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Clock-In (e.g. 09:30 AM)</label>
                              <input 
                                type="text" 
                                className="form-control" 
                                placeholder="09:30 AM"
                                value={settings[keyIn] === undefined ? '09:30 AM' : settings[keyIn]}
                                onChange={(e) => setSettings({ ...settings, [keyIn]: e.target.value })}
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Clock-Out (e.g. 05:30 PM)</label>
                              <input 
                                type="text" 
                                className="form-control" 
                                placeholder="05:30 PM"
                                value={settings[keyOut] === undefined ? '05:30 PM' : settings[keyOut]}
                                onChange={(e) => setSettings({ ...settings, [keyOut]: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
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

            {/* 5. SUB-ADMINS MANAGEMENT */}
            {activeTab === 'subadmins' && (
              <div>
                <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', margin: 0, color: 'var(--chub-purple)' }}>Sub-Admin Accounts</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
                      Created: <strong>{subAdminsList.length}</strong> / <strong>{adminCreationLimit}</strong> limits set by Super Admin.
                    </p>
                  </div>
                  <button 
                    onClick={handleOpenAddSubAdmin} 
                    className="btn btn-primary"
                    disabled={subAdminsList.length >= adminCreationLimit}
                    title={subAdminsList.length >= adminCreationLimit ? "Sub-admin limit reached" : "Add new sub-admin"}
                  >
                    <Plus size={16} /> Create Sub-Admin
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '20px' }}>
                  {/* Left Column: Sub-Admins list */}
                  <div style={{ flex: 1.8, minWidth: '350px' }}>
                    <div className="table-container">
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subAdminsList.length === 0 ? (
                            <tr>
                              <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                                No sub-admin accounts created yet.
                              </td>
                            </tr>
                          ) : (
                            subAdminsList.map((sa) => (
                              <tr 
                                key={sa.id} 
                                style={{ 
                                  cursor: 'pointer', 
                                  backgroundColor: selectedSubAdminId === sa.id ? 'rgba(216, 90, 166, 0.05)' : 'transparent' 
                                }}
                                onClick={() => handleSelectSubAdmin(sa.id)}
                              >
                                <td style={{ fontWeight: 600 }}>{sa.full_name || 'N/A'}</td>
                                <td>{sa.email}</td>
                                <td><span className="badge badge-kyc-pending">{sa.role_name}</span></td>
                                <td>
                                  <span className={`badge ${sa.status === 'active' ? 'badge-active' : 'badge-inactive'}`}>
                                    {sa.status}
                                  </span>
                                </td>
                                <td onClick={(e) => e.stopPropagation()}>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button 
                                      onClick={() => handleOpenEditSubAdmin(sa)} 
                                      className="btn btn-secondary"
                                      style={{ padding: '4px 8px', border: 'none' }}
                                      title="Edit details"
                                    >
                                      <Plus size={14} style={{ color: 'var(--chub-pink)' }} />
                                    </button>
                                    <button 
                                      onClick={() => handleToggleUserStatus(sa.id, sa.status)} 
                                      className="btn btn-secondary"
                                      style={{ padding: '4px 8px', fontSize: '11px' }}
                                    >
                                      {sa.status === 'active' ? 'Pause' : 'Resume'}
                                    </button>
                                    <button 
                                      onClick={() => handleHardDeleteUser(sa.id, sa.email)} 
                                      className="btn btn-secondary"
                                      style={{ padding: '4px 8px', border: 'none' }}
                                      title="Terminate Sub-Admin"
                                    >
                                      <Trash2 size={14} style={{ color: 'var(--color-error)' }} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right Column: Module Access Control */}
                  <div style={{ flex: 1.2, minWidth: '280px' }}>
                    <div className="card" style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                      <h4 style={{ fontSize: '16px', color: 'var(--chub-purple)', margin: '0 0 16px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                        Module Access Settings
                      </h4>
                      {selectedSubAdminId ? (
                        (() => {
                          const currentSubAdmin = subAdminsList.find(sa => sa.id === selectedSubAdminId);
                          const activeModules = (licensingData.modules || []).filter(m => m.is_enabled);
                          
                          return (
                            <form onSubmit={handleSaveSubAdminPermissions}>
                              <p style={{ fontSize: '13px', marginBottom: '16px', color: 'var(--text-muted)' }}>
                                Configure access for: <strong>{currentSubAdmin?.full_name || currentSubAdmin?.email}</strong>
                              </p>
                              {activeModules.length === 0 ? (
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                  No modules are currently licensed or enabled for the Admin Controller.
                                </p>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                                  {activeModules.map((m) => {
                                    const isChecked = subAdminAccess.some(sa => sa.module_key === m.module_key && sa.is_enabled);
                                    
                                    const moduleNameMap = {
                                      dashboard: 'Dashboard',
                                      employees: 'Employee Lifecycle',
                                      attendance: 'Attendance Hub',
                                      leaves: 'Leave Manager',
                                      security: 'Security & Audits',
                                      reports: 'Reports & Export'
                                    };
                                    
                                    return (
                                      <label 
                                        key={m.module_key}
                                        style={{ 
                                          display: 'flex', 
                                          alignItems: 'center', 
                                          gap: '10px', 
                                          cursor: 'pointer',
                                          padding: '8px 12px',
                                          borderRadius: '6px',
                                          backgroundColor: 'rgba(255, 255, 255, 0.01)',
                                          border: '1px solid rgba(255, 255, 255, 0.05)',
                                          transition: 'all 0.2s'
                                        }}
                                      >
                                        <input 
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={(e) => handleToggleSubModule(m.module_key, e.target.checked)}
                                          style={{ width: '16px', height: '16px', accentColor: 'var(--chub-pink)' }}
                                        />
                                        <span style={{ fontSize: '14px', fontWeight: 500 }}>
                                          {moduleNameMap[m.module_key] || m.module_key}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                              <button 
                                type="submit" 
                                className="btn btn-primary"
                                style={{ width: '100%', padding: '10px' }}
                                disabled={subAdminAccessSaving || activeModules.length === 0}
                              >
                                {subAdminAccessSaving ? 'Saving access...' : 'Update Module Access'}
                              </button>
                            </form>
                          );
                        })()
                      ) : (
                        <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
                          <Users size={32} style={{ color: 'var(--chub-pink)', opacity: 0.5, marginBottom: '12px' }} />
                          <p style={{ fontSize: '13px' }}>Select a sub-admin from the table to customize their module accessibility.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 6. HOLIDAY CALENDAR TAB */}
            {activeTab === 'holidays' && (
              <div>
                <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', margin: 0, color: 'var(--chub-purple)' }}>Holiday & Weekend Calendar</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
                      Configure standard holidays, weekly weekends, and clone them for upcoming fiscal terms.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <label className="form-label" style={{ margin: 0, fontSize: '13px' }}>Year Filter:</label>
                    <select 
                      className="form-control" 
                      value={holidayYear} 
                      onChange={(e) => setHolidayYear(Number(e.target.value))}
                      style={{ width: '100px', height: '36px', padding: '0 8px' }}
                    >
                      {Array.from({ length: 5 }, (_, i) => {
                        const yr = new Date().getFullYear() - 2 + i;
                        return <option key={yr} value={yr}>{yr}</option>;
                      })}
                    </select>
                    <button onClick={handleFetchNagerHolidays} className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '13px' }}>
                      Fetch India Holidays
                    </button>
                    <button onClick={() => setShowGenerateWeekendsModal(true)} className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '13px' }}>
                      Generate Weekends
                    </button>
                    <button onClick={() => setShowCloneHolidaysModal(true)} className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '13px' }}>
                      Clone Year
                    </button>
                    <button 
                      onClick={() => {
                        setHolidayForm({ id: null, name: '', date: `${holidayYear}-01-01`, description: '', type: 'Public Holiday', is_paid: true });
                        setShowHolidayModal(true);
                      }} 
                      className="btn btn-primary"
                      style={{ padding: '8px 12px', fontSize: '13px' }}
                    >
                      <Plus size={14} /> Add Holiday
                    </button>
                  </div>
                </div>

                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Holiday Name</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Description / Notes</th>
                        <th style={{ width: '100px', textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holidays.length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                            No holidays configured for {holidayYear}.
                          </td>
                        </tr>
                      ) : (
                        holidays.map((h) => {
                          let notes = '';
                          let type = 'Public Holiday';
                          let isPaid = true;
                          try {
                            if (h.description && (h.description.startsWith('{') || h.description.startsWith('['))) {
                              const parsed = JSON.parse(h.description);
                              notes = parsed.notes || '';
                              type = parsed.type || 'Public Holiday';
                              isPaid = parsed.is_paid !== false;
                            } else {
                              notes = h.description || '';
                            }
                          } catch (e) {
                            notes = h.description || '';
                          }

                          return (
                            <tr key={h.id}>
                              <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                                {h.date}
                              </td>
                              <td style={{ fontWeight: 600 }}>{h.name}</td>
                              <td>
                                <span className={`badge ${type === 'Weekly Holiday' ? 'badge-active' : 'badge-kyc-pending'}`}>
                                  {type}
                                </span>
                              </td>
                              <td>
                                <span className={`badge ${isPaid ? 'badge-active' : 'badge-inactive'}`}>
                                  {isPaid ? 'Paid' : 'Unpaid'}
                                </span>
                              </td>
                              <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{notes || 'N/A'}</td>
                              <td>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                  <button 
                                    onClick={() => {
                                      setHolidayForm({
                                        id: h.id,
                                        name: h.name,
                                        date: h.date,
                                        description: notes,
                                        type: type,
                                        is_paid: isPaid
                                      });
                                      setShowHolidayModal(true);
                                    }} 
                                    className="btn btn-secondary"
                                    style={{ padding: '6px 10px', border: 'none' }}
                                    title="Edit Holiday"
                                  >
                                    <Plus size={14} style={{ color: 'var(--chub-pink)' }} />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteHoliday(h.id)}
                                    className="btn btn-secondary"
                                    style={{ padding: '6px 10px', border: 'none' }}
                                    title="Delete Holiday"
                                  >
                                    <Trash2 size={14} style={{ color: 'var(--color-error)' }} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
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

      {/* ADD / EDIT SUB-ADMIN MODAL */}
      {showSubAdminModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <h3 style={{ marginBottom: '20px' }}>
              {subAdminForm.id ? 'Modify Sub-Admin Details' : 'Create New Sub-Admin'}
            </h3>
            <form onSubmit={handleSaveSubAdmin}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Enter administrator name"
                  value={subAdminForm.name}
                  onChange={(e) => setSubAdminForm({ ...subAdminForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <input 
                  type="email" 
                  className="form-control" 
                  placeholder="e.g. name@company.com"
                  value={subAdminForm.email}
                  onChange={(e) => setSubAdminForm({ ...subAdminForm, email: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  {subAdminForm.id ? 'Update Password (Optional)' : 'Secure Password *'}
                </label>
                <input 
                  type="password" 
                  className="form-control" 
                  placeholder={subAdminForm.id ? "Leave blank to keep current" : "Minimum 6 characters"}
                  value={subAdminForm.password}
                  onChange={(e) => setSubAdminForm({ ...subAdminForm, password: e.target.value })}
                  required={!subAdminForm.id}
                  minLength={6}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Assign System Role *</label>
                <select 
                  className="form-control" 
                  value={subAdminForm.roleId}
                  onChange={(e) => setSubAdminForm({ ...subAdminForm, roleId: e.target.value })}
                  required
                >
                  <option value="2">Admin</option>
                  <option value="3">HR Manager</option>
                  <option value="4">Department Manager</option>
                  <option value="5">Finance Manager</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowSubAdminModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {subAdminForm.id ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT HOLIDAY MODAL */}
      {showHolidayModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <h3 style={{ marginBottom: '20px' }}>
              {holidayForm.id ? 'Modify Holiday Details' : 'Configure New Holiday'}
            </h3>
            <form onSubmit={handleSaveHoliday}>
              <div className="form-group">
                <label className="form-label">Holiday Name *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. Independence Day"
                  value={holidayForm.name}
                  onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Holiday Date *</label>
                <input 
                  type="date" 
                  className="form-control" 
                  value={holidayForm.date}
                  onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Holiday Type *</label>
                <select 
                  className="form-control"
                  value={holidayForm.type}
                  onChange={(e) => setHolidayForm({ ...holidayForm, type: e.target.value })}
                  required
                >
                  <option value="Public Holiday">Public Holiday</option>
                  <option value="Weekly Holiday">Weekly Holiday</option>
                  <option value="Rest Day">Rest Day</option>
                  <option value="Company Holiday">Company Holiday</option>
                </select>
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '12px' }}>
                <input 
                  type="checkbox"
                  id="holiday_is_paid"
                  checked={holidayForm.is_paid}
                  onChange={(e) => setHolidayForm({ ...holidayForm, is_paid: e.target.checked })}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--chub-pink)' }}
                /> 
                <label htmlFor="holiday_is_paid" style={{ fontSize: '14px', cursor: 'pointer', margin: 0 }}>Is this a paid holiday?</label>
              </div>

              <div className="form-group">
                <label className="form-label">Notes / Description</label>
                <textarea 
                  className="form-control" 
                  rows="3"
                  placeholder="Additional context or compliance notes"
                  value={holidayForm.description}
                  onChange={(e) => setHolidayForm({ ...holidayForm, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowHolidayModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Holiday
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GENERATE WEEKENDS MODAL */}
      {showGenerateWeekendsModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '380px' }}>
            <h3 style={{ marginBottom: '16px' }}>Generate Weekend Holidays</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Automatically bulk-insert Saturdays and Sundays as weekly rest days for the year <strong>{holidayYear}</strong>. Duplicate dates will be skipped automatically.
            </p>
            <form onSubmit={handleGenerateWeekends}>
              <div className="form-group">
                <label className="form-label">Weekend Day Preference *</label>
                <select 
                  className="form-control"
                  value={weekendsType}
                  onChange={(e) => setWeekendsType(e.target.value)}
                  required
                >
                  <option value="both">Both Saturday & Sunday</option>
                  <option value="sunday">Sunday Only</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowGenerateWeekendsModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Generate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLONE HOLIDAYS MODAL */}
      {showCloneHolidaysModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '380px' }}>
            <h3 style={{ marginBottom: '16px' }}>Clone Holidays to Next Year</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Copy all holidays from the selected year <strong>{holidayYear}</strong> into a target year. Dates will be shifted to match the same month and day of the target year.
            </p>
            <form onSubmit={handleCloneHolidays}>
              <div className="form-group">
                <label className="form-label">Target Year *</label>
                <input 
                  type="number"
                  className="form-control"
                  value={cloneTargetYear}
                  onChange={(e) => setCloneTargetYear(Number(e.target.value))}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowCloneHolidaysModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Copy Holidays
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AUDIT MAP MODAL */}
      {showAuditMapModal && selectedAuditLog && selectedAuditLoc && (
        <div className="modal-overlay" onClick={() => setShowAuditMapModal(false)}>
          <div className="modal-content" style={{ maxWidth: '480px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, textTransform: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={20} style={{ color: 'var(--chub-pink)' }} />
                Audit Log Location
              </h3>
              <button 
                onClick={() => setShowAuditMapModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: '1' }}
              >
                &times;
              </button>
            </div>

            <div style={{ fontSize: '13px', marginBottom: '16px', lineHeight: '1.5', color: 'var(--text-muted)' }}>
              <div><strong>Action Type:</strong> {selectedAuditLog.action_type}</div>
              <div><strong>Performed By:</strong> {selectedAuditLog.performed_by} ({selectedAuditLog.role})</div>
              <div><strong>IP Address:</strong> {selectedAuditLog.ip_address}</div>
              <div><strong>Resolved Location:</strong> {selectedAuditLoc.name}</div>
              {selectedAuditLoc.latitude && (
                <div><strong>Coordinates:</strong> {selectedAuditLoc.latitude}, {selectedAuditLoc.longitude}</div>
              )}
            </div>

            {selectedAuditLoc.latitude && (
              <iframe
                title="Audit Location Map"
                width="100%"
                height="280"
                style={{ border: '1px solid var(--border-color)', borderRadius: '12px' }}
                loading="lazy"
                allowFullScreen
                src={`https://maps.google.com/maps?q=${selectedAuditLoc.latitude},${selectedAuditLoc.longitude}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
              />
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button onClick={() => setShowAuditMapModal(false)} className="btn btn-secondary" style={{ padding: '8px 24px' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
