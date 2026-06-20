const jwt = require('jsonwebtoken');
const db = require('../config/db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'chub_super_secret_jwt_key_2026_creating_wow_world';

/**
 * Main Auth Middleware: Verifies JWT token and attaches user details
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  // Supporting Bearer token
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication required. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Fetch user from DB to verify they are still active and validate their role
    const users = await db.query(`
      SELECT u.id, u.email, u.status, u.onboarding_completed, r.id AS role_id, r.name AS role_name 
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `, [decoded.id]);

    if (users.length === 0) {
      return res.status(403).json({ message: 'User session invalid or expired.' });
    }

    const user = users[0];
    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Your account has been deactivated.' });
    }

    // Load permissions for this role
    const permissions = await db.query(`
      SELECT p.name 
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = ?
    `, [user.role_id]);

    const userPermissions = permissions.map(p => p.name);

    // Attach user information to request
    req.user = {
      id: user.id,
      email: user.email,
      roleId: user.role_id,
      roleName: user.role_name,
      onboardingCompleted: user.onboarding_completed,
      permissions: userPermissions
    };

    // If Employee is logged in, we fetch their Employee table record ID and attach it
    if (user.role_name === 'Employee') {
      const employees = await db.query('SELECT id, employee_id, full_name, onboarding_status FROM employees WHERE user_id = ?', [user.id]);
      if (employees.length > 0) {
        req.user.employeeId = employees[0].id;
        req.user.employeeStringId = employees[0].employee_id;
        req.user.fullName = employees[0].full_name;
        req.user.onboardingStatus = employees[0].onboarding_status;
      }
    }

    next();
  } catch (err) {
    console.error('JWT Verification Error:', err.message);
    return res.status(403).json({ message: 'Session expired or token invalid.' });
  }
}

/**
 * Checks if user has a specific permission
 */
function requirePermission(permissionName) {
  return (req, res, next) => {
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
