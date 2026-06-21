import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, Users, Clock, CalendarDays, 
  ShieldCheck, FileSpreadsheet, User, KeyRound, 
  ChevronLeft, ChevronRight, LogOut, ClipboardList,
  Building, MapPin
} from 'lucide-react';

export default function Sidebar() {
  const { user, logout, request, mobileDrawerOpen, setMobileDrawerOpen } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [allowedModules, setAllowedModules] = useState(null);

  useEffect(() => {
    if (setMobileDrawerOpen) {
      setMobileDrawerOpen(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!user || user.role === 'Employee' || user.role === 'Super Admin') {
      setAllowedModules(null);
      return;
    }

    const fetchAllowedModules = async () => {
      try {
        const licRes = await request('/security/licensing');
        const licModules = licRes?.modules || [];
        
        const now = new Date();
        const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const isModuleValid = (m) => {
          if (!m.is_enabled) return false;
          if (m.subscription_start_date) {
            const start = new Date(m.subscription_start_date);
            const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
            if (currentDate < startDate) return false;
          }
          if (m.subscription_end_date) {
            const end = new Date(m.subscription_end_date);
            const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
            if (currentDate > endDate) return false;
          }
          return true;
        };

        const validLicKeys = licModules.filter(isModuleValid).map(m => m.module_key);

        if (user.role === 'Admin Controller') {
          setAllowedModules(validLicKeys);
        } else {
          // Sub-admin (Admin, HR Manager, etc.)
          const subRes = await request(`/security/sub-admin-licensing/${user.id}`);
          const subModules = subRes || [];
          const validSubKeys = subModules.filter(isModuleValid).map(m => m.module_key);
          
          // Intersection of validLicKeys and validSubKeys
          const finalKeys = validSubKeys.filter(k => validLicKeys.includes(k));
          setAllowedModules(finalKeys);
        }
      } catch (err) {
        console.error('Error fetching module visibility:', err);
        setAllowedModules([]); // Default to none on error for safety
      }
    };

    fetchAllowedModules();
  }, [user]);

  if (!user) return null;

  const isAdmin = user.role !== 'Employee';

  // Admin Sidebar Items
  const adminItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, key: 'dashboard' },
    { name: 'Employee Lifecycle', path: '/employees', icon: Users, key: 'employees' },
    { name: 'Attendance Hub', path: '/attendance', icon: Clock, key: 'attendance' },
    { name: 'Leave Manager', path: '/leaves', icon: CalendarDays, key: 'leaves' },
    { name: 'Security & Audits', path: '/security', icon: ShieldCheck, key: 'security' },
    { name: 'Reports', path: '/reports', icon: FileSpreadsheet, key: 'reports' }
  ];

  // Employee ESS Sidebar Items
  const employeeItems = [
    { name: 'ESS Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Clock In / Out', path: '/ess/clock', icon: Clock },
    { name: 'My Leave Requests', path: '/ess/leaves', icon: CalendarDays },
    { name: 'Performance & Logs', path: '/ess/performance', icon: ClipboardList },
    { name: 'My Profile', path: '/ess/profile', icon: User },
    { name: 'Change Password', path: '/ess/password', icon: KeyRound }
  ];

  const filteredAdminItems = allowedModules 
    ? adminItems.filter(item => allowedModules.includes(item.key))
    : adminItems;

  const menuItems = isAdmin ? filteredAdminItems : employeeItems;

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileDrawerOpen && (
        <div 
          onClick={() => setMobileDrawerOpen(false)}
          className="sidebar-backdrop"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 95
          }}
        />
      )}
      <div className={`sidebar-wrapper ${mobileDrawerOpen ? 'drawer-open' : ''}`} style={{
        width: collapsed ? '80px' : '280px',
        backgroundColor: 'var(--bg-sidebar)',
        color: '#FFFFFF',
        transition: 'width 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        zIndex: 100,
        boxShadow: '4px 0 15px rgba(0, 0, 0, 0.15)'
      }}>
      {/* Brand Header */}
      <div style={{
        padding: '24px 16px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        overflow: 'hidden',
        whiteSpace: 'nowrap'
      }}>
        <img 
          src="/logo.jpeg" 
          alt="C-Hub Logo" 
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            objectFit: 'cover',
            border: '2px solid var(--chub-pink)',
            flexShrink: 0
          }}
        />
        {!collapsed && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ 
              fontWeight: 700, 
              fontSize: '18px', 
              color: '#FFFFFF',
              fontFamily: 'Poppins',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>C-Hub ERP</span>
            <span style={{ 
              fontSize: '10px', 
              color: 'var(--chub-pink)', 
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>Creating Wow World</span>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav style={{ flex: 1, padding: '24px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {menuItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link 
              key={index} 
              to={item.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '12px 16px',
                borderRadius: '8px',
                color: isActive ? '#FFFFFF' : 'rgba(255, 255, 255, 0.7)',
                background: isActive ? 'linear-gradient(135deg, #D85AA6 0%, #F15BC4 100%)' : 'transparent',
                fontWeight: isActive ? 600 : 500,
                fontSize: '14px',
                transition: 'all 0.2s ease',
                position: 'relative',
                overflow: 'hidden'
              }}
              className={!isActive ? 'sidebar-hover-item' : ''}
            >
              <Icon size={20} style={{ flexShrink: 0, color: isActive ? '#FFFFFF' : 'var(--chub-pink)' }} />
              {!collapsed && <span>{item.name}</span>}
              {isActive && !collapsed && (
                <div style={{
                  position: 'absolute',
                  right: '12px',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#FFFFFF'
                }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Toggle button */}
      <button 
        onClick={() => setCollapsed(!collapsed)}
        style={{
          position: 'absolute',
          bottom: '100px',
          right: '-14px',
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          backgroundColor: 'var(--chub-pink)',
          color: '#FFFFFF',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          zIndex: 10
        }}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* Sidebar Footer / Logout */}
      <div style={{
        padding: '20px 16px',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <button 
          onClick={logout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '12px 16px',
            borderRadius: '8px',
            color: 'rgba(255, 255, 255, 0.7)',
            background: 'rgba(255, 255, 255, 0.04)',
            border: 'none',
            width: '100%',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '14px',
            transition: 'all 0.2s ease',
            textAlign: 'left'
          }}
          className="sidebar-hover-item"
        >
          <LogOut size={20} style={{ color: 'var(--chub-soft-pink)' }} />
          {!collapsed && <span>Logout</span>}
        </button>

        {!collapsed && (
          <span style={{ 
            fontSize: '10px', 
            color: 'rgba(255, 255, 255, 0.4)', 
            textAlign: 'center',
            marginTop: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>C-Hub Internal System</span>
        )}
      </div>

      {/* Embed Hover Styles directly */}
      <style>{`
        .sidebar-hover-item:hover {
          background-color: rgba(255, 255, 255, 0.08) !important;
          color: #FFFFFF !important;
        }
      `}</style>
      </div>
    </>
  );
}
