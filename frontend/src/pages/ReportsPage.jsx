import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  FileSpreadsheet, Download, Printer, ShieldAlert, 
  Users, CalendarClock, UserCheck, Clock, MapPin
} from 'lucide-react';

export default function ReportsPage() {
  const { request } = useAuth();
  
  // States
  const [reportType, setReportType] = useState('employees'); // 'employees', 'attendance', 'leaves', 'anomalies', 'onboarding'
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [departmentId, setDepartmentId] = useState('');
  
  const [departments, setDepartments] = useState([]);
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
    } catch (err) {
      console.error(err);
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
            <select className="form-control" value={reportType} onChange={(e) => setReportType(e.target.value)}>
              <option value="employees">Employee Register Ledger</option>
              <option value="attendance">Detailed Attendance Logs</option>
              <option value="leaves">Leave Applications Ledger</option>
              <option value="anomalies">Anomalies Report (Late / GPS Denied)</option>
              <option value="onboarding">KYC Pending / Onboarding list</option>
            </select>
          </div>

          {reportType !== 'onboarding' && reportType !== 'employees' && (
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
          )}

          <div style={{ flex: 1, minWidth: '140px' }}>
            <label className="form-label">Department filter</label>
            <select className="form-control" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

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

          {/* Tables layout */}
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
                          <span className={`badge ${r.status === 'Present' ? 'badge-active' : r.status === 'Late' ? 'badge-pending' : 'badge-rejected'}`}>
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

            </table>
          </div>

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
