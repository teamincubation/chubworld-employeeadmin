import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext();

export const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000/api'
  : '/api';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  // Toggle visual theme
  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Load user profile on startup
  useEffect(() => {
    if (token) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.user) {
          setUser({ ...data.user, employee: data.employee });
        } else {
          logout();
        }
      } else {
        logout();
      }
    } catch (err) {
      console.error('Profile fetch failed:', err);
      logout();
    } finally {
      setLoading(false);
    }
  };


  const login = async (email, password, portal = 'admin') => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, portal })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Login failed.');
    }

    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const loginWithGoogle = async (googleToken) => {
    const res = await fetch(`${API_BASE_URL}/auth/google-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: googleToken })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Google Login failed.');
    }

    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    if (token) {
      fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(err => console.error(err));
    }
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  /**
   * Universal secure api request wrapper
   */
  const request = async (endpoint, options = {}) => {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = { ...options.headers };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = { ...options, headers };
    
    // If body is object and not FormData, stringify it
    if (config.body && !(config.body instanceof FormData) && typeof config.body === 'object') {
      headers['Content-Type'] = 'application/json';
      config.body = JSON.stringify(config.body);
    }

    const res = await fetch(url, config);
    if (res.status === 401 || res.status === 403) {
      const errData = await res.json().catch(() => ({}));
      // Check if it's permission error vs login expiration
      if (res.status === 403 && errData.message && errData.message.includes('permission')) {
        throw new Error(errData.message);
      }
      logout();
      throw new Error('Your session has expired. Please log in again.');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'API request failed.');
    }
    return data;
  };

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  return (
    <AuthContext.Provider value={{ token, user, loading, login, loginWithGoogle, logout, request, theme, toggleTheme, mobileDrawerOpen, setMobileDrawerOpen, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
