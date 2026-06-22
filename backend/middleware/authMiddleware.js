const jwt = require('jsonwebtoken');
const supabase = require('../config/db');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'chub_super_secret_jwt_key_2026_creating_wow_world';

/**
 * Main Auth Middleware: Verifies JWT token and attaches user details
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  // Supporting Bearer token or token query parameter
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Active session validation (if sessionId exists in token)
    if (decoded.sessionId) {
      const { data: session, error: sessErr } = await supabase
        .from('active_sessions')
        .select('id')
        .eq('session_id', decoded.sessionId)
        .single();
      
      if (sessErr || !session) {
        return res.status(401).json({ message: 'Session has been forcefully terminated or expired.' });
      }
      
      // Update last activity in IST time
      try {
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const istTime = new Date(utc + (3600000 * 5.5));
        await supabase
          .from('active_sessions')
          .update({ last_activity_at: istTime.toISOString() })
          .eq('session_id', decoded.sessionId);
      } catch (updateErr) {
        console.error('Failed to update session activity:', updateErr.message);
      }
    }

    let roleName = '';
    let userPermissions = [];

    if (decoded.role === 'Employee') {
      const { data: emps, error: empErr } = await supabase
        .from('employees')
        .select('id, employee_id, full_name, email, mobile, onboarding_status, photo_path, status')
        .eq('id', decoded.id)
        .is('deleted_at', null);

      if (empErr || !emps || emps.length === 0) {
        return res.status(403).json({ message: 'Employee session invalid or expired.' });
      }

      const employee = emps[0];
      if (employee.status !== 'Active') {
        return res.status(403).json({ message: 'Your account has been deactivated.' });
      }

      // Fetch permissions for Employee role (ID 6)
      const { data: rolePerms } = await supabase
        .from('role_permissions')
        .select('permissions(name)')
        .eq('role_id', 6);

      userPermissions = (rolePerms || []).map(rp => rp.permissions ? rp.permissions.name : null).filter(Boolean);

      req.user = {
        id: employee.id,
        email: employee.email,
        roleId: 6,
        roleName: 'Employee',
        employeeId: employee.id,
        employeeStringId: employee.employee_id,
        fullName: employee.full_name,
        onboardingStatus: employee.onboarding_status,
        permissions: userPermissions,
        sessionId: decoded.sessionId
      };
      roleName = 'Employee';
    } else {
      // Fetch user from Supabase to verify they are still active and validate their role
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, email, status, onboarding_completed, role_id, roles(id, name)')
        .eq('id', decoded.id);

      if (userError || !users || users.length === 0) {
        return res.status(403).json({ message: 'User session invalid or expired.' });
      }

      const user = users[0];
      if (user.status !== 'active') {
        return res.status(403).json({ message: 'Your account has been deactivated.' });
      }

      roleName = user.roles ? user.roles.name : '';

      // Load permissions for this role
      const { data: rolePerms, error: permError } = await supabase
        .from('role_permissions')
        .select('permissions(name)')
        .eq('role_id', user.role_id);

      userPermissions = (rolePerms || []).map(rp => rp.permissions ? rp.permissions.name : null).filter(Boolean);

      // Attach user information to request
      req.user = {
        id: user.id,
        email: user.email,
        roleId: user.role_id,
        roleName: roleName,
        onboardingCompleted: user.onboarding_completed,
        permissions: userPermissions,
        sessionId: decoded.sessionId
      };

      // If Employee role is present inside the users table (backward compatibility/legacy)
      if (roleName === 'Employee') {
        const { data: employees, error: empError } = await supabase
          .from('employees')
          .select('id, employee_id, full_name, onboarding_status')
          .eq('user_id', user.id);
          
        if (!empError && employees && employees.length > 0) {
          req.user.employeeId = employees[0].id;
          req.user.employeeStringId = employees[0].employee_id;
          req.user.fullName = employees[0].full_name;
          req.user.onboardingStatus = employees[0].onboarding_status;
        }
      }
    }

    // Emergency lockdown check
    if (roleName !== 'Super Admin') {
      const { data: accessData } = await supabase
        .from('admin_controller_access')
        .select('status')
        .limit(1);

      if (accessData && accessData.length > 0 && accessData[0].status !== 'Active') {
        const sysStatus = accessData[0].status;
        let errMsg = 'Access Denied: The system has been locked down by the Super Admin.';
        if (sysStatus === 'Paused') {
          errMsg = 'Access Suspended: The system has been locked down by the Super Admin.';
        } else if (sysStatus === 'Deactivated') {
          errMsg = 'Access Denied: Admin Controller access has been deactivated by the Super Admin.';
        } else if (sysStatus === 'Revoked') {
          errMsg = 'Access Denied: Admin Controller access has been revoked by the Super Admin.';
        }
        return res.status(403).json({ message: errMsg });
      }
    }

    next();
  } catch (err) {
    console.error('JWT Verification Error:', err.message);
    return res.status(403).json({ message: 'Session expired or token invalid.' });
  }
}

function requirePermission(permissionName) {
  return (req, res, next) => {
    // If the requester is an Employee and they are viewing their own record, bypass the 'employee:view' check.
    if (req.user && req.user.roleName === 'Employee' && permissionName === 'employee:view') {
      const requestedId = parseInt(req.params.id, 10);
      if (requestedId === req.user.employeeId) {
        return next();
      }
    }

    if (!req.user || !req.user.permissions.includes(permissionName)) {
      return res.status(403).json({ 
        message: `Forbidden: You do not have the required permission (${permissionName})` 
      });
    }
    next();
  };
}

/**
 * Checks if user has any of the listed roles
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.roleName)) {
      return res.status(403).json({ 
        message: 'Forbidden: Unauthorized role' 
      });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  requirePermission,
  requireRole
};
