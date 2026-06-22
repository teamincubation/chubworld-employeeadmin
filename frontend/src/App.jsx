import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Components & Layouts
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';

// Public Pages
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

// Admin Pages
import AdminDashboard from './pages/AdminDashboard';
import EmployeeRegister from './pages/EmployeeRegister';
import AttendanceHub from './pages/AttendanceHub';
import LeaveManager from './pages/LeaveManager';
import SecurityCenter from './pages/SecurityCenter';
import ReportsPage from './pages/ReportsPage';
import LicensingCenter from './pages/LicensingCenter';

// Employee ESS Pages
import ESSDashboard from './pages/ESSDashboard';
import ESSClockIn from './pages/ESSClockIn';
import ESSLeaveRequest from './pages/ESSLeaveRequest';
import ESSPerformance from './pages/ESSPerformance';
import ESSProfile from './pages/ESSProfile';
import ESSLayoutShell from './components/ESSLayoutShell';
import ESSLogin from './pages/ESSLogin';

function LayoutShell({ children }) {
  return (
    <div className="app-container">
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar />
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}

function MainAppRouter() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#101010',
        color: '#FFFFFF'
      }}>
        <img 
          src="/logo.jpeg" 
          alt="C-Hub Logo" 
          style={{ width: '80px', height: '80px', borderRadius: '16px', border: '2px solid var(--chub-pink)', marginBottom: '20px' }}
        />
        <h3 style={{ fontFamily: 'Poppins', letterSpacing: '1.5px', color: '#FFFFFF' }}>INITIALIZING C-HUB OPERATIONS...</h3>
      </div>
    );
  }

  // PUBLIC NAVIGATION RULES
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/ess-login" element={<ESSLogin />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/ess-login" replace />} />
      </Routes>
    );
  }

  // ROLE-BASED ROUTING
  const isAdmin = user.role !== 'Employee';

  if (isAdmin) {
    // Admin Dashboard Routes
    return (
      <LayoutShell>
        <Routes>
          <Route path="/" element={<AdminDashboard />} />
          <Route path="/employees" element={<EmployeeRegister />} />
          <Route path="/attendance" element={<AttendanceHub />} />
          <Route path="/leaves" element={<LeaveManager />} />
          <Route path="/security" element={<SecurityCenter />} />
          {user.role === 'Super Admin' && <Route path="/licensing" element={<LicensingCenter />} />}
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </LayoutShell>
    );
  } else {
    // Employee ESS Routes
    return (
      <ESSLayoutShell>
        <Routes>
          <Route path="/" element={<ESSDashboard />} />
          <Route path="/ess/clock" element={<ESSClockIn />} />
          <Route path="/ess/leaves" element={<ESSLeaveRequest />} />
          <Route path="/ess/performance" element={<ESSPerformance />} />
          <Route path="/ess/profile" element={<ESSProfile />} />
          <Route path="/ess/password" element={<ESSProfile />} /> {/* Password reset sits inside profile page */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ESSLayoutShell>
    );
  }
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <MainAppRouter />
      </AuthProvider>
    </Router>
  );
}
