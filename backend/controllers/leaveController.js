const db = require('../config/db');
const { logAudit } = require('../utils/auditLogger');
const fs = require('fs');

const leaveController = {
  // Fetch leave balances & request logs (Employee ESS)
  getEmployeeLeaves: async (req, res) => {
    const employeeId = req.user.employeeId;
    if (!employeeId) {
      return res.status(400).json({ message: 'User is not mapped to an active employee record.' });
    }

    try {
      const year = new Date().getFullYear();
      
      // Fetch balances linked to active types
      const balances = await db.query(`
        SELECT lb.*, lt.name AS leave_name, lt.code AS leave_code
        FROM leave_balances lb
        JOIN leave_types lt ON lb.leave_type_id = lt.id
        WHERE lb.employee_id = ? AND lb.year = ? AND lt.active = TRUE
      `, [employeeId, year]);

      // Fetch requests
      const requests = await db.query(`
        SELECT lr.*, lt.name AS leave_name, lt.code AS leave_code
        FROM leave_requests lr
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        WHERE lr.employee_id = ?
        ORDER BY lr.id DESC
      `, [employeeId]);

      res.json({ balances, requests });
    } catch (err) {
      console.error('GetEmployeeLeaves Error:', err.message);
      res.status(500).json({ message: 'Error retrieving leave records.' });
    }
  },

  // Submit Leave Request (Employee ESS)
  submitLeaveRequest: async (req, res) => {
    const employeeId = req.user.employeeId;
    const { leaveTypeId, fromDate, toDate, reason } = req.body;
    const attachmentPath = req.file ? req.file.path.replace(/\\/g, '/') : null;

    if (!leaveTypeId || !fromDate || !toDate || !reason) {
      // Clean up uploaded file if validation fails
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ message: 'Leave type, dates, and reason are required.' });
    }

    try {
      // Calculate total leave days
      const fDate = new Date(fromDate);
      const tDate = new Date(toDate);
      if (tDate < fDate) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: 'End date cannot be prior to start date.' });
      }

      const diffTime = Math.abs(tDate - fDate);
      const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      // Verify leave type configuration
      const leaveTypes = await db.query('SELECT * FROM leave_types WHERE id = ? AND active = TRUE', [leaveTypeId]);
      if (leaveTypes.length === 0) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(404).json({ message: 'Selected leave type is inactive or invalid.' });
      }
      const leaveType = leaveTypes[0];

      // If sick leave, check if prolonged sick leave configuration mandates a medical certificate upload
      if (leaveType.code === 'SL' && totalDays >= leaveType.requires_medical_certificate_days && !attachmentPath) {
        return res.status(400).json({ 
          message: `Medical certificate upload is mandatory for sick leaves extending ${leaveType.requires_medical_certificate_days} days or more.` 
        });
      }

      // Check current available balance
      const year = fDate.getFullYear();
      const balances = await db.query('SELECT * FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ?', [employeeId, leaveTypeId, year]);
      if (balances.length === 0) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: 'No leave balance allocated for this leave type this year.' });
      }

      const balance = balances[0];
      const available = balance.total_days - balance.availed_days - balance.pending_days;
      if (totalDays > available) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({ 
          message: `Insufficient leave balance. Requested: ${totalDays} days. Available: ${available} days.` 
        });
      }

      // Record request
      await db.query(`
        INSERT INTO leave_requests (employee_id, leave_type_id, from_date, to_date, total_days, reason, attachment_path, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending')
      `, [employeeId, leaveTypeId, fromDate, toDate, totalDays, reason, attachmentPath]);

      // Deduct/adjust pending balance
      await db.query(`
        UPDATE leave_balances 
        SET pending_days = pending_days + ? 
        WHERE id = ?
      `, [totalDays, balance.id]);

      res.status(201).json({ message: 'Leave request submitted successfully. Awaiting manager approval.' });
    } catch (err) {
      console.error('Submit Leave Request Error:', err.message);
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      res.status(500).json({ message: 'Error saving leave request.' });
    }
  },

  // Cancel Pending Leave Request (Employee ESS)
  cancelPendingRequest: async (req, res) => {
    const { id } = req.params;
    const employeeId = req.user.employeeId;

    try {
      const requests = await db.query('SELECT * FROM leave_requests WHERE id = ? AND employee_id = ?', [id, employeeId]);
      if (requests.length === 0) {
        return res.status(404).json({ message: 'Leave request not found.' });
      }

      const request = requests[0];
      if (request.status !== 'Pending') {
        return res.status(400).json({ message: 'Only pending leave requests can be cancelled.' });
      }

      // Update status
      await db.query('UPDATE leave_requests SET status = "Cancelled" WHERE id = ?', [id]);

      // Revert pending balance
      const year = new Date(request.from_date).getFullYear();
      await db.query(`
        UPDATE leave_balances 
        SET pending_days = pending_days - ? 
        WHERE employee_id = ? AND leave_type_id = ? AND year = ?
      `, [request.total_days, employeeId, request.leave_type_id, year]);

      // Delete attachment if exists
      if (request.attachment_path && fs.existsSync(request.attachment_path)) {
        fs.unlinkSync(request.attachment_path);
      }

      res.json({ message: 'Leave request cancelled successfully.' });
    } catch (err) {
      console.error('Cancel Leave Error:', err.message);
      res.status(500).json({ message: 'Error cancelling leave request.' });
    }
  },

  // List Leave Requests (Admin / HR)
  listAdminRequests: async (req, res) => {
    try {
      const list = await db.query(`
        SELECT lr.*, e.employee_id, e.full_name, d.name AS department_name, lt.name AS leave_name, lt.code AS leave_code
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        LEFT JOIN departments d ON e.department_id = d.id
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        ORDER BY lr.id DESC
      `);
      res.json(list);
    } catch (err) {
      console.error('List Admin Leave Requests Error:', err.message);
      res.status(500).json({ message: 'Error fetching leave log.' });
    }
  },

  // Approve / Reject Leave Request (Admin / HR)
  approveLeave: async (req, res) => {
    const { id } = req.params;
    const { status, remarks } = req.body; // status: Approved or Rejected

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be Approved or Rejected.' });
    }

    try {
      const requests = await db.query('SELECT * FROM leave_requests WHERE id = ?', [id]);
      if (requests.length === 0) {
        return res.status(404).json({ message: 'Leave request not found.' });
      }

      const request = requests[0];
      if (request.status !== 'Pending') {
        return res.status(400).json({ message: 'This leave request has already been processed.' });
      }

      // Update status
      await db.query(`
        UPDATE leave_requests SET
          status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP, remarks = ?
        WHERE id = ?
      `, [status, req.user.id, remarks || null, id]);

      // Adjust balances
      const year = new Date(request.from_date).getFullYear();
      if (status === 'Approved') {
        // Transfer from pending_days to availed_days
        await db.query(`
          UPDATE leave_balances SET
            pending_days = pending_days - ?,
            availed_days = availed_days + ?
          WHERE employee_id = ? AND leave_type_id = ? AND year = ?
        `, [request.total_days, request.total_days, request.employee_id, request.leave_type_id, year]);

        // Insert placeholder into attendance logs for these dates so they are marked as 'Leave'
        const start = new Date(request.from_date);
        const end = new Date(request.to_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          // Try inserting, ignore if duplicate clock-in already exists (though leaves usually override)
          await db.query(`
            INSERT INTO attendance_logs (employee_id, date, clock_in_time, clock_in_location_status, status)
            VALUES (?, ?, '00:00:00', 'Location Not Verified', 'Leave')
            ON DUPLICATE KEY UPDATE status = 'Leave'
          `, [request.employee_id, dateStr]);
        }
      } else {
        // Status Rejected: Revert pending_days
        await db.query(`
          UPDATE leave_balances SET
            pending_days = pending_days - ?
          WHERE employee_id = ? AND leave_type_id = ? AND year = ?
        `, [request.total_days, request.employee_id, request.leave_type_id, year]);
      }

      // Audit Log
      await logAudit(req, `LEAVE_REQUEST_${status.toUpperCase()}`, `leave_requests/${id}`, request, { status, remarks });

      res.json({ message: `Leave request has been ${status.toLowerCase()} successfully.` });
    } catch (err) {
      console.error('Approve Leave Error:', err.message);
      res.status(500).json({ message: 'Error processing leave request.' });
    }
  },

  // Adjust Employee Balances manually (Admin / HR)
  adjustBalance: async (req, res) => {
    const { employeeId, leaveTypeId, adjustmentDays, remarks } = req.body;
    if (!employeeId || !leaveTypeId || adjustmentDays === undefined) {
      return res.status(400).json({ message: 'Employee ID, leave type ID, and adjustment days are required.' });
    }

    try {
      const year = new Date().getFullYear();
      const balances = await db.query('SELECT * FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ?', [employeeId, leaveTypeId, year]);
      
      let oldBalance = null;
      if (balances.length > 0) {
        const bal = balances[0];
        oldBalance = { ...bal };
        await db.query(`
          UPDATE leave_balances 
          SET total_days = total_days + ? 
          WHERE id = ?
        `, [adjustmentDays, bal.id]);
      } else {
        // Create balance record if missing
        await db.query(`
          INSERT INTO leave_balances (employee_id, leave_type_id, total_days, availed_days, pending_days, year)
          VALUES (?, ?, ?, 0.00, 0.00, ?)
        `, [employeeId, leaveTypeId, adjustmentDays, year]);
      }

      const updated = await db.query('SELECT * FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ?', [employeeId, leaveTypeId, year]);

      // Audit logs must track manual adjustments
      await logAudit(req, 'LEAVE_BALANCE_ADJUSTED', `employees/${employeeId}/leaves`, oldBalance, { updated: updated[0], remarks });

      res.json({ message: 'Leave balance adjusted successfully.' });
    } catch (err) {
      console.error('Adjust Balance Error:', err.message);
      res.status(500).json({ message: 'Error adjusting leave balance.' });
    }
  },

  // Fetch all leave types
  getLeaveTypes: async (req, res) => {
    try {
      const list = await db.query('SELECT * FROM leave_types WHERE active = TRUE');
      res.json(list);
    } catch (err) {
      console.error('GetLeaveTypes Error:', err.message);
      res.status(500).json({ message: 'Error loading leave types.' });
    }
  }
};

module.exports = leaveController;
