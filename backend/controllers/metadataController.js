const supabase = require('../config/db');
const { logAudit } = require('../utils/auditLogger');
const https = require('https');

/**
 * Robust HTTP GET requester using built-in https module for maximum compatibility
 */
function fetchJsonHttps(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

const metadataController = {
  // Indian PIN Code Resolver Proxy
  fetchPincode: async (req, res) => {
    const { pincode } = req.params;
    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({ message: 'Invalid Indian PIN code format. Must be exactly 6 digits.' });
    }

    const apiUrl = `https://api.postalpincode.in/pincode/${pincode}`;

    try {
      let data;
      if (typeof fetch === 'function') {
        const response = await fetch(apiUrl);
        data = await response.json();
      } else {
        data = await fetchJsonHttps(apiUrl);
      }

      if (data && data[0] && data[0].Status === 'Success') {
        const postOffices = data[0].PostOffice;
        const details = {
          success: true,
          country: 'India',
          state: postOffices[0].State,
          district: postOffices[0].District,
          postOffices: postOffices.map(po => po.Name)
        };

        await logAudit(req, 'PINCODE_RESOLVE', `pincode/${pincode}`, null, { state: details.state, district: details.district });

        return res.json(details);
      }

      res.status(404).json({ message: 'No address details found for the entered PIN code.' });
    } catch (err) {
      console.error('PIN Code Resolver Error:', err.message);
      res.status(500).json({ message: 'PIN Code service temporarily unavailable. Please enter details manually.' });
    }
  },

  // 1. Departments CRUD
  listDepartments: async (req, res) => {
    try {
      const { data: list, error } = await supabase.from('departments').select('*').order('name', { ascending: true });
      if (error) throw error;
      res.json(list || []);
    } catch (err) {
      res.status(500).json({ message: 'Error retrieving departments.' });
    }
  },

  createDepartment: async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Department name is required.' });

    try {
      const { data: result, error } = await supabase.from('departments').insert([{ name }]).select('id').single();
      if (error) throw error;

      await logAudit(req, 'CREATE_DEPARTMENT', `departments/${result.id}`, null, { name });
      res.status(201).json({ message: 'Department created.', id: result.id });
    } catch (err) {
      res.status(500).json({ message: 'Department already exists or server error.' });
    }
  },

  deleteDepartment: async (req, res) => {
    const { id } = req.params;
    try {
      const { error } = await supabase.from('departments').delete().eq('id', id);
      if (error) throw error;

      await logAudit(req, 'DELETE_DEPARTMENT', `departments/${id}`);
      res.json({ message: 'Department deleted.' });
    } catch (err) {
      res.status(400).json({ message: 'Cannot delete department. Employees are currently assigned to it.' });
    }
  },

  // 2. Designations CRUD
  listDesignations: async (req, res) => {
    try {
      const { data: list, error } = await supabase.from('designations').select('*').order('name', { ascending: true });
      if (error) throw error;
      res.json(list || []);
    } catch (err) {
      res.status(500).json({ message: 'Error retrieving designations.' });
    }
  },

  createDesignation: async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Designation name is required.' });

    try {
      const { data: result, error } = await supabase.from('designations').insert([{ name }]).select('id').single();
      if (error) throw error;

      await logAudit(req, 'CREATE_DESIGNATION', `designations/${result.id}`, null, { name });
      res.status(201).json({ message: 'Designation created.', id: result.id });
    } catch (err) {
      res.status(500).json({ message: 'Designation already exists or server error.' });
    }
  },

  deleteDesignation: async (req, res) => {
    const { id } = req.params;
    try {
      const { error } = await supabase.from('designations').delete().eq('id', id);
      if (error) throw error;

      await logAudit(req, 'DELETE_DESIGNATION', `designations/${id}`);
      res.json({ message: 'Designation deleted.' });
    } catch (err) {
      res.status(400).json({ message: 'Cannot delete designation. Employees are currently assigned to it.' });
    }
  },

  // 3. Work Locations CRUD
  listWorkLocations: async (req, res) => {
    try {
      const { data: list, error } = await supabase.from('work_locations').select('*').order('name', { ascending: true });
      if (error) throw error;
      res.json(list || []);
    } catch (err) {
      res.status(500).json({ message: 'Error retrieving locations.' });
    }
  },

  createWorkLocation: async (req, res) => {
    const { name, latitude, longitude, radiusMeters, allowWithoutLocation } = req.body;
    if (!name || !latitude || !longitude) {
      return res.status(400).json({ message: 'Name, latitude and longitude coordinates are required.' });
    }

    try {
      const { data: result, error } = await supabase.from('work_locations').insert([{
        name, latitude, longitude, radius_meters: radiusMeters || 100, allow_without_location: allowWithoutLocation ? true : false
      }]).select('id').single();
      
      if (error) throw error;

      await logAudit(req, 'CREATE_WORK_LOCATION', `work_locations/${result.id}`, null, { name, latitude, longitude, radiusMeters });
      res.status(201).json({ message: 'Work location configured.', id: result.id });
    } catch (err) {
      res.status(500).json({ message: 'Error setting up work location.' });
    }
  },

  updateWorkLocation: async (req, res) => {
    const { id } = req.params;
    const { name, latitude, longitude, radiusMeters, allowWithoutLocation } = req.body;

    try {
      const { data: old } = await supabase.from('work_locations').select('*').eq('id', id);
      
      const { error } = await supabase.from('work_locations').update({
        name, latitude, longitude, radius_meters: radiusMeters, allow_without_location: allowWithoutLocation ? true : false
      }).eq('id', id);

      if (error) throw error;

      await logAudit(req, 'UPDATE_WORK_LOCATION', `work_locations/${id}`, old[0], { name, latitude, longitude, radiusMeters });
      res.json({ message: 'Work location details updated.' });
    } catch (err) {
      res.status(500).json({ message: 'Error updating work location settings.' });
    }
  },

  deleteWorkLocation: async (req, res) => {
    const { id } = req.params;
    try {
      const { error } = await supabase.from('work_locations').delete().eq('id', id);
      if (error) throw error;

      await logAudit(req, 'DELETE_WORK_LOCATION', `work_locations/${id}`);
      res.json({ message: 'Work location deleted.' });
    } catch (err) {
      res.status(400).json({ message: 'Cannot delete work location. It is currently linked to employees.' });
    }
  },

  // 4. Shifts CRUD
  listShifts: async (req, res) => {
    try {
      const { data: list, error } = await supabase.from('shifts').select('*').order('name', { ascending: true });
      if (error) throw error;
      res.json(list || []);
    } catch (err) {
      res.status(500).json({ message: 'Error retrieving shifts.' });
    }
  },

  createShift: async (req, res) => {
    const { name, startTime, endTime, gracePeriodMinutes } = req.body;
    if (!name || !startTime || !endTime) {
      return res.status(400).json({ message: 'Name, start time and end time are required.' });
    }

    try {
      const { data: result, error } = await supabase.from('shifts').insert([{
        name, start_time: startTime, end_time: endTime, grace_period_minutes: gracePeriodMinutes || 15
      }]).select('id').single();

      if (error) throw error;

      await logAudit(req, 'CREATE_SHIFT', `shifts/${result.id}`, null, { name, startTime, endTime });
      res.status(201).json({ message: 'Shift created successfully.', id: result.id });
    } catch (err) {
      res.status(500).json({ message: 'Shift already exists or configuration error.' });
    }
  },

  deleteShift: async (req, res) => {
    const { id } = req.params;
    try {
      const { error } = await supabase.from('shifts').delete().eq('id', id);
      if (error) throw error;

      await logAudit(req, 'DELETE_SHIFT', `shifts/${id}`);
      res.json({ message: 'Shift configuration deleted.' });
    } catch (err) {
      res.status(400).json({ message: 'Cannot delete shift. Employees are currently assigned to it.' });
    }
  },

  // Assign shift
  assignEmployeeShift: async (req, res) => {
    const { employeeId, shiftId, startDate, endDate } = req.body;
    if (!employeeId || !shiftId || !startDate) {
      return res.status(400).json({ message: 'Employee, shift and start date are required.' });
    }

    try {
      const prevDate = new Date(startDate);
      prevDate.setDate(prevDate.getDate() - 1);
      const prevDateStr = prevDate.toISOString().split('T')[0];

      await supabase.from('employee_shift_assignments').update({ end_date: prevDateStr }).eq('employee_id', employeeId).is('end_date', null);

      const { error } = await supabase.from('employee_shift_assignments').insert([{
        employee_id: employeeId, shift_id: shiftId, start_date: startDate, end_date: endDate || null
      }]);

      if (error) throw error;

      await logAudit(req, 'ASSIGN_SHIFT', `employees/${employeeId}/shift`, null, { shiftId, startDate });
      res.json({ message: 'Employee shift assignment completed.' });
    } catch (err) {
      console.error('AssignShift Error:', err.message);
      res.status(500).json({ message: 'Error assigning shift.' });
    }
  }
};

module.exports = metadataController;
