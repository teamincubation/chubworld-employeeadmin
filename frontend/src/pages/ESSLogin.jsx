import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, ShieldAlert, Smartphone, Download, CheckCircle, Eye, EyeOff } from 'lucide-react';


export default function ESSLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });
        },
        (err) => {
          console.warn('Geolocation permission denied or failed:', err.message);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  // Geolocation coordinates are captured and used during employee credential clock-in submit

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      return setError('Please enter both your email and password.');
    }
    setError('');
    setSubmitting(true);

    const proceedLogin = async (currentCoords) => {
      try {
        await login(email, password, 'employee', currentCoords);
        navigate('/');
      } catch (err) {
        console.error(err);
        setError(err.message || 'Verification failed. Confirm your credentials.');
        setSubmitting(false);
      }
    };

    if (!coords && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const freshCoords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          };
          setCoords(freshCoords);
          proceedLogin(freshCoords);
        },
        (err) => {
          console.warn('Geolocation failed on submit:', err.message);
          proceedLogin(null);
        },
        { enableHighAccuracy: true, timeout: 2000 }
      );
    } else {
      proceedLogin(coords);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#0F0914', // Sleek dark brand background
      color: '#F5E8F7',
      padding: '20px',
      fontFamily: "'Poppins', sans-serif",
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background radial ambient lights */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        left: '-10%',
        width: '350px',
        height: '350px',
        background: 'radial-gradient(circle, rgba(66, 23, 79, 0.4) 0%, transparent 70%)',
        filter: 'blur(50px)',
        pointerEvents: 'none',
        zIndex: 0
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-10%',
        right: '-10%',
        width: '350px',
        height: '350px',
        background: 'radial-gradient(circle, rgba(216, 90, 166, 0.35) 0%, transparent 70%)',
        filter: 'blur(50px)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Main Glass Card container optimized for Mobile first aspect ratios */}
      <div style={{
        width: '100%',
        maxWidth: '420px',
        backgroundColor: 'rgba(26, 19, 33, 0.75)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(216, 90, 166, 0.15)',
        borderRadius: '24px',
        padding: '30px 24px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
        zIndex: 10,
        position: 'relative'
      }}>
        
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img 
            src="/logo.jpeg" 
            alt="C-Hub Logo" 
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '16px',
              objectFit: 'cover',
              border: '2px solid var(--chub-pink)',
              boxShadow: '0 8px 24px rgba(216, 90, 166, 0.25)',
              marginBottom: '16px'
            }}
          />
          <h2 style={{
            fontSize: '24px',
            fontWeight: 800,
            color: '#FFFFFF',
            letterSpacing: '1px',
            margin: '0 0 6px 0',
            textTransform: 'uppercase',
            fontFamily: "'Poppins', sans-serif"
          }}>
            C-Hub ESS Portal
          </h2>
          <p style={{
            color: '#A39BA6',
            fontSize: '13px',
            margin: 0
          }}>
            Secure Clock-in & Employee self-service
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid var(--color-error)',
            color: '#FCA5A5',
            padding: '12px 16px',
            borderRadius: '12px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            fontSize: '13px',
            animation: 'fadeIn 0.3s ease'
          }}>
            <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}



        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ color: 'var(--chub-pink)', fontSize: '12px', fontWeight: 600 }}>
              Registered Email ID
            </label>
            <div style={{ position: 'relative' }}>
              <input 
                type="email"
                className="form-control"
                style={{
                  backgroundColor: '#150E1A',
                  border: '1px solid #2B1E33',
                  color: '#FFFFFF',
                  paddingLeft: '44px',
                  borderRadius: '12px',
                  height: '48px',
                  fontSize: '14px'
                }}
                placeholder="email@chubworld.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Mail size={16} style={{ position: 'absolute', left: '16px', top: '16px', color: '#6B6470' }} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label" style={{ color: 'var(--chub-pink)', fontSize: '12px', fontWeight: 600 }}>
              Access Password
            </label>
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? "text" : "password"}
                className="form-control"
                style={{
                  backgroundColor: '#150E1A',
                  border: '1px solid #2B1E33',
                  color: '#FFFFFF',
                  paddingLeft: '44px',
                  paddingRight: '44px',
                  borderRadius: '12px',
                  height: '48px',
                  fontSize: '14px'
                }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Lock size={16} style={{ position: 'absolute', left: '16px', top: '16px', color: '#6B6470' }} />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '16px',
                  top: '16px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#6B6470',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '24px',
              fontSize: '15px',
              fontWeight: 600,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px',
              height: '48px'
            }}
            disabled={submitting}
          >
            {submitting ? 'Verifying Employee ID...' : 'Clock-In Sign In'}
          </button>
        </form>

        {/* Redirect to Admin Portal link */}
        <div style={{ textAlign: 'center', marginTop: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '16px' }}>
          <span style={{ fontSize: '12px', color: '#A39BA6' }}>Are you an Administrator? </span>
          <Link to="/login" style={{ fontSize: '12px', color: 'var(--chub-pink)', fontWeight: 600 }}>
            Sign In Here
          </Link>
        </div>
      </div>

      {/* Android PWA / Download Mobile-App Banner Recommendation */}
      <div style={{
        width: '100%',
        maxWidth: '420px',
        marginTop: '20px',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        border: '1px dashed rgba(216, 90, 166, 0.25)',
        borderRadius: '16px',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        zIndex: 10
      }}>
        <div style={{
          backgroundColor: 'rgba(216, 90, 166, 0.1)',
          borderRadius: '10px',
          padding: '10px',
          color: 'var(--color-success)'
        }}>
          <Smartphone size={24} />
        </div>
        <div style={{ flex: 1 }}>
          <h4 style={{ fontSize: '13px', color: '#FFFFFF', margin: '0 0 2px 0' }}>
            Daily Clock-In App
          </h4>
          <p style={{ fontSize: '11px', color: '#A39BA6', margin: 0, lineHeight: 1.4 }}>
            For a premium app experience on Android, install C-Hub directly from your browser menu.
          </p>
        </div>
      </div>

      {/* Watermark */}
      <div style={{
        marginTop: '30px',
        fontSize: '11px',
        color: '#6B6470',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        zIndex: 10
      }}>
        Chubworld Central Operations © 2026
      </div>
    </div>
  );
}
