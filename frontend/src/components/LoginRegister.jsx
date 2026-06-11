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
          setError('Email and Password are required');
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
    <div style={{ maxWidth: '460px', margin: '2rem auto' }}>
      <article className="animate-fade-in" style={{ margin: 0 }}>
        <header style={{ textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.75rem' }}>
            {isLogin ? 'Welcome Back' : 'Get Started'}
          </h2>
        </header>
        
        {error && (
          <div style={{ 
            background: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid var(--color-danger)', 
            color: 'var(--color-danger)', 
            padding: '0.75rem 1rem', 
            borderRadius: 'var(--border-radius-md)', 
            marginBottom: '1.5rem',
            fontSize: '0.9rem'
          }}>
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div style={{ 
            background: 'rgba(16, 185, 129, 0.1)', 
            border: '1px solid var(--color-success)', 
            color: 'var(--color-success)', 
            padding: '0.75rem 1rem', 
            borderRadius: 'var(--border-radius-md)', 
            marginBottom: '1.5rem',
            fontSize: '0.9rem'
          }}>
            ✅ {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label htmlFor="loginIdentifier">
            {isLogin ? 'Email Address' : 'Username'}
            <input 
              type="text" 
              id="loginIdentifier"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={isLogin ? 'example@email.com' : 'Choose a unique username'}
              required
            />
          </label>

          {!isLogin && (
            <>
              <label htmlFor="name">
                Full Name
                <input 
                  type="text" 
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  required
                />
              </label>

              <label htmlFor="email">
                Email Address
                <input 
                  type="email" 
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  required
                />
              </label>

              <label htmlFor="phone">
                Phone Number
                <input 
                  type="text" 
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="555-123-4567"
                  required
                />
              </label>
            </>
          )}

          <label htmlFor="password">
            Password
            <input 
              type="password" 
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>

          <button type="submit" style={{ width: '100%', marginTop: '0.5rem' }}>
            {isLogin ? 'Sign In' : 'Register'}
          </button>
        </form>

        <footer style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--pico-muted-color)', padding: '1rem 0 0 0' }}>
          {isLogin ? "Don't have an account?" : "Already have an account?"} {' '}
          <span 
            style={{ 
              color: 'var(--pico-primary)', 
              cursor: 'pointer', 
              textDecoration: 'underline', 
              fontWeight: 500 
            }}
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setSuccess('');
            }}
          >
            {isLogin ? 'Create one now' : 'Sign in instead'}
          </span>
        </footer>
      </article>
    </div>
  );
}
