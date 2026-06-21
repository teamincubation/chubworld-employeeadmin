const supabase = require('../config/db');

const dashboardController = {
  getOverviewStats: async (req, res) => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      // 1. Employee counts
      const { count: empTotal } = await supabase.from('employees').select('*', { count: 'exact', head: true }).is('deleted_at', null);
      const { count: empActive } = await supabase.from('employees').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'Active');
      const { count: empPending } = await supabase.from('employees').select('*', { count: 'exact', head: true }).is('deleted_at', null).in('onboarding_status', ['Draft', 'KYC Pending', 'HR Review']);
      const { count: empCompleted } = await supabase.from('employees').select('*', { count: 'exact', head: true }).is('deleted_at', null).in('onboarding_status', ['Approved', 'Onboarding Completed']);

      // 2. Today's Attendance counters
      const { data: attLogs } = await supabase.from('attendance_logs').select('status').eq('date', todayStr);
      let lateArrivals = 0;
      let onLeave = 0;
      let todayPresent = 0;

      if (attLogs) {
        for (const log of attLogs) {
          if (log.status === 'Late') lateArrivals++;
          if (log.status === 'Leave') onLeave++;
          if (['Present', 'Late', 'Half Day', 'Location Not Verified'].includes(log.status)) {
            todayPresent++;
          }
        }
      }

      // 3. Pending leave requests count
      const { count: pendingLeaves } = await supabase.from('leave_requests').select('*', { count: 'exact', head: true }).eq('status', 'Pending');

      // 4. Department-wise distribution
      const { data: deptData } = await supabase.from('departments').select('id, name, employees(id)');
      const deptStats = (deptData || []).map(d => ({
        name: d.name,
        count: d.employees ? d.employees.length : 0
      }));

      // 5. Recent audit activities (excluding Super Admin logs)
      const { data: recentActivities } = await supabase
        .from('audit_logs')
        .select('id, action_type, performed_by, role, target_record, created_at')
        .neq('performed_by', 'chub.admin@adloaf.com')
        .neq('role', 'Super Admin')
        .order('id', { ascending: false })
        .limit(10);

      // 6. Security alerts
      const { data: securityAlerts } = await supabase
        .from('security_events')
        .select('id, severity, event_type, details, ip_address, created_at')
        .order('id', { ascending: false })
        .limit(10);

      res.json({
        employees: {
          total: empTotal || 0,
          active: empActive || 0,
          pendingOnboarding: empPending || 0,
          completedOnboarding: empCompleted || 0
        },
        attendance: {
          todayPresent: todayPresent,
          lateArrivals: lateArrivals,
          employeesOnLeave: onLeave,
          pendingLeaveRequests: pendingLeaves || 0
        },
        departments: deptStats,
        recentActivities: recentActivities || [],
        securityAlerts: securityAlerts || []
      });
    } catch (err) {
      console.error('Dashboard Stats Error:', err.message);
      res.status(500).json({ message: 'Error loading dashboard statistics.' });
    }
  }
};

module.exports = dashboardController;
