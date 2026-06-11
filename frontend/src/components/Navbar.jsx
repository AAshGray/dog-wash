import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ currentView, setCurrentView, theme, toggleTheme }) {
  const { user, logout } = useAuth();

  return (
    <header className="container" style={{ borderBottom: '1px solid var(--pico-border-color)', marginBottom: '1rem' }}>
      <nav>
        <ul>
          <li style={{ cursor: 'pointer' }} onClick={() => setCurrentView('home')}>
            <strong>🧼 Dog Wash</strong>
          </li>
        </ul>
        <ul>
          <li>
            <button
              className={currentView === 'home' ? '' : 'outline'}
              onClick={() => setCurrentView('home')}
              style={{ fontSize: '0.9rem', padding: '0.4rem 0.85rem', margin: 0 }}
            >
              Home
            </button>
          </li>
          
          {user ? (
            <>
              {user.role === 'client' ? (
                <li>
                  <button
                    className={currentView === 'client-dashboard' ? '' : 'outline'}
                    onClick={() => setCurrentView('client-dashboard')}
                    style={{ fontSize: '0.9rem', padding: '0.4rem 0.85rem', margin: 0 }}
                  >
                    Dashboard
                  </button>
                </li>
              ) : (
                <li>
                  <button
                    className={currentView === 'admin-dashboard' ? '' : 'outline'}
                    onClick={() => setCurrentView('admin-dashboard')}
                    style={{ fontSize: '0.9rem', padding: '0.4rem 0.85rem', margin: 0 }}
                  >
                    Admin Panel
                  </button>
                </li>
              )}
              <li style={{ fontSize: '0.85rem' }}>
                Hi, <strong>{user.name || user.username}</strong>
              </li>
              <li>
                <button 
                  className="danger" 
                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem', margin: 0 }} 
                  onClick={() => {
                    logout();
                    setCurrentView('home');
                  }}
                >
                  Logout
                </button>
              </li>
            </>
          ) : (
            <li>
              <button
                className={currentView === 'login' ? '' : 'outline'}
                onClick={() => setCurrentView('login')}
                style={{ fontSize: '0.9rem', padding: '0.4rem 0.85rem', margin: 0 }}
              >
                Sign In
              </button>
            </li>
          )}
          
          {/* Theme Toggle Button */}
          <li>
            <button 
              onClick={toggleTheme} 
              className="outline"
              style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem', margin: 0 }}
              title="Toggle Light/Dark Theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </li>
        </ul>
      </nav>
    </header>
  );
}
