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
      // Combine local inputs into local Date objects
      const localStart = new Date(`${whDate}T${whStartTime}`);
      const localEnd = new Date(`${whDate}T${whEndTime}`);

      if (isNaN(localStart.getTime()) || isNaN(localEnd.getTime())) {
        setWhError('Invalid date or time selected');
        return;
      }

      // Convert to UTC ISO strings
      const utcStartTime = localStart.toISOString();
      const utcEndTime = localEnd.toISOString();

      await apiRequest('/working-hours/admin', 'POST', {
        startTime: utcStartTime,
        endTime: utcEndTime
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

  // Format UTC ISO string into client local time: "09:00 AM"
  function formatTime(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Format UTC ISO string into client local date: "Thu, Jun 11, 2026"
  function formatDate(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleDateString([], {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      
      {/* Page Header */}
      <article style={{ margin: 0 }}>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>✨ Groomer Admin Panel</h2>
        <p style={{ color: 'var(--pico-muted-color)', margin: 0, fontSize: '0.95rem' }}>
          Manage client schedules, approve/deny appointments, search registered clients, and apply account ban restrictions.
        </p>
      </article>

      <div className="grid">
        
        {/* Module 1: Working Hours Manager */}
        <article style={{ margin: 0 }}>
          <header>
            <h3 style={{ fontSize: '1.25rem', margin: 0 }}>⏰ Manage Working Windows</h3>
          </header>
          
          {whError && (
            <div style={{ color: 'var(--color-danger)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              ⚠️ {whError}
            </div>
          )}
          {whSuccess && (
            <div style={{ color: 'var(--color-success)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              ✅ {whSuccess}
            </div>
          )}

          <form onSubmit={handleAddWorkingHours} style={{ borderBottom: '1px solid var(--pico-border-color)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
            <label htmlFor="whDate">
              Select Date
              <input type="date" id="whDate" value={whDate} onChange={(e) => setWhDate(e.target.value)} required />
            </label>

            <div className="grid" style={{ gap: '1rem' }}>
              <label htmlFor="whStart">
                Start Time
                <input type="time" id="whStart" value={whStartTime} onChange={(e) => setWhStartTime(e.target.value)} required />
              </label>
              <label htmlFor="whEnd">
                End Time
                <input type="time" id="whEnd" value={whEndTime} onChange={(e) => setWhEndTime(e.target.value)} required />
              </label>
            </div>

            <button type="submit" className="secondary" style={{ width: '100%', marginTop: '0.5rem' }}>
              Open Window
            </button>
          </form>

          {/* Active Working Windows List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '0.25rem' }}>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--pico-muted-color)', fontWeight: 600 }}>
              Open Scheduling Windows
            </h4>
            {workingHours.length === 0 ? (
              <p style={{ color: 'var(--pico-muted-color)', fontStyle: 'italic', fontSize: '0.85rem', textAlign: 'center', margin: '1rem 0' }}>
                No working windows defined yet.
              </p>
            ) : (
              workingHours.map(wh => (
                <div key={wh.id} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  background: 'var(--pico-card-background-color)', 
                  padding: '0.75rem 1rem', 
                  border: '1px solid var(--pico-border-color)', 
                  borderRadius: 'var(--border-radius-md)' 
                }}>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '0.85rem', display: 'block' }}>{formatDate(wh.start_time)}</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--pico-primary)', fontWeight: 600 }}>
                      {formatTime(wh.start_time)} - {formatTime(wh.end_time)}
                    </span>
                  </div>
                  <button 
                    className="danger" 
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', margin: 0, width: 'auto' }} 
                    onClick={() => handleDeleteWorkingHours(wh.id)}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </article>

        {/* Module 2: Client Ban & Search Registry */}
        <article style={{ margin: 0 }}>
          <header>
            <h3 style={{ fontSize: '1.25rem', margin: 0 }}>👥 Client Database</h3>
          </header>
          
          {clientError && (
            <div style={{ color: 'var(--color-danger)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              ⚠️ {clientError}
            </div>
          )}

          {/* Search Box - Grouped input and button */}
          <form onSubmit={handleSearchClients} style={{ marginBottom: '1.5rem' }}>
            <fieldset role="group" style={{ margin: 0 }}>
              <input 
                type="search" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                placeholder="Search clients..." 
              />
              <input type="submit" value="Search" style={{ width: 'auto' }} />
            </fieldset>
          </form>

          {/* Clients List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.25rem' }}>
            {clients.length === 0 ? (
              <p style={{ color: 'var(--pico-muted-color)', fontStyle: 'italic', fontSize: '0.85rem', textAlign: 'center', margin: '1rem 0' }}>
                No clients found.
              </p>
            ) : (
              clients.map(client => (
                <div key={client.id} style={{ 
                  background: 'var(--pico-card-background-color)', 
                  border: '1px solid var(--pico-border-color)', 
                  padding: '1rem', 
                  borderRadius: 'var(--border-radius-md)', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start' 
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                    <strong style={{ color: 'var(--pico-color)' }}>{client.name}</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--pico-muted-color)' }}>👤 @{client.username}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--pico-muted-color)' }}>✉️ {client.email}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--pico-muted-color)' }}>📞 {client.phone}</span>
                    {client.is_banned === 1 && (
                      <span className="status-badge status-banned" style={{ width: 'fit-content', marginTop: '0.5rem' }}>
                        Banned Account
                      </span>
                    )}
                  </div>
                  
                  <button 
                    className={client.is_banned === 1 ? 'success' : 'danger'} 
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', margin: 0, width: 'auto', alignSelf: 'center' }}
                    onClick={() => handleToggleBan(client.id, client.is_banned === 1)}
                  >
                    {client.is_banned === 1 ? 'Unban' : 'Ban'}
                  </button>
                </div>
              ))
            )}
          </div>
        </article>

      </div>

      {/* Module 3: Master Appointment Scheduler Grid */}
      <article style={{ margin: 0 }}>
        <header>
          <h3 style={{ fontSize: '1.25rem', margin: 0 }}>📅 Master Appointment Log</h3>
        </header>
        
        <div style={{ overflowX: 'auto' }}>
          {appointments.length === 0 ? (
            <p style={{ color: 'var(--pico-muted-color)', fontStyle: 'italic', padding: '2rem 0', textAlign: 'center', margin: 0 }}>
              No appointments logged in system.
            </p>
          ) : (
            <table className="striped" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Pet Name</th>
                  <th>Client Details</th>
                  <th>Date</th>
                  <th>Time Slot</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Update Status</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map(appt => (
                  <tr key={appt.id}>
                    <td>
                      <strong>{appt.pet_name}</strong> <br/>
                      <small style={{ color: 'var(--pico-muted-color)' }}>{appt.pet_breed}</small>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      <strong>{appt.client_name}</strong> <br/>
                      <span style={{ color: 'var(--pico-muted-color)' }}>@{appt.client_username}</span> <br/>
                      <span style={{ color: 'var(--pico-muted-color)' }}>✉️ {appt.client_email}</span> <br/>
                      <span style={{ color: 'var(--pico-muted-color)' }}>📞 {appt.client_phone}</span>
                    </td>
                    <td>{formatDate(appt.start_time)}</td>
                    <td style={{ color: 'var(--pico-primary)', fontWeight: '600' }}>
                      {formatTime(appt.start_time)} - {formatTime(appt.end_time)}
                    </td>
                    <td>
                      <span className={`status-badge status-${appt.status}`}>{appt.status}</span>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--pico-muted-color)', maxWidth: '200px' }}>
                      {appt.notes || '—'}
                    </td>
                    <td>
                      <select 
                        value={appt.status} 
                        onChange={(e) => handleStatusChange(appt.id, e.target.value)}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', margin: 0, width: 'auto', height: 'auto' }}
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
      </article>

    </div>
  );
}
