const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Middlewares
const { authenticateToken, requirePermission, requireRole } = require('../middleware/authMiddleware');
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
    const dir = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
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
router.post('/auth/google-login', authController.googleLogin);
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
router.post('/employees/:id/documents', authenticateToken, requirePermission('employee:edit'), employeeController.uploadDocument);
router.delete('/employees/documents/:docId', authenticateToken, requirePermission('employee:edit'), employeeController.deleteDocument);

/* =========================================================================
   4. METADATA ROUTES (Departments, Designations, Work Locations, Shifts)
   ========================================================================= */
router.get('/metadata/pincode/:pincode', authenticateToken, metadataController.fetchPincode);

router.get('/metadata/departments', authenticateToken, metadataController.listDepartments);
router.post('/metadata/departments', authenticateToken, requirePermission('role:manage'), metadataController.createDepartment);
router.put('/metadata/departments/:id', authenticateToken, requirePermission('role:manage'), metadataController.updateDepartment);
router.delete('/metadata/departments/:id', authenticateToken, requirePermission('role:manage'), metadataController.deleteDepartment);

router.get('/metadata/designations', authenticateToken, metadataController.listDesignations);
router.post('/metadata/designations', authenticateToken, requirePermission('role:manage'), metadataController.createDesignation);
router.put('/metadata/designations/:id', authenticateToken, requirePermission('role:manage'), metadataController.updateDesignation);
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

// Admin manual overrides
router.post('/attendance/admin-add', authenticateToken, requirePermission('attendance:edit'), attendanceController.adminAddAttendance);
router.put('/attendance/admin-update/:id', authenticateToken, requirePermission('attendance:edit'), attendanceController.adminUpdateAttendance);
router.post('/attendance/admin-delete-to-leave/:id', authenticateToken, requirePermission('attendance:edit'), attendanceController.adminDeleteToLeave);


/* =========================================================================
   6. LEAVE MANAGEMENT MODULE ROUTES
   ========================================================================= */
router.get('/leaves/my-leaves', authenticateToken, leaveController.getEmployeeLeaves);
router.post('/leaves/request', authenticateToken, leaveController.submitLeaveRequest);
router.post('/leaves/cancel/:id', authenticateToken, leaveController.cancelPendingRequest);

router.get('/leaves/admin-requests', authenticateToken, requirePermission('leave:approve'), leaveController.listAdminRequests);
router.get('/leaves/employee/:employeeId', authenticateToken, requirePermission('leave:approve'), leaveController.getEmployeeLeavesForAdmin);
router.post('/leaves/approve/:id', authenticateToken, requirePermission('leave:approve'), leaveController.approveLeave);
router.post('/leaves/adjust', authenticateToken, requirePermission('leave:manage'), leaveController.adjustBalance);
router.get('/leaves/types', authenticateToken, leaveController.getLeaveTypes);
router.put('/leaves/types', authenticateToken, requirePermission('leave:manage'), leaveController.updateLeaveTypes);

/* =========================================================================
   7. SECURITY & ENCRYPTION CENTER ROUTES
   ========================================================================= */
router.get('/security/audit-logs', authenticateToken, requirePermission('audit:view'), securityController.getAuditLogs);
router.delete('/security/audit-logs', authenticateToken, securityController.deleteAuditLogs);
router.get('/security/login-history', authenticateToken, requirePermission('audit:view'), securityController.getLoginHistory);
router.get('/security/alerts', authenticateToken, requirePermission('audit:view'), securityController.getSecurityEvents);
router.get('/security/users', authenticateToken, requirePermission('role:manage'), securityController.listUsers);
router.post('/security/users/:userId/status', authenticateToken, requirePermission('role:manage'), securityController.toggleUserStatus);
router.post('/security/users/:userId/reset-password', authenticateToken, requirePermission('role:manage'), securityController.adminResetPassword);
router.delete('/security/users/:userId', authenticateToken, requirePermission('role:manage'), securityController.hardDeleteUser);

// Active sessions tracking & force management
router.get('/security/active-sessions', authenticateToken, securityController.getActiveSessions);
router.post('/security/force-signout', authenticateToken, securityController.forceSignout);
router.post('/security/force-clockout', authenticateToken, securityController.forceClockout);
router.get('/security/employee-location/:employeeId', authenticateToken, securityController.getEmployeeLiveLocation);


router.get('/security/roles', authenticateToken, requirePermission('role:manage'), securityController.listRoles);
router.get('/security/permissions', authenticateToken, requirePermission('role:manage'), securityController.listPermissions);
router.put('/security/roles/:roleId/permissions', authenticateToken, requirePermission('role:manage'), securityController.updateRolePermissions);

router.get('/security/settings', authenticateToken, requirePermission('security:settings'), securityController.getSystemSettings);
router.put('/security/settings', authenticateToken, requirePermission('security:settings'), securityController.updateSystemSettings);

