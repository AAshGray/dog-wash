import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function Home({ setCurrentView }) {
  const { user } = useAuth();

  return (
    <div style={{ maxWidth: '900px', margin: '3rem auto', padding: '0 1.5rem', display: 'flex', flexDirection: 'column', gap: '3rem' }}>
      
      {/* Hero Welcome Section */}
      <div className="glass-card animate-fade-in" style={{ padding: '3.5rem 2.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
        <h1 style={{ fontSize: '3rem', lineHeight: '1.1', background: 'linear-gradient(135deg, #a78bfa 0%, var(--color-secondary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Glow & Go Dog Grooming
        </h1>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', maxWidth: '650px' }}>
          Premium, stress-free grooming slots for your beloved dogs. Book your appointment online, specify special notes, and watch them return glowing!
        </p>
        
        <button 
          className="btn btn-primary" 
          style={{ padding: '0.85rem 2rem', fontSize: '1.1rem', marginTop: '1rem' }}
          onClick={() => {
            if (user) {
              if (user.role === 'admin') {
                setCurrentView('admin-dashboard');
              } else {
                setCurrentView('client-dashboard');
              }
            } else {
              setCurrentView('login');
            }
          }}
        >
          {user ? 'Go to My Dashboard' : 'Schedule Appointment Now'}
        </button>
      </div>

      {/* Pricing / Information section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
        
        <div className="glass-card animate-fade-in" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <span style={{ fontSize: '2rem' }}>🛁</span>
          <h3>Full Bath & Dry</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Includes premium organic shampoo, blow dry, ear cleaning, and brush-out.</p>
          <span style={{ fontWeight: '700', color: 'var(--color-secondary)', marginTop: 'auto' }}>Starts at $45</span>
        </div>

        <div className="glass-card animate-fade-in" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <span style={{ fontSize: '2rem' }}>✂️</span>
          <h3>Full Styling Groom</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Full bath, haircut/trim tailored to breed standard or owner choice, and nail trim.</p>
          <span style={{ fontWeight: '700', color: 'var(--color-secondary)', marginTop: 'auto' }}>Starts at $75</span>
        </div>

        <div className="glass-card animate-fade-in" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <span style={{ fontSize: '2rem' }}>💅</span>
          <h3>Nails & Teeth Care</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Claw trimming, smoothing, teeth brushing, and fresh-breath spray.</p>
          <span style={{ fontWeight: '700', color: 'var(--color-secondary)', marginTop: 'auto' }}>Starts at $25</span>
        </div>

      </div>

      {/* Safety and Payment Policies banner */}
      <div className="glass-card animate-fade-in" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: '4px solid var(--color-secondary)' }}>
        <h3 style={{ color: 'var(--color-secondary)' }}>🔒 Safe Schedulers & Privacy</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
          To protect your privacy, all personal details (Name, Email, and Phone number) are stored using state-of-the-art **AES-256-CBC database encryption** on our secure backend.
        </p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
          <strong>Payment Policy:</strong> We explicitly avoid storing or collecting any financial/card credentials on our server. All billing is handled safely and securely **in-person at the time of your appointment** (via cash, credit, or debit card).
        </p>
      </div>

    </div>
  );
}
