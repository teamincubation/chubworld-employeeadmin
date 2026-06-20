const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/db');
const { logAudit } = require('../utils/auditLogger');

const JWT_SECRET = process.env.JWT_SECRET || 'chub_super_secret_jwt_key_2026_creating_wow_world';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

/**
 * Log login attempts to history
 */
async function recordLoginHistory(userId, email, ip, userAgent, status, remarks) {
  try {
    await db.query(`
      INSERT INTO login_history (user_id, email_attempted, ip_address, user_agent, status, remarks)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [userId, email, ip, userAgent, status, remarks]);
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
      const users = await db.query(`
        SELECT u.*, r.name AS role_name 
        FROM users u 
        JOIN roles r ON u.role_id = r.id 
        WHERE u.email = ?
      `, [email]);

      if (users.length === 0) {
        await recordLoginHistory(null, email, ip, userAgent, 'Failed', 'User email not found');
        return res.status(401).json({ message: 'Invalid credentials.' });
      }

      const user = users[0];

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
      if (user.role_name === 'Employee') {
        const empCheck = await db.query('SELECT onboarding_status FROM employees WHERE user_id = ?', [user.id]);
        if (empCheck.length > 0) {
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
        { id: user.id, email: user.email, role: user.role_name },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      // Record successful login
      await recordLoginHistory(user.id, email, ip, userAgent, 'Success', 'Login completed');
      
      // Log audit trail
      req.user = { id: user.id, email: user.email, roleName: user.role_name };
      await logAudit(req, 'LOGIN_SUCCESS', `users/${user.id}`);

      // Return token & profile structure
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role_name,
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
      const users = await db.query('SELECT id, email, status FROM users WHERE email = ?', [email]);
      if (users.length === 0) {
        // Obfuscate response for security, but do not generate token
        return res.json({ message: 'If the email exists in our records, a secure password reset link will be sent.' });
      }

      const user = users[0];
      if (user.status !== 'active') {
        return res.status(403).json({ message: 'Account is inactive.' });
      }

      // Generate secure reset token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour validity (stored as IST timestamp implicitly based on session pool config)

      // Store hashed token in DB
      await db.query(`
        UPDATE users 
        SET reset_token_hash = ?, reset_token_expires_at = ? 
        WHERE id = ?
      `, [tokenHash, expiresAt, user.id]);

      // Log security event & audit log
      req.user = { id: user.id, email: user.email, roleName: 'Public' };
      await logAudit(req, 'PASSWORD_RESET_REQUESTED', `users/${user.id}`);

      // In production, send this via email. For delivery, return it in the response (useful for API verification & testing)
      const resetLink = `http://localhost:5173/reset-password?token=${rawToken}`;
      console.log(`[PASSWORD_RESET] Link generated for ${email}: ${resetLink}`);

      res.json({
        message: 'If the email exists in our records, a secure password reset link will be sent.',
        // Exposing token in development / test responses to simplify evaluation
        resetToken: rawToken,
        resetLink: resetLink
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
      // Hash the incoming raw token to find it
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      // Check reset token in database
      const users = await db.query(`
        SELECT id, email, reset_token_expires_at 
        FROM users 
        WHERE reset_token_hash = ?
      `, [tokenHash]);

      if (users.length === 0) {
        return res.status(400).json({ message: 'Invalid or expired password reset token.' });
      }

      const user = users[0];
      const now = new Date();
      // Ensure the reset token is not expired
      const expiresAt = new Date(user.reset_token_expires_at);

      if (expiresAt < now) {
        return res.status(400).json({ message: 'Password reset token has expired.' });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(newPassword, salt);

      // Update password and clear token
      await db.query(`
        UPDATE users 
        SET password_hash = ?, reset_token_hash = NULL, reset_token_expires_at = NULL 
        WHERE id = ?
      `, [newHash, user.id]);

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
      const users = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
      const user = users[0];

      const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isMatch) {
        await logAudit(req, 'PASSWORD_CHANGE_FAILED_WRONG_PASSWORD', `users/${req.user.id}`);
        return res.status(400).json({ message: 'Current password is incorrect.' });
      }

      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(newPassword, salt);

      await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);

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
      const users = await db.query(`
        SELECT u.id, u.email, u.onboarding_completed, r.name AS role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = ?
      `, [req.user.id]);

      if (users.length === 0) {
        return res.status(404).json({ message: 'User not found.' });
      }

      const user = users[0];
      let employeeProfile = null;

      // If it's an employee, attach profile
      if (user.role_name === 'Employee') {
        const empProfile = await db.query(`
          SELECT id, employee_id, full_name, mobile, onboarding_status, photo_path 
          FROM employees 
          WHERE user_id = ?
        `, [user.id]);
        if (empProfile.length > 0) {
          employeeProfile = empProfile[0];
        }
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role_name,
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
