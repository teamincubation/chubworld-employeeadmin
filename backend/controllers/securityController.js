const supabase = require('../config/db');
const bcrypt = require('bcryptjs');
const { logAudit } = require('../utils/auditLogger');

const securityController = {
  // Fetch security audit logs with advanced filters
  getAuditLogs: async (req, res) => {
    const { fromDate, toDate, user, actionType } = req.query;

    let query = supabase.from('audit_logs').select('*')
      .neq('performed_by', 'chub.admin@adloaf.com')
      .neq('role', 'Super Admin')
      .order('id', { ascending: false }).limit(100);

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

  // Hard delete a user account and all their related tables data/files
  hardDeleteUser: async (req, res) => {
    const { userId } = req.params;

    // Sub-admins cannot delete any user/data
    if (req.user.roleName !== 'Super Admin' && req.user.roleName !== 'Admin Controller') {
      return res.status(403).json({ message: 'Access denied: Sub-admins are not authorized to delete system data.' });
    }

    // Block self-deletion for anyone except Super Admin
    if (parseInt(userId, 10) === parseInt(req.user.id, 10) && req.user.roleName !== 'Super Admin') {
      return res.status(403).json({ message: 'Access denied: You cannot delete your own account.' });
    }

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

      if (targetUser.roles && (targetUser.roles.name === 'Super Admin' || targetUser.roles.name === 'Admin Controller')) {
        if (req.user.roleName !== 'Super Admin') {
          return res.status(403).json({ message: 'Access denied: Cannot delete Admin Controller or Super Admin records.' });
        }
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
              const filePath = path.resolve(doc.file_path);
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
          const photoPath = path.resolve(employeeRecord.photo_path);
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
  }
};

module.exports = securityController;
