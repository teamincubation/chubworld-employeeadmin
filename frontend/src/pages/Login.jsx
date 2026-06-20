import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, ShieldAlert } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      return setError('Please enter both email and password.');
    }
    setError('');
    setSubmitting(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      backgroundColor: '#101010',
      overflow: 'hidden'
    }}>
      {/* Left panel: Brand Identity */}
      <div style={{
        flex: 1.2,
        background: 'linear-gradient(135deg, #42174F 0%, #D85AA6 100%)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '80px',
        color: '#FFFFFF',
      }} className="login-left-panel">
        
        {/* Futuristic circuit grid backdrop */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.1,
          backgroundImage: 'radial-gradient(circle, #FFFFFF 1px, transparent 1px), radial-gradient(circle, #FFFFFF 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          backgroundPosition: '0 0, 20px 20px'
        }} />

        <div style={{ position: 'relative', zIndex: 2 }}>
          <img 
            src="/logo.jpeg" 
            alt="C-Hub Logo" 
            style={{
              width: '120px',
              height: '120px',
              borderRadius: '24px',
              objectFit: 'cover',
              border: '4px solid #FFFFFF',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
              marginBottom: '40px'
            }}
          />
          <h1 style={{
            fontFamily: 'Oswald',
            fontSize: '52px',
            lineHeight: 1.1,
            color: '#FFFFFF',
            marginBottom: '20px',
            letterSpacing: '1px'
          }}>
            CREATING <br />
            <span style={{ color: '#F15BC4' }}>WOW WORLD</span>
          </h1>
          <p style={{
            fontSize: '18px',
            opacity: 0.9,
            maxWidth: '500px',
            lineHeight: 1.6,
            fontWeight: 400,
            marginBottom: '40px'
          }}>
            Welcome to C-Hub Internal Operations System. A futuristic ecosystem for AI, VR, Robotics, and EdTech Learning Management.
          </p>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            padding: '12px 24px',
            borderRadius: '50px',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#22C55E' }} />
            <span style={{ fontSize: '13px', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Secure Encryption Guard Activated
            </span>
          </div>
        </div>

        {/* Brand visual watermark */}
        <div style={{
          position: 'absolute',
          bottom: '40px',
          left: '80px',
          fontSize: '12px',
          opacity: 0.6,
          letterSpacing: '2px',
          textTransform: 'uppercase'
        }}>
          Chubworld AI Ecosystem © 2026
        </div>
      </div>

      {/* Right panel: Login form */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        backgroundColor: '#101010'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '440px'
        }}>
          {/* Logo on card for mobile fallback */}
          <div style={{ display: 'none' }} className="mobile-only-logo">
            <img src="/logo.jpeg" alt="Logo" style={{ width: '60px', height: '60px', borderRadius: '12px', marginBottom: '24px' }} />
          </div>

          <h2 style={{
            fontFamily: 'Oswald',
            fontSize: '32px',
            color: '#FFFFFF',
            marginBottom: '8px'
          }}>
            SYSTEM SIGN IN
          </h2>
          <p style={{
            color: '#8e8394',
            fontSize: '14px',
            marginBottom: '32px'
          }}>
            Enter your official credentials to access the ERP & HR portal.
          </p>

          {error && (
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid var(--color-error)',
              color: '#fca5a5',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              fontSize: '14px'
            }}>
              <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" style={{ color: '#D85AA6' }}>Registered Email</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="email"
                  className="form-control"
                  style={{
                    backgroundColor: '#1A1321',
                    border: '1px solid #35253D',
                    color: '#FFFFFF',
                    paddingLeft: '44px'
                  }}
                  placeholder="e.g. employee@chubworld.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Mail size={18} style={{ position: 'absolute', left: '16px', top: '14px', color: '#6B6470' }} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ color: '#D85AA6' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="password"
                  className="form-control"
                  style={{
                    backgroundColor: '#1A1321',
                    border: '1px solid #35253D',
                    color: '#FFFFFF',
                    paddingLeft: '44px'
                  }}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Lock size={18} style={{ position: 'absolute', left: '16px', top: '14px', color: '#6B6470' }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '32px' }}>
              <Link to="/forgot-password" style={{ fontSize: '13px', color: '#F15BC4', fontWeight: '500' }}>
                Forgot Password?
              </Link>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '30px',
                fontSize: '15px'
              }}
              disabled={submitting}
            >
              {submitting ? 'Authenticating System...' : 'Secure Authorization'}
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @media (max-width: 992px) {
          .login-left-panel {
            display: none !important;
          }
          .mobile-only-logo {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}
