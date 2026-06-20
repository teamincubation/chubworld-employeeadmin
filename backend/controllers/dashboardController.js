const db = require('../config/db');

const dashboardController = {
  getOverviewStats: async (req, res) => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      // 1. Employee counts
      const empStats = await db.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN onboarding_status IN ('Draft', 'KYC Pending', 'HR Review') THEN 1 ELSE 0 END) as pending_onboarding,
          SUM(CASE WHEN onboarding_status IN ('Approved', 'Onboarding Completed') THEN 1 ELSE 0 END) as completed_onboarding
        FROM employees
        WHERE deleted_at IS NULL
      `);

      const stats = empStats[0] || { total: 0, active: 0, pending_onboarding: 0, completed_onboarding: 0 };

      // 2. Today's Attendance counters
      const attStats = await db.query(`
        SELECT
          COUNT(*) as today_clockings,
          SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) as late_arrivals,
          SUM(CASE WHEN status = 'Leave' THEN 1 ELSE 0 END) as on_leave,
          SUM(CASE WHEN status = 'Present' OR status = 'Late' OR status = 'Half Day' OR status = 'Location Not Verified' THEN 1 ELSE 0 END) as today_present
        FROM attendance_logs
        WHERE date = ?
      `, [todayStr]);

      const att = attStats[0] || { today_clockings: 0, late_arrivals: 0, on_leave: 0, today_present: 0 };

      // 3. Pending leave requests count
      const leaveStats = await db.query(`
        SELECT COUNT(*) as pending_requests 
        FROM leave_requests 
        WHERE status = 'Pending'
      `);
      const pendingLeaves = leaveStats[0] ? leaveStats[0].pending_requests : 0;

      // 4. Department-wise distribution
      const deptStats = await db.query(`
        SELECT d.name, COUNT(e.id) as count
        FROM departments d
        LEFT JOIN employees e ON e.department_id = d.id AND e.deleted_at IS NULL
        GROUP BY d.id
      `);

      // 5. Recent audit activities
      const recentActivities = await db.query(`
        SELECT id, action_type, performed_by, role, target_record, created_at
        FROM audit_logs
        ORDER BY id DESC
        LIMIT 10
      `);

      // 6. Security alerts (e.g. failed login attempts, unauthorized KYC accesses)
      const securityAlerts = await db.query(`
        SELECT id, severity, event_type, details, ip_address, created_at
        FROM security_events
        ORDER BY id DESC
        LIMIT 10
      `);

      res.json({
        employees: {
          total: stats.total || 0,
          active: stats.active || 0,
          pendingOnboarding: stats.pending_onboarding || 0,
          completedOnboarding: stats.completed_onboarding || 0
        },
        attendance: {
          todayPresent: att.today_present || 0,
          lateArrivals: att.late_arrivals || 0,
          employeesOnLeave: att.on_leave || 0,
          pendingLeaveRequests: pendingLeaves || 0
        },
        departments: deptStats,
        recentActivities,
        securityAlerts
      });
    } catch (err) {
      console.error('Dashboard Stats Error:', err.message);
      res.status(500).json({ message: 'Error loading dashboard statistics.' });
    }
  }
};

module.exports = dashboardController;
