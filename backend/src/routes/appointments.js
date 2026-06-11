const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { decrypt } = require('../crypto');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * Converts "HH:MM:SS" or "HH:MM" to minutes from midnight.
 */
function toMinutes(timeStr) {
  const parts = timeStr.split(':').map(Number);
  return parts[0] * 60 + (parts[1] || 0);
}

/**
 * Checks if target window [start, end] is fully within work window [workStart, workEnd].
 */
function isWithinWindow(start, end, workStart, workEnd) {
  return toMinutes(start) >= toMinutes(workStart) && toMinutes(end) <= toMinutes(workEnd);
}

/**
 * Checks if two time windows [s1, e1] and [s2, e2] overlap.
 */
function hasOverlap(s1, e1, s2, e2) {
  return toMinutes(s1) < toMinutes(e2) && toMinutes(e1) > toMinutes(s2);
}

// All routes require user authentication
router.use(authenticateToken);

/**
 * POST /api/appointments
 * Client: Schedule a new appointment.
 * Validates against working hours, pet ownership, date/time boundaries, and scheduling conflicts.
 */
router.post('/', async (req, res) => {
  const { petId, date, startTime, endTime, notes } = req.body;

  if (!petId || !date || !startTime || !endTime) {
    return res.status(400).json({ error: 'petId, date, startTime, and endTime are required' });
  }

  // Basic check: startTime must be strictly before endTime
  if (toMinutes(startTime) >= toMinutes(endTime)) {
    return res.status(400).json({ error: 'startTime must be strictly before endTime' });
  }

  // Check that the date is not in the past
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(`${date}T00:00:00`);
  if (isNaN(targetDate.getTime())) {
    return res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD' });
  }
  if (targetDate < today) {
    return res.status(400).json({ error: 'Cannot book appointments for a past date' });
  }

  try {
    // 1. Verify pet exists and belongs to the client
    const [pets] = await db.query('SELECT id FROM pets WHERE id = ? AND user_id = ?', [petId, req.user.id]);
    if (pets.length === 0) {
      return res.status(404).json({ error: 'Pet not found or unauthorized' });
    }

    // 2. Load working hours for the date
    const [hours] = await db.query('SELECT start_time, end_time FROM working_hours WHERE date = ?', [date]);
    if (hours.length === 0) {
      return res.status(400).json({ error: 'The groomer has no working hours scheduled for this date' });
    }

    const { start_time: workStart, end_time: workEnd } = hours[0];
    
    // Validate appointment is within working hours
    if (!isWithinWindow(startTime, endTime, workStart, workEnd)) {
      return res.status(400).json({
        error: `Selected times fall outside working hours for this date (Working hours: ${workStart.substring(0, 5)} - ${workEnd.substring(0, 5)})`
      });
    }

    // 3. Check for double booking conflicts (non-cancelled overlapping appointments)
    const [existing] = await db.query(
      "SELECT start_time, end_time FROM appointments WHERE date = ? AND status != 'cancelled'",
      [date]
    );

    for (const appt of existing) {
      if (hasOverlap(startTime, endTime, appt.start_time, appt.end_time)) {
        return res.status(409).json({ error: 'This time slot is already booked' });
      }
    }

    // 4. Create the appointment
    const apptId = crypto.randomUUID();
    await db.query(
      `INSERT INTO appointments (id, user_id, pet_id, date, start_time, end_time, status, notes) 
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [apptId, req.user.id, petId, date, startTime, endTime, notes || '']
    );

    res.status(201).json({
      message: 'Appointment scheduled successfully',
      appointmentId: apptId,
      status: 'pending'
    });
  } catch (err) {
    console.error('Error booking appointment:', err);
    res.status(500).json({ error: 'An error occurred while booking the appointment' });
  }
});

/**
 * GET /api/appointments
 * Client: Retrieves all appointments for the logged-in client.
 */
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT a.id, a.date, a.start_time, a.end_time, a.status, a.notes, a.created_at,
              p.id AS pet_id, p.name AS pet_name, p.breed AS pet_breed, p.age AS pet_age
       FROM appointments a
       JOIN pets p ON a.pet_id = p.id
       WHERE a.user_id = ?
       ORDER BY a.date DESC, a.start_time DESC`,
      [req.user.id]
    );
    res.status(200).json({ appointments: rows });
  } catch (err) {
    console.error('Error fetching client appointments:', err);
    res.status(500).json({ error: 'An error occurred while fetching appointments' });
  }
});

