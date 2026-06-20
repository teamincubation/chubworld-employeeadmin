import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { API_BASE_URL } from '../context/AuthContext';
import { Lock, ShieldAlert, CheckCircle } from 'lucide-react';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid reset request. Missing security token parameter.');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return setError('Missing security reset token.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirmPassword) return setError('Passwords do not match.');

    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Password reset failed.');
      }

      setMessage(data.message || 'Password reset completed successfully.');
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred.');
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
            SYSTEM <br />
            <span style={{ color: '#F15BC4' }}>UPDATE</span>
          </h1>
          <p style={{
            fontSize: '18px',
            opacity: 0.9,
            maxWidth: '500px',
            lineHeight: 1.6,
            fontWeight: 400,
            marginBottom: '40px'
          }}>
            Establishing new encryption credentials. Maintain standard security protocols.
          </p>
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
            RESET SECURITY KEY
          </h2>
          <p style={{
            color: '#8e8394',
            fontSize: '14px',
            marginBottom: '32px'
          }}>
            Enter and confirm your new system password.
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
                <p style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>Redirecting you to sign in page...</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" style={{ color: '#D85AA6' }}>New Password</label>
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
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={!token}
                />
                <Lock size={18} style={{ position: 'absolute', left: '16px', top: '14px', color: '#6B6470' }} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '32px' }}>
              <label className="form-label" style={{ color: '#D85AA6' }}>Confirm New Password</label>
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
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={!token}
                />
                <Lock size={18} style={{ position: 'absolute', left: '16px', top: '14px', color: '#6B6470' }} />
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
              disabled={loading || !token}
            >
              {loading ? 'Updating Credentials...' : 'Save Credentials'}
            </button>

            <div style={{ textAlign: 'center' }}>
              <Link to="/login" style={{ fontSize: '14px', color: '#8e8394', fontWeight: '500' }}>
                Back to Sign In
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
