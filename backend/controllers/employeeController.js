const db = require('../config/db');
const { encrypt, decrypt, maskValue } = require('../utils/cryptoHelper');
const { logAudit } = require('../utils/auditLogger');
const fs = require('fs');
const path = require('path');

const employeeController = {
  // Create New Employee (Onboarding wizard step 1)
  createEmployee: async (req, res) => {
    const {
      full_name, mobile, email, employee_id, department_id, designation_id,
      current_address, permanent_address, pincode, country, state, district, post_office,
      interviewed_hrs, interviewed_date, appointed_date, contract_till_date,
      dob, gender, blood_group, marital_status, nationality, citizenship_status,
      emergency_contact_name, emergency_contact_number, alt_mobile, alt_email,
      reporting_manager_id, work_location_id, employment_type, joining_salary,
      probation_period_days, confirmation_date, onboarding_status,
      // KYC fields
      aadhaar_number, pan_number, bank_account_number, bank_name, bank_ifsc, upi_id
    } = req.body;

    if (!full_name || !mobile || !email || !employee_id || !pincode) {
      return res.status(400).json({ message: 'Full name, mobile, email, employee ID, and PIN code are required.' });
    }

    try {
      // Check if employee_id already exists
      const existing = await db.query('SELECT id FROM employees WHERE employee_id = ? OR email = ?', [employee_id, email]);
      if (existing.length > 0) {
        return res.status(400).json({ message: 'Employee ID or Email already exists in the register.' });
      }

      // Insert employee record
      const result = await db.query(`
        INSERT INTO employees (
          employee_id, full_name, mobile, email, department_id, designation_id,
          current_address, permanent_address, pincode, country, state, district, post_office,
          interviewed_hrs, interviewed_date, appointed_date, contract_till_date,
          dob, gender, blood_group, marital_status, nationality, citizenship_status,
          emergency_contact_name, emergency_contact_number, alt_mobile, alt_email,
          reporting_manager_id, work_location_id, employment_type, joining_salary,
          probation_period_days, confirmation_date, onboarding_status, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')
      `, [
        employee_id, full_name, mobile, email, department_id || null, designation_id || null,
        current_address || null, permanent_address || null, pincode, country || 'India', state || null, district || null, post_office || null,
        interviewed_hrs || null, interviewed_date || null, appointed_date || null, contract_till_date || null,
        dob || null, gender || null, blood_group || null, marital_status || null, nationality || 'Indian', citizenship_status || 'Citizen',
        emergency_contact_name || null, emergency_contact_number || null, alt_mobile || null, alt_email || null,
        reporting_manager_id || null, work_location_id || null, employment_type || 'Full-time', joining_salary || 0.00,
        probation_period_days || 180, confirmation_date || null, onboarding_status || 'Draft'
      ]);

      const newEmployeeId = result.insertId;

      // Handle KYC Data (Encrypt if provided)
      const encryptedAadhaar = aadhaar_number ? encrypt(aadhaar_number.replace(/\s/g, '')) : null;
      const encryptedPan = pan_number ? encrypt(pan_number.toUpperCase()) : null;
      const encryptedBank = bank_account_number ? encrypt(bank_account_number) : null;

      await db.query(`
        INSERT INTO employee_kyc (
          employee_id, aadhaar_number_encrypted, pan_number_encrypted, 
          bank_account_number_encrypted, bank_name, bank_ifsc, upi_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        newEmployeeId, encryptedAadhaar, encryptedPan, encryptedBank, 
        bank_name || null, bank_ifsc || null, upi_id || null
      ]);

      // If onboarding status is Completed/Approved, check if we need to create login user credentials
      if (onboarding_status === 'Approved' || onboarding_status === 'Onboarding Completed') {
        await employeeController.autoCreateUserAccount(newEmployeeId, email, full_name);
      }

      // Log Audit Trail
      await logAudit(req, 'CREATE_EMPLOYEE', `employees/${newEmployeeId}`, null, { id: newEmployeeId, employee_id, full_name });

      res.status(201).json({ message: 'Employee onboarding profile initialized successfully.', employeeId: newEmployeeId });
    } catch (err) {
      console.error('Create Employee Error:', err.message);
      res.status(500).json({ message: 'Internal server error while creating employee profile.' });
    }
  },

  // Helper to create user account upon onboarding approval
  autoCreateUserAccount: async (employeeId, email, name) => {
    try {
      const existingUser = await db.query('SELECT id FROM users WHERE email = ?', [email]);
      if (existingUser.length > 0) return;

      // Generate default hashed password
      const bcrypt = require('bcryptjs');
      const defaultPassword = 'CHubEmp@2026';
      const salt = await bcrypt.genSalt(10);
      const passHash = await bcrypt.hash(defaultPassword, salt);

      // Default role is Employee (ID 6)
      const userResult = await db.query(`
        INSERT INTO users (email, password_hash, role_id, status, onboarding_completed)
        VALUES (?, ?, 6, 'active', TRUE)
      `, [email, passHash]);

      const newUserId = userResult.insertId;

      // Link employee back to users table
      await db.query('UPDATE employees SET user_id = ? WHERE id = ?', [newUserId, employeeId]);
      
      // Initialize leave balance for 2026
      const leaveTypes = await db.query('SELECT id, max_days FROM leave_types WHERE active = TRUE');
      for (const lt of leaveTypes) {
        await db.query(`
          INSERT INTO leave_balances (employee_id, leave_type_id, total_days, availed_days, pending_days, year)
          VALUES (?, ?, ?, 0.00, 0.00, 2026)
        `, [employeeId, lt.id, lt.max_days]);
      }

      console.log(`Auto User created for employee ID ${employeeId}. Account email: ${email}. Temporary password: ${defaultPassword}`);
    } catch (err) {
      console.error('Auto user registration failed:', err.message);
    }
  },

  // List Employees with advanced searches and filters
  listEmployees: async (req, res) => {
    const { search, departmentId, designationId, employmentType, onboardingStatus, status } = req.query;
    
    let query = `
      SELECT e.id, e.employee_id, e.full_name, e.mobile, e.email, e.onboarding_status, e.status,
             e.employment_type, d.name AS department_name, des.name AS designation_name,
             wl.name AS work_location_name, e.joining_salary
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN work_locations wl ON e.work_location_id = wl.id
      WHERE e.deleted_at IS NULL
    `;

    const params = [];

    if (search) {
      query += ` AND (e.full_name LIKE ? OR e.employee_id LIKE ? OR e.mobile LIKE ? OR e.email LIKE ?)`;
      const searchWild = `%${search}%`;
      params.push(searchWild, searchWild, searchWild, searchWild);
    }

    if (departmentId) {
      query += ` AND e.department_id = ?`;
      params.push(departmentId);
    }

    if (designationId) {
      query += ` AND e.designation_id = ?`;
      params.push(designationId);
    }

    if (employmentType) {
      query += ` AND e.employment_type = ?`;
      params.push(employmentType);
    }

    if (onboardingStatus) {
      query += ` AND e.onboarding_status = ?`;
      params.push(onboardingStatus);
    }

    if (status) {
      query += ` AND e.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY e.id DESC`;

    try {
      const list = await db.query(query, params);

      // Mask sensitive payroll fields for roles that do NOT have payroll:view permission
      const hasPayrollView = req.user && req.user.permissions.includes('payroll:view');
      const sanitizedList = list.map(emp => {
        const copy = { ...emp };
        if (!hasPayrollView) {
          copy.joining_salary = '₹ XXXXX';
        }
        return copy;
      });

      res.json(sanitizedList);
    } catch (err) {
      console.error('List Employees Error:', err.message);
      res.status(500).json({ message: 'Error retrieving employee register.' });
    }
  },

  // Get Employee details by ID (Masks sensitive data by default)
  getEmployeeById: async (req, res) => {
    const { id } = req.params;

    try {
      const employees = await db.query(`
        SELECT e.*, d.name AS department_name, des.name AS designation_name,
               wl.name AS work_location_name, mgr.full_name AS manager_name
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN designations des ON e.designation_id = des.id
        LEFT JOIN work_locations wl ON e.work_location_id = wl.id
        LEFT JOIN employees mgr ON e.reporting_manager_id = mgr.id
        WHERE e.id = ? AND e.deleted_at IS NULL
      `, [id]);

      if (employees.length === 0) {
        return res.status(404).json({ message: 'Employee not found.' });
      }

      const employee = { ...employees[0] };

      // Mask joining salary if not authorized
      const hasPayrollView = req.user && req.user.permissions.includes('payroll:view');
      if (!hasPayrollView) {
        employee.joining_salary = '₹ XXXXX';
      }

      // Fetch documents
      const docs = await db.query('SELECT id, document_type, document_name, uploaded_at FROM employee_documents WHERE employee_id = ?', [id]);
      
      // Fetch KYC (Get masked values only)
      const kycRecords = await db.query('SELECT bank_name, bank_ifsc, upi_id, aadhaar_number_encrypted, pan_number_encrypted, bank_account_number_encrypted FROM employee_kyc WHERE employee_id = ?', [id]);
      
      let kyc = {
        aadhaar: 'XXXX XXXX XXXX',
        pan: 'XXXXX1234X',
        bank_account: 'XXXXXXX',
        bank_name: '',
        bank_ifsc: '',
        upi_id: ''
      };

      if (kycRecords.length > 0) {
        const kRecord = kycRecords[0];
        const plainAadhaar = kRecord.aadhaar_number_encrypted ? decrypt(kRecord.aadhaar_number_encrypted) : '';
        const plainPan = kRecord.pan_number_encrypted ? decrypt(kRecord.pan_number_encrypted) : '';
        const plainBank = kRecord.bank_account_number_encrypted ? decrypt(kRecord.bank_account_number_encrypted) : '';

        kyc = {
          aadhaar: maskValue(plainAadhaar, 'aadhaar'),
          pan: maskValue(plainPan, 'pan'),
          bank_account: maskValue(plainBank, 'bank'),
          bank_name: kRecord.bank_name || '',
          bank_ifsc: kRecord.bank_ifsc || '',
          upi_id: kRecord.upi_id ? maskValue(kRecord.upi_id, 'upi') : ''
        };
      }

      res.json({
        employee,
        kyc,
        documents: docs
      });
    } catch (err) {
      console.error('Get Employee Error:', err.message);
      res.status(500).json({ message: 'Error retrieving employee profile details.' });
    }
  },

  // Fetch fully unmasked sensitive KYC values (Requires strict KYC View permission + logs event)
  getEmployeeKycDecrypted: async (req, res) => {
    const { id } = req.params;

    try {
      const kycRecords = await db.query('SELECT * FROM employee_kyc WHERE employee_id = ?', [id]);
      if (kycRecords.length === 0) {
        return res.status(404).json({ message: 'KYC record not found.' });
      }

      const kRecord = kycRecords[0];
      
      // Decrypt values
      const plainAadhaar = kRecord.aadhaar_number_encrypted ? decrypt(kRecord.aadhaar_number_encrypted) : '';
      const plainPan = kRecord.pan_number_encrypted ? decrypt(kRecord.pan_number_encrypted) : '';
      const plainBank = kRecord.bank_account_number_encrypted ? decrypt(kRecord.bank_account_number_encrypted) : '';

      // Log this access in the immutable audit logs (required by business rule)
      await logAudit(req, 'VIEW_SENSITIVE_KYC', `employees/${id}`, null, { details: 'KYC decrypted fields viewed' });

      res.json({
        aadhaar_number: plainAadhaar,
        pan_number: plainPan,
        bank_account_number: plainBank,
        bank_name: kRecord.bank_name,
        bank_ifsc: kRecord.bank_ifsc,
        upi_id: kRecord.upi_id
      });
    } catch (err) {
      console.error('Decrypted KYC View Error:', err.message);
      res.status(500).json({ message: 'Error decrypting employee KYC records.' });
    }
  },

  // Edit Employee details
  updateEmployee: async (req, res) => {
    const { id } = req.params;
    const {
      full_name, mobile, email, department_id, designation_id,
      current_address, permanent_address, pincode, country, state, district, post_office,
      interviewed_hrs, interviewed_date, appointed_date, contract_till_date,
      dob, gender, blood_group, marital_status, nationality, citizenship_status,
      emergency_contact_name, emergency_contact_number, alt_mobile, alt_email,
      reporting_manager_id, work_location_id, employment_type, joining_salary,
      probation_period_days, confirmation_date, onboarding_status, status,
      // KYC fields
      aadhaar_number, pan_number, bank_account_number, bank_name, bank_ifsc, upi_id
    } = req.body;

    try {
      const current = await db.query('SELECT * FROM employees WHERE id = ?', [id]);
      if (current.length === 0) {
        return res.status(404).json({ message: 'Employee not found.' });
      }

      const oldEmployee = current[0];

      // Update basic fields
      await db.query(`
        UPDATE employees SET
          full_name = ?, mobile = ?, email = ?, department_id = ?, designation_id = ?,
          current_address = ?, permanent_address = ?, pincode = ?, country = ?, state = ?, district = ?, post_office = ?,
          interviewed_hrs = ?, interviewed_date = ?, appointed_date = ?, contract_till_date = ?,
          dob = ?, gender = ?, blood_group = ?, marital_status = ?, nationality = ?, citizenship_status = ?,
          emergency_contact_name = ?, emergency_contact_number = ?, alt_mobile = ?, alt_email = ?,
          reporting_manager_id = ?, work_location_id = ?, employment_type = ?, joining_salary = ?,
          probation_period_days = ?, confirmation_date = ?, onboarding_status = ?, status = ?
        WHERE id = ?
      `, [
        full_name || oldEmployee.full_name, mobile || oldEmployee.mobile, email || oldEmployee.email, 
        department_id || oldEmployee.department_id, designation_id || oldEmployee.designation_id,
        current_address || oldEmployee.current_address, permanent_address || oldEmployee.permanent_address, 
        pincode || oldEmployee.pincode, country || oldEmployee.country, state || oldEmployee.state, 
        district || oldEmployee.district, post_office || oldEmployee.post_office,
        interviewed_hrs || oldEmployee.interviewed_hrs, interviewed_date || oldEmployee.interviewed_date, 
        appointed_date || oldEmployee.appointed_date, contract_till_date || oldEmployee.contract_till_date,
        dob || oldEmployee.dob, gender || oldEmployee.gender, blood_group || oldEmployee.blood_group, 
        marital_status || oldEmployee.marital_status, nationality || oldEmployee.nationality, 
        citizenship_status || oldEmployee.citizenship_status,
        emergency_contact_name || oldEmployee.emergency_contact_name, emergency_contact_number || oldEmployee.emergency_contact_number, 
        alt_mobile || oldEmployee.alt_mobile, alt_email || oldEmployee.alt_email,
        reporting_manager_id || oldEmployee.reporting_manager_id, work_location_id || oldEmployee.work_location_id, 
        employment_type || oldEmployee.employment_type, joining_salary || oldEmployee.joining_salary,
        probation_period_days || oldEmployee.probation_period_days, confirmation_date || oldEmployee.confirmation_date, 
        onboarding_status || oldEmployee.onboarding_status, status || oldEmployee.status,
        id
      ]);

      // Update KYC fields (only override if new values are supplied and aren't masked place-holders)
      const currentKyc = await db.query('SELECT * FROM employee_kyc WHERE employee_id = ?', [id]);
      if (currentKyc.length > 0) {
        let updatedAadhaar = currentKyc[0].aadhaar_number_encrypted;
        let updatedPan = currentKyc[0].pan_number_encrypted;
        let updatedBank = currentKyc[0].bank_account_number_encrypted;

        if (aadhaar_number && !aadhaar_number.includes('XXXX')) {
          updatedAadhaar = encrypt(aadhaar_number.replace(/\s/g, ''));
        }
        if (pan_number && !pan_number.includes('XXXX')) {
          updatedPan = encrypt(pan_number.toUpperCase());
        }
        if (bank_account_number && !bank_account_number.includes('XXXX')) {
          updatedBank = encrypt(bank_account_number);
        }

        await db.query(`
          UPDATE employee_kyc SET
            aadhaar_number_encrypted = ?, pan_number_encrypted = ?, bank_account_number_encrypted = ?,
            bank_name = ?, bank_ifsc = ?, upi_id = ?
          WHERE employee_id = ?
        `, [
          updatedAadhaar, updatedPan, updatedBank,
          bank_name || currentKyc[0].bank_name, bank_ifsc || currentKyc[0].bank_ifsc, 
          upi_id || currentKyc[0].upi_id,
          id
        ]);
      }

      // Check if employee onboarding status was updated to Approved and user login exists
      if ((onboarding_status === 'Approved' || onboarding_status === 'Onboarding Completed') && oldEmployee.onboarding_status !== onboarding_status) {
        await employeeController.autoCreateUserAccount(id, email || oldEmployee.email, full_name || oldEmployee.full_name);
      }

      // Log changes in immutable audit log
      const updated = await db.query('SELECT * FROM employees WHERE id = ?', [id]);
      await logAudit(req, 'EDIT_EMPLOYEE', `employees/${id}`, oldEmployee, updated[0]);

      res.json({ message: 'Employee profile updated successfully.' });
    } catch (err) {
      console.error('Update Employee Error:', err.message);
      res.status(500).json({ message: 'Error saving changes to employee register.' });
    }
  },

  // Soft Delete Employee
  deleteEmployee: async (req, res) => {
    const { id } = req.params;

    try {
      const employee = await db.query('SELECT * FROM employees WHERE id = ?', [id]);
      if (employee.length === 0) {
        return res.status(404).json({ message: 'Employee not found.' });
      }

      // Perform Soft Delete
      await db.query('UPDATE employees SET deleted_at = CURRENT_TIMESTAMP, status = "Inactive" WHERE id = ?', [id]);

      // If user account exists, suspend it
      if (employee[0].user_id) {
        await db.query('UPDATE users SET status = "inactive" WHERE id = ?', [employee[0].user_id]);
      }

      await logAudit(req, 'DELETE_EMPLOYEE', `employees/${id}`, employee[0], { deleted: true });

      res.json({ message: 'Employee profile soft-deleted successfully.' });
    } catch (err) {
      console.error('Delete Employee Error:', err.message);
      res.status(500).json({ message: 'Error deleting employee from system.' });
    }
  },

  // Restore Employee (Super Admin only check inside router)
  restoreEmployee: async (req, res) => {
    const { id } = req.params;

    try {
      const employee = await db.query('SELECT * FROM employees WHERE id = ?', [id]);
      if (employee.length === 0) {
        return res.status(404).json({ message: 'Employee not found.' });
      }

      // Restore record
      await db.query('UPDATE employees SET deleted_at = NULL, status = "Active" WHERE id = ?', [id]);

      // If user account exists, re-activate
      if (employee[0].user_id) {
        await db.query('UPDATE users SET status = "active" WHERE id = ?', [employee[0].user_id]);
      }

      await logAudit(req, 'RESTORE_EMPLOYEE', `employees/${id}`, { deleted: true }, { restored: true });

      res.json({ message: 'Employee profile restored successfully.' });
    } catch (err) {
      console.error('Restore Employee Error:', err.message);
      res.status(500).json({ message: 'Error restoring employee record.' });
    }
  },

  // Fetch lists for managers dropdown
  getEmployeesDropdown: async (req, res) => {
    try {
      const list = await db.query('SELECT id, employee_id, full_name FROM employees WHERE status = "Active" AND deleted_at IS NULL');
      res.json(list);
    } catch (err) {
      console.error('Dropdown retrieve error:', err.message);
      res.status(500).json({ message: 'Error loading choices.' });
    }
  },

  // Document management: Save upload
  uploadDocument: async (req, res) => {
    const { id } = req.params;
    const { documentType } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'No file attachment provided.' });
    }

    try {
      const employee = await db.query('SELECT id, full_name FROM employees WHERE id = ?', [id]);
      if (employee.length === 0) {
        return res.status(404).json({ message: 'Employee not found.' });
      }

      const docName = req.file.originalname;
      const docPath = req.file.path.replace(/\\/g, '/'); // Normalize path
      const docSize = req.file.size;

      await db.query(`
        INSERT INTO employee_documents (employee_id, document_type, document_name, file_path, file_size)
        VALUES (?, ?, ?, ?, ?)
      `, [id, documentType || 'Other', docName, docPath, docSize]);

      await logAudit(req, 'UPLOAD_DOCUMENT', `employees/${id}`, null, { type: documentType, name: docName });

      res.json({ message: 'Document uploaded successfully.' });
    } catch (err) {
      console.error('Document Upload Error:', err.message);
      res.status(500).json({ message: 'Error recording document upload.' });
    }
  },

  // Document management: Delete file
  deleteDocument: async (req, res) => {
    const { docId } = req.params;

    try {
      const docs = await db.query('SELECT * FROM employee_documents WHERE id = ?', [docId]);
      if (docs.length === 0) {
        return res.status(404).json({ message: 'Document record not found.' });
      }

      const doc = docs[0];

      // Delete file from disk
      if (fs.existsSync(doc.file_path)) {
        fs.unlinkSync(doc.file_path);
      }

      // Delete from database
      await db.query('DELETE FROM employee_documents WHERE id = ?', [docId]);

      await logAudit(req, 'DELETE_DOCUMENT', `employees/${doc.employee_id}`, { name: doc.document_name }, null);

      res.json({ message: 'Document deleted successfully.' });
    } catch (err) {
      console.error('Document Delete Error:', err.message);
      res.status(500).json({ message: 'Error deleting document.' });
    }
  }
};

module.exports = employeeController;
