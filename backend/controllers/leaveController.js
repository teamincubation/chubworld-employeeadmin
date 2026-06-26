const supabase = require('../config/db');
const { logAudit } = require('../utils/auditLogger');
const fs = require('fs');
const nodemailer = require('nodemailer');

async function sendLeaveStatusEmail(email, name, leaveCode, totalDays, fromDate, toDate, status, remarks = '') {
  try {
    const { data: dbSettings } = await supabase.from('system_settings').select('*');
    const settingsMap = {};
    (dbSettings || []).forEach(s => { settingsMap[s.setting_key] = s.setting_value; });

    const smtpHost = settingsMap.smtp_host || process.env.SMTP_HOST || 'smtp.hostinger.com';
    const smtpPort = settingsMap.smtp_port || process.env.SMTP_PORT || '465';
    const smtpUser = settingsMap.smtp_user || process.env.SMTP_USER;
    const smtpPass = settingsMap.smtp_pass || process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass) {
      console.log(`[SMTP] Skipped leave email to ${email} (credentials not configured)`);
      return;
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort, 10),
      secure: smtpPort === '465',
      auth: { user: smtpUser, pass: smtpPass },
      tls: { rejectUnauthorized: false }
    });

    const isApproved = status === 'Approved';
    const isRejected = status === 'Rejected';
    
    let statusColor = '#f59e0b'; // orange for pending
    if (isApproved) statusColor = '#22c55e'; // green
    if (isRejected) statusColor = '#ef4444'; // red

    const mailOptions = {
      from: `"C-Hub HR Operations" <${smtpUser}>`,
      to: email,
      subject: `C-Hub Leave Application Update: ${status}`,
      html: `
        <div style="font-family: 'Poppins', 'Segoe UI', Arial, sans-serif; background-color: #f7f9fc; padding: 40px 20px; color: #333333;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.05); border: 1px solid #eef2f6;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #42174F 0%, #D85AA6 100%); padding: 35px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">Leave Application Update</h1>
              <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px;">C-Hub ESS System</p>
            </div>
            
            <!-- Body -->
            <div style="padding: 40px 30px;">
              <p style="font-size: 16px; line-height: 1.6; margin-top: 0;">Hello <strong>${name}</strong>,</p>
              <p style="font-size: 15px; line-height: 1.6; color: #555555;">
                Your leave request has been processed. Here are the status details of your leave application:
              </p>
              
              <div style="background-color: #f8f4f9; border-left: 4px solid ${statusColor}; padding: 20px; border-radius: 8px; margin: 30px 0;">
                <h3 style="margin-top: 0; color: #42174F; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Status Information</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr>
                    <td style="padding: 6px 0; color: #777777; width: 140px;"><strong>Leave Category:</strong></td>
                    <td style="padding: 6px 0; color: #333333; font-weight: 600;">${leaveCode}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #777777;"><strong>Duration:</strong></td>
                    <td style="padding: 6px 0; color: #333333;"><strong>${totalDays} Days</strong> (${fromDate} to ${toDate})</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #777777;"><strong>Current Status:</strong></td>
                    <td style="padding: 6px 0; color: ${statusColor}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">${status}</td>
                  </tr>
                  ${remarks ? `
                  <tr>
                    <td style="padding: 6px 0; color: #777777; vertical-align: top;"><strong>Remarks:</strong></td>
                    <td style="padding: 6px 0; color: #D85AA6; font-style: italic;">${remarks}</td>
                  </tr>
                  ` : ''}
                </table>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="https://chubworld.adloaf.com" style="background: linear-gradient(135deg, #D85AA6 0%, #42174F 100%); color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 30px; font-weight: bold; font-size: 14px; display: inline-block;">
                  Login to ESS Portal
                </a>
              </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f7f9fc; padding: 20px; text-align: center; border-top: 1px solid #eef2f6;">
              <p style="margin: 0; font-size: 11px; color: #9e9e9e;">C-Hub HR Operations & Notification Services</p>
            </div>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`[SMTP] Leave update email sent successfully to ${email} with status ${status}`);
  } catch (err) {
    console.error('[SMTP] Leave status email sending failed:', err.message);
  }
}

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

    if (!leaveTypeId || !fromDate || !toDate || !reason) {
      return res.status(400).json({ message: 'Leave type, dates, and reason are required.' });
    }

    try {
      const fDate = new Date(fromDate);
      const tDate = new Date(toDate);
      if (tDate < fDate) {
        return res.status(400).json({ message: 'End date cannot be prior to start date.' });
      }

      const diffTime = Math.abs(tDate - fDate);
      const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      const { data: leaveTypes } = await supabase.from('leave_types').select('*').eq('id', leaveTypeId).eq('active', true);
      if (!leaveTypes || leaveTypes.length === 0) {
        return res.status(404).json({ message: 'Selected leave type is inactive or invalid.' });
      }
      const leaveType = leaveTypes[0];

      const year = fDate.getFullYear();
      const { data: balances } = await supabase.from('leave_balances').select('*').eq('employee_id', employeeId).eq('leave_type_id', leaveTypeId).eq('year', year);
      
      if (!balances || balances.length === 0) {
        return res.status(400).json({ message: 'No leave balance allocated for this leave type this year.' });
      }

      const balance = balances[0];
      const available = balance.total_days - balance.availed_days - balance.pending_days;
      if (totalDays > available) {
        return res.status(400).json({ message: `Insufficient leave balance. Requested: ${totalDays} days. Available: ${available} days.` });
      }

      await supabase.from('leave_requests').insert([{
        employee_id: employeeId, leave_type_id: leaveTypeId, from_date: fromDate, to_date: toDate, 
        total_days: totalDays, reason, attachment_path: null, status: 'Pending'
      }]);

      await supabase.from('leave_balances').update({
        pending_days: balance.pending_days + totalDays
      }).eq('id', balance.id);

      // Trigger leave request notification email
      try {
        const { data: empData } = await supabase.from('employees').select('full_name').eq('id', employeeId).single();
        const empName = empData ? empData.full_name : 'Employee';
        sendLeaveStatusEmail(req.user.email, empName, leaveType.code, totalDays, fromDate, toDate, 'Pending');
      } catch (mailErr) {
        console.error('Failed to trigger leave submission email:', mailErr.message);
      }

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

      // Send leave status email notification to employee
      try {
        const { data: employee } = await supabase
          .from('employees')
          .select('full_name, email')
          .eq('id', request.employee_id)
          .single();
        if (employee && employee.email) {
          const { data: lt } = await supabase
            .from('leave_types')
            .select('code')
            .eq('id', request.leave_type_id)
            .single();
          const leaveCode = lt ? lt.code : 'Leave';
          await sendLeaveStatusEmail(
            employee.email,
            employee.full_name,
            leaveCode,
            request.total_days,
            request.from_date,
            request.to_date,
            status,
            remarks
          );
        }
      } catch (mailErr) {
        console.error('Failed to trigger leave status update email:', mailErr.message);
      }

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

  // Fetch specific employee's leave balances (Admin)
  getEmployeeLeavesForAdmin: async (req, res) => {
    const { employeeId } = req.params;
    if (!employeeId) {
      return res.status(400).json({ message: 'Employee ID is required.' });
    }

    try {
      const year = new Date().getFullYear();
      
      const { data: balances } = await supabase
        .from('leave_balances')
        .select('*, leave_types!inner(name, code, active)')
        .eq('employee_id', employeeId)
        .eq('year', year)
        .eq('leave_types.active', true);

      const mappedBalances = (balances || []).map(b => ({
        ...b,
        leave_name: b.leave_types ? b.leave_types.name : null,
        leave_code: b.leave_types ? b.leave_types.code : null
      }));

      res.json(mappedBalances);
    } catch (err) {
      console.error('GetEmployeeLeavesForAdmin Error:', err.message);
      res.status(500).json({ message: 'Error retrieving employee leave balances.' });
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
  },

  // Update default base leave allocations
  updateLeaveTypes: async (req, res) => {
    const { leaveTypes } = req.body;
    try {
      if (!Array.isArray(leaveTypes)) {
        return res.status(400).json({ message: 'Invalid leaveTypes format.' });
      }

      for (const lt of leaveTypes) {
        const { code, max_days } = lt;
        const { error } = await supabase
          .from('leave_types')
          .update({ max_days: parseInt(max_days, 10) })
          .eq('code', code);
        if (error) throw error;
      }

      await logAudit(req, 'UPDATE_LEAVE_TYPES', 'leave_types', null, leaveTypes);
      res.json({ message: 'Base leave allocations updated successfully.' });
    } catch (err) {
      console.error('UpdateLeaveTypes Error:', err.message);
      res.status(500).json({ message: 'Error updating base leave allocations.' });
    }
  }
};

module.exports = leaveController;
