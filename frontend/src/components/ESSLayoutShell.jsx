import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { Home, Clock, FileText, Calendar, User, LogOut, MapPin } from 'lucide-react';

export default function ESSLayoutShell({ children }) {
  const { user, logout, request } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    if (!user || user.role !== 'Employee') return;

    const updateLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            try {
              await request('/ess/update-location', {
                method: 'POST',
                body: { latitude, longitude }
              });
            } catch (err) {
              console.error('Failed to update live coordinates:', err);
            }
          },
          (err) => {
            console.warn('Geolocation permission denied or error:', err);
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      }
    };

    updateLocation();
    const interval = setInterval(updateLocation, 60000);
    return () => clearInterval(interval);
  }, [user, request]);

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

  const locationName = user?.employee?.work_location_name || 'Main Office Geofence';

  return (
    <div className="ess-layout-container">
      {/* Mobile Top Header */}
      <header className="ess-mobile-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', height: '56px', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF' }}>
            <MapPin size={16} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '600', textTransform: 'uppercase' }}>Location</span>
            <span style={{ fontSize: '12px', color: '#FFFFFF', fontWeight: 'bold' }}>{locationName}</span>
          </div>
        </div>
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
          { label: 'Attendance', icon: Clock, path: '/ess/clock' },
          { label: 'Reports', icon: FileText, path: '/ess/performance' },
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
