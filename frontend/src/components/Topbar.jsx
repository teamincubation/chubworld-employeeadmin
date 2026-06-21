import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sun, Moon, Bell, Shield, User as UserIcon } from 'lucide-react';

export default function Topbar() {
  const { user, theme, toggleTheme } = useAuth();
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');

  // Clock updating in IST
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // IST offset: UTC+5:30
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const ist = new Date(utc + (3600000 * 5.5));
      
      const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
      const dateOptions = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
      
      setCurrentTime(ist.toLocaleTimeString('en-US', timeOptions));
      setCurrentDate(ist.toLocaleDateString('en-US', dateOptions));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!user) return null;

  return (
    <header style={{
      height: '70px',
      backgroundColor: 'var(--bg-card)',
      borderBottom: '1px solid var(--border-color)',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: 'var(--shadow-sm)',
      position: 'relative',
      zIndex: 90
    }}>
      {/* Time and Date Section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ 
            fontSize: '16px', 
            fontWeight: 700, 
            color: 'var(--chub-purple)',
            fontFamily: 'Poppins',
            letterSpacing: '0.5px'
          }}>{currentTime} IST</span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>{currentDate}</span>
        </div>
        <div style={{
          padding: '4px 10px',
          backgroundColor: 'var(--chub-light-lavender)',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: '600',
          color: 'var(--chub-purple)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Server-Side IST Time
        </div>
      </div>

      {/* Profile & Controls Section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {/* Theme Toggle */}
        <button 
          onClick={toggleTheme}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-main)',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.2s'
          }}
          className="topbar-icon-btn"
          title="Toggle Light/Dark Theme"
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} style={{ color: 'var(--chub-pink)' }} />}
        </button>

        {/* Notifications Icon (Mock) */}
        <div style={{ position: 'relative' }}>
          <button 
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-main)',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s'
            }}
            className="topbar-icon-btn"
          >
            <Bell size={20} />
          </button>
          <span style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: 'var(--chub-pink)',
            border: '2px solid var(--bg-card)'
          }} />
        </div>

        {/* User Card */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          paddingLeft: '16px',
          borderLeft: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ 
              fontSize: '14px', 
              fontWeight: 600, 
              color: 'var(--text-main)' 
            }}>{user.email.split('@')[0]}</span>
            <span style={{ 
              fontSize: '11px', 
              fontWeight: 700, 
              color: 'var(--chub-pink)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>{user.role}</span>
          </div>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'var(--chub-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <UserIcon size={18} />
          </div>
        </div>
      </div>

      <style>{`
        .topbar-icon-btn:hover {
          background-color: var(--chub-light-lavender) !important;
          color: var(--chub-purple) !important;
        }
        [data-theme='dark'] .topbar-icon-btn:hover {
          background-color: rgba(216, 90, 166, 0.1) !important;
          color: var(--chub-pink) !important;
        }
      `}</style>
    </header>
  );
}
