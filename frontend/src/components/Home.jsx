import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function Home({ setCurrentView }) {
  const { user } = useAuth();

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Hero Welcome Section */}
      <article style={{ textAlign: 'center', padding: '3rem 2rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
          Dog Wash
        </h1>
        <p style={{ fontSize: '1.1rem', color: 'var(--pico-muted-color)', maxWidth: '700px', margin: '0 auto 1.5rem auto' }}>
          Premium, stress-free grooming slots for your beloved dogs. Book your appointment online, specify special notes, and watch them return glowing!
        </p>
        
        <button 
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
          style={{ width: 'fit-content', margin: '0 auto', padding: '0.75rem 2rem' }}
        >
          {user ? 'Go to My Dashboard' : 'Schedule Appointment Now'}
        </button>
      </article>

      {/* Pricing / Information section */}
      <div className="grid">
        
        <article style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '100%', margin: 0 }}>
          <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🛁</span>
          <h3 style={{ fontSize: '1.25rem' }}>Full Bath & Dry</h3>
          <p style={{ color: 'var(--pico-muted-color)', fontSize: '0.9rem', flex: 1 }}>
            Includes premium organic shampoo, blow dry, ear cleaning, and brush-out.
          </p>
          <strong style={{ color: 'var(--pico-primary)', display: 'block', marginTop: '1rem' }}>Starts at $45</strong>
        </article>

        <article style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '100%', margin: 0 }}>
          <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✂️</span>
          <h3 style={{ fontSize: '1.25rem' }}>Full Grooming</h3>
          <p style={{ color: 'var(--pico-muted-color)', fontSize: '0.9rem', flex: 1 }}>
            Full bath, haircut/trim tailored to breed standard or owner choice, and nail trim.
          </p>
          <strong style={{ color: 'var(--pico-primary)', display: 'block', marginTop: '1rem' }}>Starts at $75</strong>
        </article>

        <article style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '100%', margin: 0 }}>
          <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💅</span>
          <h3 style={{ fontSize: '1.25rem' }}>Nails & Teeth</h3>
          <p style={{ color: 'var(--pico-muted-color)', fontSize: '0.9rem', flex: 1 }}>
            Claw trimming, smoothing, teeth brushing, and fresh-breath spray.
          </p>
          <strong style={{ color: 'var(--pico-primary)', display: 'block', marginTop: '1rem' }}>Starts at $25</strong>
        </article>

      </div>

      {/* Safety and Payment Policies banner */}
      <article style={{ borderLeft: '4px solid var(--pico-primary)', padding: '2rem', margin: 0 }}>
        <h3 style={{ color: 'var(--pico-primary)', fontSize: '1.25rem', marginBottom: '0.75rem' }}>🔒 Safe Schedulers & Privacy</h3>
        <p style={{ fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '0.5rem' }}>
          To protect your privacy, all personal details (Name, Email, and Phone number) are stored using state-of-the-art **AES-256-CBC database encryption** on our secure backend.
        </p>
        <p style={{ fontSize: '0.95rem', lineHeight: '1.6', margin: 0 }}>
          <strong>Payment Policy:</strong> We explicitly avoid storing or collecting any financial/card credentials on our server. All billing is handled safely and securely **in-person at the time of your appointment** (via cash, credit, or debit card).
        </p>
      </article>

    </div>
  );
}
