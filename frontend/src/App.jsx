import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Home from './components/Home';
import LoginRegister from './components/LoginRegister';
import ClientDashboard from './components/ClientDashboard';
import AdminDashboard from './components/AdminDashboard';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState('home');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  // Handle Theme state changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Guard routing view changes if auth states change
  useEffect(() => {
    if (!loading) {
      if (user) {
        if (user.role === 'admin' && currentView === 'login') {
          setCurrentView('admin-dashboard');
        } else if (user.role === 'client' && currentView === 'login') {
          setCurrentView('client-dashboard');
        }
      } else {
        // If logged out and on a protected dashboard, kick back to home
        if (currentView === 'client-dashboard' || currentView === 'admin-dashboard') {
          setCurrentView('home');
        }
      }
    }
  }, [user, loading, currentView]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <article aria-busy="true" style={{ width: '350px', textAlign: 'center', margin: 0 }}>
          Securing Session...
        </article>
      </div>
    );
  }

  return (
    <div>
      <Navbar 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
        theme={theme} 
        toggleTheme={toggleTheme} 
      />
      
      <main className="container" style={{ paddingBottom: '4rem', paddingTop: '2rem' }}>
        {currentView === 'home' && <Home setCurrentView={setCurrentView} />}
        {currentView === 'login' && <LoginRegister setCurrentView={setCurrentView} />}
        {currentView === 'client-dashboard' && (
          user && user.role === 'client' ? <ClientDashboard /> : <LoginRegister setCurrentView={setCurrentView} />
        )}
        {currentView === 'admin-dashboard' && (
          user && user.role === 'admin' ? <AdminDashboard /> : <LoginRegister setCurrentView={setCurrentView} />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
