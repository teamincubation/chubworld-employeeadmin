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
    const { error } = await supabase.from('login_history').insert([{
      user_id: userId,
      email_attempted: email,
      ip_address: ip,
      user_agent: userAgent,
      status: status,
      remarks: remarks
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
  login: async (req, res) => {
    const { email, password } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
      // Find user and join role name
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

      // If user is employee, check onboarding status
      if (roleName === 'Employee') {
        const { data: empCheck, error: empError } = await supabase
          .from('employees')
          .select('onboarding_status')
          .eq('user_id', user.id);
          
        if (!empError && empCheck && empCheck.length > 0) {
          const onboardingStatus = empCheck[0].onboarding_status;
          if (onboardingStatus !== 'Approved' && onboardingStatus !== 'Onboarding Completed') {
            await recordLoginHistory(user.id, email, ip, userAgent, 'Failed', `Blocked: Onboarding status is ${onboardingStatus}`);
            return res.status(403).json({ 
              message: `Access denied. Employee login is allowed only after KYC verification and Onboarding completion. Current status: ${onboardingStatus}.` 
            });
          }
        }
      }

      // Generate JWT
      const token = jwt.sign(
        { id: user.id, email: user.email, role: roleName },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      // Record successful login
      await recordLoginHistory(user.id, email, ip, userAgent, 'Success', 'Login completed');
      
      // Log audit trail
      req.user = { id: user.id, email: user.email, roleName: roleName };
      await logAudit(req, 'LOGIN_SUCCESS', `users/${user.id}`);

      // Return token & profile structure
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          role: roleName,
          onboardingCompleted: user.onboarding_completed
        }
      });
    } catch (err) {
      console.error('Login Endpoint Error:', err.message);
      res.status(500).json({ message: 'Internal server login error.' });
    }
  },

  // Logout Endpoint
  logout: async (req, res) => {
    try {
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
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, email, status')
        .eq('email', email);
        
      if (userError || !users || users.length === 0) {
        return res.json({ message: 'If the email exists in our records, a secure password reset link will be sent.' });
      }

      const user = users[0];
      if (user.status !== 'active') {
        return res.status(403).json({ message: 'Account is inactive.' });
      }

      // Generate secure reset token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      // Store hashed token in DB
      await supabase
        .from('users')
        .update({ reset_token_hash: tokenHash, reset_token_expires_at: expiresAt })
        .eq('id', user.id);

      // Log security event & audit log
      req.user = { id: user.id, email: user.email, roleName: 'Public' };
      await logAudit(req, 'PASSWORD_RESET_REQUESTED', `users/${user.id}`);

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
        message: 'If the email exists in our records, a secure password reset link will be sent.',
        resetToken: rawToken,
        resetLink: resetLink,
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

      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, email, reset_token_expires_at')
        .eq('reset_token_hash', tokenHash);

      if (userError || !users || users.length === 0) {
        return res.status(400).json({ message: 'Invalid or expired password reset token.' });
      }

      const user = users[0];
      const now = new Date();
      const expiresAt = new Date(user.reset_token_expires_at);

      if (expiresAt < now) {
        return res.status(400).json({ message: 'Password reset token has expired.' });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(newPassword, salt);

      // Update password and clear token
      await supabase
        .from('users')
        .update({ password_hash: newHash, reset_token_hash: null, reset_token_expires_at: null })
        .eq('id', user.id);

      // Log audit
      req.user = { id: user.id, email: user.email, roleName: 'Public' };
      await logAudit(req, 'PASSWORD_RESET_SUCCESS', `users/${user.id}`);

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
      res.json({ message: 'Password updated successfully.' });
    } catch (err) {
      console.error('ChangePassword error:', err.message);
      res.status(500).json({ message: 'Error updating password.' });
    }
  },

  // Fetch current user details
  getMe: async (req, res) => {
    try {
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

      // If it's an employee, attach profile
      if (roleName === 'Employee') {
        const { data: empProfile, error: empError } = await supabase
          .from('employees')
          .select('id, employee_id, full_name, mobile, onboarding_status, photo_path')
          .eq('user_id', user.id);
          
        if (!empError && empProfile && empProfile.length > 0) {
          employeeProfile = empProfile[0];
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
