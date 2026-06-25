const supabase = require('../config/db');
const bcrypt = require('bcryptjs');
const { logAudit } = require('../utils/auditLogger');
const nodemailer = require('nodemailer');

const securityController = {
  getAuditLogs: async (req, res) => {
    const { fromDate, toDate, user, actionType, page = 1, limit = 100, exportAll } = req.query;

    let query = supabase.from('audit_logs').select('*', { count: 'exact' })
      .or('role.neq."Super Admin",action_type.eq.VIEW_LIVE_LOCATION,action_type.eq.DELETE_ATTENDANCE_LEAVE')
      .or('performed_by.neq.chub.admin@adloaf.com,action_type.eq.VIEW_LIVE_LOCATION,action_type.eq.DELETE_ATTENDANCE_LEAVE')
      .order('id', { ascending: false });

    if (fromDate && toDate) {
      query = query.gte('created_at', `${fromDate} 00:00:00`).lte('created_at', `${toDate} 23:59:59`);
    }

    if (user) {
      query = query.or(`performed_by.ilike.%${user}%,role.ilike.%${user}%`);
    }

    if (actionType) {
      query = query.eq('action_type', actionType);
    }

    // Apply pagination only if not exporting all logs
    const isExport = exportAll === 'true';
    if (!isExport) {
      const parsedPage = parseInt(page, 10) || 1;
      const parsedLimit = parseInt(limit, 10) || 100;
      const offset = (parsedPage - 1) * parsedLimit;
      query = query.range(offset, offset + parsedLimit - 1);
    } else {
      // Set a high upper limit to fetch all matching logs for download
      query = query.range(0, 99999);
    }

    try {
      const { data: logs, error, count } = await query;
      if (error) throw error;
      res.json({
        logs: logs || [],
        total: count || 0
      });
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
        .neq('email_attempted', 'chub.admin@adloaf.com')
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
          id, email, status, onboarding_completed, full_name,
          roles(name),
          employees(employee_id, full_name, deleted_at)
        `)
        .order('id', { ascending: true });

      if (error) throw error;

      const { data: controllerAcc } = await supabase.from('admin_controller_access').select('user_id, full_name').limit(1);
      const controllerMap = {};
      if (controllerAcc && controllerAcc.length > 0 && controllerAcc[0].user_id) {
        controllerMap[controllerAcc[0].user_id] = controllerAcc[0].full_name;
      }

      let mappedUsers = (users || []).map(u => {
        const emp = (u.employees && u.employees.length > 0) ? u.employees[0] : null;
        let fullName = emp ? emp.full_name : (u.full_name || null);
        if (u.roles && u.roles.name === 'Admin Controller' && controllerMap[u.id]) {
          fullName = controllerMap[u.id];
        }
        return {
          id: u.id,
          email: u.email,
          status: u.status,
          onboarding_completed: u.onboarding_completed,
          role_name: u.roles ? u.roles.name : null,
          employee_id: emp ? emp.employee_id : null,
          full_name: fullName,
          deleted_at: emp ? emp.deleted_at : null,
          is_soft_deleted: !!(emp && emp.deleted_at)
        };
      });

      if (req.user.roleName !== 'Super Admin') {
        mappedUsers = mappedUsers.filter(u => u.email !== 'chub.admin@adloaf.com' && u.role_name !== 'Super Admin');
      }

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
      const { data: targetUsers, error: curErr } = await supabase
        .from('users')
        .select('id, email, status, role_id, roles(name)')
        .eq('id', userId);

      if (curErr || !targetUsers || targetUsers.length === 0) {
        return res.status(404).json({ message: 'User account not found.' });
      }
      const targetUser = targetUsers[0];

      const actorId = parseInt(req.user.id, 10);
      const targetId = parseInt(targetUser.id, 10);
      const actorRole = req.user.roleName;
      const targetRole = targetUser.roles ? targetUser.roles.name : null;

      // 1. Self-management check
      if (actorId === targetId) {
        return res.status(403).json({ message: 'Access denied: You cannot modify your own account status.' });
      }

      // 2. Super Admin target
      if (targetRole === 'Super Admin') {
        if (actorRole !== 'Super Admin') {
          return res.status(403).json({ message: 'Access denied: Only Super Admin can manage Super Admin accounts.' });
        }
      }

      // 3. Admin Controller target
      if (targetRole === 'Admin Controller') {
        if (actorRole !== 'Super Admin') {
          return res.status(403).json({ message: 'Access denied: Only Super Admin can manage Admin Controller accounts.' });
        }
      }

      const isSubAdminRole = (role) => {
        return role && role !== 'Employee' && role !== 'Super Admin' && role !== 'Admin Controller';
      };

      // 4. Sub-admin target
      if (isSubAdminRole(targetRole)) {
        if (actorRole !== 'Super Admin' && actorRole !== 'Admin Controller') {
          return res.status(403).json({ message: 'Access denied: Sub-admins can only be managed by Super Admin or Admin Controller.' });
        }
      }

      await supabase.from('users').update({ status }).eq('id', userId);

      // If user is also employee, update status accordingly
      if (status === 'inactive') {
        await supabase.from('employees').update({ status: 'Inactive' }).eq('user_id', userId);
      } else {
        await supabase.from('employees').update({ status: 'Active' }).eq('user_id', userId);
      }

      // Log Security audit
      await logAudit(req, `USER_LOGIN_${status.toUpperCase()}`, `users/${userId}`, { email: targetUser.email, status: targetUser.status }, { status });

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
      const { data: targetUsers, error: findErr } = await supabase
        .from('users')
        .select('id, email, role_id, roles(name)')
        .eq('id', userId);

      if (findErr || !targetUsers || targetUsers.length === 0) {
        return res.status(404).json({ message: 'User account not found.' });
      }
      const targetUser = targetUsers[0];

      const actorId = parseInt(req.user.id, 10);
      const targetId = parseInt(targetUser.id, 10);
      const actorRole = req.user.roleName;
      const targetRole = targetUser.roles ? targetUser.roles.name : null;

      // 1. Self-management check
      if (actorId === targetId) {
        return res.status(403).json({ message: 'Access denied: You cannot reset your own password via this admin feature.' });
      }

      // 2. Super Admin target
      if (targetRole === 'Super Admin') {
        if (actorRole !== 'Super Admin') {
          return res.status(403).json({ message: 'Access denied: Only Super Admin can manage Super Admin accounts.' });
        }
      }

      // 3. Admin Controller target
      if (targetRole === 'Admin Controller') {
        if (actorRole !== 'Super Admin') {
          return res.status(403).json({ message: 'Access denied: Only Super Admin can manage Admin Controller accounts.' });
        }
      }

      const isSubAdminRole = (role) => {
        return role && role !== 'Employee' && role !== 'Super Admin' && role !== 'Admin Controller';
      };

      // 4. Sub-admin target
      if (isSubAdminRole(targetRole)) {
        if (actorRole !== 'Super Admin' && actorRole !== 'Admin Controller') {
          return res.status(403).json({ message: 'Access denied: Sub-admins can only be managed by Super Admin or Admin Controller.' });
        }
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

  // Hard delete a user account and all their related tables data/files
  hardDeleteUser: async (req, res) => {
    const { userId } = req.params;

    try {
      // Get target user details to check their role/email
      const { data: targetUser, error: checkErr } = await supabase
        .from('users')
        .select('*, roles(name)')
        .eq('id', userId)
        .single();

      if (checkErr || !targetUser) {
        return res.status(404).json({ message: 'User account not found.' });
      }

      const actorId = parseInt(req.user.id, 10);
      const targetId = parseInt(targetUser.id, 10);
      const actorRole = req.user.roleName;
      const targetRole = targetUser.roles ? targetUser.roles.name : null;

      // 1. Self-management check: No one can delete their own account
      if (actorId === targetId) {
        return res.status(403).json({ message: 'Access denied: You cannot delete your own account.' });
      }

      // 2. Super Admin target: No one can delete Super Admin accounts
      if (targetRole === 'Super Admin') {
        return res.status(403).json({ message: 'Access denied: Super Admin accounts cannot be deleted by anyone.' });
      }

      // 3. Admin Controller target
      if (targetRole === 'Admin Controller') {
        if (actorRole !== 'Super Admin') {
          return res.status(403).json({ message: 'Access denied: Only Super Admin can delete Admin Controller accounts.' });
        }
      }

      const isSubAdminRole = (role) => {
        return role && role !== 'Employee' && role !== 'Super Admin' && role !== 'Admin Controller';
      };

      // 4. Sub-admin target
      if (isSubAdminRole(targetRole)) {
        if (actorRole !== 'Super Admin' && actorRole !== 'Admin Controller') {
          return res.status(403).json({ message: 'Access denied: Only Super Admin or Admin Controller can delete Sub-admin accounts.' });
        }
      }

      // 5. Employee target
      if (actorRole !== 'Super Admin' && actorRole !== 'Admin Controller' && !isSubAdminRole(actorRole)) {
        return res.status(403).json({ message: 'Access denied: Unauthorized role to delete employee data.' });
      }

      const userRecord = targetUser;




      // 2. Find associated employee
      const { data: employeeRecord } = await supabase
        .from('employees')
        .select('id, photo_path')
        .eq('user_id', userId)
        .single();

      // 3. If employee exists, clean up documents and delete employee record
      if (employeeRecord) {
        const empId = employeeRecord.id;

        // Fetch document file paths to delete files from disk
        const { data: docs } = await supabase
          .from('employee_documents')
          .select('file_path')
          .eq('employee_id', empId);

        const fs = require('fs');
        const path = require('path');

        // Delete documents from disk
        if (docs && docs.length > 0) {
          docs.forEach(doc => {
            if (doc.file_path) {
              let filePath = doc.file_path;
              if (!path.isAbsolute(filePath)) {
                filePath = path.join(__dirname, '../', filePath);
              }
              if (fs.existsSync(filePath)) {
                try {
                  fs.unlinkSync(filePath);
                } catch (e) {
                  console.error('Failed to delete file from disk:', filePath, e.message);
                }
              }
            }
          });
        }

        // Delete photo from disk
        if (employeeRecord.photo_path) {
          let photoPath = employeeRecord.photo_path;
          if (!path.isAbsolute(photoPath)) {
            photoPath = path.join(__dirname, '../', photoPath);
          }
          if (fs.existsSync(photoPath)) {
            try {
              fs.unlinkSync(photoPath);
            } catch (e) {
              console.error('Failed to delete photo from disk:', photoPath, e.message);
            }
          }
        }

        // Delete employee record (cascades to kyc, documents, shifts, attendance, corrections, leaves)
        const { error: empDelErr } = await supabase.from('employees').delete().eq('id', empId);
        if (empDelErr) throw empDelErr;
      }

      // 4. Delete login history
      await supabase.from('login_history').delete().eq('user_id', userId);

      // 5. Delete user record
      const { error: userDelErr } = await supabase.from('users').delete().eq('id', userId);
      if (userDelErr) throw userDelErr;

      // 6. Log hard delete in security logs
      await logAudit(req, 'HARD_DELETE_USER_DATA', `users/${userId}`, null, { 
        email: userRecord.email, 
        hadEmployee: !!employeeRecord 
      });

      res.json({ message: `User and all associated profile, attendance, and documents data purged successfully.` });
    } catch (err) {
      console.error('HardDeleteUser Error:', err.message);
      res.status(500).json({ message: 'Error performing hard delete on user data.' });
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

    const keyDescriptions = {
      company_name: 'The legal official company name display',
      tagline: 'Branding tagline displayed on logins and dashboard',
      geofence_enforced: 'Whether attendance clock-in requires matching work location radius coordinates',
      auto_clockout_duration: 'Auto Clock-out Duration Threshold (Hours)',
      paycut_absent: 'Unexcused Absence Salary Cut percentage',
      paycut_lop: 'Loss of Pay (LOP) Salary Cut percentage',
      paycut_half_day: 'Half Day Work Salary Cut percentage',
      smtp_host: 'Mail server host for password reset email dispatches',
      smtp_port: 'Secure mail server port',
      smtp_user: 'System email account credentials',
      smtp_pass: 'System email security password',
      admin_creation_limit: 'Max number of admins the Admin Controller can create'
    };

    try {
      for (const [key, val] of Object.entries(settings)) {
        const payload = {
          setting_key: key,
          setting_value: String(val)
        };
        if (keyDescriptions[key]) {
          payload.description = keyDescriptions[key];
        }
        await supabase.from('system_settings').upsert(payload, { onConflict: 'setting_key' });
      }

      await logAudit(req, 'UPDATE_SYSTEM_SETTINGS', 'system_settings', null, settings);

      res.json({ message: 'System configurations updated successfully.' });
    } catch (err) {
      console.error('UpdateSystemSettings Error:', err.message);
      res.status(500).json({ message: 'Error updating system settings.' });
    }
  },

  getLicensing: async (req, res) => {
    try {
      const { data: modules, error: modErr } = await supabase.from('admin_controller_licensing').select('*');
      if (modErr) throw modErr;

      const { data: settings } = await supabase.from('system_settings').select('*').eq('setting_key', 'admin_creation_limit');
      const limit = settings && settings.length > 0 ? parseInt(settings[0].setting_value, 10) : 3;

      res.json({
        modules: modules || [],
        admin_creation_limit: limit
      });
    } catch (err) {
      console.error('getLicensing error:', err.message);
      res.status(500).json({ message: 'Error retrieving licensing settings.' });
    }
  },

  updateLicensing: async (req, res) => {
    if (req.user.roleName !== 'Super Admin') {
      return res.status(403).json({ message: 'Access denied: Super Admin privilege required.' });
    }
    const { modules, admin_creation_limit } = req.body;
    try {
      if (modules && Array.isArray(modules)) {
        for (const m of modules) {
          await supabase.from('admin_controller_licensing').upsert({
            module_key: m.module_key,
            is_enabled: m.is_enabled,
            subscription_start_date: m.subscription_start_date || null,
            subscription_end_date: m.subscription_end_date || null,
            feature_label: m.feature_label || null
          }, { onConflict: 'module_key' });
        }
      }
      if (admin_creation_limit !== undefined) {
        await supabase.from('system_settings').upsert({
          setting_key: 'admin_creation_limit',
          setting_value: String(admin_creation_limit),
          description: 'Max number of admins the Admin Controller can create'
        }, { onConflict: 'setting_key' });
      }
      res.json({ message: 'Licensing parameters updated successfully.' });
    } catch (err) {
      console.error('updateLicensing error:', err.message);
      res.status(500).json({ message: 'Error saving licensing settings.' });
    }
  },

  getSubAdminLicensing: async (req, res) => {
    const { userId } = req.params;
    try {
      const { data, error } = await supabase.from('sub_admin_access').select('*').eq('user_id', userId);
      if (error) throw error;
      res.json(data || []);
    } catch (err) {
      console.error('getSubAdminLicensing error:', err.message);
      res.status(500).json({ message: 'Error retrieving sub-admin permissions.' });
    }
  },

  updateSubAdminLicensing: async (req, res) => {
    if (req.user.roleName !== 'Super Admin' && req.user.roleName !== 'Admin Controller') {
      return res.status(403).json({ message: 'Access denied: Admin Controller privilege required.' });
    }
    const { userId } = req.params;
    const { modules } = req.body;
    try {
      if (!Array.isArray(modules)) {
        return res.status(400).json({ message: 'Modules parameter must be an array.' });
      }
      await supabase.from('sub_admin_access').delete().eq('user_id', userId);
      for (const m of modules) {
        const { data: allowed } = await supabase.from('admin_controller_licensing').select('is_enabled').eq('module_key', m.module_key).single();
        if (allowed && allowed.is_enabled) {
          await supabase.from('sub_admin_access').insert([{
            user_id: userId,
            module_key: m.module_key,
            is_enabled: m.is_enabled,
            subscription_start_date: m.subscription_start_date || null,
            subscription_end_date: m.subscription_end_date || null,
            feature_label: m.feature_label || null
          }]);
        }
      }
      res.json({ message: 'Sub-admin access updated successfully.' });
    } catch (err) {
      console.error('updateSubAdminLicensing error:', err.message);
      res.status(500).json({ message: 'Error saving sub-admin access mapping.' });
    }
  },

  getAdminController: async (req, res) => {
    try {
      const { data: access, error } = await supabase
        .from('admin_controller_access')
        .select('*')
        .limit(1);

      if (error) throw error;

      if (!access || access.length === 0) {
        return res.json(null);
      }

      const rec = access[0];

      // Calculate accumulated duration
      let accumulatedSeconds = rec.total_active_seconds || 0;
      if (rec.status === 'Active' && rec.activated_at) {
        const elapsed = Math.floor((Date.now() - new Date(rec.activated_at).getTime()) / 1000);
        if (elapsed > 0) accumulatedSeconds += elapsed;
      }

      res.json({
        id: rec.id,
        user_id: rec.user_id,
        status: rec.status,
        password_plain: rec.password_plain,
        activated_at: rec.activated_at,
        total_active_seconds: rec.total_active_seconds,
        accumulated_seconds: accumulatedSeconds,
        employee_id: null,
        full_name: rec.full_name,
        email: rec.email
      });
    } catch (err) {
      console.error('getAdminController error:', err.message);
      res.status(500).json({ message: 'Error loading Admin Controller configurations.' });
    }
  },

  setAdminController: async (req, res) => {
    if (req.user.roleName !== 'Super Admin') {
      return res.status(403).json({ message: 'Access denied: Super Admin privilege required.' });
    }
    const { name, email, password, status } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    try {
      const bcrypt = require('bcryptjs');
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);

      // Check if Admin Controller access record exists
      const { data: currentAccess } = await supabase.from('admin_controller_access').select('id, user_id').limit(1);
      
      let userId;

      if (currentAccess && currentAccess.length > 0) {
        const rec = currentAccess[0];
        userId = rec.user_id;

        if (userId) {
          // Update the user record (email & password_hash)
          await supabase
            .from('users')
            .update({
              email: email,
              password_hash: hash,
              status: 'active'
            })
            .eq('id', userId);
        } else {
          // If for some reason user_id was null, create it now
          const { data: newUser, error: userErr } = await supabase
            .from('users')
            .insert([{
              email: email,
              password_hash: hash,
              role_id: 7, // Admin Controller role
              status: 'active',
              onboarding_completed: true
            }])
            .select('id')
            .single();

          if (userErr) throw userErr;
          userId = newUser.id;
        }

        const accessPayload = {
          user_id: userId,
          full_name: name,
          email: email,
          password_plain: password,
          status: status || 'Active'
        };

        await supabase.from('admin_controller_access').update(accessPayload).eq('id', rec.id);
      } else {
        // Create user record
        const { data: newUser, error: userErr } = await supabase
          .from('users')
          .insert([{
            email: email,
            password_hash: hash,
            role_id: 7, // Admin Controller role
            status: 'active',
            onboarding_completed: true
          }])
          .select('id')
          .single();

        if (userErr) throw userErr;
        userId = newUser.id;

        const accessPayload = {
          user_id: userId,
          full_name: name,
          email: email,
          password_plain: password,
          status: status || 'Active',
          activated_at: (status || 'Active') === 'Active' ? new Date().toISOString() : null,
          total_active_seconds: 0
        };

        await supabase.from('admin_controller_access').insert([accessPayload]);
      }

      await logAudit(req, 'SET_ADMIN_CONTROLLER', `users/${userId}`, null, { email });

      res.json({ message: 'Admin Controller assigned and configured successfully.' });
    } catch (err) {
      console.error('setAdminController error:', err.message);
      res.status(500).json({ message: 'Error setting Admin Controller access.' });
    }
  },

  updateAdminControllerStatus: async (req, res) => {
    if (req.user.roleName !== 'Super Admin') {
      return res.status(403).json({ message: 'Access denied: Super Admin privilege required.' });
    }
    const { status } = req.body;
    if (!['Active', 'Paused', 'Deactivated', 'Revoked'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status parameter.' });
    }

    try {
      const { data: access, error: accErr } = await supabase.from('admin_controller_access').select('*').limit(1);
      if (accErr || !access || access.length === 0) {
        return res.status(404).json({ message: 'No Admin Controller assigned.' });
      }

      const rec = access[0];
      const oldStatus = rec.status;
      
      let newTotalSeconds = rec.total_active_seconds || 0;
      let newActivatedAt = rec.activated_at;

      // Handle transitions
      if (oldStatus === 'Active' && status !== 'Active') {
        // Transitioning OUT of Active: calculate and add elapsed time
        if (rec.activated_at) {
          const elapsed = Math.floor((Date.now() - new Date(rec.activated_at).getTime()) / 1000);
          if (elapsed > 0) {
            newTotalSeconds += elapsed;
          }
        }
        newActivatedAt = null;
      } else if (oldStatus !== 'Active' && status === 'Active') {
        // Transitioning INTO Active: set start time
        newActivatedAt = new Date().toISOString();
      }

      await supabase.from('admin_controller_access').update({
        status: status,
        activated_at: newActivatedAt,
        total_active_seconds: newTotalSeconds
      }).eq('id', rec.id);

      await logAudit(req, `ADMIN_CONTROLLER_STATUS_${status.toUpperCase()}`, `admin_controller/${rec.id}`, { oldStatus }, { status });

      res.json({ message: `Admin Controller access status is now ${status}.` });
    } catch (err) {
      console.error('updateAdminControllerStatus error:', err.message);
      res.status(500).json({ message: 'Error updating Admin Controller status.' });
    }
  },

  createSubAdmin: async (req, res) => {
    if (req.user.roleName !== 'Super Admin' && req.user.roleName !== 'Admin Controller') {
      return res.status(403).json({ message: 'Access denied: Admin Controller privilege required.' });
    }
    const { name, email, password, roleId } = req.body;
    if (!name || !email || !password || !roleId) {
      return res.status(400).json({ message: 'All fields (name, email, password, and role) are required.' });
    }
    try {
      // 1. Check sub-admin creation limit
      const { data: limitSettings } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'admin_creation_limit').limit(1);
      const limit = limitSettings && limitSettings.length > 0 ? parseInt(limitSettings[0].setting_value, 10) : 3;

      const { data: currentSubAdmins, error: countErr } = await supabase
        .from('users')
        .select('id')
        .in('role_id', [2, 3, 4, 5]);

      if (countErr) throw countErr;

      if (currentSubAdmins && currentSubAdmins.length >= limit) {
        return res.status(400).json({ message: `Access denied: Sub-admin creation limit reached (${limit}).` });
      }

      // 2. Check email uniqueness (against users and employees)
      const { data: extUser } = await supabase.from('users').select('id').eq('email', email);
      const { data: extEmp } = await supabase.from('employees').select('id').eq('email', email);
      if ((extUser && extUser.length > 0) || (extEmp && extEmp.length > 0)) {
        return res.status(400).json({ message: 'A user or employee with this email already exists.' });
      }

      // 3. Hash password and insert user
      const bcrypt = require('bcryptjs');
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const { data: newUser, error: createErr } = await supabase
        .from('users')
        .insert([{
          email,
          password_hash: passwordHash,
          role_id: parseInt(roleId, 10),
          status: 'active',
          onboarding_completed: true,
          full_name: name
        }])
        .select('id, email, status, onboarding_completed, full_name, role_id')
        .single();

      if (createErr) throw createErr;

      // Log Security audit
      await logAudit(req, 'SUB_ADMIN_CREATED', `users/${newUser.id}`, null, { email, roleId, name });

      res.status(201).json(newUser);
    } catch (err) {
      console.error('createSubAdmin error:', err.message);
      res.status(500).json({ message: 'Error creating sub-admin account.' });
    }
  },

  updateSubAdmin: async (req, res) => {
    if (req.user.roleName !== 'Super Admin' && req.user.roleName !== 'Admin Controller') {
      return res.status(403).json({ message: 'Access denied: Admin Controller privilege required.' });
    }
    const { userId } = req.params;
    const { name, email, password, roleId } = req.body;
    if (!name || !email || !roleId) {
      return res.status(400).json({ message: 'Name, email, and role are required.' });
    }
    try {
      const { data: targetUser, error: findErr } = await supabase.from('users').select('*').eq('id', userId).single();
      if (findErr || !targetUser) {
        return res.status(404).json({ message: 'Sub-admin account not found.' });
      }

      // Check email uniqueness if changed
      if (email !== targetUser.email) {
        const { data: extUser } = await supabase.from('users').select('id').eq('email', email);
        const { data: extEmp } = await supabase.from('employees').select('id').eq('email', email);
        if ((extUser && extUser.length > 0) || (extEmp && extEmp.length > 0)) {
          return res.status(400).json({ message: 'A user or employee with this email already exists.' });
        }
      }

      const updates = {
        email,
        role_id: parseInt(roleId, 10),
        full_name: name
      };

      if (password) {
        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        updates.password_hash = await bcrypt.hash(password, salt);
      }

      const { error: updateErr } = await supabase.from('users').update(updates).eq('id', userId);
      if (updateErr) throw updateErr;

      // Log Security audit
      await logAudit(req, 'SUB_ADMIN_UPDATED', `users/${userId}`, null, { email, roleId, name });

      res.json({ message: 'Sub-admin details updated successfully.' });
    } catch (err) {
      console.error('updateSubAdmin error:', err.message);
      res.status(500).json({ message: 'Error updating sub-admin details.' });
    }
  },

  deleteAuditLogs: async (req, res) => {
    if (req.user.roleName !== 'Super Admin') {
      return res.status(403).json({ message: 'Access denied: Only Super Admin can delete logs.' });
    }
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No log IDs specified for deletion.' });
    }
    try {
      const { error } = await supabase
        .from('audit_logs')
        .delete()
        .in('id', ids);

      if (error) throw error;

      res.json({ message: 'Audit logs deleted successfully.' });
    } catch (err) {
      console.error('deleteAuditLogs error:', err.message);
      res.status(500).json({ message: 'Error deleting audit logs.' });
    }
  },

  // Clear Database (Super Admin only)
  clearDatabase: async (req, res) => {
    if (req.user.roleName !== 'Super Admin') {
      return res.status(403).json({ message: 'Access denied: Only Super Admin can clear the database.' });
    }

    try {
      console.log('Super Admin initiating complete Database Clear...');

      // 1. Delete transactional and employee mapping tables first to resolve constraints
      await supabase.from('attendance_corrections').delete().neq('id', 0);
      await supabase.from('attendance_logs').delete().neq('id', 0);
      await supabase.from('leave_requests').delete().neq('id', 0);
      await supabase.from('leave_balances').delete().neq('id', 0);
      await supabase.from('employee_kyc').delete().neq('id', 0);
      await supabase.from('employee_documents').delete().neq('id', 0);
      await supabase.from('employee_shift_assignments').delete().neq('id', 0);

      // 2. Set reporting manager links to null to avoid self-joins deadlock
      await supabase.from('employees').update({ reporting_manager_id: null }).neq('id', 0);
      
      // 3. Clear employee profiles
      await supabase.from('employees').delete().neq('id', 0);

      // 4. Clear admin controller configuration and all system log traces
      await supabase.from('admin_controller_access').delete().neq('id', 0);
      await supabase.from('audit_logs').delete().neq('id', 0);
      await supabase.from('login_history').delete().neq('id', 0);
      await supabase.from('security_events').delete().neq('id', 0);

      // 5. Delete administrative logins (except the Super Admin account itself)
      await supabase.from('users').delete().neq('email', 'chub.admin@adloaf.com');

      // 6. Delete structural configuration parameters
      await supabase.from('designations').delete().neq('id', 0);
      await supabase.from('departments').delete().neq('id', 0);
      await supabase.from('shifts').delete().neq('id', 0);
      await supabase.from('work_locations').delete().neq('id', 0);

      // Log this deletion as the only remaining record in a fresh audit trail
      req.user = { id: 1, email: 'chub.admin@adloaf.com', roleName: 'Super Admin' };
      await logAudit(req, 'CLEAR_DATABASE_COMPLETE', 'system/all', null, { wiped: true });

      res.json({ message: 'Database cleared successfully. All records wiped, excluding system configuration parameters.' });
    } catch (err) {
      console.error('Clear Database Error:', err.message);
      res.status(500).json({ message: `Error wiping database: ${err.message}` });
    }
  },

  // Clear All Employees (Super Admin only)
  clearEmployees: async (req, res) => {
    if (req.user.roleName !== 'Super Admin') {
      return res.status(403).json({ message: 'Access denied: Only Super Admin can clear employees.' });
    }

    try {
      console.log('Super Admin initiating Employee Database Clear...');

      // 1. Delete employee-specific transactional entries
      await supabase.from('attendance_corrections').delete().neq('id', 0);
      await supabase.from('attendance_logs').delete().neq('id', 0);
      await supabase.from('leave_requests').delete().neq('id', 0);
      await supabase.from('leave_balances').delete().neq('id', 0);
      await supabase.from('employee_kyc').delete().neq('id', 0);
      await supabase.from('employee_documents').delete().neq('id', 0);
      await supabase.from('employee_shift_assignments').delete().neq('id', 0);

      // 2. Set reporting manager self-referential foreign keys to null
      await supabase.from('employees').update({ reporting_manager_id: null }).neq('id', 0);
      
      // 3. Clear all employee records
      await supabase.from('employees').delete().neq('id', 0);

      // 4. Remove legacy employee user credentials (role ID 6) if any
      await supabase.from('users').delete().eq('role_id', 6);

      // Log audit
      await logAudit(req, 'CLEAR_EMPLOYEES_COMPLETE', 'system/employees', null, { wipedEmployees: true });

      res.json({ message: 'Employee database cleared successfully. All employee records and metrics have been wiped.' });
    } catch (err) {
      console.error('Clear Employees Error:', err.message);
      res.status(500).json({ message: `Error wiping employee data: ${err.message}` });
    }
  },

  updateSessionLocation: async (req, res) => {
    const { latitude, longitude } = req.body;
    const sessionId = req.user.sessionId;
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID not found in token.' });
    }
    try {
      const { data: sess } = await supabase
        .from('active_sessions')
        .select('location_name')
        .eq('session_id', sessionId)
        .single();

      let baseLoc = 'ESS Mobile';
      if (sess && sess.location_name) {
        baseLoc = sess.location_name.split('|')[0] || 'ESS Mobile';
      }

      const coordsStr = (latitude !== undefined && longitude !== undefined) ? `|${latitude},${longitude}` : '';
      const updatedLocationName = baseLoc + coordsStr;

      const { error } = await supabase
        .from('active_sessions')
        .update({
          location_name: updatedLocationName,
          last_activity_at: new Date().toISOString()
        })
        .eq('session_id', sessionId);
      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      console.error('updateSessionLocation Error:', err.message);
      res.status(500).json({ message: 'Error updating session location.' });
    }
  },

  getEmployeeLiveLocation: async (req, res) => {
    if (req.user.roleName !== 'Super Admin' && req.user.roleName !== 'Admin Controller') {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const { employeeId } = req.params;

    try {
      // 1. Fetch employee details and assigned work location
      const { data: employee, error: empErr } = await supabase
        .from('employees')
        .select(`
          id, full_name, email, work_location_id,
          work_locations (name, latitude, longitude, radius_meters)
        `)
        .eq('id', employeeId)
        .single();

      if (empErr || !employee) {
        return res.status(404).json({ message: 'Employee not found.' });
      }

      // 2. Try to get coordinates from active sessions table first
      let lat = null;
      let lng = null;
      let source = 'Active Session';

      const { data: session } = await supabase
        .from('active_sessions')
        .select('location_name')
        .eq('employee_id', employeeId)
        .order('id', { ascending: false })
        .limit(1);

      if (session && session.length > 0 && session[0].location_name) {
        const parts = session[0].location_name.split('|');
        if (parts.length > 1 && parts[1]) {
          const coords = parts[1].split(',');
          if (coords.length === 2 && coords[0] && coords[1]) {
            lat = parseFloat(coords[0]);
            lng = parseFloat(coords[1]);
          }
        }
      }

      if (lat === null || lng === null) {
        // Fallback to today's clock-in coordinates
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const istTime = new Date(utc + (3600000 * 5.5));
        const todayStr = istTime.toISOString().split('T')[0];

        const { data: attLog } = await supabase
          .from('attendance_logs')
          .select('clock_in_latitude, clock_in_longitude')
          .eq('employee_id', employeeId)
          .eq('date', todayStr)
          .limit(1);

        if (attLog && attLog.length > 0 && attLog[0].clock_in_latitude !== null) {
          lat = parseFloat(attLog[0].clock_in_latitude);
          lng = parseFloat(attLog[0].clock_in_longitude);
          source = "Today's Clock-In";
        }
      }

      if (lat === null || lng === null) {
        return res.status(404).json({ message: 'No active location coordinates found for this employee.' });
      }

      // 3. Get Geofence coordinates
      const wl = employee.work_locations;
      let distanceMeters = null;
      let geofence = null;

      if (wl && wl.latitude !== null && wl.longitude !== null) {
        geofence = {
          name: wl.name,
          latitude: parseFloat(wl.latitude),
          longitude: parseFloat(wl.longitude),
          radius_meters: wl.radius_meters
        };
        // Calculate distance using Haversine formula
        const R = 6371000; // Earth radius in meters
        const dLat = (geofence.latitude - lat) * Math.PI / 180;
        const dLon = (geofence.longitude - lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat * Math.PI / 180) * Math.cos(geofence.latitude * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        distanceMeters = R * c;
      }

      const responseData = {
        employee_id: employee.id,
        employee_name: employee.full_name,
        latitude: lat,
        longitude: lng,
        source: source,
        geofence: geofence,
        distance_meters: distanceMeters
      };

      // 4. Log to Operational Activity Logs (audit_logs)
      await logAudit(req, 'VIEW_LIVE_LOCATION', `employees/${employee.id}`, null, responseData);

      res.json(responseData);
    } catch (err) {
      console.error('getEmployeeLiveLocation Error:', err.message);
      res.status(500).json({ message: 'Error retrieving employee live location.' });
    }
  },

  // Get active online sessions / clocked in employees
  getActiveSessions: async (req, res) => {
    if (req.user.roleName !== 'Super Admin' && req.user.roleName !== 'Admin Controller') {
      return res.status(403).json({ message: 'Access denied.' });
    }

    try {
      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const istTime = new Date(utc + (3600000 * 5.5));
      const todayStr = istTime.toISOString().split('T')[0];

      if (req.user.roleName === 'Super Admin') {
        // Fetch all active sessions
        const { data: sessions, error } = await supabase
          .from('active_sessions')
          .select(`
            *,
            users (id, email, roles (name)),
            employees (id, employee_id, full_name, email)
          `)
          .order('login_at', { ascending: false });

        if (error) throw error;

        // Fetch all today's attendance logs
        const { data: attLogs } = await supabase
          .from('attendance_logs')
          .select('employee_id, clock_in_time, clock_out_time, clock_in_location_status')
          .eq('date', todayStr);

        const attMap = {};
        (attLogs || []).forEach(log => {
          attMap[log.employee_id] = log;
        });

        const formattedSessions = (sessions || []).map(sess => {
          let name = 'System / Admin';
          let role = 'Admin';
          let email = '';
          let isClockedIn = false;
          let clockInTime = null;
          let location = sess.location_name || 'Web Console';
          if (location && location.includes('|')) {
            location = location.split('|')[0] || 'Web Console';
          }

          if (sess.users) {
            email = sess.users.email;
            role = sess.users.roles ? sess.users.roles.name : 'User';
            name = email;
          }

          if (sess.employees) {
            name = sess.employees.full_name;
            role = 'Employee';
            email = sess.employees.email || '';
            const att = attMap[sess.employees.id];
            if (att && !att.clock_out_time) {
              isClockedIn = true;
              clockInTime = att.clock_in_time;
              location = `${location} (${att.clock_in_location_status === 'Verified-Inside' ? 'Office - Inside' : 'Outside Geofence'})`;
            }
          }

          // Format IST login_at time
          const loginAtDate = new Date(sess.login_at);
          const activeFrom = loginAtDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

          // Format active duration
          const diffMs = istTime.getTime() - loginAtDate.getTime();
          let activeDuration = '0m';
          if (diffMs > 0) {
            const diffMins = Math.floor(diffMs / 60000);
            const hours = Math.floor(diffMins / 60);
            const mins = diffMins % 60;
            activeDuration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
          }

          return {
            id: sess.id,
            session_id: sess.session_id,
            user_id: sess.user_id,
            employee_id: sess.employee_id,
            name,
            email,
            role,
            location,
            active_from: activeFrom,
            active_duration: activeDuration,
            ip_address: sess.ip_address,
            user_agent: sess.user_agent,
            is_clocked_in: isClockedIn,
            clock_in_time: clockInTime
          };
        });

        res.json(formattedSessions);
      } else {
        // Admin Controller: Only see clocked-in employees (active online employees)
        // Fetch all employee attendance logs for today with clock_out_time IS NULL
        const { data: clockedInLogs, error: attErr } = await supabase
          .from('attendance_logs')
          .select(`
            *,
            employees (
              id, employee_id, full_name, email, mobile,
              departments (name),
              work_locations (name)
            )
          `)
          .eq('date', todayStr)
          .is('clock_out_time', null);

        if (attErr) throw attErr;

        // Fetch active sessions for these employees
        const employeeIds = (clockedInLogs || []).map(log => log.employee_id).filter(Boolean);
        let sessionMap = {};
        
        if (employeeIds.length > 0) {
          const { data: empSessions } = await supabase
            .from('active_sessions')
            .select('*')
            .in('employee_id', employeeIds);
          (empSessions || []).forEach(sess => {
            sessionMap[sess.employee_id] = sess;
          });
        }

        const formattedEmployees = (clockedInLogs || []).map(log => {
          const emp = log.employees || {};
          const sess = sessionMap[emp.id];
          let activeFrom = 'Not Logged In';
          let activeDuration = 'N/A';
          let sessionId = null;
          let ipAddress = 'N/A';
          let userAgent = 'N/A';

          if (sess) {
            sessionId = sess.session_id;
            ipAddress = sess.ip_address;
            userAgent = sess.user_agent;
            const loginAtDate = new Date(sess.login_at);
            activeFrom = loginAtDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

            const diffMs = istTime.getTime() - loginAtDate.getTime();
            if (diffMs > 0) {
              const diffMins = Math.floor(diffMs / 60000);
              const hours = Math.floor(diffMins / 60);
              const mins = diffMins % 60;
              activeDuration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
            }
          }

          return {
            employee_id: emp.id,
            employee_id_str: emp.employee_id,
            name: emp.full_name,
            email: emp.email,
            department: emp.departments ? emp.departments.name : 'N/A',
            clock_in_time: log.clock_in_time,
            location_status: log.clock_in_location_status,
            assigned_location: emp.work_locations ? emp.work_locations.name : 'N/A',
            active_from: activeFrom,
            active_duration: activeDuration,
            session_id: sessionId,
            ip_address: ipAddress,
            user_agent: userAgent,
            is_clocked_in: true
          };
        });

        res.json(formattedEmployees);
      }
    } catch (err) {
      console.error('getActiveSessions Error:', err.message);
      res.status(500).json({ message: 'Error retrieving active online users.' });
    }
  },

  // Force Signout session
  forceSignout: async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required.' });
    }

    if (req.user.roleName !== 'Super Admin' && req.user.roleName !== 'Admin Controller') {
      return res.status(403).json({ message: 'Access denied.' });
    }

    try {
      // Fetch session details first
      const { data: sessions, error: sessErr } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('session_id', sessionId);

      if (sessErr || !sessions || sessions.length === 0) {
        return res.status(404).json({ message: 'Session not found or already terminated.' });
      }

      const session = sessions[0];

      // Admin Controller can only force sign-out employees
      if (req.user.roleName === 'Admin Controller') {
        if (session.user_id) {
          return res.status(403).json({ message: 'Forbidden: Admin Controller can only force sign-out employee sessions.' });
        }
      }

      // Delete active session record
      await supabase.from('active_sessions').delete().eq('session_id', sessionId);

      // Log Security audit
      const targetType = session.employee_id ? `employees/${session.employee_id}` : `users/${session.user_id}`;
      await logAudit(req, 'FORCE_SIGNOUT', targetType, session, { message: 'Session forcefully terminated by Administrator' });

      res.json({ message: 'User session has been forcefully terminated.' });
    } catch (err) {
      console.error('forceSignout Error:', err.message);
      res.status(500).json({ message: 'Error terminating user session.' });
    }
  },

  // Force Clockout employee
  forceClockout: async (req, res) => {
    const { employeeId } = req.body;
    if (!employeeId) {
      return res.status(400).json({ message: 'Employee ID is required.' });
    }

    if (req.user.roleName !== 'Super Admin' && req.user.roleName !== 'Admin Controller') {
      return res.status(403).json({ message: 'Access denied.' });
    }

    try {
      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const istTime = new Date(utc + (3600000 * 5.5));
      const todayStr = istTime.toISOString().split('T')[0];
      const nowTimeStr = istTime.toTimeString().split(' ')[0];

      // Fetch today's clocked in log for that employee
      const { data: logs, error: logErr } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('date', todayStr)
        .is('clock_out_time', null);

      if (logErr || !logs || logs.length === 0) {
        return res.status(400).json({ message: 'Employee is not clocked in for today, or has already clocked out.' });
      }

      const logRecord = logs[0];

      // Calculate total active hours worked
      const [inH, inM, inS] = logRecord.clock_in_time.split(':').map(Number);
      const [outH, outM, outS] = nowTimeStr.split(':').map(Number);

      const inTotalSecs = inH * 3600 + inM * 60 + inS;
      const outTotalSecs = outH * 3600 + outM * 60 + outS;
      const activeHours = parseFloat(((outTotalSecs - inTotalSecs) / 3600).toFixed(2));

      let finalStatus = logRecord.status;
      if (activeHours < 4.0 && finalStatus !== 'Location Not Verified') {
        finalStatus = 'Half Day';
      }

      await supabase.from('attendance_logs').update({
        clock_out_time: nowTimeStr, 
        clock_out_ip: '127.0.0.1 (Force-Clockout)',
        clock_out_user_agent: 'Admin System Control',
        clock_out_location_status: 'Location Not Verified',
        total_hours: activeHours,
        status: finalStatus
      }).eq('id', logRecord.id);

      // Log Security audit
      await logAudit(req, 'FORCE_CLOCKOUT', `attendance_logs/${logRecord.id}`, logRecord, { 
        clock_out_time: nowTimeStr,
        total_hours: activeHours,
        status: finalStatus,
        message: 'Employee was forcefully clocked out by Administrator'
      });

      // Fetch employee info for email
      try {
        const { data: empData } = await supabase
          .from('employees')
          .select('full_name, email')
          .eq('id', employeeId)
          .single();

        if (empData && empData.email) {
          // Send attendance email alert
          await sendAdminForceClockoutEmail(
            empData.email,
            empData.full_name,
            todayStr,
            logRecord.clock_in_time,
            nowTimeStr,
            activeHours
          );
        }
      } catch (mailErr) {
        console.error('Failed to trigger force-clockout email:', mailErr.message);
      }

      res.json({ message: 'Employee has been forcefully clocked out.' });
    } catch (err) {
      console.error('forceClockout Error:', err.message);
      res.status(500).json({ message: 'Error processing force clock-out.' });
    }
  },

  getHolidays: async (req, res) => {
    const { year } = req.query;
    try {
      let query = supabase.from('holidays').select('*').order('date', { ascending: true });
      if (year) {
        query = query.gte('date', `${year}-01-01`).lte('date', `${year}-12-31`);
      }
      const { data, error } = await query;
      if (error) throw error;
      res.json(data || []);
    } catch (err) {
      console.error('getHolidays Error:', err.message);
      res.status(500).json({ message: 'Error retrieving holidays.' });
    }
  },

  createHoliday: async (req, res) => {
    const { name, date, description, type, is_paid } = req.body;
    try {
      if (!name || !date) {
        return res.status(400).json({ message: 'Name and date are required.' });
      }
      const metaObj = { notes: description || '', type: type || 'Public Holiday', is_paid: is_paid !== false };
      const descriptionJson = JSON.stringify(metaObj);

      const { data, error } = await supabase.from('holidays').insert([{
        name, date, description: descriptionJson
      }]).select();
      if (error) throw error;

      await logAudit(req, 'CREATE_HOLIDAY', `holidays/${data[0].id}`, null, data[0]);
      res.status(201).json({ message: 'Holiday created successfully.', holiday: data[0] });
    } catch (err) {
      console.error('createHoliday Error:', err.message);
      res.status(500).json({ message: 'Error creating holiday. It may already exist.' });
    }
  },

  updateHoliday: async (req, res) => {
    const { id } = req.params;
    const { name, date, description, type, is_paid } = req.body;
    try {
      const metaObj = { notes: description || '', type: type || 'Public Holiday', is_paid: is_paid !== false };
      const descriptionJson = JSON.stringify(metaObj);

      const { data: oldData } = await supabase.from('holidays').select('*').eq('id', id);
      
      const { data, error } = await supabase.from('holidays').update({
        name, date, description: descriptionJson
      }).eq('id', id).select();
      if (error) throw error;

      await logAudit(req, 'UPDATE_HOLIDAY', `holidays/${id}`, oldData?.[0], data[0]);
      res.json({ message: 'Holiday updated successfully.', holiday: data[0] });
    } catch (err) {
      console.error('updateHoliday Error:', err.message);
      res.status(500).json({ message: 'Error updating holiday.' });
    }
  },

  deleteHoliday: async (req, res) => {
    const { id } = req.params;
    try {
      const { data: oldData } = await supabase.from('holidays').select('*').eq('id', id);
      const { error } = await supabase.from('holidays').delete().eq('id', id);
      if (error) throw error;

      await logAudit(req, 'DELETE_HOLIDAY', `holidays/${id}`, oldData?.[0], null);
      res.json({ message: 'Holiday deleted successfully.' });
    } catch (err) {
      console.error('deleteHoliday Error:', err.message);
      res.status(500).json({ message: 'Error deleting holiday.' });
    }
  },

  generateWeekends: async (req, res) => {
    const { year, weekendsType } = req.body;
    try {
      if (!year) return res.status(400).json({ message: 'Year is required.' });
      const targetYear = parseInt(year, 10);
      const inserts = [];
      const startDate = new Date(targetYear, 0, 1);
      const endDate = new Date(targetYear, 11, 31);
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const day = d.getDay();
        const dateStr = d.toISOString().split('T')[0];
        
        if (day === 0) { // Sunday
          inserts.push({
            name: 'Weekly Holiday - Sunday',
            date: dateStr,
            description: JSON.stringify({ notes: 'Sunday Weekly Rest Day', type: 'Weekly Holiday', is_paid: true })
          });
        } else if (day === 6 && weekendsType === 'both') { // Saturday
          inserts.push({
            name: 'Weekly Holiday - Saturday',
            date: dateStr,
            description: JSON.stringify({ notes: 'Saturday Weekly Rest Day', type: 'Weekly Holiday', is_paid: true })
          });
        }
      }
      
      let addedCount = 0;
      for (const ins of inserts) {
        const { error } = await supabase.from('holidays').insert([ins]);
        if (!error) addedCount++;
      }
      
      await logAudit(req, 'GENERATE_WEEKENDS', `holidays/weekends-${year}`, null, { addedCount, weekendsType });
      res.json({ message: `Successfully generated ${addedCount} weekend holidays for ${year}.` });
    } catch (err) {
      console.error('generateWeekends Error:', err.message);
      res.status(500).json({ message: 'Error generating weekend holidays.' });
    }
  },

  cloneHolidays: async (req, res) => {
    const { fromYear, toYear } = req.body;
    try {
      if (!fromYear || !toYear) {
        return res.status(400).json({ message: 'fromYear and toYear are required.' });
      }
      const fYear = parseInt(fromYear, 10);
      const tYear = parseInt(toYear, 10);
      
      const { data: sourceHolidays, error } = await supabase
        .from('holidays')
        .select('*')
        .gte('date', `${fYear}-01-01`)
        .lte('date', `${fYear}-12-31`);
         
      if (error) throw error;
      if (!sourceHolidays || sourceHolidays.length === 0) {
        return res.status(404).json({ message: `No holidays found for source year ${fromYear}.` });
      }
      
      let clonedCount = 0;
      for (const h of sourceHolidays) {
        const sourceDate = new Date(h.date);
        const targetDate = new Date(tYear, sourceDate.getMonth(), sourceDate.getDate());
        const targetDateStr = targetDate.toISOString().split('T')[0];
        
        const { error: insErr } = await supabase.from('holidays').insert([{
          name: h.name,
          date: targetDateStr,
          description: h.description
        }]);
        if (!insErr) clonedCount++;
      }
      
      await logAudit(req, 'CLONE_HOLIDAYS', `holidays/clone-${fYear}-to-${tYear}`, null, { clonedCount });
      res.json({ message: `Successfully copied ${clonedCount} holidays to year ${toYear}.` });
    } catch (err) {
      console.error('cloneHolidays Error:', err.message);
      res.status(500).json({ message: 'Error copying holidays.' });
    }
  },

  getMonthlyPayrollSummary: async (req, res) => {
    const { month, year, employeeId } = req.query;
    if (!month || !year) {
      return res.status(400).json({ message: 'Month and year are required.' });
    }
    
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    const daysInMonth = new Date(y, m, 0).getDate();
    
    const startStr = `${y}-${String(m).padStart(2, '0')}-01`;
    const endStr = `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    
    try {
      const { data: dbSettings } = await supabase.from('system_settings').select('*');
      const settingsMap = {};
      (dbSettings || []).forEach(s => { settingsMap[s.setting_key] = s.setting_value; });
      
      const cutAbsent = parseFloat(settingsMap.paycut_absent || 100);
      const cutLop = parseFloat(settingsMap.paycut_lop || 100);
      const cutHalfDay = parseFloat(settingsMap.paycut_half_day || 50);
      
      let empQuery = supabase.from('employees').select('id, employee_id, full_name, joining_salary, departments(name)').eq('status', 'Active').is('deleted_at', null);
      if (employeeId) {
        empQuery = empQuery.eq('id', employeeId);
      }
      const { data: employees, error: empErr } = await empQuery;
      if (empErr) throw empErr;
      
      const { data: holidays, error: holErr } = await supabase.from('holidays').select('*').gte('date', startStr).lte('date', endStr);
      if (holErr) throw holErr;
      
      const { data: logs, error: logErr } = await supabase.from('attendance_logs').select('*').gte('date', startStr).lte('date', endStr);
      if (logErr) throw logErr;
      
      const { data: allLeaves } = await supabase.from('leave_requests').select('*, leave_types(code)').eq('status', 'Approved');
      
      const holidaysSet = {};
      (holidays || []).forEach(h => {
        let isPaid = true;
        try {
          const parsed = JSON.parse(h.description);
          isPaid = parsed.is_paid !== false;
        } catch (e) {}
        if (isPaid) {
          holidaysSet[h.date] = h.name;
        }
      });
      
      const payrollList = [];
      
      for (const emp of employees) {
        const baseSalary = parseFloat(emp.joining_salary || 0);
        const perDayPay = parseFloat((baseSalary / daysInMonth).toFixed(2));
        
        let presentDays = 0;
        let lateDays = 0;
        let halfDays = 0;
        let absentDays = 0;
        let clTaken = 0;
        let slTaken = 0;
        let elTaken = 0;
        let lopTaken = 0;
        let holidayWorkDays = 0;
        let totalHours = 0;
        
        const empLogs = (logs || []).filter(l => l.employee_id === emp.id);
        const empLogsMap = {};
        empLogs.forEach(l => { empLogsMap[l.date] = l; });
        
        const empLeavesMap = {};
        (allLeaves || [])
          .filter(r => r.employee_id === emp.id)
          .forEach(r => {
            const start = new Date(r.from_date);
            const end = new Date(r.to_date);
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
              const dateStr = d.toISOString().split('T')[0];
              empLeavesMap[dateStr] = r.leave_types?.code || 'LOP';
            }
          });
          
        for (let day = 1; day <= daysInMonth; day++) {
          const dateObj = new Date(y, m - 1, day);
          const dateStr = dateObj.toISOString().split('T')[0];
          const dayOfWeek = dateObj.getDay();
          
          const log = empLogsMap[dateStr];
          const isWeekend = (dayOfWeek === 0);
          const isHoliday = !!holidaysSet[dateStr] || isWeekend;
          
          if (log) {
            totalHours += parseFloat(log.total_hours || 0);
            if (isHoliday) {
              holidayWorkDays++;
            } else {
              if (log.status === 'Leave') {
                const leaveCode = empLeavesMap[dateStr] || 'LOP';
                if (leaveCode === 'CL') clTaken++;
                else if (leaveCode === 'SL') slTaken++;
                else if (leaveCode === 'EL') elTaken++;
                else lopTaken++;
              } else {
                presentDays++;
                if (log.status === 'Late') lateDays++;
                if (log.status === 'Half Day') halfDays++;
              }
            }
          } else {
            if (isHoliday) {
              // Paid rest day
            } else {
              const leaveCode = empLeavesMap[dateStr];
              if (leaveCode) {
                if (leaveCode === 'CL') clTaken++;
                else if (leaveCode === 'SL') slTaken++;
                else if (leaveCode === 'EL') elTaken++;
                else lopTaken++;
              } else {
                absentDays++;
              }
            }
          }
        }
        
        const unpaidDays = lopTaken + absentDays;
        
        let compensatedAbsent = 0;
        let compensatedLop = 0;
        
        if (absentDays > 0) {
          compensatedAbsent = Math.min(absentDays, holidayWorkDays);
        }
        if (holidayWorkDays - compensatedAbsent > 0) {
          compensatedLop = Math.min(lopTaken, holidayWorkDays - compensatedAbsent);
        }
        
        const compensatedDays = compensatedAbsent + compensatedLop;
        const remainingHolidayWorkDays = holidayWorkDays - compensatedDays;
        
        const effectiveAbsent = absentDays - compensatedAbsent;
        const effectiveLop = lopTaken - compensatedLop;
        
        const absentCut = effectiveAbsent * perDayPay * (cutAbsent / 100);
        const lopCut = effectiveLop * perDayPay * (cutLop / 100);
        const halfDayCut = halfDays * perDayPay * (cutHalfDay / 100);
        
        const totalPayCut = parseFloat((absentCut + lopCut + halfDayCut).toFixed(2));
        const overtimePay = parseFloat((remainingHolidayWorkDays * perDayPay).toFixed(2));
        const netPayout = parseFloat((baseSalary - totalPayCut + overtimePay).toFixed(2));
        
        payrollList.push({
          employee_id_val: emp.id,
          employee_id: emp.employee_id,
          full_name: emp.full_name,
          department_name: emp.departments ? emp.departments.name : 'Unassigned',
          base_salary: baseSalary,
          per_day_pay: perDayPay,
          days_present: presentDays,
          days_late: lateDays,
          days_half_day: halfDays,
          days_absent: absentDays,
          cl_taken: clTaken,
          sl_taken: slTaken,
          el_taken: elTaken,
          lop_taken: lopTaken,
          holiday_work_days: holidayWorkDays,
          compensated_days: compensatedDays,
          extra_working_days: remainingHolidayWorkDays,
          total_pay_cut: totalPayCut,
          overtime_pay: overtimePay,
          net_payout: netPayout,
          total_hours: parseFloat(totalHours.toFixed(2))
        });
      }
      
      res.json(payrollList);
    } catch (err) {
      console.error('getMonthlyPayrollSummary Error:', err.message);
      res.status(500).json({ message: 'Error calculating payroll summary.' });
    }
  }
};

