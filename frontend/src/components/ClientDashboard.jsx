import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';

export default function ClientDashboard() {
  const [pets, setPets] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [workingHours, setWorkingHours] = useState([]);
  
  // States for loaders/messages
  const [petError, setPetError] = useState('');
  const [petSuccess, setPetSuccess] = useState('');
  const [apptError, setApptError] = useState('');
  const [apptSuccess, setApptSuccess] = useState('');

  // Pet Form States
  const [petName, setPetName] = useState('');
  const [petBreed, setPetBreed] = useState('');
  const [petAge, setPetAge] = useState('');
  const [petNotes, setPetNotes] = useState('');

  // Appointment Form States
  const [selectedPet, setSelectedPet] = useState('');
  const [apptDate, setApptDate] = useState('');
  const [apptStartTime, setApptStartTime] = useState('');
  const [apptEndTime, setApptEndTime] = useState('');
  const [apptNotes, setApptNotes] = useState('');

  // Fetch all initial data
  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      const petsData = await apiRequest('/pets');
      setPets(petsData.pets);
      if (petsData.pets.length > 0) {
        setSelectedPet(petsData.pets[0].id);
      }

      const apptsData = await apiRequest('/appointments');
      setAppointments(apptsData.appointments);

      const whData = await apiRequest('/working-hours');
      setWorkingHours(whData.workingHours);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
  }

  // Handle adding a pet
  async function handleAddPet(e) {
    e.preventDefault();
    setPetError('');
    setPetSuccess('');

    if (!petName || !petBreed || !petAge) {
      setPetError('Name, Breed, and Age are required');
      return;
    }

    try {
      await apiRequest('/pets', 'POST', {
        name: petName,
        breed: petBreed,
        age: parseInt(petAge, 10),
        special_notes: petNotes
      });
      setPetSuccess('Pet added successfully!');
      setPetName('');
      setPetBreed('');
      setPetAge('');
      setPetNotes('');
      
      // Refresh pet list
      const petsData = await apiRequest('/pets');
      setPets(petsData.pets);
      if (!selectedPet && petsData.pets.length > 0) {
        setSelectedPet(petsData.pets[0].id);
      }
    } catch (err) {
      setPetError(err.message || 'Failed to add pet');
    }
  }

  // Handle booking appointment
  async function handleBookAppointment(e) {
    e.preventDefault();
    setApptError('');
    setApptSuccess('');

    if (!selectedPet || !apptDate || !apptStartTime || !apptEndTime) {
      setApptError('Please fill out all booking fields');
      return;
    }

    try {
      await apiRequest('/appointments', 'POST', {
        petId: selectedPet,
        date: apptDate,
        startTime: apptStartTime + ':00', // Format as HH:MM:SS
        endTime: apptEndTime + ':00',
        notes: apptNotes
      });
      setApptSuccess('Appointment scheduled successfully! Awaiting groomer review.');
      setApptDate('');
      setApptStartTime('');
      setApptEndTime('');
      setApptNotes('');

      // Refresh appointments list
      const apptsData = await apiRequest('/appointments');
      setAppointments(apptsData.appointments);
    } catch (err) {
      setApptError(err.message || 'Failed to book appointment');
    }
  }

  // Handle cancelling appointment
  async function handleCancelAppointment(id) {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
    try {
      await apiRequest(`/appointments/${id}/cancel`, 'PATCH');
      // Refresh appointments list
      const apptsData = await apiRequest('/appointments');
      setAppointments(apptsData.appointments);
    } catch (err) {
      alert(err.message || 'Failed to cancel appointment');
    }
  }

  // Format Time representation from "09:00:00" -> "09:00"
  function formatTime(t) {
    return t ? t.substring(0, 5) : '';
  }

  // Format Date representation
  function formatDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
    });
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Welcome Banner */}
      <div className="glass-card animate-fade-in" style={{ padding: '2rem' }}>
        <h2 style={{ fontSize: '2.25rem', marginBottom: '0.5rem' }}>Client Dashboard</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Manage your furry friends and schedule your grooming sessions. Please note: payment is accepted **in-person at the time of appointment** (cash/card). No payment information is collected online.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
        
        {/* Section 1: My Pets */}
        <div className="glass-card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h3>🐾 My Pets</h3>
          {petError && <div style={{ color: 'var(--color-danger)', fontSize: '0.9rem' }}>⚠️ {petError}</div>}
          {petSuccess && <div style={{ color: 'var(--color-success)', fontSize: '0.9rem' }}>✅ {petSuccess}</div>}
          
          {/* Add Pet Form */}
          <form onSubmit={handleAddPet} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label htmlFor="petName">Pet Name</label>
                <input type="text" id="petName" value={petName} onChange={(e) => setPetName(e.target.value)} placeholder="Max" required />
              </div>
              <div className="form-group">
                <label htmlFor="petAge">Age (years)</label>
                <input type="number" id="petAge" value={petAge} onChange={(e) => setPetAge(e.target.value)} placeholder="3" min="0" required />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="petBreed">Breed</label>
              <input type="text" id="petBreed" value={petBreed} onChange={(e) => setPetBreed(e.target.value)} placeholder="Goldendoodle" required />
            </div>
            <div className="form-group">
              <label htmlFor="petNotes">Special Preferences / Notes</label>
              <textarea id="petNotes" value={petNotes} onChange={(e) => setPetNotes(e.target.value)} placeholder="E.g., Scared of blowdryers, skin allergy to oatmeal shampoo..." />
            </div>
            <button type="submit" className="btn btn-secondary" style={{ padding: '0.65rem' }}>Add Pet</button>
          </form>

          {/* Pets List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem' }}>
            {pets.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center' }}>No pets registered yet. Add one above!</p>
            ) : (
              pets.map(pet => (
                <div key={pet.id} style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--glass-border)', padding: '1rem', borderRadius: 'var(--border-radius-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ color: 'var(--color-accent)' }}>{pet.name}</h4>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{pet.breed} ({pet.age} yrs)</span>
                  </div>
                  {pet.special_notes && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem', borderTop: '1px dashed rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>💡 {pet.special_notes}</p>}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Section 2: Book Appointment */}
        <div className="glass-card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h3>📅 Schedule Appointment</h3>
          {apptError && <div style={{ color: 'var(--color-danger)', fontSize: '0.9rem' }}>⚠️ {apptError}</div>}
          {apptSuccess && <div style={{ color: 'var(--color-success)', fontSize: '0.9rem' }}>✅ {apptSuccess}</div>}

          {pets.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem 1rem' }}>
              <p style={{ marginBottom: '1rem' }}>Please register a pet before scheduling an appointment.</p>
            </div>
          ) : (
            <form onSubmit={handleBookAppointment} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label htmlFor="selectPet">Select Pet</label>
                <select id="selectPet" value={selectedPet} onChange={(e) => setSelectedPet(e.target.value)}>
                  {pets.map(pet => (
                    <option key={pet.id} value={pet.id}>{pet.name} ({pet.breed})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="apptDate">Select Date</label>
                <input type="date" id="apptDate" value={apptDate} onChange={(e) => setApptDate(e.target.value)} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label htmlFor="startTime">Start Time</label>
                  <input type="time" id="startTime" value={apptStartTime} onChange={(e) => setApptStartTime(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label htmlFor="endTime">End Time</label>
                  <input type="time" id="endTime" value={apptEndTime} onChange={(e) => setApptEndTime(e.target.value)} required />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="apptNotes">Notes for Groomer</label>
                <textarea id="apptNotes" value={apptNotes} onChange={(e) => setApptNotes(e.target.value)} placeholder="E.g., Trim tail round, watch out for sore leg..." />
              </div>

              <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem' }}>Schedule Slot</button>
            </form>
          )}

          {/* Open Windows Calendar */}
          <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '1rem', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--glass-border)' }}>
            <h4 style={{ fontSize: '0.95rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>🗓️ Groomer Open Windows</h4>
            {workingHours.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No open windows scheduled yet. Please ask groomer.</p>
            ) : (
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto' }}>
                {workingHours.map(wh => (
                  <li key={wh.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.25rem' }}>
                    <span style={{ fontWeight: '500' }}>{formatDate(wh.date)}</span>
                    <span style={{ color: 'var(--color-secondary)' }}>{formatTime(wh.start_time)} - {formatTime(wh.end_time)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Section 3: My Appointments */}
      <div className="glass-card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <h3>📅 My Appointments</h3>
        <div style={{ overflowX: 'auto' }}>
          {appointments.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '2rem 0', textAlign: 'center' }}>No appointments scheduled yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
                  <th style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>Pet Name</th>
                  <th style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>Date</th>
                  <th style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>Time Slot</th>
                  <th style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>Status</th>
                  <th style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>Notes</th>
                  <th style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map(appt => (
                  <tr key={appt.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '1rem 0.75rem', fontWeight: '600', color: 'var(--color-accent)' }}>{appt.pet_name}</td>
                    <td style={{ padding: '1rem 0.75rem' }}>{formatDate(appt.date)}</td>
                    <td style={{ padding: '1rem 0.75rem', color: 'var(--color-secondary)' }}>{formatTime(appt.start_time)} - {formatTime(appt.end_time)}</td>
                    <td style={{ padding: '1rem 0.75rem' }}>
                      <span className={`status-badge status-${appt.status}`}>{appt.status}</span>
                    </td>
                    <td style={{ padding: '1rem 0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{appt.notes || '—'}</td>
                    <td style={{ padding: '1rem 0.75rem' }}>
                      {appt.status !== 'completed' && appt.status !== 'cancelled' ? (
                        <button className="btn btn-danger" style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }} onClick={() => handleCancelAppointment(appt.id)}>Cancel</button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}
