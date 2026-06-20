const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { logAudit } = require('../utils/auditLogger');

const securityController = {
  // Fetch security audit logs with advanced filters
  getAuditLogs: async (req, res) => {
    const { fromDate, toDate, user, actionType } = req.query;

    let query = `
      SELECT id, user_id, action_type, performed_by, role, target_record, old_value, new_value, ip_address, user_agent, created_at
      FROM audit_logs
      WHERE 1=1
    `;
    const params = [];

    if (fromDate && toDate) {
      query += ` AND created_at BETWEEN ? AND ?`;
      params.push(`${fromDate} 00:00:00`, `${toDate} 23:59:59`);
    }

    if (user) {
      query += ` AND (performed_by LIKE ? OR role LIKE ?)`;
      params.push(`%${user}%`, `%${user}%`);
    }

    if (actionType) {
      query += ` AND action_type = ?`;
      params.push(actionType);
    }

    query += ` ORDER BY id DESC LIMIT 100`;

    try {
      const logs = await db.query(query, params);
      res.json(logs);
    } catch (err) {
      console.error('GetAuditLogs Error:', err.message);
      res.status(500).json({ message: 'Error retrieving system audit logs.' });
    }
  },

  // Fetch successful/failed login histories
  getLoginHistory: async (req, res) => {
    try {
      const history = await db.query(`
        SELECT id, user_id, email_attempted, ip_address, user_agent, status, remarks, created_at
        FROM login_history
        ORDER BY id DESC
        LIMIT 100
      `);
      res.json(history);
    } catch (err) {
      console.error('GetLoginHistory Error:', err.message);
      res.status(500).json({ message: 'Error retrieving login history logs.' });
    }
  },

  // Fetch security event alerts
  getSecurityEvents: async (req, res) => {
    try {
      const events = await db.query(`
        SELECT id, severity, event_type, details, ip_address, user_agent, created_at
        FROM security_events
        ORDER BY id DESC
      `);
      res.json(events);
    } catch (err) {
      console.error('GetSecurityEvents Error:', err.message);
      res.status(500).json({ message: 'Error retrieving security alerts.' });
    }
  },

  // List all users and credential access details
  listUsers: async (req, res) => {
    try {
      const users = await db.query(`
        SELECT u.id, u.email, u.status, u.onboarding_completed, r.name AS role_name,
               e.employee_id, e.full_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN employees e ON e.user_id = u.id
        ORDER BY u.id ASC
      `);
      res.json(users);
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
      const current = await db.query('SELECT email, status FROM users WHERE id = ?', [userId]);
      if (current.length === 0) {
        return res.status(404).json({ message: 'User account not found.' });
      }

      await db.query('UPDATE users SET status = ? WHERE id = ?', [status, userId]);

      // If user is also employee, update status accordingly
      if (status === 'inactive') {
        await db.query('UPDATE employees SET status = "Inactive" WHERE user_id = ?', [userId]);
      } else {
        await db.query('UPDATE employees SET status = "Active" WHERE user_id = ?', [userId]);
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
      const users = await db.query('SELECT email FROM users WHERE id = ?', [userId]);
      if (users.length === 0) {
        return res.status(404).json({ message: 'User account not found.' });
      }

      const salt = await bcrypt.genSalt(10);
      const passHash = await bcrypt.hash(newPassword, salt);

      await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [passHash, userId]);

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
      const roles = await db.query('SELECT * FROM roles');
      const rolePermissions = await db.query(`
        SELECT rp.role_id, p.id AS permission_id, p.name AS permission_name
        FROM role_permissions rp
        JOIN permissions p ON rp.permission_id = p.id
      `);

      // Nest permission lists
      const mapped = roles.map(role => {
        const perms = rolePermissions
          .filter(rp => rp.role_id === role.id)
          .map(rp => ({ id: rp.permission_id, name: rp.permission_name }));
        return {
          ...role,
          permissions: perms
        };
      });

      res.json(mapped);
    } catch (err) {
      console.error('ListRoles Error:', err.message);
      res.status(500).json({ message: 'Error loading roles.' });
    }
  },

  listPermissions: async (req, res) => {
    try {
      const list = await db.query('SELECT * FROM permissions');
      res.json(list);
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
      await db.query('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);

      // Insert new mappings
      if (permissionIds.length > 0) {
        const values = permissionIds.map(pid => [roleId, pid]);
        await db.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ?', [values]);
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
      const settings = await db.query('SELECT * FROM system_settings');
      res.json(settings);
    } catch (err) {
      console.error('GetSystemSettings Error:', err.message);
      res.status(500).json({ message: 'Error loading settings.' });
    }
  },

  updateSystemSettings: async (req, res) => {
    const { settings } = req.body; // Object: { key: value, key2: value2 }

    try {
      for (const [key, val] of Object.entries(settings)) {
        await db.query('UPDATE system_settings SET setting_value = ? WHERE setting_key = ?', [String(val), key]);
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
