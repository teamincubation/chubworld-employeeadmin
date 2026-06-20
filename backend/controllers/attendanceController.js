const supabase = require('../config/db');
const { logAudit } = require('../utils/auditLogger');

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

      if (!logs || logs.length === 0) {
        return res.json({ status: 'not_clocked_in', shift });
      }

      const record = logs[0];
      if (!record.clock_out_time) {
        return res.json({ status: 'clocked_in', record, shift });
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
  }
};

module.exports = attendanceController;
