import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { CalendarDays, Printer, ChevronLeft, ChevronRight, Clock, FileText } from 'lucide-react';

export default function ESSPerformance() {
  const { request, user } = useAuth();
  
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Performance metrics summary
  const [summary, setSummary] = useState({
    present: 0, late: 0, halfDay: 0, leave: 0, hours: 0, locationNotVerified: 0
  });

  useEffect(() => {
    fetchLogs();
  }, [currentDate]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const data = await request('/attendance/my-logs');
      setLogs(data || []);
      calculateSummary(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const calculateSummary = (allLogs) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Filter logs for this month in IST
    const thisMonthLogs = allLogs.filter(log => {
      const d = new Date(log.date);
      const istYear = parseInt(d.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric' }), 10);
      const istMonth = parseInt(d.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', month: 'numeric' }), 10) - 1;
      return istYear === year && istMonth === month;
    });

    let present = 0;
    let late = 0;
    let halfDay = 0;
    let leave = 0;
    let hours = 0;
    let locationNotVerified = 0;

    thisMonthLogs.forEach(log => {
      if (log.status === 'Present') present++;
      else if (log.status === 'Late') { present++; late++; }
      else if (log.status === 'Half Day') { present++; halfDay++; }
      else if (log.status === 'Leave') leave++;
      else if (log.status === 'Location Not Verified') { present++; locationNotVerified++; }
      
      if (log.total_hours) {
        hours += parseFloat(log.total_hours);
      }
    });

    setSummary({
      present, late, halfDay, leave, hours: hours.toFixed(1), locationNotVerified
    });
  };

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const totalDays = getDaysInMonth(year, month);
  const firstDayIndex = getFirstDayOfMonth(year, month);

  const daysGrid = [];
  for (let i = 0; i < firstDayIndex; i++) {
    daysGrid.push(null);
  }
  for (let i = 1; i <= totalDays; i++) {
    daysGrid.push(i);
  }

  const monthName = currentDate.toLocaleString('en-US', { month: 'long', timeZone: 'Asia/Kolkata' });

  // Get log for specific day
  const getDayLog = (dayNum) => {
    if (!dayNum) return null;
    const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    return logs.find(log => {
      const logD = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(log.date));
      return logD === formattedDate;
    });
  };

  // Color mapper for calendar day
  const getDayStyles = (log) => {
    if (!log) return { bg: '#F8FAFC', color: '#1A1D20' };
    
    switch (log.status) {
      case 'Present':
        return { bg: '#EBFDF4', color: '#047857', border: '1px solid rgba(16, 185, 129, 0.2)' };
      case 'Late':
        return { bg: '#FFFBEB', color: '#B45309', border: '1px solid rgba(245, 158, 11, 0.2)' };
      case 'Half Day':
        return { bg: '#FEF3C7', color: '#D97706', border: '1px solid rgba(217, 119, 6, 0.2)' };
      case 'Leave':
        return { bg: '#EFF6FF', color: '#2E62F6', border: '1px solid rgba(46, 98, 246, 0.2)' };
      case 'Location Not Verified':
        return { bg: '#FEF2F2', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.2)' };
      default:
        return { bg: '#F8FAFC', color: '#1A1D20' };
    }
  };

  // Get list of filtered logs for this month (ordered chronologically)
  const thisMonthLogs = logs.filter(log => {
    const d = new Date(log.date);
    const istYear = parseInt(d.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric' }), 10);
    const istMonth = parseInt(d.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', month: 'numeric' }), 10) - 1;
    return istYear === year && istMonth === month;
  }).sort((a, b) => new Date(b.date) - new Date(a.date)); // Latest first

  const handlePrintReport = () => {
    window.print();
  };

  if (loading && logs.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <p>Loading performance metrics...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '0px' }}>
      
      {/* Header and PDF Print Actions */}
      <div className="flex-between m-b-20 no-print" style={{ marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1A1D20', margin: '0 0 4px 0' }}>Performance & Logs</h2>
          <p style={{ color: '#6B7280', fontSize: '12px', margin: 0 }}>Review monthly attendance calendars, active hours, and print sheets.</p>
        </div>
        <button onClick={handlePrintReport} className="btn btn-primary" style={{ height: '36px', padding: '6px 14px', borderRadius: '20px', fontSize: '11px' }}>
          <Printer size={14} /> Print Sheet
        </button>
      </div>

      {/* Printable Sheet Branding (Only visible on Print) */}
      <div className="printable-report-sheet">
        
        {/* Brand header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '2px solid #2E62F6', paddingBottom: '12px', marginBottom: '20px' }}>
          <img src="/logo.jpeg" alt="C-Hub" style={{ width: '40px', height: '40px', borderRadius: '8px' }} />
          <div>
            <h3 style={{ fontSize: '16px', color: '#2E62F6', margin: 0 }}>C-Hub Internal operations</h3>
            <span style={{ fontSize: '10px', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Creating Wow World</span>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right', fontSize: '11px' }}>
            <div><strong>Employee:</strong> {user?.email}</div>
            <div><strong>Month:</strong> {monthName} {year}</div>
            <div style={{ fontSize: '9px', color: '#6B7280' }}>Printed in IST Zone</div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
          <div className="card" style={{ padding: '12px !important', borderLeft: '4px solid #10B981', borderTop: 'none', borderRight: 'none', borderBottom: 'none', borderRadius: '8px' }}>
            <span style={{ fontSize: '9px', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>Days Present</span>
            <h4 style={{ fontSize: '18px', margin: '4px 0 0 0', fontWeight: 'bold' }}>{summary.present} Days</h4>
          </div>
          <div className="card" style={{ padding: '12px !important', borderLeft: '4px solid #2E62F6', borderTop: 'none', borderRight: 'none', borderBottom: 'none', borderRadius: '8px' }}>
            <span style={{ fontSize: '9px', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>Leaves Taken</span>
            <h4 style={{ fontSize: '18px', margin: '4px 0 0 0', fontWeight: 'bold' }}>{summary.leave} Days</h4>
          </div>
          <div className="card" style={{ padding: '12px !important', borderLeft: '4px solid #4B5563', borderTop: 'none', borderRight: 'none', borderBottom: 'none', borderRadius: '8px' }}>
            <span style={{ fontSize: '9px', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>Active Hours</span>
            <h4 style={{ fontSize: '18px', margin: '4px 0 0 0', fontWeight: 'bold' }}>{summary.hours} hrs</h4>
          </div>
        </div>

        {/* Calendar and logs layout */}
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          
          {/* Calendar Box */}
          <div className="card" style={{ flex: 1.5, minWidth: '320px' }}>
            <div className="flex-between no-print" style={{ marginBottom: '16px' }}>
              <button onClick={handlePrevMonth} className="btn" style={{ padding: '4px 10px', fontSize: '10px', backgroundColor: '#EEF2F6', border: 'none', color: '#2E62F6', borderRadius: '4px' }}>
                <ChevronLeft size={14} /> Prev
              </button>
              <h3 style={{ fontSize: '14px', margin: 0, fontWeight: '700' }}>{monthName} {year}</h3>
              <button onClick={handleNextMonth} className="btn" style={{ padding: '4px 10px', fontSize: '10px', backgroundColor: '#EEF2F6', border: 'none', color: '#2E62F6', borderRadius: '4px' }}>
                Next <ChevronRight size={14} />
              </button>
            </div>
            
            <div className="print-only" style={{ display: 'none', textAlign: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', margin: 0 }}>{monthName} {year} Attendance Calendar</h3>
            </div>

            {/* Calendar grid */}
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center', fontWeight: 'bold', fontSize: '11px', marginBottom: '6px', color: '#6B7280' }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <span key={d}>{d}</span>)}
              </div>

              <div className="ess-calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', minHeight: '220px' }}>
                {daysGrid.map((day, idx) => {
                  const log = getDayLog(day);
                  const styles = getDayStyles(log);
                  
                  return (
                    <div 
                      key={idx}
                      className="calendar-day-cell"
                      style={{
                        backgroundColor: styles.bg,
                        color: styles.color,
                        border: styles.border || '1px solid #E5E7EB',
                        borderRadius: '6px',
                        padding: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: '48px'
                      }}
                    >
                      {day ? (
                        <>
                          <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{day}</span>
                          {log && (
                            <span className="calendar-day-status" style={{ fontSize: '8px', fontWeight: '700', textTransform: 'uppercase', display: 'block', textAlign: 'right' }}>
                              {log.status === 'Location Not Verified' ? 'No GPS' : log.status}
                            </span>
                          )}
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Legends inside/below the calendar */}
            <div style={{ marginTop: '16px', borderTop: '1px solid #F1F5F9', paddingTop: '12px' }}>
              <h4 style={{ fontSize: '11px', fontWeight: 'bold', color: '#1A1D20', marginBottom: '8px' }}>Legends</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', fontSize: '10px', color: '#4B5563' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#EBFDF4', border: '1px solid rgba(16, 185, 129, 0.2)' }} />
                  <span>Present</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#FFFBEB', border: '1px solid rgba(245, 158, 11, 0.2)' }} />
                  <span>Late Arrival</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#FEF3C7', border: '1px solid rgba(217, 119, 6, 0.2)' }} />
                  <span>Half Day</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#EFF6FF', border: '1px solid rgba(46, 98, 246, 0.2)' }} />
                  <span>Leave</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#FEF2F2', border: '1px solid rgba(239, 68, 68, 0.2)' }} />
                  <span>No GPS Verification</span>
                </div>
              </div>
            </div>

          </div>

          {/* Chronological logs list */}
          <div className="card" style={{ flex: 1.2, minWidth: '300px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '14px', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px', marginBottom: '12px', color: '#1A1D20', fontWeight: '700' }}>
              Attendance Details Log
            </h3>
            
            {thisMonthLogs.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '40px 10px', color: '#6B7280', fontSize: '12px', margin: 0 }}>No logs recorded for this month.</p>
            ) : (
              <div style={{ maxHeight: '360px', overflowY: 'auto', paddingRight: '4px' }}>
                {thisMonthLogs.map((log, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F1F5F9', fontSize: '11px' }}>
                    <div>
                      <strong style={{ display: 'block', color: '#1A1D20', fontSize: '12px' }}>
                        {new Date(log.date).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', weekday: 'short' })}
                      </strong>
                      <span style={{ color: '#6B7280', fontSize: '11px' }}>
                        In: {log.clock_in_time || '--:--'} | Out: {log.clock_out_time || '--:--'}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: '#4B5563', fontWeight: 'bold' }}>
                        {log.total_hours ? `${log.total_hours} hrs` : '--'}
                      </span>
                      <span className={`badge ${
                        log.status === 'Present' ? 'badge-active' :
                        log.status === 'Late' ? 'badge-pending' :
                        log.status === 'Half Day' ? 'badge-pending' :
                        log.status === 'Leave' ? 'badge-active' : 'badge-rejected'
                      }`} style={{ fontSize: '9px', padding: '2px 8px' }}>
                        {log.status === 'Location Not Verified' ? 'No GPS' : log.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Print Footer */}
        <div className="print-only" style={{ display: 'none', borderTop: '1px solid #E5E7EB', padding: '16px 0', marginTop: '30px', fontSize: '10px', color: '#6B7280', justifyContent: 'space-between' }}>
          <span>Generated from C-Hub ESS Panel</span>
          <span>Branding: Creating Wow World</span>
        </div>

      </div>

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
          .print-only {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}
