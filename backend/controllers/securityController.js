const supabase = require('../config/db');
const bcrypt = require('bcryptjs');
const { logAudit } = require('../utils/auditLogger');

const securityController = {
  // Fetch security audit logs with advanced filters
  getAuditLogs: async (req, res) => {
    const { fromDate, toDate, user, actionType } = req.query;

    let query = supabase.from('audit_logs').select('*').order('id', { ascending: false }).limit(100);

    if (fromDate && toDate) {
      query = query.gte('created_at', `${fromDate} 00:00:00`).lte('created_at', `${toDate} 23:59:59`);
    }

    if (user) {
      query = query.or(`performed_by.ilike.%${user}%,role.ilike.%${user}%`);
    }

    if (actionType) {
      query = query.eq('action_type', actionType);
    }

    try {
      const { data: logs, error } = await query;
      if (error) throw error;
      res.json(logs || []);
    } catch (err) {
      console.error('GetAuditLogs Error:', err.message);
      res.status(500).json({ message: 'Error retrieving system audit logs.' });
    }
  },

  // Fetch successful/failed login histories
  getLoginHistory: async (req, res) => {
    try {
      const { data: history, error } = await supabase
        .from('login_history')
        .select('*')
        .order('id', { ascending: false })
        .limit(100);

      if (error) throw error;
      res.json(history || []);
    } catch (err) {
      console.error('GetLoginHistory Error:', err.message);
      res.status(500).json({ message: 'Error retrieving login history logs.' });
    }
  },

  // Fetch security event alerts
  getSecurityEvents: async (req, res) => {
    try {
      const { data: events, error } = await supabase
        .from('security_events')
        .select('*')
        .order('id', { ascending: false });

      if (error) throw error;
      res.json(events || []);
    } catch (err) {
      console.error('GetSecurityEvents Error:', err.message);
      res.status(500).json({ message: 'Error retrieving security alerts.' });
    }
  },

  // List all users and credential access details
  listUsers: async (req, res) => {
    try {
      const { data: users, error } = await supabase
        .from('users')
        .select(`
          id, email, status, onboarding_completed,
          roles(name),
          employees(employee_id, full_name)
        `)
        .order('id', { ascending: true });

      if (error) throw error;

      const mappedUsers = (users || []).map(u => ({
        id: u.id,
        email: u.email,
        status: u.status,
        onboarding_completed: u.onboarding_completed,
        role_name: u.roles ? u.roles.name : null,
        employee_id: (u.employees && u.employees.length > 0) ? u.employees[0].employee_id : null,
        full_name: (u.employees && u.employees.length > 0) ? u.employees[0].full_name : null
      }));

      res.json(mappedUsers);
    } catch (err) {
      console.error('ListUsers Error:', err.message);
      res.status(500).json({ message: 'Error loading user logins list.' });
    }
  },

  // Activate / Deactivate login accounts
  toggleUserStatus: async (req, res) => {
    const { userId } = req.params;
    const { status } = req.body; // status: active or inactive

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status parameter.' });
    }

    try {
      const { data: current, error: curErr } = await supabase.from('users').select('email, status').eq('id', userId);
      if (curErr || !current || current.length === 0) {
        return res.status(404).json({ message: 'User account not found.' });
      }

      await supabase.from('users').update({ status }).eq('id', userId);

      // If user is also employee, update status accordingly
      if (status === 'inactive') {
        await supabase.from('employees').update({ status: 'Inactive' }).eq('user_id', userId);
      } else {
        await supabase.from('employees').update({ status: 'Active' }).eq('user_id', userId);
      }

      // Log Security audit
      await logAudit(req, `USER_LOGIN_${status.toUpperCase()}`, `users/${userId}`, current[0], { status });

      res.json({ message: `User account is now ${status}.` });
    } catch (err) {
      console.error('ToggleUserStatus Error:', err.message);
      res.status(500).json({ message: 'Error updating user status.' });
    }
  },

  // Admin resets employee password
  adminResetPassword: async (req, res) => {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'A secure password of at least 6 characters is required.' });
    }

    try {
      const { data: users, error } = await supabase.from('users').select('email').eq('id', userId);
      if (error || !users || users.length === 0) {
        return res.status(404).json({ message: 'User account not found.' });
      }

      const salt = await bcrypt.genSalt(10);
      const passHash = await bcrypt.hash(newPassword, salt);

      await supabase.from('users').update({ password_hash: passHash }).eq('id', userId);

      await logAudit(req, 'ADMIN_RESET_PASSWORD', `users/${userId}`, null, { message: 'Password forcefully reset by admin' });

      res.json({ message: 'Employee password reset completed successfully.' });
    } catch (err) {
      console.error('AdminResetPassword Error:', err.message);
      res.status(500).json({ message: 'Error resetting password.' });
    }
  },

  // Roles & Permissions Links
  listRoles: async (req, res) => {
    try {
      const { data: roles, error } = await supabase
        .from('roles')
        .select(`
          *,
          role_permissions(
            permission_id,
            permissions(name)
          )
        `);

      if (error) throw error;

      // Nest permission lists
      const mapped = (roles || []).map(role => {
        const perms = (role.role_permissions || []).map(rp => ({
          id: rp.permission_id,
          name: rp.permissions ? rp.permissions.name : null
        })).filter(p => p.name);

        const roleCopy = { ...role, permissions: perms };
        delete roleCopy.role_permissions;
        return roleCopy;
      });

      res.json(mapped);
    } catch (err) {
      console.error('ListRoles Error:', err.message);
      res.status(500).json({ message: 'Error loading roles.' });
    }
  },

  listPermissions: async (req, res) => {
    try {
      const { data: list, error } = await supabase.from('permissions').select('*');
      if (error) throw error;
      res.json(list || []);
    } catch (err) {
      console.error('ListPermissions Error:', err.message);
      res.status(500).json({ message: 'Error loading permissions list.' });
    }
  },

  // Update permissions for a role
  updateRolePermissions: async (req, res) => {
    const { roleId } = req.params;
    const { permissionIds } = req.body; // array of permission IDs

    if (!Array.isArray(permissionIds)) {
      return res.status(400).json({ message: 'Permissions parameter must be an array of IDs.' });
    }

    try {
      // Clear current mappings
      await supabase.from('role_permissions').delete().eq('role_id', roleId);

      // Insert new mappings
      if (permissionIds.length > 0) {
        const inserts = permissionIds.map(pid => ({ role_id: roleId, permission_id: pid }));
        await supabase.from('role_permissions').insert(inserts);
      }

      await logAudit(req, 'UPDATE_ROLE_PERMISSIONS', `roles/${roleId}`, null, { permissionIds });

      res.json({ message: 'Role permissions updated successfully.' });
    } catch (err) {
      console.error('UpdateRolePermissions Error:', err.message);
      res.status(500).json({ message: 'Error saving role permissions.' });
    }
  },

  // Fetch Settings
  getSystemSettings: async (req, res) => {
    try {
      const { data: settings, error } = await supabase.from('system_settings').select('*');
      if (error) throw error;
      res.json(settings || []);
    } catch (err) {
      console.error('GetSystemSettings Error:', err.message);
      res.status(500).json({ message: 'Error loading settings.' });
    }
  },

  updateSystemSettings: async (req, res) => {
    const { settings } = req.body; // Object: { key: value, key2: value2 }

    try {
      for (const [key, val] of Object.entries(settings)) {
        await supabase.from('system_settings').update({ setting_value: String(val) }).eq('setting_key', key);
      }

      await logAudit(req, 'UPDATE_SYSTEM_SETTINGS', 'system_settings', null, settings);

      res.json({ message: 'System configurations updated successfully.' });
    } catch (err) {
      console.error('UpdateSystemSettings Error:', err.message);
      res.status(500).json({ message: 'Error updating system settings.' });
    }
  }
};

module.exports = securityController;
