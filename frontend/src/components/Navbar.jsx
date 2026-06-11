import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ currentView, setCurrentView }) {
  const { user, logout } = useAuth();

  return (
    <nav className="navbar">
      <div className="logo" style={{ cursor: 'pointer' }} onClick={() => setCurrentView('home')}>
        ✨ Glow & Go
      </div>
      <ul className="nav-links">
        <li>
          <button 
            className={`btn btn-link nav-link ${currentView === 'home' ? 'active' : ''}`}
            onClick={() => setCurrentView('home')}
          >
            Home
          </button>
        </li>
        {user ? (
          <>
            {user.role === 'client' ? (
              <li>
                <button 
                  className={`btn btn-link nav-link ${currentView === 'client-dashboard' ? 'active' : ''}`}
                  onClick={() => setCurrentView('client-dashboard')}
                >
                  Dashboard
                </button>
              </li>
            ) : (
              <li>
                <button 
                  className={`btn btn-link nav-link ${currentView === 'admin-dashboard' ? 'active' : ''}`}
                  onClick={() => setCurrentView('admin-dashboard')}
                >
                  Admin Panel
                </button>
              </li>
            )}
            <li>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginRight: '0.5rem' }}>
                Hi, <strong>{user.name}</strong> ({user.role})
              </span>
            </li>
            <li>
              <button className="btn btn-danger" style={{ padding: '0.4rem 1rem', fontSize: '0.9rem' }} onClick={() => {
                logout();
                setCurrentView('home');
              }}>
                Logout
              </button>
            </li>
          </>
        ) : (
          <li>
            <button 
              className="btn btn-primary" 
              style={{ padding: '0.5rem 1.25rem', fontSize: '0.9rem' }}
              onClick={() => setCurrentView('login')}
            >
              Sign In
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}