/**
 * GET /api/appointments/:id
 * Client: Retrieves details of a specific appointment.
 */
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT a.id, a.date, a.start_time, a.end_time, a.status, a.notes, a.created_at,
              p.id AS pet_id, p.name AS pet_name, p.breed AS pet_breed
       FROM appointments a
       JOIN pets p ON a.pet_id = p.id
       WHERE a.id = ? AND a.user_id = ?`,
      [req.params.id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found or unauthorized' });
    }

    res.status(200).json({ appointment: rows[0] });
  } catch (err) {
    console.error('Error fetching appointment detail:', err);
    res.status(500).json({ error: 'An error occurred while fetching the appointment' });
  }
});

/**
 * PATCH /api/appointments/:id/cancel
 * Client: Allows a client to cancel their own appointment.
 */
router.patch('/:id/cancel', async (req, res) => {
  try {
    const [existing] = await db.query(
      'SELECT id, status FROM appointments WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Appointment not found or unauthorized' });
    }

    if (existing[0].status === 'cancelled') {
      return res.status(400).json({ error: 'Appointment is already cancelled' });
    }

    await db.query("UPDATE appointments SET status = 'cancelled' WHERE id = ?", [req.params.id]);

    res.status(200).json({ message: 'Appointment cancelled successfully' });
  } catch (err) {
    console.error('Error cancelling appointment:', err);
    res.status(500).json({ error: 'An error occurred while cancelling the appointment' });
  }
});

// ==========================================
// ADMIN ENDPOINTS
// ==========================================

/**
 * GET /api/appointments/admin/all
 * Admin-only: Retrieves all appointments with decrypted client details and pet details.
 */
router.get('/admin/all', requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT a.id, a.date, a.start_time, a.end_time, a.status, a.notes, a.created_at,
              p.id AS pet_id, p.name AS pet_name, p.breed AS pet_breed,
              u.id AS user_id, u.username AS client_username, u.encrypted_name, u.encrypted_email, u.encrypted_phone
       FROM appointments a
       JOIN pets p ON a.pet_id = p.id
       JOIN users u ON a.user_id = u.id
       ORDER BY a.date DESC, a.start_time DESC`
    );

    // Decrypt the personal client information in each row
    const decryptedAppointments = rows.map(row => {
      const appt = { ...row };
      appt.client_name = decrypt(row.encrypted_name);
      appt.client_email = decrypt(row.encrypted_email);
      appt.client_phone = decrypt(row.encrypted_phone);
      
      // Clean up encrypted columns so we don't leak ciphertexts
      delete appt.encrypted_name;
      delete appt.encrypted_email;
      delete appt.encrypted_phone;
      return appt;
    });

    res.status(200).json({ appointments: decryptedAppointments });
  } catch (err) {
    console.error('Error fetching admin appointments:', err);
    res.status(500).json({ error: 'An error occurred while fetching appointments' });
  }
});

/**
 * PATCH /api/appointments/admin/:id/status
 * Admin-only: Updates the status of an appointment.
 */
router.patch('/admin/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  try {
    const [result] = await db.query(
      'UPDATE appointments SET status = ? WHERE id = ?',
      [status, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.status(200).json({ message: 'Appointment status updated successfully', appointmentId: req.params.id, status });
  } catch (err) {
    console.error('Error updating appointment status:', err);
    res.status(500).json({ error: 'An error occurred while updating the appointment status' });
  }
});

module.exports = router;