async function sendAdminForceClockoutEmail(email, name, date, clockInTime, clockOutTime, totalHours) {
  try {
    const { data: dbSettings } = await supabase.from('system_settings').select('*');
    const settingsMap = {};
    (dbSettings || []).forEach(s => { settingsMap[s.setting_key] = s.setting_value; });

    const smtpHost = settingsMap.smtp_host || process.env.SMTP_HOST || 'smtp.hostinger.com';
    const smtpPort = settingsMap.smtp_port || process.env.SMTP_PORT || '465';
    const smtpUser = settingsMap.smtp_user || process.env.SMTP_USER;
    const smtpPass = settingsMap.smtp_pass || process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass) {
      console.log(`[SMTP] Skipped force-clockout email to ${email} (credentials not configured)`);
      return;
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort, 10),
      secure: smtpPort === '465',
      auth: { user: smtpUser, pass: smtpPass },
      tls: { rejectUnauthorized: false }
    });

    const mailOptions = {
      from: `"C-Hub Security Operations" <${smtpUser}>`,
      to: email,
      subject: `C-Hub Attendance Alert: Forced Clock-Out by Administrator`,
      html: `
        <div style="font-family: 'Poppins', 'Segoe UI', Arial, sans-serif; background-color: #f7f9fc; padding: 40px 20px; color: #333333;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.05); border: 1px solid #eef2f6;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #ef4444 0%, #42174F 100%); padding: 35px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">Forced Clock-Out Alert</h1>
              <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px;">C-Hub ESS Security Center</p>
            </div>
            
            <!-- Body -->
            <div style="padding: 40px 30px;">
              <p style="font-size: 16px; line-height: 1.6; margin-top: 0;">Hello <strong>${name}</strong>,</p>
              <p style="font-size: 15px; line-height: 1.6; color: #555555;">
                This is a notification that your shift attendance for today has been **forcefully clocked out by the Administrator**.
              </p>
              
              <div style="background-color: #fcf8f8; border-left: 4px solid #ef4444; padding: 20px; border-radius: 8px; margin: 30px 0;">
                <h3 style="margin-top: 0; color: #42174F; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Shift Details</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr>
                    <td style="padding: 6px 0; color: #777777; width: 140px;"><strong>Date:</strong></td>
                    <td style="padding: 6px 0; color: #333333; font-weight: 600;">${date}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #777777;"><strong>Clock-In Time:</strong></td>
                    <td style="padding: 6px 0; color: #333333;">${clockInTime} IST</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #777777;"><strong>Clock-Out Time:</strong></td>
                    <td style="padding: 6px 0; color: #ef4444; font-weight: 700;">${clockOutTime} IST (Forced)</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #777777;"><strong>Total Hours:</strong></td>
                    <td style="padding: 6px 0; color: #333333;"><strong>${totalHours} Hours</strong></td>
                  </tr>
                </table>
              </div>

              <p style="font-size: 13px; color: #777777;">
                If you believe this was done in error or need to adjust your time logs, please submit an Attendance Correction Request via the ESS dashboard.
              </p>
            </div>

            <!-- Footer -->
            <div style="background-color: #f7f9fc; padding: 20px; text-align: center; border-top: 1px solid #eef2f6;">
              <p style="margin: 0; font-size: 11px; color: #9e9e9e;">C-Hub HR Operations & Security Services</p>
            </div>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`[SMTP] Force-clockout email sent successfully to ${email}`);
  } catch (err) {
    console.error('[SMTP] Force-clockout email sending failed:', err.message);
  }
}

module.exports = securityController;
