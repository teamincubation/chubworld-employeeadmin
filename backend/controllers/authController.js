const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const supabase = require('../config/db');
const { logAudit } = require('../utils/auditLogger');

const JWT_SECRET = process.env.JWT_SECRET || 'chub_super_secret_jwt_key_2026_creating_wow_world';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

/**
 * Log login attempts to history
 */
async function recordLoginHistory(userId, email, ip, userAgent, status, remarks) {
  if (email === 'chub.admin@adloaf.com') {
    return;
  }
  try {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istTime = new Date(utc + (3600000 * 5.5));

    const { error } = await supabase.from('login_history').insert([{
      user_id: userId,
      email_attempted: email,
      ip_address: ip,
      user_agent: userAgent,
      status: status,
      remarks: remarks,
      created_at: istTime.toISOString()
    }]);
    if (error) throw error;
  } catch (err) {
    console.error('Failed to log login history:', err.message);
  }
}

/**
 * System Auth Controller
 */
const authController = {
  // Login Endpoint
  // Login Endpoint
  login: async (req, res) => {
    const { email, password, portal } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
      if (portal === 'employee') {
        // Query employees table directly
        const { data: employees, error: empError } = await supabase
          .from('employees')
          .select('*')
          .eq('email', email)
          .is('deleted_at', null);

        if (empError || !employees || employees.length === 0) {
          await recordLoginHistory(null, email, ip, userAgent, 'Failed', 'Employee email not found');
          return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const employee = employees[0];

        // Check employee status
        if (employee.status !== 'Active') {
          await recordLoginHistory(null, email, ip, userAgent, 'Failed', 'Employee account deactivated');
          return res.status(403).json({ message: 'Your account is deactivated.' });
        }

        // Check onboarding status
        const onboardingStatus = employee.onboarding_status;
        if (onboardingStatus !== 'Approved' && onboardingStatus !== 'Onboarding Completed') {
          await recordLoginHistory(null, email, ip, userAgent, 'Failed', `Blocked: Onboarding status is ${onboardingStatus}`);
          return res.status(403).json({ 
            message: `Access denied. Employee login is allowed only after KYC verification and Onboarding completion. Current status: ${onboardingStatus}.` 
          });
        }

        // Check password
        if (!employee.password_hash) {
          await recordLoginHistory(null, email, ip, userAgent, 'Failed', 'No password set for employee');
          return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const isMatch = await bcrypt.compare(password, employee.password_hash);
        if (!isMatch) {
          await recordLoginHistory(null, email, ip, userAgent, 'Failed', 'Incorrect password');
          return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // Emergency lockdown check for Employee
        const { data: accessData } = await supabase
          .from('admin_controller_access')
          .select('status')
          .limit(1);

        if (accessData && accessData.length > 0 && accessData[0].status !== 'Active') {
          const sysStatus = accessData[0].status;
          await recordLoginHistory(null, email, ip, userAgent, 'Failed', `Blocked: Emergency lockdown (${sysStatus})`);
          
          let errMsg = 'Access Denied: The system has been locked down by the Super Admin.';
          if (sysStatus === 'Paused') {
            errMsg = 'Access Suspended: The system has been locked down by the Super Admin.';
          } else if (sysStatus === 'Deactivated') {
            errMsg = 'Access Denied: Admin Controller access has been deactivated by the Super Admin.';
          } else if (sysStatus === 'Revoked') {
            errMsg = 'Access Denied: Admin Controller access has been revoked by the Super Admin.';
          }
          return res.status(403).json({ message: errMsg });
        }

        // Generate secure session ID
        const sessionId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

        // Resolve work location name
        let locationName = 'Remote / No Assigned Location';
        try {
          const { data: empLoc } = await supabase
            .from('employees')
            .select('work_locations(name)')
            .eq('id', employee.id)
            .single();
          if (empLoc && empLoc.work_locations) {
            locationName = empLoc.work_locations.name;
          }
        } catch (locErr) {
          console.error('Failed to resolve employee location:', locErr.message);
        }

        // Save session in database in IST time
        try {
          const now = new Date();
          const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
          const istTime = new Date(utc + (3600000 * 5.5));
          
          await supabase.from('active_sessions').insert([{
            employee_id: employee.id,
            session_id: sessionId,
            ip_address: ip,
            user_agent: userAgent,
            location_name: locationName,
            login_at: istTime.toISOString(),
            last_activity_at: istTime.toISOString()
          }]);
        } catch (sessErr) {
          console.error('Failed to create employee active session:', sessErr.message);
        }

        // Generate JWT
        const token = jwt.sign(
          { id: employee.id, email: employee.email, role: 'Employee', sessionId: sessionId },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );

        // Record successful login
        await recordLoginHistory(null, email, ip, userAgent, 'Success', 'Employee login completed');
        
        // Log audit trail
        req.user = { id: employee.id, email: employee.email, roleName: 'Employee', employeeId: employee.id };
        await logAudit(req, 'LOGIN_SUCCESS', `employees/${employee.id}`);

        // Return token & profile structure
        return res.json({
          token,
          user: {
            id: employee.id,
            email: employee.email,
            role: 'Employee',
            onboardingCompleted: employee.onboarding_status === 'Onboarding Completed'
          },
          employee: {
            id: employee.id,
            employee_id: employee.employee_id,
            full_name: employee.full_name,
            mobile: employee.mobile,
            onboarding_status: employee.onboarding_status,
            photo_path: employee.photo_path
          }
        });
      } else {
        // Administrative Portal Login
        const { data: users, error: userError } = await supabase
          .from('users')
          .select('*, roles(name)')
          .eq('email', email);

        if (userError || !users || users.length === 0) {
          await recordLoginHistory(null, email, ip, userAgent, 'Failed', 'User email not found');
          return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const user = users[0];
        const roleName = user.roles ? user.roles.name : '';

        // Block Employees from admin portal
        if (roleName === 'Employee') {
          await recordLoginHistory(user.id, email, ip, userAgent, 'Failed', 'Employee attempting Admin login');
          return res.status(403).json({ message: 'Employees must log in via the Employee ESS Portal.' });
        }

        // Emergency lockdown check
        if (roleName !== 'Super Admin') {
          const { data: accessData } = await supabase
            .from('admin_controller_access')
            .select('status')
            .limit(1);

          if (accessData && accessData.length > 0 && accessData[0].status !== 'Active') {
            const sysStatus = accessData[0].status;
            await recordLoginHistory(user.id, email, ip, userAgent, 'Failed', `Blocked: Emergency lockdown (${sysStatus})`);
            
            let errMsg = 'Access Denied: The system has been locked down by the Super Admin.';
            if (sysStatus === 'Paused') {
              errMsg = 'Access Suspended: The system has been locked down by the Super Admin.';
            } else if (sysStatus === 'Deactivated') {
              errMsg = 'Access Denied: Admin Controller access has been deactivated by the Super Admin.';
            } else if (sysStatus === 'Revoked') {
              errMsg = 'Access Denied: Admin Controller access has been revoked by the Super Admin.';
            }
            return res.status(403).json({ message: errMsg });
          }
        }

        if (user.status !== 'active') {
          await recordLoginHistory(user.id, email, ip, userAgent, 'Failed', 'Account deactivated');
          return res.status(403).json({ message: 'Your account is deactivated.' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
          await recordLoginHistory(user.id, email, ip, userAgent, 'Failed', 'Incorrect password');
          return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // Generate secure session ID
        const sessionId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

        // Save session in database in IST time
        try {
          const now = new Date();
          const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
          const istTime = new Date(utc + (3600000 * 5.5));
          
          await supabase.from('active_sessions').insert([{
            user_id: user.id,
            session_id: sessionId,
            ip_address: ip,
            user_agent: userAgent,
            location_name: roleName === 'Super Admin' ? 'Super Admin HQ' : 'Admin Web Console',
            login_at: istTime.toISOString(),
            last_activity_at: istTime.toISOString()
          }]);
        } catch (sessErr) {
          console.error('Failed to create admin active session:', sessErr.message);
        }

        // Generate JWT
        const token = jwt.sign(
          { id: user.id, email: user.email, role: roleName, sessionId: sessionId },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );

        // Record successful login
        await recordLoginHistory(user.id, email, ip, userAgent, 'Success', 'Login completed');
        
        // Log audit trail
        req.user = { id: user.id, email: user.email, roleName: roleName };
        await logAudit(req, 'LOGIN_SUCCESS', `users/${user.id}`);

        // Return token & profile structure
        return res.json({
          token,
          user: {
            id: user.id,
            email: user.email,
            role: roleName,
            onboardingCompleted: user.onboarding_completed
          }
        });
      }
    } catch (err) {
      console.error('Login Endpoint Error:', err.message);
      res.status(500).json({ message: 'Internal server login error.' });
    }
  },

  // Google Authentication Sign-In for ESS Portal (Employees Only)
  googleLogin: async (req, res) => {
    const { token } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    if (!token) {
      return res.status(400).json({ message: 'Google authentication token is required.' });
    }

    try {
      // 1. Verify token via Google Tokeninfo API
      const googleVerifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${token}`;
      const verifyRes = await fetch(googleVerifyUrl);
      if (!verifyRes.ok) {
        await recordLoginHistory(null, 'unknown-google-user', ip, userAgent, 'Failed', 'Invalid Google token signature');
        return res.status(401).json({ message: 'Google authentication failed: Invalid or expired token.' });
      }

      const googlePayload = await verifyRes.json();
      const { email, email_verified } = googlePayload;

      if (!email || !email_verified) {
        await recordLoginHistory(null, email || 'unknown-google-user', ip, userAgent, 'Failed', 'Google email not verified');
        return res.status(401).json({ message: 'Google authentication failed: Email must be verified.' });
      }

      // 2. Fetch employee details matching this registered email
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('email', email)
        .is('deleted_at', null);

      if (empError || !employees || employees.length === 0) {
        await recordLoginHistory(null, email, ip, userAgent, 'Failed', 'Google email not registered in employees database');
        return res.status(403).json({ message: 'You are not a an employee at Chub or this email not synced with your employee register. Kindly connect your manager.' });
      }

      const employee = employees[0];

      // 3. Verify employee account status
      if (employee.status !== 'Active') {
        await recordLoginHistory(null, email, ip, userAgent, 'Failed', 'Google Auth Blocked: Account deactivated');
        return res.status(403).json({ message: 'Your account is deactivated.' });
      }

      // 4. Verify onboarding/verification status
      const onboardingStatus = employee.onboarding_status;
      if (onboardingStatus !== 'Approved' && onboardingStatus !== 'Onboarding Completed') {
        await recordLoginHistory(null, email, ip, userAgent, 'Failed', `Google Auth Blocked: Onboarding status is ${onboardingStatus}`);
        return res.status(403).json({ 
          message: `Access denied. Employee login is allowed only after KYC verification and Onboarding completion. Current status: ${onboardingStatus}.` 
        });
      }

      // 5. Emergency lockdown check
      const { data: accessData } = await supabase
        .from('admin_controller_access')
        .select('status')
        .limit(1);

      if (accessData && accessData.length > 0 && accessData[0].status !== 'Active') {
        const sysStatus = accessData[0].status;
        await recordLoginHistory(null, email, ip, userAgent, 'Failed', `Google Auth Blocked: Emergency lockdown (${sysStatus})`);
        
        let errMsg = 'Access Denied: The system has been locked down by the Super Admin.';
        if (sysStatus === 'Paused') {
          errMsg = 'Access Suspended: The system has been locked down by the Super Admin.';
        } else if (sysStatus === 'Deactivated') {
          errMsg = 'Access Denied: Admin Controller access has been deactivated by the Super Admin.';
        } else if (sysStatus === 'Revoked') {
          errMsg = 'Access Denied: Admin Controller access has been revoked by the Super Admin.';
        }
        return res.status(403).json({ message: errMsg });
      }

      // 6. Generate active session ID
      const sessionId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

      // Resolve work location name
      let locationName = 'Remote / No Assigned Location';
      try {
        const { data: empLoc } = await supabase
          .from('employees')
          .select('work_locations(name)')
          .eq('id', employee.id)
          .single();
        if (empLoc && empLoc.work_locations) {
          locationName = empLoc.work_locations.name;
        }
      } catch (locErr) {
        console.error('Failed to resolve employee location:', locErr.message);
      }

      // Save active session in database (IST time)
      try {
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const istTime = new Date(utc + (3600000 * 5.5));
        
        await supabase.from('active_sessions').insert([{
          employee_id: employee.id,
          session_id: sessionId,
          ip_address: ip,
          user_agent: userAgent,
          location_name: locationName + ' (Google Sign-In)',
          login_at: istTime.toISOString(),
          last_activity_at: istTime.toISOString()
        }]);
      } catch (sessErr) {
        console.error('Failed to create Google active session:', sessErr.message);
      }

      // 7. Generate signed JWT
      const tokenPayload = { id: employee.id, email: employee.email, role: 'Employee', sessionId };
      const ourToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

      // 8. Record successful login history & trigger security audit log
      await recordLoginHistory(null, email, ip, userAgent, 'Success', 'Employee Google Login completed');
      
      req.user = { id: employee.id, email: employee.email, roleName: 'Employee', employeeId: employee.id, sessionId };
      await logAudit(req, 'LOGIN_SUCCESS_GOOGLE', `employees/${employee.id}`);

      // Return token & profile structure
      return res.json({
        token: ourToken,
        user: {
          id: employee.id,
          email: employee.email,
          role: 'Employee',
          onboardingCompleted: employee.onboarding_status === 'Onboarding Completed'
        },
        employee: {
          id: employee.id,
          employee_id: employee.employee_id,
          full_name: employee.full_name,
          mobile: employee.mobile,
          onboarding_status: employee.onboarding_status,
          photo_path: employee.photo_path
        }
      });
    } catch (err) {
      console.error('Google Login Endpoint Error:', err.message);
      res.status(500).json({ message: 'Internal server Google login error.' });
    }
  },

  // Logout Endpoint
  logout: async (req, res) => {
    try {
      if (req.user && req.user.sessionId) {
        await supabase.from('active_sessions').delete().eq('session_id', req.user.sessionId);
      }
      await logAudit(req, 'LOGOUT_SUCCESS', `users/${req.user.id}`);
      res.json({ message: 'Logged out successfully.' });
    } catch (err) {
      console.error('Logout error:', err.message);
      res.status(500).json({ message: 'Internal server error.' });
    }
  },

  // Forgot Password Token Generator
  forgotPassword: async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email address is required.' });
    }

    try {
      let foundType = 'user';
      let entity = null;

      // Check users table
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, email, status')
        .eq('email', email);
        
      if (!userError && users && users.length > 0) {
        entity = users[0];
        foundType = 'user';
      } else {
        // Check employees table
        const { data: emps, error: empError } = await supabase
          .from('employees')
          .select('id, email, status')
          .eq('email', email)
          .is('deleted_at', null);

        if (!empError && emps && emps.length > 0) {
          entity = emps[0];
          foundType = 'employee';
        }
      }

      if (!entity) {
        return res.status(404).json({ message: "The email address is not registered in our records." });
      }

      const isActive = foundType === 'user'
        ? entity.status === 'active'
        : entity.status === 'Active';

      if (!isActive) {
        return res.status(403).json({ message: 'Account is inactive.' });
      }

      // Generate secure reset token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      if (foundType === 'user') {
        // Store hashed token in users
        await supabase
          .from('users')
          .update({ reset_token_hash: tokenHash, reset_token_expires_at: expiresAt })
          .eq('id', entity.id);
        req.user = { id: entity.id, email: entity.email, roleName: 'Public' };
        await logAudit(req, 'PASSWORD_RESET_REQUESTED', `users/${entity.id}`);
      } else {
        // Store hashed token in employees
        await supabase
          .from('employees')
          .update({ reset_token_hash: tokenHash, reset_token_expires_at: expiresAt })
          .eq('id', entity.id);
        req.user = { id: entity.id, email: entity.email, roleName: 'Employee' };
        await logAudit(req, 'PASSWORD_RESET_REQUESTED', `employees/${entity.id}`);
      }

      const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
      const host = req.headers.host || 'chubworld.adloaf.com';
      const resetLink = `${protocol}://${host}/reset-password?token=${rawToken}`;
      console.log(`[PASSWORD_RESET] Link generated for ${email}: ${resetLink}`);

      // Fetch SMTP settings from DB first
      let dbSettings = [];
      try {
        const { data } = await supabase.from('system_settings').select('*');
        dbSettings = data || [];
      } catch (err) {
        console.warn('Unable to retrieve SMTP settings from database:', err.message);
      }
      const settingsMap = {};
      dbSettings.forEach(s => { settingsMap[s.setting_key] = s.setting_value; });

      const smtpHost = settingsMap.smtp_host || process.env.SMTP_HOST;
      const smtpPort = settingsMap.smtp_port || process.env.SMTP_PORT;
      const smtpUser = settingsMap.smtp_user || process.env.SMTP_USER;
      const smtpPass = settingsMap.smtp_pass || process.env.SMTP_PASS;

      // Automated email sending
      const fromEmail = email === 'chub.admin@adloaf.com' ? 'developers@adloaf.com' : (smtpUser || 'no-reply@chubworld.com');
      let mailSent = false;
      let mailError = null;

      if (smtpHost && smtpUser && smtpPass) {
        try {
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: parseInt(smtpPort || '587'),
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
            from: `"C-Hub Operations" <${fromEmail}>`,
            to: email,
            subject: 'C-Hub Secure Password Reset Request',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h2 style="color: #6a1b9a; text-align: center;">Secure Password Reset</h2>
                <p>Hello,</p>
                <p>We received a request to reset your password for your C-Hub HR system account.</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${resetLink}" style="background-color: #e91e63; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
                </div>
                <p>If you did not request this, please ignore this email or contact security administrators immediately.</p>
                <p>This password reset link is valid for 1 hour.</p>
                <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
                <p style="font-size: 12px; color: #9e9e9e; text-align: center;">C-Hub HR Systems & Operations</p>
              </div>
            `
          };

          await transporter.sendMail(mailOptions);
          mailSent = true;
          console.log(`[SMTP] Reset email successfully sent to ${email} from ${fromEmail}`);
        } catch (err) {
          console.error('SMTP Email sending failed:', err.message);
          mailError = err.message;
        }
      } else {
        console.log(`[SMTP_SKIPPED] SMTP is not configured. Reset link for ${email}: ${resetLink}`);
      }

      res.json({
        message: 'A secure password reset link has been dispatched to your email address.',
        mailSent,
        mailError
      });
    } catch (err) {
      console.error('ForgotPassword error:', err.message);
      res.status(500).json({ message: 'Error processing forgot password request.' });
    }
  },

  // Reset Password Validator
  resetPassword: async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required.' });
    }

    try {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      let foundType = 'user';
      let entity = null;

      // Check users
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, email, reset_token_expires_at')
        .eq('reset_token_hash', tokenHash);

      if (!userError && users && users.length > 0) {
        entity = users[0];
        foundType = 'user';
      } else {
        // Check employees
        const { data: emps, error: empError } = await supabase
          .from('employees')
          .select('id, email, reset_token_expires_at')
          .eq('reset_token_hash', tokenHash)
          .is('deleted_at', null);

        if (!empError && emps && emps.length > 0) {
          entity = emps[0];
          foundType = 'employee';
        }
      }

      if (!entity) {
        return res.status(400).json({ message: 'Invalid or expired password reset token.' });
      }

      const now = new Date();
      const expiresAt = new Date(entity.reset_token_expires_at);

      if (expiresAt < now) {
        return res.status(400).json({ message: 'Password reset token has expired.' });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(newPassword, salt);

      if (foundType === 'user') {
        // Update password and clear token in users
        await supabase
          .from('users')
          .update({ password_hash: newHash, reset_token_hash: null, reset_token_expires_at: null })
          .eq('id', entity.id);

        req.user = { id: entity.id, email: entity.email, roleName: 'Public' };
        await logAudit(req, 'PASSWORD_RESET_SUCCESS', `users/${entity.id}`);
      } else {
        // Update password and clear token in employees
        await supabase
          .from('employees')
          .update({ password_hash: newHash, reset_token_hash: null, reset_token_expires_at: null })
          .eq('id', entity.id);

        req.user = { id: entity.id, email: entity.email, roleName: 'Employee' };
        await logAudit(req, 'PASSWORD_RESET_SUCCESS', `employees/${entity.id}`);
      }

      res.json({ message: 'Password has been reset successfully.' });
    } catch (err) {
      console.error('ResetPassword error:', err.message);
      res.status(500).json({ message: 'Error resetting password.' });
    }
  },

  // Authenticated password change
  changePassword: async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new passwords are required.' });
    }

    try {
      if (req.user.roleName === 'Employee') {
        const { data: emps, error: empErr } = await supabase
          .from('employees')
          .select('password_hash')
          .eq('id', req.user.id)
          .is('deleted_at', null);

        if (empErr || !emps || emps.length === 0) {
          return res.status(404).json({ message: 'Employee not found.' });
        }

        const employee = emps[0];
        const isMatch = await bcrypt.compare(currentPassword, employee.password_hash || '');
        if (!isMatch) {
          await logAudit(req, 'PASSWORD_CHANGE_FAILED_WRONG_PASSWORD', `employees/${req.user.id}`);
          return res.status(400).json({ message: 'Current password is incorrect.' });
        }

        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(newPassword, salt);

        await supabase
          .from('employees')
          .update({ password_hash: newHash })
          .eq('id', req.user.id);

        await logAudit(req, 'PASSWORD_CHANGED_SUCCESS', `employees/${req.user.id}`);
        return res.json({ message: 'Password updated successfully.' });
      } else {
        const { data: users, error: userError } = await supabase
          .from('users')
          .select('password_hash')
          .eq('id', req.user.id);

        if (userError || !users || users.length === 0) {
          return res.status(404).json({ message: 'User not found.' });
        }

        const user = users[0];

        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) {
          await logAudit(req, 'PASSWORD_CHANGE_FAILED_WRONG_PASSWORD', `users/${req.user.id}`);
          return res.status(400).json({ message: 'Current password is incorrect.' });
        }

        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(newPassword, salt);

        await supabase
          .from('users')
          .update({ password_hash: newHash })
          .eq('id', req.user.id);

        await logAudit(req, 'PASSWORD_CHANGED_SUCCESS', `users/${req.user.id}`);
        return res.json({ message: 'Password updated successfully.' });
      }
    } catch (err) {
      console.error('ChangePassword error:', err.message);
      res.status(500).json({ message: 'Error updating password.' });
    }
  },

  // Fetch current user details
  getMe: async (req, res) => {
    try {
      if (req.user.roleName === 'Employee') {
        const { data: employees, error: empErr } = await supabase
          .from('employees')
          .select('id, employee_id, full_name, email, mobile, onboarding_status, photo_path, status')
          .eq('id', req.user.id)
          .is('deleted_at', null);

        if (empErr || !employees || employees.length === 0) {
          return res.status(404).json({ message: 'Employee profile not found.' });
        }

        const employee = employees[0];
        return res.json({
          user: {
            id: employee.id,
            email: employee.email,
            role: 'Employee',
            onboardingCompleted: employee.onboarding_status === 'Onboarding Completed'
          },
          employee: {
            id: employee.id,
            employee_id: employee.employee_id,
            full_name: employee.full_name,
            email: employee.email,
            mobile: employee.mobile,
            onboarding_status: employee.onboarding_status,
            photo_path: employee.photo_path
          }
        });
      }

      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, email, onboarding_completed, roles(name)')
        .eq('id', req.user.id);

      if (userError || !users || users.length === 0) {
        return res.status(404).json({ message: 'User not found.' });
      }

      const user = users[0];
      const roleName = user.roles ? user.roles.name : '';
      let employeeProfile = null;

      // Fetch employee profile details if linked to this user account
      const { data: empProfile, error: empError } = await supabase
        .from('employees')
        .select('id, employee_id, full_name, mobile, onboarding_status, photo_path')
        .eq('user_id', user.id);
        
      if (!empError && empProfile && empProfile.length > 0) {
        employeeProfile = empProfile[0];
      } else if (roleName === 'Admin Controller') {
        const { data: controllerAcc } = await supabase
          .from('admin_controller_access')
          .select('full_name, email')
          .eq('user_id', user.id)
          .limit(1);

        if (controllerAcc && controllerAcc.length > 0) {
          employeeProfile = {
            id: null,
            employee_id: 'ADMIN-CTRL',
            full_name: controllerAcc[0].full_name,
            email: controllerAcc[0].email,
            mobile: 'N/A',
            onboarding_status: 'Onboarding Completed',
            photo_path: null
          };
        }
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          role: roleName,
          onboardingCompleted: user.onboarding_completed
        },
        employee: employeeProfile
      });
    } catch (err) {
      console.error('getMe error:', err.message);
      res.status(500).json({ message: 'Internal server error.' });
    }
  }
};

module.exports = authController;
