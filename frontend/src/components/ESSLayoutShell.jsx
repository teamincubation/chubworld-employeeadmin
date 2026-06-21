import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { Home, Clock, FileText, Calendar, User, LogOut } from 'lucide-react';

export default function ESSLayoutShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      logout();
    }
  };

  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="ess-layout-container">
      {/* Mobile Top Header */}
      <header className="ess-mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo.jpeg" alt="C-Hub Logo" style={{ width: '32px', height: '32px', borderRadius: '6px', border: '1px solid var(--chub-pink)' }} />
          <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--chub-purple)', letterSpacing: '0.5px' }}>C-HUB ESS</span>
        </div>
        <button onClick={handleLogout} className="ess-mobile-logout-btn" title="Logout">
          <LogOut size={18} />
        </button>
      </header>

      {/* Main Core Container (combines sidebar + main content for desktop) */}
      <div className="app-container">
        {/* Sidebar is hidden on mobile via CSS query */}
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Topbar is hidden on mobile via CSS query */}
          <Topbar />
          <main className="main-content ess-main-content">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav className="ess-mobile-bottom-nav">
        {[
          { label: 'Home', icon: Home, path: '/' },
          { label: 'Clock', icon: Clock, path: '/ess/clock' },
          { label: 'Leaves', icon: FileText, path: '/ess/leaves' },
          { label: 'Logs', icon: Calendar, path: '/ess/performance' },
          { label: 'Profile', icon: User, path: '/ess/profile' }
        ].map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.path);
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`ess-nav-tab ${active ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
