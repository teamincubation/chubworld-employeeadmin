const supabase = require('../config/db');
const { logAudit } = require('../utils/auditLogger');
const nodemailer = require('nodemailer');

async function sendAttendanceEmail(email, name, eventType, date, time, locationStatus, totalHours = null) {
  try {
    const { data: dbSettings } = await supabase.from('system_settings').select('*');
    const settingsMap = {};
    (dbSettings || []).forEach(s => { settingsMap[s.setting_key] = s.setting_value; });

    const smtpHost = settingsMap.smtp_host || process.env.SMTP_HOST || 'smtp.hostinger.com';
    const smtpPort = settingsMap.smtp_port || process.env.SMTP_PORT || '465';
    const smtpUser = settingsMap.smtp_user || process.env.SMTP_USER;
    const smtpPass = settingsMap.smtp_pass || process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass) {
      console.log(`[SMTP] Skipped attendance email to ${email} (credentials not configured)`);
      return;
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort, 10),
      secure: smtpPort === '465',
      auth: { user: smtpUser, pass: smtpPass },
      tls: { rejectUnauthorized: false }
    });

    const isClockIn = eventType === 'Clock-In';
    const statusColor = isClockIn ? '#22c55e' : '#D85AA6';

    const mailOptions = {
      from: `"C-Hub Attendance Alert" <${smtpUser}>`,
      to: email,
      subject: `C-Hub Attendance Notification: ${eventType}`,
      html: `
        <div style="font-family: 'Poppins', 'Segoe UI', Arial, sans-serif; background-color: #f7f9fc; padding: 40px 20px; color: #333333;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.05); border: 1px solid #eef2f6;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #42174F 0%, #D85AA6 100%); padding: 35px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">Attendance Logged</h1>
              <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px;">C-Hub ESS System</p>
            </div>
            
            <!-- Body -->
            <div style="padding: 40px 30px;">
              <p style="font-size: 16px; line-height: 1.6; margin-top: 0;">Hello <strong>${name}</strong>,</p>
              <p style="font-size: 15px; line-height: 1.6; color: #555555;">
                We have registered a new <strong>${eventType}</strong> event on your account:
              </p>
              
              <div style="background-color: #f8f4f9; border-left: 4px solid ${statusColor}; padding: 20px; border-radius: 8px; margin: 30px 0;">
                <h3 style="margin-top: 0; color: #42174F; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Activity Details</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr>
                    <td style="padding: 6px 0; color: #777777; width: 140px;"><strong>Event Type:</strong></td>
                    <td style="padding: 6px 0; color: ${statusColor}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">${eventType}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #777777;"><strong>Date:</strong></td>
                    <td style="padding: 6px 0; color: #333333;"><strong>${date}</strong></td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #777777;"><strong>Logged Time:</strong></td>
                    <td style="padding: 6px 0; color: #333333;"><strong>${time} IST</strong></td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #777777;"><strong>Location Status:</strong></td>
                    <td style="padding: 6px 0; color: #333333;">${locationStatus}</td>
                  </tr>
                  ${totalHours !== null ? `
                  <tr>
                    <td style="padding: 6px 0; color: #777777;"><strong>Active Duration:</strong></td>
                    <td style="padding: 6px 0; color: #333333;"><strong>${totalHours} Hours</strong></td>
                  </tr>
                  ` : ''}
                </table>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="https://chubworld.adloaf.com" style="background: linear-gradient(135deg, #D85AA6 0%, #42174F 100%); color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 30px; font-weight: bold; font-size: 14px; display: inline-block;">
                  Login to Portal
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
    console.log(`[SMTP] Attendance ${eventType} email sent to ${email}`);
  } catch (err) {
    console.error('[SMTP] Attendance email sending failed:', err.message);
  }
}

/**
 * Get current time in IST (Asia/Kolkata)
 */
function getISTDate() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 5.5));
}

function getISTDateString(istDate = getISTDate()) {
  return istDate.toISOString().split('T')[0];
}

function getISTTimeString(istDate = getISTDate()) {
  return istDate.toTimeString().split(' ')[0];
}

/**
 * Haversine Formula to calculate distance between two coordinates in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const radLat1 = (lat1 * Math.PI) / 180;
  const radLat2 = (lat2 * Math.PI) / 180;
  const diffLat = ((lat2 - lat1) * Math.PI) / 180;
  const diffLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(diffLat / 2) * Math.sin(diffLat / 2) +
    Math.cos(radLat1) *
      Math.cos(radLat2) *
      Math.sin(diffLon / 2) *
      Math.sin(diffLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in meters
}

const attendanceController = {
  // Check Today's status
  getTodayStatus: async (req, res) => {
    const employeeId = req.user.employeeId;
    if (!employeeId) {
      return res.status(400).json({ message: 'User is not mapped to an active employee record.' });
    }

    try {
      const todayStr = getISTDateString();
      const { data: logs, error: logErr } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('date', todayStr);

      // Fetch shift assignment
      const { data: assignments, error: shiftErr } = await supabase
        .from('employee_shift_assignments')
        .select('*, shifts(*)')
        .eq('employee_id', employeeId)
        .or(`end_date.is.null,end_date.gte.${todayStr}`)
        .limit(1);

      const shift = (assignments && assignments.length > 0 && assignments[0].shifts) ? assignments[0].shifts : null;

      // Check if today is a holiday
      const { data: holidays } = await supabase.from('holidays').select('*').eq('date', todayStr).limit(1);
      const holidayName = holidays && holidays.length > 0 ? holidays[0].name : null;

      if (!logs || logs.length === 0) {
        if (holidayName) {
          return res.json({ status: 'holiday', holidayName, shift });
        }
        return res.json({ status: 'not_clocked_in', shift });
      }

      const record = logs[0];
      if (!record.clock_out_time) {
        const clockInTimeStr = record.clock_in_time.length === 5 ? `${record.clock_in_time}:00` : record.clock_in_time;
        const inDate = new Date(`${record.date}T${clockInTimeStr}`);
        const nowIst = getISTDate();
        const diffHours = (nowIst - inDate) / 3600000;
        return res.json({ 
          status: 'clocked_in', 
          record, 
          shift,
          warningNotification: diffHours >= 8.0
        });
      }

      res.json({ status: 'clocked_out', record, shift });
    } catch (err) {
      console.error('GetTodayStatus Error:', err.message);
      res.status(500).json({ message: 'Error checking attendance status.' });
    }
  },

  // Clock In Action
  clockIn: async (req, res) => {
    const employeeId = req.user.employeeId;
    const { latitude, longitude, accuracy } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    if (!employeeId) {
      return res.status(400).json({ message: 'User is not linked to an employee profile.' });
    }

    try {
      const istDateObj = getISTDate();
      const todayStr = getISTDateString(istDateObj);
      const nowTimeStr = getISTTimeString(istDateObj);

      // Block clock-in on holidays
      const { data: holidayMatch } = await supabase.from('holidays').select('name').eq('date', todayStr).limit(1);
      if (holidayMatch && holidayMatch.length > 0) {
        return res.status(400).json({ message: `Clock-in blocked: Today is a scheduled holiday (${holidayMatch[0].name}).` });
      }

      // Prevent duplicate clock-in
      const { data: existing } = await supabase.from('attendance_logs').select('id').eq('employee_id', employeeId).eq('date', todayStr);
      if (existing && existing.length > 0) {
        return res.status(400).json({ message: 'You have already clocked in for today.' });
      }

      // Fetch employee's office location preferences
      const { data: empDetails } = await supabase
        .from('employees')
        .select('work_location_id, work_locations(latitude, longitude, radius_meters, allow_without_location, name)')
        .eq('id', employeeId);

      if (!empDetails || empDetails.length === 0) {
        return res.status(404).json({ message: 'Employee record not found.' });
      }

      const emp = empDetails[0];
      const wl = emp.work_locations || {};
      let locationStatus = 'Location Not Verified';

      if (emp.work_location_id && wl.latitude) {
        if (latitude && longitude) {
          const distance = calculateDistance(latitude, longitude, wl.latitude, wl.longitude);
          if (distance <= wl.radius_meters) {
            locationStatus = 'Verified-Inside';
          } else {
            locationStatus = 'Verified-Outside';
          }
        } else {
          if (!wl.allow_without_location) {
            return res.status(400).json({ message: 'Clock-in blocked: Sharing your GPS location is mandatory for this work site.' });
          }
        }
      }

      // Fetch employee's shift
      const { data: assignments } = await supabase
        .from('employee_shift_assignments')
        .select('shifts(*)')
        .eq('employee_id', employeeId)
        .or(`end_date.is.null,end_date.gte.${todayStr}`)
        .limit(1);

      let recordStatus = 'Present';
      if (assignments && assignments.length > 0 && assignments[0].shifts) {
        const shift = assignments[0].shifts;
        const [shHour, shMin] = shift.start_time.split(':').map(Number);
        const [inHour, inMin] = nowTimeStr.split(':').map(Number);

        const shiftStartMins = shHour * 60 + shMin;
        const clockInMins = inHour * 60 + inMin;

        if (clockInMins > (shiftStartMins + shift.grace_period_minutes)) {
          recordStatus = 'Late';
        }
      }

      if (locationStatus === 'Location Not Verified') {
        recordStatus = 'Location Not Verified';
      }

      // Save log
      await supabase.from('attendance_logs').insert([{
        employee_id: employeeId, date: todayStr, clock_in_time: nowTimeStr, 
        clock_in_latitude: latitude || null, clock_in_longitude: longitude || null, clock_in_accuracy: accuracy || null, 
        clock_in_ip: ip, clock_in_user_agent: userAgent, clock_in_location_status: locationStatus, status: recordStatus
      }]);

      // Trigger clock-in notification email
      try {
        const { data: empData } = await supabase.from('employees').select('full_name').eq('id', employeeId).single();
        const empName = empData ? empData.full_name : 'Employee';
        sendAttendanceEmail(req.user.email, empName, 'Clock-In', todayStr, nowTimeStr, locationStatus);
      } catch (mailErr) {
        console.error('Failed to trigger clock-in email:', mailErr.message);
      }

      res.status(201).json({ 
        message: 'Clocked-in successfully!', 
        time: nowTimeStr,
        locationStatus,
        status: recordStatus
      });
    } catch (err) {
      console.error('Clock-In Error:', err.message);
      res.status(500).json({ message: 'Error processing clock-in stamp.' });
    }
  },

  // Clock Out Action
  clockOut: async (req, res) => {
    const employeeId = req.user.employeeId;
    const { latitude, longitude, accuracy } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    if (!employeeId) {
      return res.status(400).json({ message: 'User is not linked to an employee profile.' });
    }

    try {
      const istDateObj = getISTDate();
      const todayStr = getISTDateString(istDateObj);
      const nowTimeStr = getISTTimeString(istDateObj);

      const { data: existing } = await supabase.from('attendance_logs').select('*').eq('employee_id', employeeId).eq('date', todayStr);
      if (!existing || existing.length === 0) {
        return res.status(400).json({ message: 'You have not clocked in for today yet.' });
      }

      const logRecord = existing[0];
      if (logRecord.clock_out_time) {
        return res.status(400).json({ message: 'You have already clocked out for today.' });
      }

      const { data: empDetails } = await supabase
        .from('employees')
        .select('work_location_id, work_locations(latitude, longitude, radius_meters, allow_without_location)')
        .eq('id', employeeId);

      const emp = empDetails[0];
      const wl = emp.work_locations || {};
      let locationStatus = 'Location Not Verified';

      if (emp.work_location_id && wl.latitude) {
        if (latitude && longitude) {
          const distance = calculateDistance(latitude, longitude, wl.latitude, wl.longitude);
          if (distance <= wl.radius_meters) {
            locationStatus = 'Verified-Inside';
          } else {
            locationStatus = 'Verified-Outside';
          }
        } else {
          if (!wl.allow_without_location) {
            return res.status(400).json({ message: 'Clock-out blocked: Sharing your GPS location is mandatory for this work site.' });
          }
        }
      }

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
        clock_out_latitude: latitude || null, clock_out_longitude: longitude || null, clock_out_accuracy: accuracy || null,
        clock_out_ip: ip, clock_out_user_agent: userAgent, clock_out_location_status: locationStatus,
        total_hours: activeHours, status: finalStatus
      }).eq('id', logRecord.id);

      // Trigger clock-out notification email
      try {
        const { data: empData } = await supabase.from('employees').select('full_name').eq('id', employeeId).single();
        const empName = empData ? empData.full_name : 'Employee';
        sendAttendanceEmail(req.user.email, empName, 'Clock-Out', todayStr, nowTimeStr, locationStatus, activeHours);
      } catch (mailErr) {
        console.error('Failed to trigger clock-out email:', mailErr.message);
      }

      res.json({
        message: 'Clocked-out successfully!',
        time: nowTimeStr,
        hours: activeHours,
        status: finalStatus
      });
    } catch (err) {
      console.error('Clock-Out Error:', err.message);
      res.status(500).json({ message: 'Error processing clock-out stamp.' });
    }
  },

  // Submit Correction request (Employee)
  submitCorrection: async (req, res) => {
    const employeeId = req.user.employeeId;
    const { date, requestedClockIn, requestedClockOut, reason } = req.body;

    if (!date || !reason) {
      return res.status(400).json({ message: 'Date and correction reason are required.' });
    }

    try {
      const { data: existing } = await supabase.from('attendance_logs').select('id').eq('employee_id', employeeId).eq('date', date);
      const logId = (existing && existing.length > 0) ? existing[0].id : null;

      const { data: pending } = await supabase.from('attendance_corrections').select('id').eq('employee_id', employeeId).eq('date', date).eq('status', 'Pending');
      if (pending && pending.length > 0) {
        return res.status(400).json({ message: 'You already have a pending correction request for this date.' });
      }

      await supabase.from('attendance_corrections').insert([{
        attendance_log_id: logId, employee_id: employeeId, date, requested_clock_in: requestedClockIn || null, requested_clock_out: requestedClockOut || null, reason, status: 'Pending'
      }]);

      res.json({ message: 'Correction request submitted to manager review.' });
    } catch (err) {
      console.error('Submit Correction Error:', err.message);
      res.status(500).json({ message: 'Error submitting correction request.' });
    }
  },

  // List Correction requests
  listCorrections: async (req, res) => {
    try {
      const { data: list } = await supabase
        .from('attendance_corrections')
        .select('*, employees(employee_id, full_name, departments(name))')
        .order('id', { ascending: false });

      const mappedList = (list || []).map(ac => ({
        ...ac,
        employee_id_str: ac.employees ? ac.employees.employee_id : null,
        full_name: ac.employees ? ac.employees.full_name : null,
        department_name: (ac.employees && ac.employees.departments) ? ac.employees.departments.name : null
      }));

      res.json(mappedList);
    } catch (err) {
      console.error('List Corrections Error:', err.message);
      res.status(500).json({ message: 'Error fetching correction log.' });
    }
  },

  // Approve / Reject Correction Request
  approveCorrection: async (req, res) => {
    const { correctionId } = req.params;
    const { status, remarks } = req.body; 

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be Approved or Rejected.' });
    }

    try {
      const { data: corrections } = await supabase.from('attendance_corrections').select('*').eq('id', correctionId);
      if (!corrections || corrections.length === 0) {
        return res.status(404).json({ message: 'Correction request not found.' });
      }

      const corr = corrections[0];
      if (corr.status !== 'Pending') {
        return res.status(400).json({ message: 'This request has already been processed.' });
      }

      await supabase.from('attendance_corrections').update({
        status, approved_by: req.user.id, approved_at: new Date().toISOString(), remarks: remarks || null
      }).eq('id', correctionId);

      if (status === 'Approved') {
        const checkIn = corr.requested_clock_in;
        const checkOut = corr.requested_clock_out;
        
        let activeHours = 0.00;
        if (checkIn && checkOut) {
          const [inH, inM] = checkIn.split(':').map(Number);
          const [outH, outM] = checkOut.split(':').map(Number);
          activeHours = parseFloat((((outH * 60 + outM) - (inH * 60 + inM)) / 60).toFixed(2));
        }

        let recordStatus = 'Present';
        if (activeHours < 4.0) recordStatus = 'Half Day';

        if (corr.attendance_log_id) {
          const { data: exLog } = await supabase.from('attendance_logs').select('clock_in_time, clock_out_time').eq('id', corr.attendance_log_id).single();
          await supabase.from('attendance_logs').update({
            clock_in_time: checkIn || exLog.clock_in_time,
            clock_out_time: checkOut || exLog.clock_out_time,
            total_hours: activeHours,
            status: recordStatus,
            clock_in_location_status: 'Verified-Inside',
            clock_out_location_status: 'Verified-Inside'
          }).eq('id', corr.attendance_log_id);
        } else {
          await supabase.from('attendance_logs').insert([{
            employee_id: corr.employee_id, date: corr.date, clock_in_time: checkIn || '09:00:00', clock_out_time: checkOut, 
            clock_in_location_status: 'Verified-Inside', clock_out_location_status: 'Verified-Inside', total_hours: activeHours, status: recordStatus
          }]);
        }
      }

      await logAudit(req, `ATTENDANCE_CORRECTION_${status.toUpperCase()}`, `attendance_corrections/${correctionId}`, corr, { status, remarks });
      res.json({ message: `Correction request has been ${status.toLowerCase()} successfully.` });
    } catch (err) {
      console.error('Approve Correction Error:', err.message);
      res.status(500).json({ message: 'Error applying correction.' });
    }
  },

  // Fetch Attendance Logs for ESS
  getEmployeeLogs: async (req, res) => {
    const employeeId = req.user.employeeId;
    if (!employeeId) return res.status(400).json({ message: 'No mapped employee record.' });

    try {
      const { data: logs } = await supabase.from('attendance_logs').select('*').eq('employee_id', employeeId).order('date', { ascending: false }).limit(90);
      res.json(logs || []);
    } catch (err) {
      console.error('GetEmployeeLogs Error:', err.message);
      res.status(500).json({ message: 'Error retrieving your attendance history.' });
    }
  },

  // Fetch Admin Attendance Logs
  getAdminLogs: async (req, res) => {
    const { fromDate, toDate, departmentId } = req.query;

    let query = supabase
      .from('attendance_logs')
      .select('*, employees!inner(employee_id, full_name, department_id, departments(name))')
      .order('date', { ascending: false })
      .order('clock_in_time', { ascending: false });

    if (fromDate && toDate) {
      query = query.gte('date', fromDate).lte('date', toDate);
    } else {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      query = query.gte('date', thirtyDaysAgo);
    }

    if (departmentId) {
      query = query.eq('employees.department_id', departmentId);
    }

    try {
      const { data: logs, error } = await query;
      if (error) throw error;

      const mappedLogs = logs.map(l => ({
        ...l,
        employee_id_str: l.employees.employee_id,
        full_name: l.employees.full_name,
        department_name: l.employees.departments ? l.employees.departments.name : null
      }));

      res.json(mappedLogs);
    } catch (err) {
      console.error('GetAdminLogs Error:', err.message);
      res.status(500).json({ message: 'Error retrieving employee logs.' });
    }
  },

  // Add manual attendance (Admin)
  adminAddAttendance: async (req, res) => {
    const { employeeId, date, clockInTime, clockOutTime, clockInLocationStatus, clockOutLocationStatus } = req.body;
    try {
      if (!employeeId || !date || !clockInTime) {
        return res.status(400).json({ message: 'Employee, date, and clock-in time are required.' });
      }
      
      let activeHours = 0.00;
      if (clockInTime && clockOutTime) {
        const [inH, inM] = clockInTime.split(':').map(Number);
        const [outH, outM] = clockOutTime.split(':').map(Number);
        activeHours = parseFloat((((outH * 60 + outM) - (inH * 60 + inM)) / 60).toFixed(2));
      }
      
      const { data: assignments } = await supabase
        .from('employee_shift_assignments')
        .select('shifts(*)')
        .eq('employee_id', employeeId)
        .or(`end_date.is.null,end_date.gte.${date}`)
        .limit(1);
        
      let recordStatus = 'Present';
      if (assignments && assignments.length > 0 && assignments[0].shifts) {
        const shift = assignments[0].shifts;
        const [shHour, shMin] = shift.start_time.split(':').map(Number);
        const [inHour, inMin] = clockInTime.split(':').map(Number);
        
        const shiftStartMins = shHour * 60 + shMin;
        const clockInMins = inHour * 60 + inMin;
        
        if (clockInMins > (shiftStartMins + shift.grace_period_minutes)) {
          recordStatus = 'Late';
        }
      }
      
      if (activeHours < 4.0 && clockOutTime) {
        recordStatus = 'Half Day';
      }
      
      if (clockInLocationStatus === 'Location Not Verified') {
        recordStatus = 'Location Not Verified';
      }

      const { data: existing } = await supabase.from('attendance_logs').select('id').eq('employee_id', employeeId).eq('date', date);
      if (existing && existing.length > 0) {
        return res.status(400).json({ message: 'An attendance record already exists for this employee on this date.' });
      }

      const { data: inserted, error } = await supabase.from('attendance_logs').insert([{
        employee_id: employeeId,
        date,
        clock_in_time: clockInTime,
        clock_out_time: clockOutTime || null,
        clock_in_ip: 'admin added',
        clock_out_ip: clockOutTime ? 'admin added' : null,
        clock_in_location_status: clockInLocationStatus || 'Verified-Inside',
        clock_out_location_status: clockOutLocationStatus || 'Verified-Inside',
        total_hours: activeHours,
        status: recordStatus
      }]).select();

      if (error) throw error;
      
      await logAudit(req, 'ADMIN_ADD_ATTENDANCE', `attendance_logs/${inserted[0].id}`, null, inserted[0]);
      res.status(201).json({ message: 'Attendance record manually added successfully.', log: inserted[0] });
    } catch (err) {
      console.error('adminAddAttendance Error:', err.message);
      res.status(500).json({ message: 'Error adding attendance record.' });
    }
  },

  // Edit manual or employee attendance (Admin)
  adminUpdateAttendance: async (req, res) => {
    const { id } = req.params;
    const { clockInTime, clockOutTime, clockInLocationStatus, clockOutLocationStatus } = req.body;
    try {
      const { data: oldData } = await supabase.from('attendance_logs').select('*').eq('id', id);
      if (!oldData || oldData.length === 0) {
        return res.status(404).json({ message: 'Attendance record not found.' });
      }
      const oldRecord = oldData[0];
      
      let activeHours = 0.00;
      if (clockInTime && clockOutTime) {
        const [inH, inM] = clockInTime.split(':').map(Number);
        const [outH, outM] = clockOutTime.split(':').map(Number);
        activeHours = parseFloat((((outH * 60 + outM) - (inH * 60 + inM)) / 60).toFixed(2));
      }
      
      const { data: assignments } = await supabase
        .from('employee_shift_assignments')
        .select('shifts(*)')
        .eq('employee_id', oldRecord.employee_id)
        .or(`end_date.is.null,end_date.gte.${oldRecord.date}`)
        .limit(1);
        
      let recordStatus = 'Present';
      if (assignments && assignments.length > 0 && assignments[0].shifts) {
        const shift = assignments[0].shifts;
        const [shHour, shMin] = shift.start_time.split(':').map(Number);
        const [inHour, inMin] = clockInTime.split(':').map(Number);
        
        const shiftStartMins = shHour * 60 + shMin;
        const clockInMins = inHour * 60 + inMin;
        
        if (clockInMins > (shiftStartMins + shift.grace_period_minutes)) {
          recordStatus = 'Late';
        }
      }
      
      if (activeHours < 4.0 && clockOutTime) {
        recordStatus = 'Half Day';
      }
      
      if (clockInLocationStatus === 'Location Not Verified') {
        recordStatus = 'Location Not Verified';
      }
      
      const inIp = oldRecord.clock_in_ip === 'admin added' ? 'admin added' : 'admin updated';
      const outIp = clockOutTime ? (oldRecord.clock_out_ip === 'admin added' ? 'admin added' : 'admin updated') : null;

      const { data: updated, error } = await supabase.from('attendance_logs').update({
        clock_in_time: clockInTime,
        clock_out_time: clockOutTime || null,
        clock_in_ip: inIp,
        clock_out_ip: outIp,
        clock_in_location_status: clockInLocationStatus,
        clock_out_location_status: clockOutLocationStatus || null,
        total_hours: activeHours,
        status: recordStatus
      }).eq('id', id).select();

      if (error) throw error;
      
      await logAudit(req, 'ADMIN_UPDATE_ATTENDANCE', `attendance_logs/${id}`, oldRecord, updated[0]);
      res.json({ message: 'Attendance record modified successfully.', log: updated[0] });
    } catch (err) {
      console.error('adminUpdateAttendance Error:', err.message);
      res.status(500).json({ message: 'Error modifying attendance record.' });
    }
  },

  // Monthly detailed attendance summary (Admin Reports)
  getMonthlyAttendanceSummary: async (req, res) => {
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
      let empQuery = supabase.from('employees').select('id, employee_id, full_name, departments(name)').eq('status', 'Active').is('deleted_at', null);
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
      const { data: allBalances } = await supabase.from('leave_balances').select('*, leave_types(code)').eq('year', y);

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
      
      const summaryList = [];
      
      for (const emp of employees) {
        let presentDays = 0;
        let lateDays = 0;
        let halfDays = 0;
        let absentDays = 0;
        let clTaken = 0;
        let slTaken = 0;
        let elTaken = 0;
        let lopTaken = 0;
        let holidayWorkDays = 0;
        
        let geofenceInCount = 0;
        let geofenceOutCount = 0;
        let outsideInCount = 0;
        let outsideOutCount = 0;
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
          
        const dailyDetailList = [];
        let calendarWorkingDays = 0;

        for (let day = 1; day <= daysInMonth; day++) {
          const dateObj = new Date(y, m - 1, day);
          const dateStr = dateObj.toISOString().split('T')[0];
          const dayOfWeek = dateObj.getDay();
          
          const log = empLogsMap[dateStr];
          const isWeekend = (dayOfWeek === 0);
          const isHoliday = !!holidaysSet[dateStr] || isWeekend;
          
          let dayStatus = 'Absent';
          
          if (!isHoliday) {
            calendarWorkingDays++;
          }

          if (log) {
            totalHours += parseFloat(log.total_hours || 0);
            if (log.clock_in_location_status === 'Verified-Inside') geofenceInCount++;
            if (log.clock_in_location_status === 'Verified-Outside') outsideInCount++;
            if (log.clock_out_location_status === 'Verified-Inside') geofenceOutCount++;
            if (log.clock_out_location_status === 'Verified-Outside') outsideOutCount++;

            if (isHoliday) {
              holidayWorkDays++;
              dayStatus = 'Holiday Work';
            } else {
              if (log.status === 'Leave') {
                const leaveCode = empLeavesMap[dateStr] || 'LOP';
                if (leaveCode === 'CL') clTaken++;
                else if (leaveCode === 'SL') slTaken++;
                else if (leaveCode === 'EL') elTaken++;
                else lopTaken++;
                dayStatus = `Leave (${leaveCode})`;
              } else {
                presentDays++;
                if (log.status === 'Late') lateDays++;
                if (log.status === 'Half Day') halfDays++;
                dayStatus = log.status;
              }
            }
          } else {
            if (isHoliday) {
              dayStatus = 'Paid rest day';
            } else {
              const leaveCode = empLeavesMap[dateStr];
              if (leaveCode) {
                if (leaveCode === 'CL') clTaken++;
                else if (leaveCode === 'SL') slTaken++;
                else if (leaveCode === 'EL') elTaken++;
                else lopTaken++;
                dayStatus = `Leave (${leaveCode})`;
              } else {
                absentDays++;
                dayStatus = 'Absent';
              }
            }
          }
          
          dailyDetailList.push({
            date: dateStr,
            dayName: dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
            isHoliday,
            clockIn: log ? log.clock_in_time : null,
            clockOut: log ? log.clock_out_time : null,
            geofenceIn: log ? log.clock_in_location_status : null,
            geofenceOut: log ? log.clock_out_location_status : null,
            hours: log ? log.total_hours : 0,
            status: dayStatus,
            clock_in_ip: log ? log.clock_in_ip : null,
            clock_out_ip: log ? log.clock_out_ip : null
          });
        }
        
        const empBalances = (allBalances || []).filter(b => b.employee_id === emp.id);
        const clBal = empBalances.find(b => b.leave_types?.code === 'CL');
        const slBal = empBalances.find(b => b.leave_types?.code === 'SL');
        const elBal = empBalances.find(b => b.leave_types?.code === 'EL');
        
        summaryList.push({
          employee_id_val: emp.id,
          employee_id: emp.employee_id,
          full_name: emp.full_name,
          department_name: emp.departments ? emp.departments.name : 'Unassigned',
          total_calendar_days: daysInMonth,
          total_working_days: calendarWorkingDays,
          days_present: presentDays,
          days_late: lateDays,
          days_half_day: halfDays,
          days_absent: absentDays,
          cl_taken: clTaken,
          sl_taken: slTaken,
          el_taken: elTaken,
          lop_taken: lopTaken,
          holiday_work_days: holidayWorkDays,
          total_hours: parseFloat(totalHours.toFixed(2)),
          total_geofence_in_out: geofenceInCount + geofenceOutCount,
          total_outside_in_out: outsideInCount + outsideOutCount,
          balances: {
            CL: clBal ? (clBal.total_days - clBal.availed_days - clBal.pending_days) : 0,
            SL: slBal ? (slBal.total_days - slBal.availed_days - slBal.pending_days) : 0,
            EL: elBal ? (elBal.total_days - elBal.availed_days - elBal.pending_days) : 0
          },
          details: dailyDetailList
        });
      }
      
      res.json(summaryList);
    } catch (err) {
      console.error('getMonthlyAttendanceSummary Error:', err.message);
      res.status(500).json({ message: 'Error calculating attendance summary.' });
    }
  }
};

module.exports = attendanceController;
