import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginRegister({ setCurrentView }) {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form Fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (isLogin) {
        if (!username || !password) {
          setError('Username/Email and Password are required');
          return;
        }
        const user = await login(username, password);
        if (user.role === 'admin') {
          setCurrentView('admin-dashboard');
        } else {
          setCurrentView('client-dashboard');
        }
      } else {
        if (!username || !password || !name || !email || !phone) {
          setError('All fields are required');
          return;
        }
        await register(username, password, name, email, phone);
        setSuccess('Registration successful! Please login.');
        setIsLogin(true);
        // Clean fields
        setPassword('');
      }
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.');
    }
  }

  return (
    <div style={{ maxWidth: '450px', margin: '4rem auto', padding: '1.5rem' }}>
      <div className="glass-card animate-fade-in">
        <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '2rem' }}>
          {isLogin ? 'Welcome Back' : 'Get Started'}
        </h2>
        
        {error && (
          <div style={{ 
            background: 'rgba(239, 68, 68, 0.15)', 
            border: '1px solid var(--color-danger)', 
            color: 'var(--color-danger)', 
            padding: '0.75rem', 
            borderRadius: 'var(--border-radius-md)', 
            marginBottom: '1rem',
            fontSize: '0.9rem'
          }}>
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div style={{ 
            background: 'rgba(16, 185, 129, 0.15)', 
            border: '1px solid var(--color-success)', 
            color: 'var(--color-success)', 
            padding: '0.75rem', 
            borderRadius: 'var(--border-radius-md)', 
            marginBottom: '1rem',
            fontSize: '0.9rem'
          }}>
            ✅ {success}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group">
            <label htmlFor="loginIdentifier">{isLogin ? 'Username or Email' : 'Username'}</label>
            <input 
              type="text" 
              id="loginIdentifier"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={isLogin ? 'admin / your email' : 'Choose a unique username'}
              required
            />
          </div>

          {!isLogin && (
            <>
              <div className="form-group">
                <label htmlFor="name">Full Name</label>
                <input 
                  type="text" 
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input 
                  type="email" 
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone">Phone Number</label>
                <input 
                  type="text" 
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="555-123-4567"
                  required
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input 
              type="password" 
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.85rem' }}>
            {isLogin ? 'Sign In' : 'Register'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          {isLogin ? "Don't have an account?" : "Already have an account?"} {' '}
          <button 
            type="button" 
            className="btn btn-link" 
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setSuccess('');
            }}
          >
            {isLogin ? 'Create one now' : 'Sign in instead'}
          </button>
        </div>
      </div>
    </div>
  );
}
