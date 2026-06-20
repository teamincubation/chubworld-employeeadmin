const db = require('../config/db');
const { logAudit } = require('../utils/auditLogger');

/**
 * Get current time in IST (Asia/Kolkata)
 */
function getISTDate() {
  const now = new Date();
  // IST offset is UTC+5.5 hours = 330 minutes
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
  // Check Today's status (for active employee rendering)
  getTodayStatus: async (req, res) => {
    const employeeId = req.user.employeeId;
    if (!employeeId) {
      return res.status(400).json({ message: 'User is not mapped to an active employee record.' });
    }

    try {
      const todayStr = getISTDateString();
      const logs = await db.query('SELECT * FROM attendance_logs WHERE employee_id = ? AND date = ?', [employeeId, todayStr]);
      
      // Fetch shift assignment
      const shifts = await db.query(`
        SELECT s.* 
        FROM employee_shift_assignments esa
        JOIN shifts s ON esa.shift_id = s.id
        WHERE esa.employee_id = ? AND (esa.end_date IS NULL OR esa.end_date >= ?)
        LIMIT 1
      `, [employeeId, todayStr]);

      const shift = shifts.length > 0 ? shifts[0] : null;

      if (logs.length === 0) {
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
      const existing = await db.query('SELECT id FROM attendance_logs WHERE employee_id = ? AND date = ?', [employeeId, todayStr]);
      if (existing.length > 0) {
        return res.status(400).json({ message: 'You have already clocked in for today.' });
      }

      // Fetch employee's office location preferences
      const empDetails = await db.query(`
        SELECT e.work_location_id, wl.latitude AS office_lat, wl.longitude AS office_lon, 
               wl.radius_meters, wl.allow_without_location, wl.name AS office_name
        FROM employees e
        LEFT JOIN work_locations wl ON e.work_location_id = wl.id
        WHERE e.id = ?
      `, [employeeId]);

      if (empDetails.length === 0) {
        return res.status(404).json({ message: 'Employee record not found.' });
      }

      const emp = empDetails[0];
      let locationStatus = 'Location Not Verified';

      if (emp.work_location_id) {
        if (latitude && longitude) {
          const distance = calculateDistance(latitude, longitude, emp.office_lat, emp.office_lon);
          if (distance <= emp.radius_meters) {
            locationStatus = 'Verified-Inside';
          } else {
            locationStatus = 'Verified-Outside';
          }
        } else {
          // No coordinates received
          if (!emp.allow_without_location) {
            return res.status(400).json({ 
              message: 'Clock-in blocked: Sharing your GPS location is mandatory for this work site.' 
            });
          }
        }
      }

      // Fetch employee's shift to compute shift grace period and late marks
      const shifts = await db.query(`
        SELECT s.* 
        FROM employee_shift_assignments esa
        JOIN shifts s ON esa.shift_id = s.id
        WHERE esa.employee_id = ? AND (esa.end_date IS NULL OR esa.end_date >= ?)
        LIMIT 1
      `, [employeeId, todayStr]);

      let recordStatus = 'Present';
      if (shifts.length > 0) {
        const shift = shifts[0];
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
      await db.query(`
        INSERT INTO attendance_logs (
          employee_id, date, clock_in_time, 
          clock_in_latitude, clock_in_longitude, clock_in_accuracy, 
          clock_in_ip, clock_in_user_agent, clock_in_location_status, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        employeeId, todayStr, nowTimeStr,
        latitude || null, longitude || null, accuracy || null,
        ip, userAgent, locationStatus, recordStatus
      ]);

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

      // Verify clock-in exists
      const existing = await db.query('SELECT * FROM attendance_logs WHERE employee_id = ? AND date = ?', [employeeId, todayStr]);
      if (existing.length === 0) {
        return res.status(400).json({ message: 'You have not clocked in for today yet.' });
      }

      const logRecord = existing[0];
      if (logRecord.clock_out_time) {
        return res.status(400).json({ message: 'You have already clocked out for today.' });
      }

      // Validate location status
      const empDetails = await db.query(`
        SELECT e.work_location_id, wl.latitude AS office_lat, wl.longitude AS office_lon, 
               wl.radius_meters, wl.allow_without_location
        FROM employees e
        LEFT JOIN work_locations wl ON e.work_location_id = wl.id
        WHERE e.id = ?
      `, [employeeId]);

      const emp = empDetails[0];
      let locationStatus = 'Location Not Verified';

      if (emp.work_location_id) {
        if (latitude && longitude) {
          const distance = calculateDistance(latitude, longitude, emp.office_lat, emp.office_lon);
          if (distance <= emp.radius_meters) {
            locationStatus = 'Verified-Inside';
          } else {
            locationStatus = 'Verified-Outside';
          }
        } else {
          if (!emp.allow_without_location) {
            return res.status(400).json({ 
              message: 'Clock-out blocked: Sharing your GPS location is mandatory for this work site.' 
            });
          }
        }
      }

      // Calculate total active hours worked
      const [inH, inM, inS] = logRecord.clock_in_time.split(':').map(Number);
      const [outH, outM, outS] = nowTimeStr.split(':').map(Number);

      const inTotalSecs = inH * 3600 + inM * 60 + inS;
      const outTotalSecs = outH * 3600 + outM * 60 + outS;
      const activeHours = parseFloat(((outTotalSecs - inTotalSecs) / 3600).toFixed(2));

      // Decide status (e.g. Half Day if worked < 4 hours)
      let finalStatus = logRecord.status;
      if (activeHours < 4.0 && finalStatus !== 'Location Not Verified') {
        finalStatus = 'Half Day';
      }

      await db.query(`
        UPDATE attendance_logs SET
          clock_out_time = ?, 
          clock_out_latitude = ?, clock_out_longitude = ?, clock_out_accuracy = ?,
          clock_out_ip = ?, clock_out_user_agent = ?, clock_out_location_status = ?,
          total_hours = ?, status = ?
        WHERE id = ?
      `, [
        nowTimeStr,
        latitude || null, longitude || null, accuracy || null,
        ip, userAgent, locationStatus,
        activeHours, finalStatus,
        logRecord.id
      ]);

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
      // Find matching attendance record if any
      const existing = await db.query('SELECT id FROM attendance_logs WHERE employee_id = ? AND date = ?', [employeeId, date]);
      const logId = existing.length > 0 ? existing[0].id : null;

      // Ensure no active pending request for same date
      const pending = await db.query('SELECT id FROM attendance_corrections WHERE employee_id = ? AND date = ? AND status = "Pending"', [employeeId, date]);
      if (pending.length > 0) {
        return res.status(400).json({ message: 'You already have a pending correction request for this date.' });
      }

      await db.query(`
        INSERT INTO attendance_corrections (
          attendance_log_id, employee_id, date, requested_clock_in, requested_clock_out, reason, status
        ) VALUES (?, ?, ?, ?, ?, ?, 'Pending')
      `, [logId, employeeId, date, requestedClockIn || null, requestedClockOut || null, reason]);

      res.json({ message: 'Correction request submitted to manager review.' });
    } catch (err) {
      console.error('Submit Correction Error:', err.message);
      res.status(500).json({ message: 'Error submitting correction request.' });
    }
  },

  // List Correction requests (Admin / HR)
  listCorrections: async (req, res) => {
    try {
      const list = await db.query(`
        SELECT ac.*, e.employee_id, e.full_name, d.name AS department_name
        FROM attendance_corrections ac
        JOIN employees e ON ac.employee_id = e.id
        LEFT JOIN departments d ON e.department_id = d.id
        ORDER BY ac.id DESC
      `);
      res.json(list);
    } catch (err) {
      console.error('List Corrections Error:', err.message);
      res.status(500).json({ message: 'Error fetching correction log.' });
    }
  },

  // Approve / Reject Correction Request (Admin / HR)
  approveCorrection: async (req, res) => {
    const { correctionId } = req.params;
    const { status, remarks } = req.body; // status: Approved or Rejected

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be Approved or Rejected.' });
    }

    try {
      const corrections = await db.query('SELECT * FROM attendance_corrections WHERE id = ?', [correctionId]);
      if (corrections.length === 0) {
        return res.status(404).json({ message: 'Correction request not found.' });
      }

      const corr = corrections[0];
      if (corr.status !== 'Pending') {
        return res.status(400).json({ message: 'This request has already been processed.' });
      }

      // Update correction status
      await db.query(`
        UPDATE attendance_corrections SET
          status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP, remarks = ?
        WHERE id = ?
      `, [status, req.user.id, remarks || null, correctionId]);

      // If approved, update or insert attendance logs
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
        if (activeHours < 4.0) {
          recordStatus = 'Half Day';
        }

        if (corr.attendance_log_id) {
          // Update existing log
          await db.query(`
            UPDATE attendance_logs SET
              clock_in_time = COALESCE(?, clock_in_time),
              clock_out_time = COALESCE(?, clock_out_time),
              total_hours = ?,
              status = ?,
              clock_in_location_status = 'Verified-Inside', -- Overwrite as verified due to correction
              clock_out_location_status = 'Verified-Inside'
            WHERE id = ?
          `, [checkIn, checkOut, activeHours, recordStatus, corr.attendance_log_id]);
        } else {
          // Create new log record
          await db.query(`
            INSERT INTO attendance_logs (
              employee_id, date, clock_in_time, clock_out_time, 
              clock_in_location_status, clock_out_location_status, total_hours, status
            ) VALUES (?, ?, ?, ?, 'Verified-Inside', 'Verified-Inside', ?, ?)
          `, [corr.employee_id, corr.date, checkIn || '09:00:00', checkOut, activeHours, recordStatus]);
        }
      }

      // Record Audit trail
      await logAudit(req, `ATTENDANCE_CORRECTION_${status.toUpperCase()}`, `attendance_corrections/${correctionId}`, corr, { status, remarks });

      res.json({ message: `Correction request has been ${status.toLowerCase()} successfully.` });
    } catch (err) {
      console.error('Approve Correction Error:', err.message);
      res.status(500).json({ message: 'Error applying correction.' });
    }
  },

  // Fetch Attendance Logs for ESS (Employee personal log)
  getEmployeeLogs: async (req, res) => {
    const employeeId = req.user.employeeId;
    if (!employeeId) {
      return res.status(400).json({ message: 'No mapped employee record.' });
    }

    try {
      const logs = await db.query(`
        SELECT * FROM attendance_logs 
        WHERE employee_id = ? 
        ORDER BY date DESC 
        LIMIT 90
      `, [employeeId]);
      res.json(logs);
    } catch (err) {
      console.error('GetEmployeeLogs Error:', err.message);
      res.status(500).json({ message: 'Error retrieving your attendance history.' });
    }
  },

  // Fetch Admin Attendance Logs (with date filter, department filter)
  getAdminLogs: async (req, res) => {
    const { fromDate, toDate, departmentId } = req.query;

    let query = `
      SELECT al.*, e.employee_id, e.full_name, d.name AS department_name
      FROM attendance_logs al
      JOIN employees e ON al.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (fromDate && toDate) {
      query += ` AND al.date BETWEEN ? AND ?`;
      params.push(fromDate, toDate);
    } else {
      // Default to last 30 days
      query += ` AND al.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`;
    }

    if (departmentId) {
      query += ` AND e.department_id = ?`;
      params.push(departmentId);
    }

    query += ` ORDER BY al.date DESC, al.clock_in_time DESC`;

    try {
      const logs = await db.query(query, params);
      res.json(logs);
    } catch (err) {
      console.error('GetAdminLogs Error:', err.message);
      res.status(500).json({ message: 'Error retrieving employee logs.' });
    }
  }
};

module.exports = attendanceController;
