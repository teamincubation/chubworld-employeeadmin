const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Middlewares
const { authenticateToken, requirePermission } = require('../middleware/authMiddleware');
const supabase = require('../config/db');

// Controllers
const authController = require('../controllers/authController');
const employeeController = require('../controllers/employeeController');
const metadataController = require('../controllers/metadataController');
const attendanceController = require('../controllers/attendanceController');
const leaveController = require('../controllers/leaveController');
const securityController = require('../controllers/securityController');
const dashboardController = require('../controllers/dashboardController');

// Multer Storage Configuration for secure uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = process.env.UPLOAD_DIR || './uploads';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|pdf/i;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) {
      cb(null, true);
    } else {
      cb(new Error('File upload blocked: Only PDF, JPG, JPEG, and PNG formats are allowed.'));
    }
  }
});

// Helper wrapper to handle multer upload errors cleanly
const handleUpload = (field) => {
  const uploadSingle = upload.single(field);
  return (req, res, next) => {
    uploadSingle(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  };
};

/* =========================================================================
   1. AUTHENTICATION ROUTES
   ========================================================================= */
router.post('/auth/login', authController.login);
router.post('/auth/forgot-password', authController.forgotPassword);
router.post('/auth/reset-password', authController.resetPassword);
router.post('/auth/logout', authenticateToken, authController.logout);
router.post('/auth/change-password', authenticateToken, authController.changePassword);
router.get('/auth/me', authenticateToken, authController.getMe);

/* =========================================================================
   2. DASHBOARD OVERVIEW ROUTES
   ========================================================================= */
router.get('/dashboard/stats', authenticateToken, dashboardController.getOverviewStats);

/* =========================================================================
   3. EMPLOYEE LIFECYCLE MANAGEMENT ROUTES
   ========================================================================= */
router.post('/employees', authenticateToken, requirePermission('employee:create'), employeeController.createEmployee);
router.get('/employees', authenticateToken, requirePermission('employee:view'), employeeController.listEmployees);
router.get('/employees/dropdown', authenticateToken, employeeController.getEmployeesDropdown);
router.get('/employees/:id', authenticateToken, requirePermission('employee:view'), employeeController.getEmployeeById);
router.put('/employees/:id', authenticateToken, requirePermission('employee:edit'), employeeController.updateEmployee);
router.delete('/employees/:id', authenticateToken, requirePermission('employee:delete'), employeeController.deleteEmployee);
router.post('/employees/:id/restore', authenticateToken, requirePermission('employee:restore'), employeeController.restoreEmployee);

// Sensitive KYC View Route (Verifies permission, decrypts fields, logs VIEW_KYC)
router.get('/employees/:id/kyc', authenticateToken, requirePermission('kyc:view'), employeeController.getEmployeeKycDecrypted);

// Documents upload / delete
router.post('/employees/:id/documents', authenticateToken, requirePermission('employee:edit'), handleUpload('document'), employeeController.uploadDocument);
router.delete('/employees/documents/:docId', authenticateToken, requirePermission('employee:edit'), employeeController.deleteDocument);

/* =========================================================================
   4. METADATA ROUTES (Departments, Designations, Work Locations, Shifts)
   ========================================================================= */
router.get('/metadata/pincode/:pincode', authenticateToken, metadataController.fetchPincode);

router.get('/metadata/departments', authenticateToken, metadataController.listDepartments);
router.post('/metadata/departments', authenticateToken, requirePermission('role:manage'), metadataController.createDepartment);
router.delete('/metadata/departments/:id', authenticateToken, requirePermission('role:manage'), metadataController.deleteDepartment);

router.get('/metadata/designations', authenticateToken, metadataController.listDesignations);
router.post('/metadata/designations', authenticateToken, requirePermission('role:manage'), metadataController.createDesignation);
router.delete('/metadata/designations/:id', authenticateToken, requirePermission('role:manage'), metadataController.deleteDesignation);

router.get('/metadata/work-locations', authenticateToken, metadataController.listWorkLocations);
router.post('/metadata/work-locations', authenticateToken, requirePermission('security:settings'), metadataController.createWorkLocation);
router.put('/metadata/work-locations/:id', authenticateToken, requirePermission('security:settings'), metadataController.updateWorkLocation);
router.delete('/metadata/work-locations/:id', authenticateToken, requirePermission('security:settings'), metadataController.deleteWorkLocation);

router.get('/metadata/shifts', authenticateToken, metadataController.listShifts);
router.post('/metadata/shifts', authenticateToken, requirePermission('security:settings'), metadataController.createShift);
router.delete('/metadata/shifts/:id', authenticateToken, requirePermission('security:settings'), metadataController.deleteShift);
router.post('/metadata/shifts/assign', authenticateToken, requirePermission('employee:edit'), metadataController.assignEmployeeShift);

/* =========================================================================
   5. ATTENDANCE & GEOFENCING TRACKER ROUTES
   ========================================================================= */
router.get('/attendance/status', authenticateToken, attendanceController.getTodayStatus);
router.post('/attendance/clock-in', authenticateToken, attendanceController.clockIn);
router.post('/attendance/clock-out', authenticateToken, attendanceController.clockOut);

router.get('/attendance/my-logs', authenticateToken, attendanceController.getEmployeeLogs);
router.get('/attendance/admin-logs', authenticateToken, requirePermission('attendance:view'), attendanceController.getAdminLogs);

router.post('/attendance/corrections', authenticateToken, attendanceController.submitCorrection);
router.get('/attendance/corrections', authenticateToken, requirePermission('attendance:view'), attendanceController.listCorrections);
router.post('/attendance/corrections/:correctionId/approve', authenticateToken, requirePermission('attendance:edit'), attendanceController.approveCorrection);

/* =========================================================================
   6. LEAVE MANAGEMENT MODULE ROUTES
   ========================================================================= */
router.get('/leaves/my-leaves', authenticateToken, leaveController.getEmployeeLeaves);
router.post('/leaves/request', authenticateToken, handleUpload('medical_proof'), leaveController.submitLeaveRequest);
router.post('/leaves/cancel/:id', authenticateToken, leaveController.cancelPendingRequest);

router.get('/leaves/admin-requests', authenticateToken, requirePermission('leave:approve'), leaveController.listAdminRequests);
router.post('/leaves/approve/:id', authenticateToken, requirePermission('leave:approve'), leaveController.approveLeave);
router.post('/leaves/adjust', authenticateToken, requirePermission('leave:manage'), leaveController.adjustBalance);
router.get('/leaves/types', authenticateToken, leaveController.getLeaveTypes);

/* =========================================================================
   7. SECURITY & ENCRYPTION CENTER ROUTES
   ========================================================================= */
router.get('/security/audit-logs', authenticateToken, requirePermission('audit:view'), securityController.getAuditLogs);
router.get('/security/login-history', authenticateToken, requirePermission('audit:view'), securityController.getLoginHistory);
router.get('/security/alerts', authenticateToken, requirePermission('audit:view'), securityController.getSecurityEvents);
router.get('/security/users', authenticateToken, requirePermission('role:manage'), securityController.listUsers);
router.post('/security/users/:userId/status', authenticateToken, requirePermission('role:manage'), securityController.toggleUserStatus);
router.post('/security/users/:userId/reset-password', authenticateToken, requirePermission('role:manage'), securityController.adminResetPassword);

router.get('/security/roles', authenticateToken, requirePermission('role:manage'), securityController.listRoles);
router.get('/security/permissions', authenticateToken, requirePermission('role:manage'), securityController.listPermissions);
router.put('/security/roles/:roleId/permissions', authenticateToken, requirePermission('role:manage'), securityController.updateRolePermissions);

router.get('/security/settings', authenticateToken, requirePermission('security:settings'), securityController.getSystemSettings);
router.put('/security/settings', authenticateToken, requirePermission('security:settings'), securityController.updateSystemSettings);

/* =========================================================================
   8. SECURE DOCUMENT RETRIEVAL (Permission validation before serving files)
   ========================================================================= */
router.get('/documents/download/:filename', authenticateToken, async (req, res) => {
  const { filename } = req.params;
  const dir = process.env.UPLOAD_DIR || './uploads';
  const filePath = path.join(dir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'Requested document file not found.' });
  }

  try {
    // 1. If Super Admin/HR/Finance, allow download
    const canViewKyc = req.user.permissions.includes('kyc:view');
    const isHrOrFinance = req.user.roleName === 'HR Manager' || req.user.roleName === 'Finance Manager';

    if (canViewKyc || isHrOrFinance || req.user.roleName === 'Super Admin') {
      return res.sendFile(path.resolve(filePath));
    }

    // 2. If Employee, check if they own the document
    if (req.user.roleName === 'Employee' && req.user.employeeId) {
      const { data: records } = await supabase
        .from('employee_documents')
        .select('id')
        .eq('employee_id', req.user.employeeId)
        .ilike('file_path', `%${filename}%`);

      // Check if photo is requested
      const { data: photoRecord } = await supabase
        .from('employees')
        .select('id')
        .eq('id', req.user.employeeId)
        .ilike('photo_path', `%${filename}%`);

      if ((records && records.length > 0) || (photoRecord && photoRecord.length > 0)) {
        return res.sendFile(path.resolve(filePath));
      }
    }

    return res.status(403).json({ message: 'Access denied: You do not have permission to view this document.' });
  } catch (err) {
    console.error('File download server error:', err.message);
    res.status(500).json({ message: 'Internal server error resolving file request.' });
  }
});

