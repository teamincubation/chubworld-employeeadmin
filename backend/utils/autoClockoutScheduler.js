const supabase = require('../config/db');
const nodemailer = require('nodemailer');

// Keep track of warned logs in memory to avoid spamming emails
const warnedLogs = new Set();

function getISTDate() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 5.5));
}

async function sendEmailNotification(email, name, subject, htmlContent) {
  try {
    const { data: dbSettings } = await supabase.from('system_settings').select('*');
    const settingsMap = {};
    (dbSettings || []).forEach(s => { settingsMap[s.setting_key] = s.setting_value; });

    const smtpHost = settingsMap.smtp_host || process.env.SMTP_HOST || 'smtp.hostinger.com';
    const smtpPort = settingsMap.smtp_port || process.env.SMTP_PORT || '465';
    const smtpUser = settingsMap.smtp_user || process.env.SMTP_USER;
    const smtpPass = settingsMap.smtp_pass || process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass) {
      console.log(`[SMTP] Skipped auto-clockout/warning email to ${email} (credentials not configured)`);
      return;
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort, 10),
      secure: smtpPort === '465',
      auth: { user: smtpUser, pass: smtpPass },
      tls: { rejectUnauthorized: false }
    });

    const mailOptions = {
      from: `"C-Hub HR Operations" <${smtpUser}>`,
      to: email,
      subject,
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);
    console.log(`[SMTP] Sent email to ${email}: ${subject}`);
  } catch (err) {
    console.error('[SMTP] Auto-clockout/warning email failed:', err.message);
  }
}

async function checkAndProcessAutoClockouts() {
  try {
    // 1. Get active shift logs
    const { data: activeLogs, error } = await supabase
      .from('attendance_logs')
      .select('*, employees(full_name, email, user_id)')
      .is('clock_out_time', null);

    if (error) throw error;
    if (!activeLogs || activeLogs.length === 0) return;

    // 2. Load system configurations
    const { data: dbSettings } = await supabase.from('system_settings').select('*');
    const settingsMap = {};
    (dbSettings || []).forEach(s => { settingsMap[s.setting_key] = s.setting_value; });

    const limitHours = parseFloat(settingsMap.auto_clockout_duration || 12);

    const nowIst = getISTDate();

    for (const log of activeLogs) {
      const emp = log.employees;
      if (!emp) continue;

      // Construct clock-in date in IST
      const clockInTimeStr = log.clock_in_time.length === 5 ? `${log.clock_in_time}:00` : log.clock_in_time;
      const inDate = new Date(`${log.date}T${clockInTimeStr}`);
      
      const diffHours = (nowIst - inDate) / 3600000;

      if (diffHours >= limitHours) {
        // Auto clock-out
        const outTimeStr = nowIst.toTimeString().split(' ')[0];
        
        // Calculate active hours
        const activeHours = parseFloat(diffHours.toFixed(2));
        
        let finalStatus = log.status;
        if (activeHours < 4.0 && finalStatus !== 'Location Not Verified') {
          finalStatus = 'Half Day';
        }

        await supabase.from('attendance_logs').update({
          clock_out_time: outTimeStr,
          clock_out_ip: 'system auto',
          clock_out_location_status: 'Location Not Verified',
          total_hours: activeHours,
          status: finalStatus
        }).eq('id', log.id);

        console.log(`[Scheduler] Auto clocked-out employee ${emp.full_name} after ${activeHours} hours.`);

        // Send email
        const mailBody = `
          <div style="font-family: 'Poppins', Arial, sans-serif; padding: 40px; color: #333;">
            <h2 style="color: #ef4444;">Automatic Shift Clock-Out Notification</h2>
            <p>Hello <strong>${emp.full_name}</strong>,</p>
            <p>Your shift attendance log for <strong>${log.date}</strong> has been automatically clocked out because it exceeded the maximum allowed duration of <strong>${limitHours} hours</strong>.</p>
            <div style="background-color: #f7f9fc; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <div><strong>Clock-In:</strong> ${log.clock_in_time}</div>
              <div><strong>Clock-Out (Auto):</strong> ${outTimeStr}</div>
              <div><strong>Total Hours:</strong> ${activeHours} hrs</div>
            </div>
            <p>If you forgot to clock out manually, no action is required. If your shift details are incorrect, please submit an attendance correction request via the employee portal.</p>
          </div>
        `;
        await sendEmailNotification(emp.email, emp.full_name, 'C-Hub Shift Auto-Clockout', mailBody);

        // Remove from warning cache
        warnedLogs.delete(log.id);

      } else if (diffHours >= 8.0) {
        // Send Warning reminder email if not already sent
        if (!warnedLogs.has(log.id)) {
          warnedLogs.add(log.id);

          const mailBody = `
            <div style="font-family: 'Poppins', Arial, sans-serif; padding: 40px; color: #333;">
              <h2 style="color: #fd7e14;">Shift Duration Reminder: 8 Hours Passed</h2>
              <p>Hello <strong>${emp.full_name}</strong>,</p>
              <p>You have been clocked in for over <strong>8 hours</strong> today. This is a friendly reminder to clock out if your shift has ended.</p>
              <p>If you are still working, please ensure you clock out as soon as your work is complete to prevent automatic clock-out by the system.</p>
              <div style="margin: 20px 0;">
                <a href="https://chubworld.adloaf.com" style="background-color: #D85AA6; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">Go to Clock-Out Panel</a>
              </div>
            </div>
          `;
          await sendEmailNotification(emp.email, emp.full_name, 'C-Hub Warning: 8+ Hours Reminder', mailBody);
          console.log(`[Scheduler] Sent 8-hour shift warning to ${emp.full_name}`);
        }
      }
    }
  } catch (err) {
    console.error('[Scheduler] Auto-clockout check failed:', err.message);
  }
}

module.exports = {
  checkAndProcessAutoClockouts
};
