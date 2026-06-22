const supabase = require('../config/db');
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
      probation_period_days, confirmation_date, onboarding_status, login_password,
      // KYC fields
      aadhaar_number, pan_number, bank_account_number, bank_name, bank_ifsc, upi_id
    } = req.body;

    if (!full_name || !mobile || !email || !employee_id || !pincode) {
      return res.status(400).json({ message: 'Full name, mobile, email, employee ID, and PIN code are required.' });
    }

    try {
      // Check if employee_id already exists
      const { data: existing, error: existErr } = await supabase
        .from('employees')
        .select('id')
        .or(`employee_id.eq.${employee_id},email.eq.${email}`);

      if (existing && existing.length > 0) {
        return res.status(400).json({ message: 'Employee ID or Email already exists in the register.' });
      }

      // Insert employee record
      const { data: result, error: insertErr } = await supabase
        .from('employees')
        .insert([{
          employee_id, full_name, mobile, email, department_id: department_id || null, designation_id: designation_id || null,
          current_address: current_address || null, permanent_address: permanent_address || null, pincode, country: country || 'India', state: state || null, district: district || null, post_office: post_office || null,
          interviewed_hrs: interviewed_hrs || null, interviewed_date: interviewed_date || null, appointed_date: appointed_date || null, contract_till_date: contract_till_date || null,
          dob: dob || null, gender: gender || null, blood_group: blood_group || null, marital_status: marital_status || null, nationality: nationality || 'Indian', citizenship_status: citizenship_status || 'Citizen',
          emergency_contact_name: emergency_contact_name || null, emergency_contact_number: emergency_contact_number || null, alt_mobile: alt_mobile || null, alt_email: alt_email || null,
          reporting_manager_id: reporting_manager_id || null, work_location_id: work_location_id || null, employment_type: employment_type || 'Full-time', joining_salary: joining_salary || 0.00,
          probation_period_days: probation_period_days || 180, confirmation_date: confirmation_date || null, onboarding_status: onboarding_status || 'Draft', status: 'Active'
        }])
        .select('id')
        .single();

      if (insertErr) throw insertErr;

      const newEmployeeId = result.id;

      // Handle KYC Data (Encrypt if provided)
      const encryptedAadhaar = aadhaar_number ? encrypt(aadhaar_number.replace(/\s/g, '')) : null;
      const encryptedPan = pan_number ? encrypt(pan_number.toUpperCase()) : null;
      const encryptedBank = bank_account_number ? encrypt(bank_account_number) : null;

      const { error: kycErr } = await supabase
        .from('employee_kyc')
        .insert([{
          employee_id: newEmployeeId, aadhaar_number_encrypted: encryptedAadhaar, pan_number_encrypted: encryptedPan, 
          bank_account_number_encrypted: encryptedBank, bank_name: bank_name || null, bank_ifsc: bank_ifsc || null, upi_id: upi_id || null
        }]);

      if (kycErr) throw kycErr;

      // If onboarding status is Completed/Approved, check if we need to create login user credentials
      if (onboarding_status === 'Approved' || onboarding_status === 'Onboarding Completed') {
        await employeeController.autoCreateUserAccount(newEmployeeId, email, full_name, login_password);
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
  autoCreateUserAccount: async (employeeId, email, name, customPassword) => {
    try {
      const { data: existingUser } = await supabase.from('users').select('id').eq('email', email);
      
      const bcrypt = require('bcryptjs');
      const defaultPassword = customPassword || 'CHubEmp@2026';
      const salt = await bcrypt.genSalt(10);
      const passHash = await bcrypt.hash(defaultPassword, salt);

      if (existingUser && existingUser.length > 0) {
        // If user already exists, update password if customPassword was provided
        if (customPassword) {
          await supabase.from('users').update({ password_hash: passHash }).eq('id', existingUser[0].id);
          console.log(`User password updated for employee ID ${employeeId}.`);
          // Dispatch SMTP Email Notification
          await employeeController.sendOnboardingEmail(email, name, defaultPassword);
        }
        return;
      }

      // Default role is Employee (ID 6)
      const { data: userResult, error: userErr } = await supabase
        .from('users')
        .insert([{ email, password_hash: passHash, role_id: 6, status: 'active', onboarding_completed: true }])
        .select('id')
        .single();

      if (userErr) throw userErr;

      const newUserId = userResult.id;

      // Link employee back to users table
      await supabase.from('employees').update({ user_id: newUserId }).eq('id', employeeId);
      
      // Initialize leave balance for 2026
      const { data: leaveTypes } = await supabase.from('leave_types').select('id, max_days').eq('active', true);
      if (leaveTypes) {
        for (const lt of leaveTypes) {
          await supabase.from('leave_balances').insert([{
            employee_id: employeeId, leave_type_id: lt.id, total_days: lt.max_days, availed_days: 0.00, pending_days: 0.00, year: 2026
          }]);
        }
      }

      console.log(`Auto User created for employee ID ${employeeId}. Account email: ${email}. Password: ${defaultPassword}`);
      
      // Dispatch SMTP Email Notification
      await employeeController.sendOnboardingEmail(email, name, defaultPassword);
    } catch (err) {
      console.error('Auto user registration failed:', err.message);
    }
  },

  // Onboarding Email Dispatcher
  sendOnboardingEmail: async (email, name, password) => {
    const nodemailer = require('nodemailer');
    try {
      // Fetch SMTP settings from system_settings
      const { data: dbSettings } = await supabase.from('system_settings').select('*');
      const settingsMap = {};
      (dbSettings || []).forEach(s => { settingsMap[s.setting_key] = s.setting_value; });

      const smtpHost = settingsMap.smtp_host || process.env.SMTP_HOST || 'smtp.hostinger.com';
      const smtpPort = settingsMap.smtp_port || process.env.SMTP_PORT || '465';
      const smtpUser = settingsMap.smtp_user || process.env.SMTP_USER;
      const smtpPass = settingsMap.smtp_pass || process.env.SMTP_PASS;

      if (!smtpUser || !smtpPass) {
        console.log(`[SMTP] Skipped sending onboarding email because credentials are not configured. Email: ${email}`);
        return;
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort, 10),
        secure: smtpPort === '465',
        auth: {
          user: smtpUser,
          pass: smtpPass
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      const mailOptions = {
        from: `"C-Hub HR Operations" <${smtpUser}>`,
        to: email,
        subject: 'Welcome to C-Hub! Your Employee Portal Credentials',
        html: `
          <div style="font-family: 'Poppins', 'Segoe UI', Arial, sans-serif; background-color: #f7f9fc; padding: 40px 20px; color: #333333;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.05); border: 1px solid #eef2f6;">
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #6a1b9a 0%, #e91e63 100%); padding: 40px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 0.5px;">Welcome to C-Hub!</h1>
                <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1.5px;">Creating Wow World</p>
              </div>
              
              <!-- Body -->
              <div style="padding: 40px 30px;">
                <p style="font-size: 16px; line-height: 1.6; margin-top: 0;">Hello <strong>${name}</strong>,</p>
                <p style="font-size: 15px; line-height: 1.6; color: #555555;">
                  Your employee profile has been set up successfully by the administrator. You can now access your C-Hub Employee Self-Service (ESS) Portal to clock in, request leaves, view reports, and more.
                </p>
                
                <div style="background-color: #f8f4f9; border-left: 4px solid #e91e63; padding: 20px; border-radius: 8px; margin: 30px 0;">
                  <h3 style="margin-top: 0; color: #6a1b9a; font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px;">Your Portal Credentials</h3>
                  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <tr>
                      <td style="padding: 6px 0; color: #777777; width: 100px;"><strong>Portal URL:</strong></td>
                      <td style="padding: 6px 0; color: #333333;"><a href="https://chubworld.adloaf.com" style="color: #e91e63; text-decoration: none; font-weight: 600;">chubworld.adloaf.com</a></td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #777777;"><strong>Email ID:</strong></td>
                      <td style="padding: 6px 0; color: #333333; font-family: monospace; font-size: 15px;"><strong>${email}</strong></td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #777777;"><strong>Password:</strong></td>
                      <td style="padding: 6px 0; color: #333333; font-family: monospace; font-size: 15px;"><strong>${password}</strong></td>
                    </tr>
                  </table>
                </div>

                <div style="text-align: center; margin: 35px 0;">
                  <a href="https://chubworld.adloaf.com" style="background: linear-gradient(135deg, #e91e63 0%, #6a1b9a 100%); color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 30px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 15px rgba(233, 30, 99, 0.3);">
                    Employee Portal Login
                  </a>
                </div>

                <p style="font-size: 13px; line-height: 1.6; color: #888888; background-color: #fafafa; padding: 12px; border-radius: 6px; text-align: center;">
                  🔒 For security purposes, we recommend that you change your password after logging in for the first time.
                </p>
              </div>

              <!-- Footer -->
              <div style="background-color: #f7f9fc; padding: 24px; text-align: center; border-top: 1px solid #eef2f6;">
                <p style="margin: 0; font-size: 12px; color: #9e9e9e;">C-Hub HR Systems & Administrative Portal</p>
              </div>
            </div>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log(`[SMTP] Onboarding email successfully dispatched to ${email}`);
    } catch (err) {
      console.error('[SMTP] Onboarding email dispatch failed:', err.message);
    }
  },

  // List Employees with advanced searches and filters
  listEmployees: async (req, res) => {
    const { search, departmentId, designationId, employmentType, onboardingStatus, status } = req.query;
    
    let query = supabase
      .from('employees')
      .select(`
        id, employee_id, full_name, mobile, email, onboarding_status, status,
        employment_type, joining_salary, contract_till_date,
        departments(name), designations(name), work_locations(name)
      `)
      .is('deleted_at', null)
      .order('id', { ascending: false });

    // Hide Super Admin employee record from other admin views
    if (req.user.roleName !== 'Super Admin') {
      query = query.neq('email', 'chub.admin@adloaf.com');
    }


    if (search) {
      query = query.or(`full_name.ilike.%${search}%,employee_id.ilike.%${search}%,mobile.ilike.%${search}%,email.ilike.%${search}%`);
    }
    if (departmentId) query = query.eq('department_id', departmentId);
    if (designationId) query = query.eq('designation_id', designationId);
    if (employmentType) query = query.eq('employment_type', employmentType);
    if (onboardingStatus) query = query.eq('onboarding_status', onboardingStatus);
    if (status) query = query.eq('status', status);

    try {
      const { data: list, error } = await query;
      if (error) throw error;

      // Mask sensitive payroll fields for roles that do NOT have payroll:view permission
      const hasPayrollView = req.user && req.user.permissions.includes('payroll:view');
      const sanitizedList = list.map(emp => {
        const copy = { 
          ...emp,
          department_name: emp.departments ? emp.departments.name : null,
          designation_name: emp.designations ? emp.designations.name : null,
          work_location_name: emp.work_locations ? emp.work_locations.name : null
        };
        // Remove nested objects
        delete copy.departments;
        delete copy.designations;
        delete copy.work_locations;

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
      const { data: employees, error } = await supabase
        .from('employees')
        .select(`
          *,
          departments(name), designations(name), work_locations(name)
        `)
        .eq('id', id)
        .is('deleted_at', null);

      if (error || !employees || employees.length === 0) {
        return res.status(404).json({ message: 'Employee not found.' });
      }

      const employeeRaw = employees[0];

      // Hide Super Admin profile from non-Super Admins
      if (req.user.roleName !== 'Super Admin' && (employeeRaw.id === 1 || employeeRaw.email === 'chub.admin@adloaf.com')) {
        return res.status(404).json({ message: 'Employee not found.' });
      }


      // Fetch manager separately to avoid complex self-join query errors in Supabase JS
      let manager_name = null;
      if (employeeRaw.reporting_manager_id) {
        const { data: mgr } = await supabase.from('employees').select('full_name').eq('id', employeeRaw.reporting_manager_id);
        if (mgr && mgr.length > 0) manager_name = mgr[0].full_name;
      }

      const employee = { 
        ...employeeRaw,
        department_name: employeeRaw.departments ? employeeRaw.departments.name : null,
        designation_name: employeeRaw.designations ? employeeRaw.designations.name : null,
        work_location_name: employeeRaw.work_locations ? employeeRaw.work_locations.name : null,
        manager_name: manager_name
      };

      delete employee.departments;
      delete employee.designations;
      delete employee.work_locations;

      // Mask joining salary if not authorized
      const hasPayrollView = req.user && req.user.permissions.includes('payroll:view');
      if (!hasPayrollView) {
        employee.joining_salary = '₹ XXXXX';
      }

      // Fetch documents
      const { data: docs } = await supabase.from('employee_documents').select('id, document_type, document_name, uploaded_at').eq('employee_id', id);
      
      // Fetch KYC (Get masked values only)
      const { data: kycRecords } = await supabase.from('employee_kyc').select('bank_name, bank_ifsc, upi_id, aadhaar_number_encrypted, pan_number_encrypted, bank_account_number_encrypted').eq('employee_id', id);
      
      let kyc = {
        aadhaar: 'XXXX XXXX XXXX',
        pan: 'XXXXX1234X',
        bank_account: 'XXXXXXX',
        bank_name: '',
        bank_ifsc: '',
        upi_id: ''
      };

      if (kycRecords && kycRecords.length > 0) {
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
        documents: docs || []
      });
    } catch (err) {
      console.error('Get Employee Error:', err.message);
      res.status(500).json({ message: 'Error retrieving employee profile details.' });
    }
  },

  // Fetch fully unmasked sensitive KYC values
  getEmployeeKycDecrypted: async (req, res) => {
    const { id } = req.params;

    try {
      const { data: kycRecords, error } = await supabase.from('employee_kyc').select('*').eq('employee_id', id);
      if (error || !kycRecords || kycRecords.length === 0) {
        return res.status(404).json({ message: 'KYC record not found.' });
      }

      const kRecord = kycRecords[0];
      
      // Decrypt values
      const plainAadhaar = kRecord.aadhaar_number_encrypted ? decrypt(kRecord.aadhaar_number_encrypted) : '';
      const plainPan = kRecord.pan_number_encrypted ? decrypt(kRecord.pan_number_encrypted) : '';
      const plainBank = kRecord.bank_account_number_encrypted ? decrypt(kRecord.bank_account_number_encrypted) : '';

      // Log this access in the immutable audit logs
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
      probation_period_days, confirmation_date, onboarding_status, status, login_password,
      // KYC fields
      aadhaar_number, pan_number, bank_account_number, bank_name, bank_ifsc, upi_id
    } = req.body;

    try {
      const { data: current, error: curErr } = await supabase.from('employees').select('*').eq('id', id);
      if (curErr || !current || current.length === 0) {
        return res.status(404).json({ message: 'Employee not found.' });
      }

      const oldEmployee = current[0];

      // Update basic fields
      const { error: updErr } = await supabase.from('employees').update({
        full_name: full_name || oldEmployee.full_name, mobile: mobile || oldEmployee.mobile, email: email || oldEmployee.email, department_id: department_id || oldEmployee.department_id, designation_id: designation_id || oldEmployee.designation_id,
        current_address: current_address || oldEmployee.current_address, permanent_address: permanent_address || oldEmployee.permanent_address, pincode: pincode || oldEmployee.pincode, country: country || oldEmployee.country, state: state || oldEmployee.state, district: district || oldEmployee.district, post_office: post_office || oldEmployee.post_office,
        interviewed_hrs: interviewed_hrs || oldEmployee.interviewed_hrs, interviewed_date: interviewed_date || oldEmployee.interviewed_date, appointed_date: appointed_date || oldEmployee.appointed_date, contract_till_date: contract_till_date || oldEmployee.contract_till_date,
        dob: dob || oldEmployee.dob, gender: gender || oldEmployee.gender, blood_group: blood_group || oldEmployee.blood_group, marital_status: marital_status || oldEmployee.marital_status, nationality: nationality || oldEmployee.nationality, citizenship_status: citizenship_status || oldEmployee.citizenship_status,
        emergency_contact_name: emergency_contact_name || oldEmployee.emergency_contact_name, emergency_contact_number: emergency_contact_number || oldEmployee.emergency_contact_number, alt_mobile: alt_mobile || oldEmployee.alt_mobile, alt_email: alt_email || oldEmployee.alt_email,
        reporting_manager_id: reporting_manager_id || oldEmployee.reporting_manager_id, work_location_id: work_location_id || oldEmployee.work_location_id, employment_type: employment_type || oldEmployee.employment_type, joining_salary: joining_salary || oldEmployee.joining_salary,
        probation_period_days: probation_period_days || oldEmployee.probation_period_days, confirmation_date: confirmation_date || oldEmployee.confirmation_date, onboarding_status: onboarding_status || oldEmployee.onboarding_status, status: status || oldEmployee.status
      }).eq('id', id);

      if (updErr) throw updErr;

      // Update KYC fields (only override if new values are supplied and aren't masked place-holders)
      const { data: currentKyc } = await supabase.from('employee_kyc').select('*').eq('employee_id', id);
      if (currentKyc && currentKyc.length > 0) {
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

        await supabase.from('employee_kyc').update({
          aadhaar_number_encrypted: updatedAadhaar, pan_number_encrypted: updatedPan, bank_account_number_encrypted: updatedBank,
          bank_name: bank_name || currentKyc[0].bank_name, bank_ifsc: bank_ifsc || currentKyc[0].bank_ifsc, upi_id: upi_id || currentKyc[0].upi_id
        }).eq('employee_id', id);
      }

      // Check if employee onboarding status was updated to Approved and user login exists
      if ((onboarding_status === 'Approved' || onboarding_status === 'Onboarding Completed') || login_password) {
        await employeeController.autoCreateUserAccount(id, email || oldEmployee.email, full_name || oldEmployee.full_name, login_password);
      }

      // Log changes in immutable audit log
      const { data: updated } = await supabase.from('employees').select('*').eq('id', id);
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

    // Restrict soft-delete to Super Admin and Admin Controller
    if (req.user.roleName !== 'Super Admin' && req.user.roleName !== 'Admin Controller') {
      return res.status(403).json({ message: 'Access denied: Sub-admins are not authorized to delete system data.' });
    }

    try {
      const { data: employee, error } = await supabase.from('employees').select('*').eq('id', id);
      if (error || !employee || employee.length === 0) {
        return res.status(404).json({ message: 'Employee not found.' });
      }

      // Block self-deletion or deleting the Admin Controller (unless Super Admin is the requester)
      if (req.user.roleName !== 'Super Admin') {
        if (employee[0].user_id === req.user.id) {
          return res.status(403).json({ message: 'Access denied: You cannot delete your own account.' });
        }

        if (employee[0].user_id) {
          const { data: userRec } = await supabase.from('users').select('role_id').eq('id', employee[0].user_id).single();
          if (userRec && userRec.role_id === 7) {
            return res.status(403).json({ message: 'Access denied: Cannot delete the Admin Controller account.' });
          }
        }
      }


      // Perform Soft Delete
      await supabase.from('employees').update({ deleted_at: new Date().toISOString(), status: 'Inactive' }).eq('id', id);

      // If user account exists, suspend it
      if (employee[0].user_id) {
        await supabase.from('users').update({ status: 'inactive' }).eq('id', employee[0].user_id);
      }

      await logAudit(req, 'DELETE_EMPLOYEE', `employees/${id}`, employee[0], { deleted: true });

      res.json({ message: 'Employee profile soft-deleted successfully.' });
    } catch (err) {
      console.error('Delete Employee Error:', err.message);
      res.status(500).json({ message: 'Error deleting employee from system.' });
    }
  },

  // Restore Employee
  restoreEmployee: async (req, res) => {
    const { id } = req.params;

    try {
      const { data: employee, error } = await supabase.from('employees').select('*').eq('id', id);
      if (error || !employee || employee.length === 0) {
        return res.status(404).json({ message: 'Employee not found.' });
      }

      // Restore record
      await supabase.from('employees').update({ deleted_at: null, status: 'Active' }).eq('id', id);

      // If user account exists, re-activate
      if (employee[0].user_id) {
        await supabase.from('users').update({ status: 'active' }).eq('id', employee[0].user_id);
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
      const { data: list, error } = await supabase
        .from('employees')
        .select('id, employee_id, full_name')
        .eq('status', 'Active')
        .is('deleted_at', null);

      if (error) throw error;
      
      let filteredList = list || [];
      if (req.user.roleName !== 'Super Admin') {
        filteredList = filteredList.filter(emp => emp.id !== 1 && emp.employee_id !== 'CHUB-EMP-001');
      }
      res.json(filteredList);

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
      const { data: employee, error } = await supabase.from('employees').select('id, full_name').eq('id', id);
      if (error || !employee || employee.length === 0) {
        return res.status(404).json({ message: 'Employee not found.' });
      }

      const docName = req.file.originalname;
      const docPath = req.file.path.replace(/\\/g, '/');
      const docSize = req.file.size;

      await supabase.from('employee_documents').insert([{
        employee_id: id, document_type: documentType || 'Other', document_name: docName, file_path: docPath, file_size: docSize
      }]);

      if (documentType === 'Other') {
        await supabase.from('employees').update({ photo_path: docPath }).eq('id', id);
      }

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
      const { data: docs, error } = await supabase.from('employee_documents').select('*').eq('id', docId);
      if (error || !docs || docs.length === 0) {
        return res.status(404).json({ message: 'Document record not found.' });
      }

      const doc = docs[0];

      // Delete file from disk
      if (fs.existsSync(doc.file_path)) {
        fs.unlinkSync(doc.file_path);
      }

      // Delete from database
      await supabase.from('employee_documents').delete().eq('id', docId);

      await logAudit(req, 'DELETE_DOCUMENT', `employees/${doc.employee_id}`, { name: doc.document_name }, null);

      res.json({ message: 'Document deleted successfully.' });
    } catch (err) {
      console.error('Document Delete Error:', err.message);
      res.status(500).json({ message: 'Error deleting document.' });
    }
  },

  // Self photo upload handler
  uploadSelfPhoto: async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No photo file provided.' });
    }

    try {
      const { data: employee, error } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', req.user.id);

      if (error || !employee || employee.length === 0) {
        return res.status(404).json({ message: 'Employee profile not found for this user.' });
      }

      const empId = employee[0].id;
      const docName = req.file.originalname;
      const docPath = req.file.path.replace(/\\/g, '/');
      const docSize = req.file.size;

      // Insert document
      await supabase.from('employee_documents').insert([{
        employee_id: empId,
        document_type: 'Other',
        document_name: docName,
        file_path: docPath,
        file_size: docSize
      }]);

      // Update employee photo
      await supabase.from('employees').update({ photo_path: docPath }).eq('id', empId);

      // Log audit
      await logAudit(req, 'UPLOAD_SELF_PHOTO', `employees/${empId}`, null, { name: docName });

      res.json({ message: 'Profile photo updated successfully.', photoPath: docPath });
    } catch (err) {
      console.error('Self Photo Upload Error:', err.message);
      res.status(500).json({ message: 'Error uploading profile photo.' });
    }
  }
};

module.exports = employeeController;
