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
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Welcome Banner */}
      <article style={{ margin: 0 }}>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Client Dashboard</h2>
        <p style={{ color: 'var(--pico-muted-color)', margin: 0, fontSize: '0.95rem' }}>
          Manage your furry friends and schedule your grooming sessions. Please note: payment is accepted **in-person at the time of appointment** (cash/card). No payment information is collected online.
        </p>
      </article>

      <div className="grid">
        
        {/* Section 1: My Pets */}
        <article style={{ margin: 0 }}>
          <header>
            <h3 style={{ fontSize: '1.25rem', margin: 0 }}>🐾 My Pets</h3>
          </header>
          
          {petError && (
            <div style={{ color: 'var(--color-danger)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              ⚠️ {petError}
            </div>
          )}
          {petSuccess && (
            <div style={{ color: 'var(--color-success)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              ✅ {petSuccess}
            </div>
          )}
          
          {/* Add Pet Form */}
          <form onSubmit={handleAddPet} style={{ borderBottom: '1px solid var(--pico-border-color)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
            <div className="grid" style={{ gap: '1rem' }}>
              <label htmlFor="petName">
                Pet Name
                <input type="text" id="petName" value={petName} onChange={(e) => setPetName(e.target.value)} placeholder="Max" required />
              </label>
              <label htmlFor="petAge">
                Age (years)
                <input type="number" id="petAge" value={petAge} onChange={(e) => setPetAge(e.target.value)} placeholder="3" min="0" required />
              </label>
            </div>
            
            <label htmlFor="petBreed">
              Breed
              <input type="text" id="petBreed" value={petBreed} onChange={(e) => setPetBreed(e.target.value)} placeholder="Goldendoodle" required />
            </label>
            
            <label htmlFor="petNotes">
              Special Preferences / Notes
              <textarea id="petNotes" value={petNotes} onChange={(e) => setPetNotes(e.target.value)} placeholder="E.g., Scared of blowdryers, skin allergy..." />
            </label>
            
            <button type="submit" className="secondary" style={{ width: '100%', marginTop: '0.5rem' }}>
              Add Pet
            </button>
          </form>

          {/* Pets List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '0.25rem' }}>
            {pets.length === 0 ? (
              <p style={{ color: 'var(--pico-muted-color)', fontStyle: 'italic', textAlign: 'center', fontSize: '0.9rem', margin: '1rem 0' }}>
                No pets registered yet. Add one above!
              </p>
            ) : (
              pets.map(pet => (
                <div key={pet.id} style={{ 
                  background: 'var(--pico-card-background-color)', 
                  border: '1px solid var(--pico-border-color)', 
                  padding: '0.75rem 1rem', 
                  borderRadius: 'var(--border-radius-md)' 
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: 'var(--pico-primary)' }}>{pet.name}</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--pico-muted-color)' }}>{pet.breed} ({pet.age} yrs)</span>
                  </div>
                  {pet.special_notes && (
                    <p style={{ 
                      fontSize: '0.8rem', 
                      color: 'var(--pico-muted-color)', 
                      marginTop: '0.5rem', 
                      borderTop: '1px dashed var(--pico-border-color)', 
                      paddingTop: '0.5rem',
                      marginBottom: 0
                    }}>
                      💡 {pet.special_notes}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </article>

        {/* Section 2: Book Appointment */}
        <article style={{ margin: 0 }}>
          <header>
            <h3 style={{ fontSize: '1.25rem', margin: 0 }}>📅 Schedule Appointment</h3>
          </header>
          
          {apptError && (
            <div style={{ color: 'var(--color-danger)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              ⚠️ {apptError}
            </div>
          )}
          {apptSuccess && (
            <div style={{ color: 'var(--color-success)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              ✅ {apptSuccess}
            </div>
          )}

          {pets.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--pico-muted-color)', padding: '2rem 1rem' }}>
              <p style={{ margin: 0 }}>Please register a pet before scheduling an appointment.</p>
            </div>
          ) : (
            <form onSubmit={handleBookAppointment} style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="selectPet">
                Select Pet
                <select id="selectPet" value={selectedPet} onChange={(e) => setSelectedPet(e.target.value)}>
                  {pets.map(pet => (
                    <option key={pet.id} value={pet.id}>{pet.name} ({pet.breed})</option>
                  ))}
                </select>
              </label>

              <label htmlFor="apptDate">
                Select Date
                <input type="date" id="apptDate" value={apptDate} onChange={(e) => setApptDate(e.target.value)} required />
              </label>

              <div className="grid" style={{ gap: '1rem' }}>
                <label htmlFor="startTime">
                  Start Time
                  <input type="time" id="startTime" value={apptStartTime} onChange={(e) => setApptStartTime(e.target.value)} required />
                </label>
                <label htmlFor="endTime">
                  End Time
                  <input type="time" id="endTime" value={apptEndTime} onChange={(e) => setApptEndTime(e.target.value)} required />
                </label>
              </div>

              <label htmlFor="apptNotes">
                Notes for Groomer
                <textarea id="apptNotes" value={apptNotes} onChange={(e) => setApptNotes(e.target.value)} placeholder="E.g., Trim tail round, watch out for sore leg..." />
              </label>

              <button type="submit" style={{ width: '100%', marginTop: '0.5rem' }}>
                Schedule Slot
              </button>
            </form>
          )}

          {/* Open Windows Calendar */}
          <div style={{ 
            background: 'var(--pico-card-background-color)', 
            padding: '1rem', 
            borderRadius: 'var(--border-radius-md)', 
            border: '1px solid var(--pico-border-color)' 
          }}>
            <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--pico-muted-color)', marginBottom: '0.75rem', fontWeight: 600 }}>
              🗓️ Groomer Open Windows
            </h4>
            {workingHours.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--pico-muted-color)', fontStyle: 'italic', margin: 0 }}>
                No open windows scheduled yet. Please ask groomer.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '120px', overflowY: 'auto', padding: 0, margin: 0 }}>
                {workingHours.map(wh => (
                  <li key={wh.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', borderBottom: '1px solid var(--pico-border-color)', paddingBottom: '0.25rem', marginBottom: 0 }}>
                    <span style={{ fontWeight: '500' }}>{formatDate(wh.date)}</span>
                    <span style={{ color: 'var(--pico-primary)', fontWeight: '600' }}>
                      {formatTime(wh.start_time)} - {formatTime(wh.end_time)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </div>

      {/* Section 3: My Appointments */}
      <article style={{ margin: 0 }}>
        <header>
          <h3 style={{ fontSize: '1.25rem', margin: 0 }}>📅 My Appointments</h3>
        </header>
        
        <div style={{ overflowX: 'auto' }}>
          {appointments.length === 0 ? (
            <p style={{ color: 'var(--pico-muted-color)', fontStyle: 'italic', padding: '2rem 0', textAlign: 'center', margin: 0 }}>
              No appointments scheduled yet.
            </p>
          ) : (
            <table className="striped" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Pet Name</th>
                  <th>Date</th>
                  <th>Time Slot</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map(appt => (
                  <tr key={appt.id}>
                    <td><strong>{appt.pet_name}</strong></td>
                    <td>{formatDate(appt.date)}</td>
                    <td style={{ color: 'var(--pico-primary)', fontWeight: '600' }}>
                      {formatTime(appt.start_time)} - {formatTime(appt.end_time)}
                    </td>
                    <td>
                      <span className={`status-badge status-${appt.status}`}>{appt.status}</span>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--pico-muted-color)' }}>{appt.notes || '—'}</td>
                    <td>
                      {appt.status !== 'completed' && appt.status !== 'cancelled' ? (
                        <button 
                          className="danger" 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', margin: 0, width: 'auto' }} 
                          onClick={() => handleCancelAppointment(appt.id)}
                        >
                          Cancel
                        </button>
                      ) : (
                        <span style={{ color: 'var(--pico-muted-color)', fontSize: '0.85rem' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </article>

    </div>
  );
}
