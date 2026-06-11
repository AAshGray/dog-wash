import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';

export default function AdminDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [clients, setClients] = useState([]);
  const [workingHours, setWorkingHours] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // States for loaders/messages
  const [whError, setWhError] = useState('');
  const [whSuccess, setWhSuccess] = useState('');
  const [clientError, setClientError] = useState('');

  // Working Hours Form
  const [whDate, setWhDate] = useState('');
  const [whStartTime, setWhStartTime] = useState('');
  const [whEndTime, setWhEndTime] = useState('');

  useEffect(() => {
    fetchAdminData();
  }, []);

  async function fetchAdminData() {
    try {
      // 1. Fetch all appointments
      const apptData = await apiRequest('/appointments/admin/all');
      setAppointments(apptData.appointments);

      // 2. Fetch all clients
      const clientsData = await apiRequest('/admin/clients');
      setClients(clientsData.clients);

      // 3. Fetch all working hours
      const whData = await apiRequest('/working-hours');
      setWorkingHours(whData.workingHours);
    } catch (err) {
      console.error('Error fetching admin dashboard data:', err);
    }
  }

  // Handle setting working hours
  async function handleAddWorkingHours(e) {
    e.preventDefault();
    setWhError('');
    setWhSuccess('');

    if (!whDate || !whStartTime || !whEndTime) {
      setWhError('Date, Start Time, and End Time are required');
      return;
    }

    try {
      await apiRequest('/working-hours/admin', 'POST', {
        date: whDate,
        startTime: whStartTime + ':00',
        endTime: whEndTime + ':00'
      });
      setWhSuccess('Working hours set successfully!');
      setWhDate('');
      setWhStartTime('');
      setWhEndTime('');

      // Refresh working hours
      const whData = await apiRequest('/working-hours');
      setWorkingHours(whData.workingHours);
    } catch (err) {
      setWhError(err.message || 'Failed to set working hours');
    }
  }

  // Handle deleting working hours
  async function handleDeleteWorkingHours(id) {
    if (!window.confirm('Are you sure you want to remove this working window?')) return;
    try {
      await apiRequest(`/working-hours/admin/${id}`, 'DELETE');
      // Refresh working hours
      const whData = await apiRequest('/working-hours');
      setWorkingHours(whData.workingHours);
    } catch (err) {
      alert(err.message || 'Failed to remove working hours');
    }
  }

  // Handle changing appointment status
  async function handleStatusChange(apptId, newStatus) {
    try {
      await apiRequest(`/appointments/admin/${apptId}/status`, 'PATCH', {
        status: newStatus
      });
      // Refresh appointments list
      const apptData = await apiRequest('/appointments/admin/all');
      setAppointments(apptData.appointments);
    } catch (err) {
      alert(err.message || 'Failed to update status');
    }
  }

  // Handle searching clients
  async function handleSearchClients(e) {
    e.preventDefault();
    setClientError('');
    try {
      const data = await apiRequest(`/admin/clients?q=${searchQuery}`);
      setClients(data.clients);
    } catch (err) {
      setClientError(err.message || 'Search failed');
    }
  }

  // Handle banning/unbanning client
  async function handleToggleBan(clientId, currentBanStatus) {
    const action = currentBanStatus ? 'unban' : 'ban';
    if (!window.confirm(`Are you sure you want to ${action} this client?`)) return;

    try {
      await apiRequest(`/admin/clients/${clientId}/ban`, 'PATCH', {
        isBanned: !currentBanStatus
      });
      // Refresh clients list
      const clientsData = await apiRequest(`/admin/clients?q=${searchQuery}`);
      setClients(clientsData.clients);
      
      // Also refresh appointments list in case user accounts are banned,
      // it would show their status or block them from list
      const apptData = await apiRequest('/appointments/admin/all');
      setAppointments(apptData.appointments);
    } catch (err) {
      alert(err.message || 'Failed to update user status');
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
    <div style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1.5rem', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      
      {/* Page Header */}
      <div className="glass-card animate-fade-in" style={{ padding: '2rem' }}>
        <h2 style={{ fontSize: '2.25rem', marginBottom: '0.5rem' }}>✨ Groomer Admin Panel</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Manage client schedules, approve/deny appointments, search registered clients, and apply account ban restrictions.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
        
        {/* Module 1: Working Hours Manager */}
        <div className="glass-card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h3>⏰ Manage Working Windows</h3>
          {whError && <div style={{ color: 'var(--color-danger)', fontSize: '0.9rem' }}>⚠️ {whError}</div>}
          {whSuccess && <div style={{ color: 'var(--color-success)', fontSize: '0.9rem' }}>✅ {whSuccess}</div>}

          <form onSubmit={handleAddWorkingHours} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1.5rem' }}>
            <div className="form-group">
              <label htmlFor="whDate">Select Date</label>
              <input type="date" id="whDate" value={whDate} onChange={(e) => setWhDate(e.target.value)} required />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label htmlFor="whStart">Start Time</label>
                <input type="time" id="whStart" value={whStartTime} onChange={(e) => setWhStartTime(e.target.value)} required />
              </div>
              <div className="form-group">
                <label htmlFor="whEnd">End Time</label>
                <input type="time" id="whEnd" value={whEndTime} onChange={(e) => setWhEndTime(e.target.value)} required />
              </div>
            </div>

            <button type="submit" className="btn btn-secondary" style={{ padding: '0.65rem' }}>Open Window</button>
          </form>

          {/* Active Working Windows List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '0.5rem' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Open Scheduling Windows</h4>
            {workingHours.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem', textAlign: 'center' }}>No working windows defined yet.</p>
            ) : (
              workingHours.map(wh => (
                <div key={wh.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.4)', padding: '0.75rem 1rem', border: '1px solid var(--glass-border)', borderRadius: 'var(--border-radius-md)' }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>{formatDate(wh.date)}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-secondary)' }}>{formatTime(wh.start_time)} - {formatTime(wh.end_time)}</div>
                  </div>
                  <button className="btn btn-danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={() => handleDeleteWorkingHours(wh.id)}>Remove</button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Module 2: Client Ban & Search Registry */}
        <div className="glass-card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h3>👥 Client Database</h3>
          {clientError && <div style={{ color: 'var(--color-danger)', fontSize: '0.9rem' }}>⚠️ {clientError}</div>}

          {/* Search Box */}
          <form onSubmit={handleSearchClients} style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              placeholder="Search name, phone, email, username..." 
              style={{ flex: 1, padding: '0.5rem' }}
            />
            <button type="submit" className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>Search</button>
          </form>

          {/* Clients List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.5rem' }}>
            {clients.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem', textAlign: 'center' }}>No clients found.</p>
            ) : (
              clients.map(client => (
                <div key={client.id} style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--glass-border)', padding: '1rem', borderRadius: 'var(--border-radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <h4 style={{ color: 'var(--text-primary)' }}>{client.name}</h4>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>👤 @{client.username}</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>✉️ {client.email}</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>📞 {client.phone}</span>
                    {client.is_banned === 1 && (
                      <span className="status-badge status-banned" style={{ width: 'fit-content', marginTop: '0.5rem' }}>Banned Account</span>
                    )}
                  </div>
                  
                  <button 
                    className={`btn ${client.is_banned === 1 ? 'btn-secondary' : 'btn-danger'}`} 
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                    onClick={() => handleToggleBan(client.id, client.is_banned === 1)}
                  >
                    {client.is_banned === 1 ? 'Unban' : 'Ban Client'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Module 3: Master Appointment Scheduler Grid */}
      <div className="glass-card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <h3>📅 Master Appointment Log</h3>
        <div style={{ overflowX: 'auto' }}>
          {appointments.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '2rem 0', textAlign: 'center' }}>No appointments logged in system.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '850px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
                  <th style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>Pet Name</th>
                  <th style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>Client Details</th>
                  <th style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>Date</th>
                  <th style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>Time Slot</th>
                  <th style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>Status</th>
                  <th style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>Notes</th>
                  <th style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>Update Status</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map(appt => (
                  <tr key={appt.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '1rem 0.75rem', fontWeight: '600', color: 'var(--color-accent)' }}>
                      {appt.pet_name} <br/>
                      <span style={{ fontSize: '0.75rem', fontWeight: '400', color: 'var(--text-secondary)' }}>{appt.pet_breed}</span>
                    </td>
                    <td style={{ padding: '1rem 0.75rem', fontSize: '0.85rem' }}>
                      <strong>{appt.client_name}</strong> <br/>
                      <span style={{ color: 'var(--text-muted)' }}>@{appt.client_username}</span> <br/>
                      <span style={{ color: 'var(--text-secondary)' }}>✉️ {appt.client_email}</span> <br/>
                      <span style={{ color: 'var(--text-secondary)' }}>📞 {appt.client_phone}</span>
                    </td>
                    <td style={{ padding: '1rem 0.75rem' }}>{formatDate(appt.date)}</td>
                    <td style={{ padding: '1rem 0.75rem', color: 'var(--color-secondary)' }}>{formatTime(appt.start_time)} - {formatTime(appt.end_time)}</td>
                    <td style={{ padding: '1rem 0.75rem' }}>
                      <span className={`status-badge status-${appt.status}`}>{appt.status}</span>
                    </td>
                    <td style={{ padding: '1rem 0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '200px' }}>{appt.notes || '—'}</td>
                    <td style={{ padding: '1rem 0.75rem' }}>
                      <select 
                        value={appt.status} 
                        onChange={(e) => handleStatusChange(appt.id, e.target.value)}
                        style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem' }}
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
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
