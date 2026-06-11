import React, { createContext, useState, useEffect, useContext } from 'react';
import { apiRequest } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for existing token and restore session on mount
  useEffect(() => {
    async function restoreSession() {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const data = await apiRequest('/auth/me');
          setUser(data.user);
        } catch (err) {
          console.warn('Session restoration failed (token may be expired or user banned):', err.message);
          localStorage.removeItem('token');
          setUser(null);
        }
      }
      setLoading(false);
    }
    restoreSession();
  }, []);

  /**
   * Performs client registration.
   */
  async function register(username, password, name, email, phone) {
    return await apiRequest('/auth/register', 'POST', {
      username,
      password,
      name,
      email,
      phone
    });
  }

  /**
   * Logs in a user, stores the JWT, and fetches their profile.
   */
  async function login(loginIdentifier, password) {
    const data = await apiRequest('/auth/login', 'POST', {
      loginIdentifier,
      password
    });
    
    localStorage.setItem('token', data.token);
    
    try {
      const profile = await apiRequest('/auth/me');
      setUser(profile.user);
      return profile.user;
    } catch (err) {
      localStorage.removeItem('token');
      throw err;
    }
  }

  /**
   * Logs out the user and clears storage.
   */
  function logout() {
    localStorage.removeItem('token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