// Holiday Management Calendar
router.get('/security/holidays', authenticateToken, requirePermission('security:settings'), securityController.getHolidays);
router.post('/security/holidays', authenticateToken, requirePermission('security:settings'), securityController.createHoliday);
router.put('/security/holidays/:id', authenticateToken, requirePermission('security:settings'), securityController.updateHoliday);
router.delete('/security/holidays/:id', authenticateToken, requirePermission('security:settings'), securityController.deleteHoliday);
router.post('/security/holidays/generate-weekends', authenticateToken, requirePermission('security:settings'), securityController.generateWeekends);
router.post('/security/holidays/clone', authenticateToken, requirePermission('security:settings'), securityController.cloneHolidays);

// Monthly Attendance and Payroll summaries for Reports
router.get('/reports/attendance-summary', authenticateToken, requirePermission('attendance:view'), attendanceController.getMonthlyAttendanceSummary);
router.get('/reports/payroll-summary', authenticateToken, requirePermission('payroll:view'), securityController.getMonthlyPayrollSummary);

router.get('/security/licensing', authenticateToken, securityController.getLicensing);
router.put('/security/licensing', authenticateToken, securityController.updateLicensing);
router.get('/security/sub-admin-licensing/:userId', authenticateToken, securityController.getSubAdminLicensing);
router.put('/security/sub-admin-licensing/:userId', authenticateToken, securityController.updateSubAdminLicensing);
router.post('/security/sub-admins', authenticateToken, requirePermission('role:manage'), securityController.createSubAdmin);
router.put('/security/sub-admins/:userId', authenticateToken, requirePermission('role:manage'), securityController.updateSubAdmin);

// Database wiping actions
router.post('/security/clear-database', authenticateToken, requireRole(['Super Admin']), securityController.clearDatabase);
router.post('/security/clear-employees', authenticateToken, requireRole(['Super Admin']), securityController.clearEmployees);

/* =========================================================================
   8. SECURE DOCUMENT RETRIEVAL (Permission validation before serving files)
   ========================================================================= */
router.get('/documents/download/:filename', authenticateToken, async (req, res) => {
  const { filename } = req.params;
  const dir = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
  let targetFilename = filename;
  let filePath = path.join(dir, filename);

  try {
    // Resolve by document ID if filename starts with id-
    if (filename.startsWith('id-')) {
      const docId = parseInt(filename.split('-')[1], 10);
      if (!isNaN(docId)) {
        const { data: docs, error: docErr } = await supabase
          .from('employee_documents')
          .select('*')
          .eq('id', docId);
        
        if (!docErr && docs && docs.length > 0) {
          const doc = docs[0];
          filePath = doc.file_path;
          targetFilename = path.basename(filePath);
        } else {
          return res.status(404).json({ message: 'Document record not found in database.' });
        }
      }
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Requested document file not found.' });
    }

    // A. Allow any authenticated user to view/download employee photos
    const { data: photoRecordMatch } = await supabase
      .from('employees')
      .select('id')
      .ilike('photo_path', `%${targetFilename}%`);

    if (photoRecordMatch && photoRecordMatch.length > 0) {
      return res.sendFile(path.resolve(filePath));
    }

    // 1. If Super Admin/HR/Finance/Admin Controller/Admin, allow download
    const canViewKyc = req.user.permissions && req.user.permissions.includes('kyc:view');
    const isHrOrFinance = req.user.roleName === 'HR Manager' || req.user.roleName === 'Finance Manager';
    const isPrivilegedRole = req.user.roleName === 'Super Admin' || req.user.roleName === 'Admin Controller' || req.user.roleName === 'Admin';

    if (canViewKyc || isHrOrFinance || isPrivilegedRole) {
      return res.sendFile(path.resolve(filePath));
    }

    // 2. If Employee, check if they own the document
    if (req.user.roleName === 'Employee' && req.user.employeeId) {
      const { data: records } = await supabase
        .from('employee_documents')
        .select('id')
        .eq('employee_id', req.user.employeeId)
        .ilike('file_path', `%${targetFilename}%`);

      // Check if photo is requested
      const { data: photoRecord } = await supabase
        .from('employees')
        .select('id')
        .eq('id', req.user.employeeId)
        .ilike('photo_path', `%${targetFilename}%`);

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

// Self-photo update endpoint
router.post('/ess/profile/photo', authenticateToken, handleUpload('photo'), employeeController.uploadSelfPhoto);
router.post('/ess/update-location', authenticateToken, securityController.updateSessionLocation);

// Admin Controller management routes
router.get('/security/admin-controller', authenticateToken, securityController.getAdminController);
router.post('/security/admin-controller', authenticateToken, securityController.setAdminController);
router.post('/security/admin-controller/status', authenticateToken, securityController.updateAdminControllerStatus);

module.exports = router;

