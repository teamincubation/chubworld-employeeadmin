import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  FileSpreadsheet, Download, Printer, ShieldAlert, 
  Users, CalendarClock, UserCheck, Clock, MapPin
} from 'lucide-react';

export default function ReportsPage() {
  const { request } = useAuth();
  
  // States
  const [reportType, setReportType] = useState('employees'); // 'employees', 'attendance', 'leaves', 'anomalies', 'onboarding', 'detailed_attendance', 'payroll'
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [departmentId, setDepartmentId] = useState('');
  
  const [departments, setDepartments] = useState([]);
  const [employeesList, setEmployeesList] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [reportYear, setReportYear] = useState(new Date().getFullYear());

  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMetadata();
  }, []);

  const fetchMetadata = async () => {
    try {
      const list = await request('/metadata/departments');
      setDepartments(list);
      const emps = await request('/employees/dropdown');
      setEmployeesList(emps || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuickViewEmployeeReport = async (empId, type) => {
    setSelectedEmployeeId(empId);
    setLoading(true);
    setError('');
    setReportData([]);
    try {
      let url = '';
      if (type === 'detailed_attendance') {
        url = `/reports/attendance-summary?month=${reportMonth}&year=${reportYear}&employeeId=${empId}`;
      } else {
        url = `/reports/payroll-summary?month=${reportMonth}&year=${reportYear}&employeeId=${empId}`;
      }
      const data = await request(url);
      setReportData(data || []);
    } catch (err) {
      setError(err.message || 'Error generating report.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setReportData([]);

    try {
      let url = '';
      if (reportType === 'employees') {
        url = `/employees?departmentId=${departmentId}`;
      } else if (reportType === 'attendance') {
        url = `/attendance/admin-logs?fromDate=${fromDate}&toDate=${toDate}&departmentId=${departmentId}`;
      } else if (reportType === 'leaves') {
        url = `/leaves/admin-requests`; // We will filter locally in frontend to make it simple and fast
      } else if (reportType === 'anomalies') {
        url = `/attendance/admin-logs?fromDate=${fromDate}&toDate=${toDate}&departmentId=${departmentId}`;
      } else if (reportType === 'onboarding') {
        url = `/employees?onboardingStatus=KYC Pending`;
      } else if (reportType === 'detailed_attendance') {
        url = `/reports/attendance-summary?month=${reportMonth}&year=${reportYear}${selectedEmployeeId ? '&employeeId=' + selectedEmployeeId : ''}`;
      } else if (reportType === 'payroll') {
        url = `/reports/payroll-summary?month=${reportMonth}&year=${reportYear}${selectedEmployeeId ? '&employeeId=' + selectedEmployeeId : ''}`;
      }

      const list = await request(url);
      
      // Filter locally for specific types if needed
      let filtered = [...list];
      if (reportType === 'leaves') {
        // filter requests by fromDate / toDate
        filtered = list.filter(r => {
          const from = new Date(r.from_date);
          const f = new Date(fromDate);
          const t = new Date(toDate);
          return from >= f && from <= t;
        });
      } else if (reportType === 'anomalies') {
        // Filter logs where status is Late, Half Day or Location Not Verified
        filtered = list.filter(log => ['Late', 'Half Day', 'Location Not Verified'].includes(log.status));
      }

      setReportData(filtered);
    } catch (err) {
      setError(err.message || 'Error generating report.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = () => {
    if (reportData.length === 0) return alert('No data to export.');

    let csvContent = "data:text/csv;charset=utf-8,";
    
    if (reportType === 'employees' || reportType === 'onboarding') {
      const headers = ['Employee ID', 'Full Name', 'Email', 'Mobile', 'Department', 'Designation', 'Employment Type', 'Status'];
      const rows = reportData.map(r => [r.employee_id, r.full_name, r.email, r.mobile, r.department_name, r.designation_name, r.employment_type, r.status]);
      csvContent += [headers.join(','), ...rows.map(e => e.map(val => `"${val || ''}"`).join(','))].join('\n');
    } else if (reportType === 'attendance' || reportType === 'anomalies') {
      const headers = ['Date', 'Emp ID', 'Full Name', 'Department', 'Clock In', 'Location In', 'Clock Out', 'Location Out', 'Hours', 'Status'];
      const rows = reportData.map(r => [r.date, r.employee_id, r.full_name, r.department_name, r.clock_in_time, r.clock_in_location_status, r.clock_out_time, r.clock_out_location_status, r.total_hours, r.status]);
      csvContent += [headers.join(','), ...rows.map(e => e.map(val => `"${val || ''}"`).join(','))].join('\n');
    } else if (reportType === 'leaves') {
      const headers = ['Emp ID', 'Full Name', 'Department', 'Leave Type', 'From Date', 'To Date', 'Total Days', 'Status', 'Remarks'];
      const rows = reportData.map(r => [r.employee_id, r.full_name, r.department_name, r.leave_code, r.from_date, r.to_date, r.total_days, r.status, r.remarks]);
      csvContent += [headers.join(','), ...rows.map(e => e.map(val => `"${val || ''}"`).join(','))].join('\n');
    } else if (reportType === 'detailed_attendance') {
      if (!selectedEmployeeId) {
        const headers = ['Employee ID', 'Full Name', 'Department', 'Working Days', 'Present', 'Late', 'Half Day', 'Absent', 'CL', 'SL', 'EL', 'LOP', 'Holiday Work', 'Total Hours'];
        const rows = reportData.map(r => [r.employee_id, r.full_name, r.department_name, r.total_working_days, r.days_present, r.days_late, r.days_half_day, r.days_absent, r.cl_taken, r.sl_taken, r.el_taken, r.lop_taken, r.holiday_work_days, r.total_hours]);
        csvContent += [headers.join(','), ...rows.map(e => e.map(val => `"${val === undefined || val === null ? '' : val}"`).join(','))].join('\n');
      } else {
        const headers = ['Date', 'Day', 'Clock In', 'Clock In Location', 'Clock Out', 'Clock Out Location', 'Hours Worked', 'Status'];
        const rows = (reportData[0]?.details || []).map(d => [d.date, d.dayName, d.clockIn, d.geofenceIn, d.clockOut, d.geofenceOut, d.hours, d.status]);
        csvContent += [headers.join(','), ...rows.map(e => e.map(val => `"${val === undefined || val === null ? '' : val}"`).join(','))].join('\n');
      }
    } else if (reportType === 'payroll') {
      const headers = ['Employee ID', 'Full Name', 'Department', 'Base Salary', 'Per Day Rate', 'Days Present', 'Absent', 'Half Day', 'LOP', 'Compensated', 'Holiday OT Days', 'Cuts Deductions', 'OT Earnings', 'Net Payout'];
      const rows = reportData.map(r => [r.employee_id, r.full_name, r.department_name, r.base_salary, r.per_day_pay, r.days_present, r.days_absent, r.days_half_day, r.lop_taken, r.compensated_days, r.extra_working_days, r.total_pay_cut, r.overtime_pay, r.net_payout]);
      csvContent += [headers.join(','), ...rows.map(e => e.map(val => `"${val === undefined || val === null ? '' : val}"`).join(','))].join('\n');
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `C-Hub_${reportType}_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      {/* Header */}
      <div className="flex-between m-b-20 no-print">
        <div>
          <h2 style={{ fontSize: '28px', color: 'var(--chub-purple)' }}>Reports Generator</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Build custom queries, filter employee operations, and export data ledger files.</p>
        </div>
      </div>

      {/* Query Form (Hidden on Print) */}
      <div className="card m-b-20 no-print">
        <form onSubmit={handleGenerateReport} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
          
          <div style={{ flex: 1.2, minWidth: '150px' }}>
            <label className="form-label">Report type</label>
            <select className="form-control" value={reportType} onChange={(e) => { setReportType(e.target.value); setSelectedEmployeeId(''); setReportData([]); }}>
              <option value="employees">Employee Register Ledger</option>
              <option value="attendance">Detailed Attendance Logs</option>
              <option value="leaves">Leave Applications Ledger</option>
              <option value="anomalies">Anomalies Report (Late / GPS Denied)</option>
              <option value="onboarding">KYC Pending / Onboarding list</option>
              <option value="detailed_attendance">Detailed Attendance Report</option>
              <option value="payroll">Monthly Payroll Report</option>
            </select>
          </div>

          {(reportType === 'detailed_attendance' || reportType === 'payroll') ? (
            <div style={{ display: 'flex', gap: '16px', flex: 2, minWidth: '350px' }}>
              <div style={{ flex: 1 }}>
                <label className="form-label">Month</label>
                <select className="form-control" value={reportMonth} onChange={(e) => { setReportMonth(Number(e.target.value)); setReportData([]); }}>
                  <option value="1">January</option>
                  <option value="2">February</option>
                  <option value="3">March</option>
                  <option value="4">April</option>
                  <option value="5">May</option>
                  <option value="6">June</option>
                  <option value="7">July</option>
                  <option value="8">August</option>
                  <option value="9">September</option>
                  <option value="10">October</option>
                  <option value="11">November</option>
                  <option value="12">December</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">Year</label>
                <select className="form-control" value={reportYear} onChange={(e) => { setReportYear(Number(e.target.value)); setReportData([]); }}>
                  {Array.from({ length: 5 }, (_, i) => {
                    const yr = new Date().getFullYear() - 2 + i;
                    return <option key={yr} value={yr}>{yr}</option>;
                  })}
                </select>
              </div>
              <div style={{ flex: 1.5 }}>
                <label className="form-label">Select Employee</label>
                <select className="form-control" value={selectedEmployeeId} onChange={(e) => { setSelectedEmployeeId(e.target.value); setReportData([]); }}>
                  <option value="">All Employees</option>
                  {employeesList.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.employee_id})</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            reportType !== 'onboarding' && reportType !== 'employees' && (
              <div style={{ display: 'flex', gap: '16px', flex: 1.5, minWidth: '240px' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">From Date</label>
                  <input type="date" className="form-control" value={fromDate} onChange={(e) => setFromDate(e.target.value)} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">To Date</label>
                  <input type="date" className="form-control" value={toDate} onChange={(e) => setToDate(e.target.value)} required />
                </div>
              </div>
            )
          )}

          {reportType !== 'detailed_attendance' && reportType !== 'payroll' && (
            <div style={{ flex: 1, minWidth: '140px' }}>
              <label className="form-label">Department filter</label>
              <select className="form-control" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                <option value="">All Departments</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ padding: '12px 24px' }}>
            Generate Report
          </button>
        </form>
      </div>

      {error && <div className="alert alert-error no-print"><ShieldAlert /><span>{error}</span></div>}

      {/* Generated Report Card Container */}
      {reportData.length > 0 && (
        <div className="printable-report-sheet">
          
          {/* Branded Report Header (Only visible on Print, hidden on normal page or vice versa) */}
          <div className="card flex-between" style={{ borderBottom: '2px solid var(--chub-purple)', borderRadius: 0, padding: '20px 0', marginBottom: '24px', backgroundColor: 'transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <img src="/logo.jpeg" alt="C-Hub" style={{ width: '50px', height: '50px', borderRadius: '8px' }} />
              <div>
                <h3 style={{ fontSize: '20px', color: 'var(--chub-purple)', margin: 0 }}>C-Hub / Chubworld</h3>
                <span style={{ fontSize: '11px', color: 'var(--chub-pink)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Creating Wow World</span>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '13px' }}>
              <div><strong>Report:</strong> {reportType.toUpperCase()}</div>
              <div><strong>Range:</strong> {fromDate} to {toDate}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Generated: {new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' })} in IST</div>
            </div>
          </div>

          {/* Action buttons (Hidden on Print) */}
          <div className="flex-between m-b-20 no-print">
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Generated {reportData.length} records in system.</span>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handleDownloadCSV} className="btn btn-secondary" style={{ padding: '8px 16px' }}>
                <Download size={16} /> Download CSV
              </button>
              <button onClick={handlePrint} className="btn btn-primary" style={{ padding: '8px 16px' }}>
                <Printer size={16} /> Print Report
              </button>
            </div>
          </div>

          {/* Detailed Attendance - Single Employee view stats header */}
          {reportType === 'detailed_attendance' && selectedEmployeeId && reportData[0] && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '20px' }} className="no-print">
                {[
                  { label: 'Work Days', val: reportData[0].total_working_days },
                  { label: 'Present', val: reportData[0].days_present, color: '#2ec4b6' },
                  { label: 'Late', val: reportData[0].days_late, color: '#ffb703' },
                  { label: 'Half Day', val: reportData[0].days_half_day, color: '#fd7e14' },
                  { label: 'Absent', val: reportData[0].days_absent, color: '#e71d36' },
                  { label: 'CL Taken', val: reportData[0].cl_taken },
                  { label: 'SL Taken', val: reportData[0].sl_taken },
                  { label: 'EL Taken', val: reportData[0].el_taken },
                  { label: 'LOP Taken', val: reportData[0].lop_taken, color: '#e71d36' },
                  { label: 'OT Days', val: reportData[0].holiday_work_days, color: '#9d4edd' },
                  { label: 'Total Hours', val: `${reportData[0].total_hours} hrs` }
                ].map((stat, i) => (
                  <div key={i} className="card" style={{ padding: '12px', textAlign: 'center', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{stat.label}</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: stat.color || 'inherit', marginTop: '4px' }}>{stat.val}</div>
                  </div>
                ))}
              </div>
              <button 
                className="btn btn-secondary no-print" 
                onClick={() => { setSelectedEmployeeId(''); handleGenerateReport({ preventDefault: () => {} }); }}
                style={{ marginBottom: '16px', fontSize: '13px' }}
              >
                &larr; Back to All Summaries
              </button>
            </div>
          )}

          {/* Payroll - Single Employee detailed Payslip view */}
          {reportType === 'payroll' && selectedEmployeeId && reportData[0] && (
            <div style={{ margin: '20px auto', maxWidth: '750px' }}>
              <button 
                className="btn btn-secondary no-print" 
                onClick={() => { setSelectedEmployeeId(''); handleGenerateReport({ preventDefault: () => {} }); }}
                style={{ marginBottom: '20px', fontSize: '13px' }}
              >
                &larr; Back to All Payouts
              </button>
              
              <div style={{ 
                border: '2px solid var(--border-color)', 
                borderRadius: '16px', 
                padding: '30px', 
                backgroundColor: 'rgba(255, 255, 255, 0.01)', 
                boxShadow: '0 8px 30px rgba(0,0,0,0.1)' 
              }} className="printable-payslip">
                <div style={{ textAlign: 'center', borderBottom: '2px solid var(--chub-purple)', paddingBottom: '20px', marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '22px', color: 'var(--chub-purple)', margin: 0 }}>C-Hub / Chubworld</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--chub-pink)', textTransform: 'uppercase', fontWeight: 600 }}>Creating Wow World</p>
                  <h4 style={{ margin: '16px 0 0 0', fontSize: '16px', fontWeight: 600 }}>PAYSLIP FOR THE MONTH OF {new Date(reportYear, reportMonth - 1).toLocaleString('en-US', { month: 'LONG' }).toUpperCase()} {reportYear}</h4>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px', fontSize: '14px' }}>
                  <div>
                    <div style={{ marginBottom: '8px' }}><strong>Employee Name:</strong> {reportData[0].full_name}</div>
                    <div style={{ marginBottom: '8px' }}><strong>Employee ID:</strong> {reportData[0].employee_id}</div>
                    <div><strong>Department:</strong> {reportData[0].department_name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ marginBottom: '8px' }}><strong>Days in Month:</strong> {reportData[0].total_calendar_days || 30}</div>
                    <div style={{ marginBottom: '8px' }}><strong>Present Days:</strong> {reportData[0].days_present}</div>
                    <div><strong>Absent/LOP Days:</strong> {reportData[0].days_absent + reportData[0].lop_taken} (Compensated: {reportData[0].compensated_days})</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '20px', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', padding: '20px 0', marginBottom: '24px' }}>
                  <div style={{ flex: 1, borderRight: '1px solid var(--border-color)', paddingRight: '20px' }}>
                    <h5 style={{ margin: '0 0 12px 0', color: '#2ec4b6', fontSize: '15px', fontWeight: 600 }}>Earnings</h5>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                      <span>Base Salary:</span>
                      <strong>₹{reportData[0].base_salary?.toLocaleString('en-IN')}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                      <span>Holiday OT Pay:</span>
                      <strong>₹{reportData[0].overtime_pay?.toLocaleString('en-IN')}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '8px', borderTop: '1px dashed var(--border-color)', fontWeight: 'bold' }}>
                      <span>Gross Earnings:</span>
                      <span>₹{(reportData[0].base_salary + reportData[0].overtime_pay).toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <div style={{ flex: 1, paddingLeft: '20px' }}>
                    <h5 style={{ margin: '0 0 12px 0', color: '#e71d36', fontSize: '15px', fontWeight: 600 }}>Deductions</h5>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                      <span>Leave Pay Cuts:</span>
                      <strong>₹{reportData[0].total_pay_cut?.toLocaleString('en-IN')}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '8px', borderTop: '1px dashed var(--border-color)', fontWeight: 'bold' }}>
                      <span>Total Deductions:</span>
                      <span>₹{reportData[0].total_pay_cut?.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                <div style={{ 
                  backgroundColor: 'rgba(216, 90, 166, 0.05)', 
                  border: '1px solid var(--chub-pink)', 
                  borderRadius: '8px', 
                  padding: '16px', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center' 
                }}>
                  <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--chub-pink)' }}>Net Payable Salary:</span>
                  <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--chub-pink)' }}>₹{reportData[0].net_payout?.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          )}

          {/* Tables layout */}
          {(!selectedEmployeeId || reportType !== 'payroll') && (
            <div className="table-container" style={{ border: 'none' }}>
              <table className="custom-table" style={{ width: '100%' }}>
                
                {/* EMPLOYEES LEDGER HEADERS */}
                {(reportType === 'employees' || reportType === 'onboarding') && (
                  <>
                    <thead>
                      <tr>
                        <th>Emp ID</th>
                        <th>Full Name</th>
                        <th>Email ID</th>
                        <th>Mobile</th>
                        <th>Department</th>
                        <th>Designation</th>
                        <th>Onboarding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.map((r, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 'bold' }}>{r.employee_id}</td>
                          <td style={{ fontWeight: 600 }}>{r.full_name}</td>
                          <td>{r.email}</td>
                          <td>{r.mobile}</td>
                          <td>{r.department_name}</td>
                          <td>{r.designation_name}</td>
                          <td><span className="badge badge-kyc-pending">{r.onboarding_status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                {/* ATTENDANCE / ANOMALIES LOGS HEADERS */}
                {(reportType === 'attendance' || reportType === 'anomalies') && (
                  <>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Employee</th>
                        <th>Clock In (IST)</th>
                        <th>In Geofence</th>
                        <th>Clock Out (IST)</th>
                        <th>Hours</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.map((r, i) => (
                        <tr key={i}>
                          <td><strong>{r.date}</strong></td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{r.full_name}</div>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.employee_id}</span>
                          </td>
                          <td>{r.clock_in_time}</td>
                          <td>
                            <span className={`badge ${r.clock_in_location_status === 'Verified-Inside' ? 'badge-active' : 'badge-rejected'}`}>
                              {r.clock_in_location_status}
                            </span>
                          </td>
                          <td>{r.clock_out_time || '--:--:--'}</td>
                          <td>{r.total_hours ? `${r.total_hours} hrs` : '--'}</td>
                          <td>
                            <span className={`badge ${r.status === 'Present' ? 'badge-active' : r.status === 'Late' ? 'badge-pending' : r.status === 'rejected' ? 'badge-rejected' : 'badge-rejected'}`}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                {/* LEAVES LEDGER HEADERS */}
                {reportType === 'leaves' && (
                  <>
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Leave Type</th>
                        <th>Range Dates</th>
                        <th>Total Days</th>
                        <th>Reason</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.map((r, i) => (
                        <tr key={i}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{r.full_name}</div>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.employee_id}</span>
                          </td>
                          <td><span className="badge badge-kyc-pending">{r.leave_code}</span></td>
                          <td>{r.from_date} to {r.to_date}</td>
                          <td style={{ fontWeight: 'bold' }}>{r.total_days} Days</td>
                          <td style={{ fontSize: '13px' }}>{r.reason}</td>
                          <td>
                            <span className={`badge ${r.status === 'Approved' ? 'badge-active' : r.status === 'Rejected' ? 'badge-rejected' : 'badge-pending'}`}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                {/* DETAILED ATTENDANCE - ALL EMPLOYEES SUMMARY */}
                {reportType === 'detailed_attendance' && !selectedEmployeeId && (
                  <>
                    <thead>
                      <tr>
                        <th>Emp ID</th>
                        <th>Full Name</th>
                        <th>Department</th>
                        <th>Work Days</th>
                        <th>Present</th>
                        <th>Late</th>
                        <th>Half Day</th>
                        <th>Absent</th>
                        <th>CL</th>
                        <th>SL</th>
                        <th>EL</th>
                        <th>LOP</th>
                        <th>OT Days</th>
                        <th>Total Hours</th>
                        <th style={{ width: '100px', textAlign: 'center' }} className="no-print">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.map((r, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 'bold' }}>{r.employee_id}</td>
                          <td style={{ fontWeight: 600 }}>{r.full_name}</td>
                          <td>{r.department_name}</td>
                          <td>{r.total_working_days}</td>
                          <td><strong>{r.days_present}</strong></td>
                          <td style={{ color: '#ffb703' }}>{r.days_late}</td>
                          <td style={{ color: '#fd7e14' }}>{r.days_half_day}</td>
                          <td style={{ color: '#e71d36', fontWeight: 600 }}>{r.days_absent}</td>
                          <td>{r.cl_taken}</td>
                          <td>{r.sl_taken}</td>
                          <td>{r.el_taken}</td>
                          <td style={{ color: '#e71d36' }}>{r.lop_taken}</td>
                          <td style={{ color: '#9d4edd' }}>{r.holiday_work_days}</td>
                          <td>{r.total_hours} hrs</td>
                          <td className="no-print" style={{ textAlign: 'center' }}>
                            <button 
                              type="button"
                              onClick={() => handleQuickViewEmployeeReport(r.employee_id_val, 'detailed_attendance')} 
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                            >
                              View Days
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                {/* DETAILED ATTENDANCE - SINGLE EMPLOYEE DAY-BY-DAY LIST */}
                {reportType === 'detailed_attendance' && selectedEmployeeId && reportData[0] && (
                  <>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Day</th>
                        <th>Clock In</th>
                        <th>In Geofence</th>
                        <th>Clock Out</th>
                        <th>Out Geofence</th>
                        <th>Hours</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData[0].details?.map((d, idx) => (
                        <tr key={idx} style={{ backgroundColor: d.isHoliday ? 'rgba(157, 78, 221, 0.03)' : 'transparent' }}>
                          <td><strong>{d.date}</strong></td>
                          <td style={{ color: d.isHoliday ? 'var(--chub-pink)' : 'inherit' }}>{d.dayName}</td>
                          <td>
                            <div>{d.clockIn || '--:--:--'}</div>
                            {d.clock_in_ip === 'admin added' && <span className="badge" style={{ backgroundColor: '#6f42c1', color: '#fff', fontSize: '8px', padding: '1px 4px' }}>Admin Added</span>}
                            {d.clock_in_ip === 'admin updated' && <span className="badge" style={{ backgroundColor: '#ff8c00', color: '#fff', fontSize: '8px', padding: '1px 4px' }}>Admin Updated</span>}
                          </td>
                          <td>
                            {d.clockIn ? (
                              <span className={`badge ${d.geofenceIn === 'Verified-Inside' ? 'badge-active' : 'badge-rejected'}`}>
                                {d.geofenceIn}
                              </span>
                            ) : '--'}
                          </td>
                          <td>
                            <div>{d.clockOut || '--:--:--'}</div>
                            {d.clock_out_ip === 'admin added' && <span className="badge" style={{ backgroundColor: '#6f42c1', color: '#fff', fontSize: '8px', padding: '1px 4px' }}>Admin Added</span>}
                            {d.clock_out_ip === 'admin updated' && <span className="badge" style={{ backgroundColor: '#ff8c00', color: '#fff', fontSize: '8px', padding: '1px 4px' }}>Admin Updated</span>}
                          </td>
                          <td>
                            {d.clockOut ? (
                              <span className={`badge ${d.geofenceOut === 'Verified-Inside' ? 'badge-active' : 'badge-rejected'}`}>
                                {d.geofenceOut}
                              </span>
                            ) : '--'}
                          </td>
                          <td>{d.hours ? `${d.hours} hrs` : '--'}</td>
                          <td>
                            <span className={`badge ${
                              d.status === 'Present' || d.status === 'Holiday Work'
                                ? 'badge-active' 
                                : d.status === 'Late' 
                                ? 'badge-pending' 
                                : d.status === 'Paid rest day' 
                                ? 'badge-active' 
                                : d.status.startsWith('Leave') 
                                ? 'badge-pending'
                                : 'badge-rejected'
                            }`}>
                              {d.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                {/* PAYROLL - ALL EMPLOYEES LIST */}
                {reportType === 'payroll' && !selectedEmployeeId && (
                  <>
                    <thead>
                      <tr>
                        <th>Emp ID</th>
                        <th>Full Name</th>
                        <th>Department</th>
                        <th>Base Salary</th>
                        <th>Per Day Rate</th>
                        <th>Present</th>
                        <th>Absent Cut</th>
                        <th>LOP Cut</th>
                        <th>Half Day Cut</th>
                        <th>Compensated</th>
                        <th>OT Payout</th>
                        <th>Total Deductions</th>
                        <th>Net Payout</th>
                        <th style={{ width: '100px', textAlign: 'center' }} className="no-print">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.map((r, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 'bold' }}>{r.employee_id}</td>
                          <td style={{ fontWeight: 600 }}>{r.full_name}</td>
                          <td>{r.department_name}</td>
                          <td><strong>₹{r.base_salary?.toLocaleString('en-IN')}</strong></td>
                          <td>₹{r.per_day_pay}</td>
                          <td>{r.days_present}</td>
                          <td style={{ color: r.days_absent > 0 ? '#e71d36' : 'inherit' }}>{r.days_absent}</td>
                          <td style={{ color: r.lop_taken > 0 ? '#e71d36' : 'inherit' }}>{r.lop_taken}</td>
                          <td>{r.days_half_day}</td>
                          <td style={{ color: '#2ec4b6' }}>{r.compensated_days}</td>
                          <td style={{ color: '#9d4edd' }}>₹{r.overtime_pay?.toLocaleString('en-IN')}</td>
                          <td style={{ color: '#e71d36' }}>₹{r.total_pay_cut?.toLocaleString('en-IN')}</td>
                          <td style={{ color: 'var(--chub-pink)', fontWeight: 'bold' }}>₹{r.net_payout?.toLocaleString('en-IN')}</td>
                          <td className="no-print" style={{ textAlign: 'center' }}>
                            <button 
                              type="button"
                              onClick={() => handleQuickViewEmployeeReport(r.employee_id_val, 'payroll')} 
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                            >
                              Payslip
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

              </table>
            </div>
          )}

          {/* Branded Footer */}
          <div className="flex-between" style={{ borderTop: '1px solid var(--border-color)', padding: '20px 0', marginTop: '24px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span>Generated from C-Hub HR Admin Panel</span>
            <span>Branding: Creating Wow World</span>
          </div>

        </div>
      )}

      {reportData.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }} className="card">
          <FileSpreadsheet size={48} style={{ margin: '0 auto 16px auto', display: 'block', color: 'var(--chub-purple)' }} />
          <h4 style={{ margin: 0 }}>Query report ledger parameters above to render tables.</h4>
        </div>
      )}

      {/* Print stylesheet override */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-report-sheet, .printable-report-sheet * {
            visibility: visible;
          }
          .printable-report-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
