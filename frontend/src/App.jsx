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
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: '1rem', background: 'var(--bg-gradient)' }}>
        <div style={{ 
          width: '50px', 
          height: '50px', 
          border: '5px solid var(--glass-border)', 
          borderTopColor: 'var(--color-primary)', 
          borderRadius: '50%', 
          animation: 'spin 1s linear infinite'
        }}></div>
        <div style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontWeight: 500 }}>
          Securing Session...
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div>
      <Navbar currentView={currentView} setCurrentView={setCurrentView} />
      
      <main style={{ paddingBottom: '4rem' }}>
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
