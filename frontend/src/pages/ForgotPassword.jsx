import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../context/AuthContext';
import { Mail, CheckCircle, ShieldAlert } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [resetLink, setResetLink] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return setError('Email address is required.');
    
    setError('');
    setMessage('');
    setResetLink('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'ForgotPassword request failed.');
      }

      setMessage(data.message);
      if (data.resetLink) {
        setResetLink(data.resetLink);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
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
            SECURITY <br />
            <span style={{ color: '#F15BC4' }}>GATEWAY</span>
          </h1>
          <p style={{
            fontSize: '18px',
            opacity: 0.9,
            maxWidth: '500px',
            lineHeight: 1.6,
            fontWeight: 400,
            marginBottom: '40px'
          }}>
            Resetting your account key. Enter your email to verify identity and dispatch reset link.
          </p>
        </div>
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

      {/* Right panel: Form */}
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
          <h2 style={{
            fontFamily: 'Oswald',
            fontSize: '32px',
            color: '#FFFFFF',
            marginBottom: '8px'
          }}>
            KEY RESTORATION
          </h2>
          <p style={{
            color: '#8e8394',
            fontSize: '14px',
            marginBottom: '32px'
          }}>
            Enter your registered email to receive a secure password reset link.
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

          {message && (
            <div style={{
              backgroundColor: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid var(--color-success)',
              color: '#a7f3d0',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              fontSize: '14px'
            }}>
              <CheckCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <p>{message}</p>
                {resetLink && (
                  <div style={{ marginTop: '12px', padding: '10px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
                    <p style={{ fontWeight: 'bold', color: '#FFFFFF', fontSize: '12px', marginBottom: '4px' }}>Developer Sandbox Reset Bypass:</p>
                    <a href={resetLink} style={{ color: '#F15BC4', fontSize: '12px', wordBreak: 'break-all' }}>
                      {resetLink}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '32px' }}>
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
                  placeholder="email@chubworld.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Mail size={18} style={{ position: 'absolute', left: '16px', top: '14px', color: '#6B6470' }} />
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '30px',
                fontSize: '15px',
                marginBottom: '24px'
              }}
              disabled={loading}
            >
              {loading ? 'Validating...' : 'Request Reset Link'}
            </button>

            <div style={{ textAlign: 'center' }}>
              <Link to="/login" style={{ fontSize: '14px', color: '#8e8394', fontWeight: '500' }}>
                Back to Sign In
              </Link>
            </div>
          </form>
        </div>
      </div>

      <style>{`
        @media (max-width: 992px) {
          .login-left-panel {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
