const supabase = require('../config/db');
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
      
      const { data: balances } = await supabase
        .from('leave_balances')
        .select('*, leave_types!inner(name, code, active)')
        .eq('employee_id', employeeId)
        .eq('year', year)
        .eq('leave_types.active', true);

      const { data: requests } = await supabase
        .from('leave_requests')
        .select('*, leave_types(name, code)')
        .eq('employee_id', employeeId)
        .order('id', { ascending: false });

      const mappedBalances = (balances || []).map(b => ({
        ...b,
        leave_name: b.leave_types ? b.leave_types.name : null,
        leave_code: b.leave_types ? b.leave_types.code : null
      }));

      const mappedRequests = (requests || []).map(r => ({
        ...r,
        leave_name: r.leave_types ? r.leave_types.name : null,
        leave_code: r.leave_types ? r.leave_types.code : null
      }));

      res.json({ balances: mappedBalances, requests: mappedRequests });
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
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Leave type, dates, and reason are required.' });
    }

    try {
      const fDate = new Date(fromDate);
      const tDate = new Date(toDate);
      if (tDate < fDate) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: 'End date cannot be prior to start date.' });
      }

      const diffTime = Math.abs(tDate - fDate);
      const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      const { data: leaveTypes } = await supabase.from('leave_types').select('*').eq('id', leaveTypeId).eq('active', true);
      if (!leaveTypes || leaveTypes.length === 0) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(404).json({ message: 'Selected leave type is inactive or invalid.' });
      }
      const leaveType = leaveTypes[0];

      if (leaveType.code === 'SL' && totalDays >= leaveType.requires_medical_certificate_days && !attachmentPath) {
        return res.status(400).json({ 
          message: `Medical certificate upload is mandatory for sick leaves extending ${leaveType.requires_medical_certificate_days} days or more.` 
        });
      }

      const year = fDate.getFullYear();
      const { data: balances } = await supabase.from('leave_balances').select('*').eq('employee_id', employeeId).eq('leave_type_id', leaveTypeId).eq('year', year);
      
      if (!balances || balances.length === 0) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: 'No leave balance allocated for this leave type this year.' });
      }

      const balance = balances[0];
      const available = balance.total_days - balance.availed_days - balance.pending_days;
      if (totalDays > available) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: `Insufficient leave balance. Requested: ${totalDays} days. Available: ${available} days.` });
      }

      await supabase.from('leave_requests').insert([{
        employee_id: employeeId, leave_type_id: leaveTypeId, from_date: fromDate, to_date: toDate, 
        total_days: totalDays, reason, attachment_path: attachmentPath, status: 'Pending'
      }]);

      await supabase.from('leave_balances').update({
        pending_days: balance.pending_days + totalDays
      }).eq('id', balance.id);

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
      const { data: requests } = await supabase.from('leave_requests').select('*').eq('id', id).eq('employee_id', employeeId);
      if (!requests || requests.length === 0) {
        return res.status(404).json({ message: 'Leave request not found.' });
      }

      const request = requests[0];
      if (request.status !== 'Pending') {
        return res.status(400).json({ message: 'Only pending leave requests can be cancelled.' });
      }

      await supabase.from('leave_requests').update({ status: 'Cancelled' }).eq('id', id);

      const year = new Date(request.from_date).getFullYear();
      const { data: balData } = await supabase.from('leave_balances').select('id, pending_days').eq('employee_id', employeeId).eq('leave_type_id', request.leave_type_id).eq('year', year).single();
      
      if (balData) {
        await supabase.from('leave_balances').update({
          pending_days: balData.pending_days - request.total_days
        }).eq('id', balData.id);
      }

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
      const { data: list } = await supabase
        .from('leave_requests')
        .select('*, employees(employee_id, full_name, departments(name)), leave_types(name, code)')
        .order('id', { ascending: false });

      const mappedList = (list || []).map(r => ({
        ...r,
        employee_id_str: r.employees ? r.employees.employee_id : null,
        full_name: r.employees ? r.employees.full_name : null,
        department_name: (r.employees && r.employees.departments) ? r.employees.departments.name : null,
        leave_name: r.leave_types ? r.leave_types.name : null,
        leave_code: r.leave_types ? r.leave_types.code : null
      }));

      res.json(mappedList);
    } catch (err) {
      console.error('List Admin Leave Requests Error:', err.message);
      res.status(500).json({ message: 'Error fetching leave log.' });
    }
  },

  // Approve / Reject Leave Request (Admin / HR)
  approveLeave: async (req, res) => {
    const { id } = req.params;
    const { status, remarks } = req.body; 

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be Approved or Rejected.' });
    }

    try {
      const { data: requests } = await supabase.from('leave_requests').select('*').eq('id', id);
      if (!requests || requests.length === 0) {
        return res.status(404).json({ message: 'Leave request not found.' });
      }

      const request = requests[0];
      if (request.status !== 'Pending') {
        return res.status(400).json({ message: 'This leave request has already been processed.' });
      }

      await supabase.from('leave_requests').update({
        status, approved_by: req.user.id, approved_at: new Date().toISOString(), remarks: remarks || null
      }).eq('id', id);

      const year = new Date(request.from_date).getFullYear();
      const { data: balData } = await supabase.from('leave_balances').select('id, pending_days, availed_days').eq('employee_id', request.employee_id).eq('leave_type_id', request.leave_type_id).eq('year', year).single();

      if (balData) {
        if (status === 'Approved') {
          await supabase.from('leave_balances').update({
            pending_days: balData.pending_days - request.total_days,
            availed_days: balData.availed_days + request.total_days
          }).eq('id', balData.id);

          const start = new Date(request.from_date);
          const end = new Date(request.to_date);
          const upserts = [];
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            upserts.push({
              employee_id: request.employee_id, date: dateStr, clock_in_time: '00:00:00', clock_in_location_status: 'Location Not Verified', status: 'Leave'
            });
          }
          if (upserts.length > 0) {
            await supabase.from('attendance_logs').upsert(upserts, { onConflict: 'employee_id,date' });
          }
        } else {
          await supabase.from('leave_balances').update({
            pending_days: balData.pending_days - request.total_days
          }).eq('id', balData.id);
        }
      }

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
      const { data: balances } = await supabase.from('leave_balances').select('*').eq('employee_id', employeeId).eq('leave_type_id', leaveTypeId).eq('year', year);
      
      let oldBalance = null;
      if (balances && balances.length > 0) {
        const bal = balances[0];
        oldBalance = { ...bal };
        await supabase.from('leave_balances').update({
          total_days: bal.total_days + adjustmentDays
        }).eq('id', bal.id);
      } else {
        await supabase.from('leave_balances').insert([{
          employee_id: employeeId, leave_type_id: leaveTypeId, total_days: adjustmentDays, availed_days: 0.00, pending_days: 0.00, year
        }]);
      }

      const { data: updated } = await supabase.from('leave_balances').select('*').eq('employee_id', employeeId).eq('leave_type_id', leaveTypeId).eq('year', year);
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
      const { data: list } = await supabase.from('leave_types').select('*').eq('active', true);
      res.json(list || []);
    } catch (err) {
      console.error('GetLeaveTypes Error:', err.message);
      res.status(500).json({ message: 'Error loading leave types.' });
    }
  }
};

module.exports = leaveController;
