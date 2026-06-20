import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { CalendarDays, Printer, ChevronLeft, ChevronRight, Clock, FileText } from 'lucide-react';

export default function ESSPerformance() {
  const { request, user } = useAuth();
  
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date()); // Used to toggle month

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
      setLogs(data);
      calculateSummary(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const calculateSummary = (allLogs) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Filter logs for this month
    const thisMonthLogs = allLogs.filter(log => {
      const d = new Date(log.date);
      return d.getFullYear() === year && d.getMonth() === month;
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
    return new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Build Calendar grid
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const totalDays = getDaysInMonth(year, month);
  const firstDayIndex = getFirstDayOfMonth(year, month); // Day offset

  const daysGrid = [];
  // Empty blocks for offset
  for (let i = 0; i < firstDayIndex; i++) {
    daysGrid.push(null);
  }
  // Month days
  for (let i = 1; i <= totalDays; i++) {
    daysGrid.push(i);
  }

  const monthName = currentDate.toLocaleString('en-US', { month: 'long' });

  // Get log for specific day
  const getDayLog = (dayNum) => {
    if (!dayNum) return null;
    const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    return logs.find(log => {
      // Handle UTC vs Local string
      const logD = new Date(log.date).toISOString().split('T')[0];
      return logD === formattedDate;
    });
  };

  // Color mapper for calendar day
  const getDayStyles = (log) => {
    if (!log) return { bg: 'var(--bg-primary)', color: 'var(--text-main)' };
    
    switch (log.status) {
      case 'Present':
        return { bg: 'rgba(34, 197, 94, 0.12)', color: 'var(--color-success)', border: '1px solid var(--color-success)' };
      case 'Late':
        return { bg: 'rgba(245, 158, 11, 0.12)', color: 'var(--color-warning)', border: '1px solid var(--color-warning)' };
      case 'Half Day':
        return { bg: 'rgba(245, 158, 11, 0.18)', color: '#d97706', border: '1px solid #d97706' };
      case 'Leave':
        return { bg: 'rgba(216, 90, 166, 0.12)', color: 'var(--chub-pink)', border: '1px solid var(--chub-pink)' };
      case 'Location Not Verified':
        return { bg: 'rgba(239, 68, 68, 0.12)', color: 'var(--color-error)', border: '1px solid var(--color-error)' };
      default:
        return { bg: 'var(--bg-primary)', color: 'var(--text-main)' };
    }
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div>
      {/* Header and PDF Print Actions */}
      <div className="flex-between m-b-20 no-print">
        <div>
          <h2 style={{ fontSize: '28px', color: 'var(--chub-purple)' }}>Performance & Logs</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Review monthly attendance calendars, working hours, and export personal PDF reports.</p>
        </div>
        <button onClick={handlePrintReport} className="btn btn-primary">
          <Printer size={16} /> Print Monthly Sheet
        </button>
      </div>

      {/* Printable Sheet Branding (Only visible on Print) */}
      <div className="printable-report-sheet">
        
        {/* Brand header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '2px solid var(--chub-purple)', paddingBottom: '16px', marginBottom: '24px' }}>
          <img src="/logo.jpeg" alt="C-Hub" style={{ width: '50px', height: '50px', borderRadius: '8px' }} />
          <div>
            <h3 style={{ fontSize: '20px', color: 'var(--chub-purple)', margin: 0 }}>C-Hub Internal operations</h3>
            <span style={{ fontSize: '11px', color: 'var(--chub-pink)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Creating Wow World</span>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right', fontSize: '12px' }}>
            <div><strong>Employee:</strong> {user?.email}</div>
            <div><strong>Month:</strong> {monthName} {year}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Printed in IST Zone</div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid-cols-4 m-b-20">
          <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--color-success)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>DAYS PRESENT</span>
            <h4 style={{ fontSize: '24px', margin: 0 }}>{summary.present} Days</h4>
          </div>
          <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--color-warning)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>LATE ARRIVALS</span>
            <h4 style={{ fontSize: '24px', margin: 0 }}>{summary.late}</h4>
          </div>
          <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--chub-pink)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>AVAILED LEAVES</span>
            <h4 style={{ fontSize: '24px', margin: 0 }}>{summary.leave}</h4>
          </div>
          <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--chub-purple)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL ACTIVE HOURS</span>
            <h4 style={{ fontSize: '24px', margin: 0 }}>{summary.hours} hrs</h4>
          </div>
        </div>

        {/* Calendar and legends layout */}
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          
          {/* Calendar Box */}
          <div className="card" style={{ flex: 1.8, minWidth: '320px' }}>
            <div className="flex-between no-print" style={{ marginBottom: '20px' }}>
              <button onClick={handlePrevMonth} className="btn btn-secondary" style={{ padding: '6px 12px' }}>
                <ChevronLeft size={16} /> Prev
              </button>
              <h3 style={{ fontSize: '18px', margin: 0 }}>{monthName} {year}</h3>
              <button onClick={handleNextMonth} className="btn btn-secondary" style={{ padding: '6px 12px' }}>
                Next <ChevronRight size={16} />
              </button>
            </div>
            
            {/* Calendar header shown on print */}
            <div className="print-only" style={{ display: 'none', textAlign: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', margin: 0 }}>{monthName} {year} Attendance Calendar</h3>
            </div>

            {/* Calendar grid */}
            <div>
              {/* Day names */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center', fontWeight: 'bold', fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <span key={d}>{d}</span>)}
              </div>

              {/* Grid content */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', minHeight: '260px' }}>
                {daysGrid.map((day, idx) => {
                  const log = getDayLog(day);
                  const styles = getDayStyles(log);
                  
                  return (
                    <div 
                      key={idx}
                      style={{
                        backgroundColor: styles.bg,
                        color: styles.color,
                        border: styles.border || '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: '56px',
                        transition: 'all 0.2s'
                      }}
                    >
                      {day ? (
                        <>
                          <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{day}</span>
                          {log && (
                            <span style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', display: 'block', textAlign: 'right' }}>
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
          </div>

          {/* Legends Column */}
          <div className="card" style={{ flex: 1, minWidth: '240px' }}>
            <h3 style={{ fontSize: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '16px' }}>
              Attendance Legends
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: 'rgba(34, 197, 94, 0.12)', border: '1px solid var(--color-success)' }} />
                <span><strong>Present:</strong> Valid check-in inside office geofence</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: 'rgba(245, 158, 11, 0.12)', border: '1px solid var(--color-warning)' }} />
                <span><strong>Late Arrival:</strong> Clocked in after shift grace period</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: 'rgba(245, 158, 11, 0.18)', border: '1px solid #d97706' }} />
                <span><strong>Half Day:</strong> Worked hours under 4.0 hours</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: 'rgba(216, 90, 166, 0.12)', border: '1px solid var(--chub-pink)' }} />
                <span><strong>Approved Leave:</strong> Approved day off</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid var(--color-error)' }} />
                <span><strong>Location Not Verified:</strong> GPS denied / outside radius</span>
              </div>
            </div>
            
            <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
              * Monthly logs calculated using IST timezone standard. Report generates directly from C-Hub database registries.
            </div>
          </div>

        </div>

        {/* Print Footer */}
        <div className="print-only" style={{ display: 'none', borderTop: '1px solid var(--border-color)', padding: '20px 0', marginTop: '40px', fontSize: '11px', color: 'var(--text-muted)', justifyContent: 'space-between' }}>
          <span>Generated from C-Hub HR Admin Panel</span>
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