// Debug route to initialize Supabase database tables and seed data via direct or pooler with comprehensive retries
router.get('/temp-run-migrations', async (req, res) => {
  const { Client } = require('pg');
  const fs = require('fs');
  const path = require('path');

  const targets = [
    { host: 'db.mcolsszojnveoommnuk.supabase.co', port: 5432, user: 'postgres' },
    { host: 'aws-0-ap-southeast-1.pooler.supabase.com', port: 6543, user: 'postgres.mcolsszojnveoommnuk' }
  ];

  let client;
  let connected = false;
  let lastError;

  // Try each target up to 8 times with a 3-second delay
  for (const target of targets) {
    for (let attempt = 1; attempt <= 8; attempt++) {
      console.log(`Connecting to ${target.host}:${target.port} as ${target.user} (Attempt ${attempt})...`);
      client = new Client({
        host: target.host,
        port: target.port,
        database: 'postgres',
        user: target.user,
        password: 'Cw@adloaf#root$Admin',
        ssl: { rejectUnauthorized: false }
      });

      try {
        await client.connect();
        connected = true;
        console.log(`Successfully connected to ${target.host}!`);
        break;
      } catch (err) {
        console.error(`Connection to ${target.host} failed:`, err.message);
        lastError = err;
        try { await client.end(); } catch (e) {}
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    if (connected) break;
  }

  if (!connected) {
    return res.status(500).json({ status: 'FAILED', error: lastError.message, stack: lastError.stack });
  }

  try {
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const seedPath = path.join(__dirname, '../../database/seed.sql');

    console.log('Reading migration files...');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    const seedSql = fs.readFileSync(seedPath, 'utf8');

    console.log('Executing schema.sql...');
    await client.query(schemaSql);

    console.log('Executing seed.sql...');
    await client.query(seedSql);

    await client.end();
    res.json({ status: 'SUCCESS', message: 'Database schema and seed data applied successfully!' });
  } catch (err) {
    if (client) {
      try { await client.end(); } catch (e) {}
    }
    console.error('Migration execution failed:', err.message);
    res.status(500).json({ status: 'FAILED', error: err.message, stack: err.stack });
  }
});

module.exports = router;
