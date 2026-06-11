const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { decrypt } = require('../crypto');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All routes require user authentication
router.use(authenticateToken);

/**
 * POST /api/appointments
 * Client: Schedule a new appointment.
 * Validates against working hours, pet ownership, date/time boundaries, and scheduling conflicts.
 */
router.post('/', async (req, res) => {
  const { petId, startTime, endTime, notes } = req.body;

  if (!petId || !startTime || !endTime) {
    return res.status(400).json({ error: 'petId, startTime, and endTime are required' });
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({ error: 'Invalid date-time format' });
  }

  // Basic check: startTime must be strictly before endTime
  if (start >= end) {
    return res.status(400).json({ error: 'startTime must be strictly before endTime' });
  }

  // Check that the date-time is not in the past
  const now = new Date();
  if (start < now) {
    return res.status(400).json({ error: 'Cannot book appointments for a past date' });
  }

  try {
    // 1. Verify pet exists and belongs to the client
    const [pets] = await db.query('SELECT id FROM pets WHERE id = ? AND user_id = ?', [petId, req.user.id]);
    if (pets.length === 0) {
      return res.status(404).json({ error: 'Pet not found or unauthorized' });
    }

    // 2. Load working hours that cover this appointment fully
    const [hours] = await db.query(
      'SELECT start_time, end_time FROM working_hours WHERE start_time <= ? AND end_time >= ?',
      [start, end]
    );

    if (hours.length === 0) {
      // Check if there are any working hours scheduled for this local date
      const [anyHours] = await db.query(
        'SELECT start_time, end_time FROM working_hours WHERE DATE(start_time) = DATE(?)',
        [start]
      );
      if (anyHours.length === 0) {
        return res.status(400).json({ error: 'The groomer has no working hours scheduled for this date' });
      }
      
      const wh = anyHours[0];
      const ws = wh.start_time instanceof Date ? wh.start_time.toISOString() : wh.start_time;
      const we = wh.end_time instanceof Date ? wh.end_time.toISOString() : wh.end_time;
      
      // Extract HH:MM UTC representation
      const fmtStart = ws.substring(11, 16);
      const fmtEnd = we.substring(11, 16);
      
      return res.status(400).json({
        error: `Selected times fall outside working hours for this date (Working hours: ${fmtStart} - ${fmtEnd})`
      });
    }

    // 3. Check for double booking conflicts (non-cancelled overlapping appointments)
    const [existing] = await db.query(
      "SELECT id FROM appointments WHERE status != 'cancelled' AND start_time < ? AND end_time > ?",
      [end, start]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'This time slot is already booked' });
    }

    // 4. Create the appointment
    const apptId = crypto.randomUUID();
    await db.query(
      `INSERT INTO appointments (id, user_id, pet_id, start_time, end_time, status, notes) 
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [apptId, req.user.id, petId, start, end, notes || '']
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
      `SELECT a.id, a.start_time, a.end_time, a.status, a.notes, a.created_at,
              p.id AS pet_id, p.name AS pet_name, p.breed AS pet_breed, p.age AS pet_age
       FROM appointments a
       JOIN pets p ON a.pet_id = p.id
       WHERE a.user_id = ?
       ORDER BY a.start_time DESC`,
      [req.user.id]
    );

    const formatted = rows.map(r => ({
      ...r,
      start_time: r.start_time instanceof Date ? r.start_time.toISOString() : r.start_time,
      end_time: r.end_time instanceof Date ? r.end_time.toISOString() : r.end_time
    }));

    res.status(200).json({ appointments: formatted });
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
      `SELECT a.id, a.start_time, a.end_time, a.status, a.notes, a.created_at,
              p.id AS pet_id, p.name AS pet_name, p.breed AS pet_breed
       FROM appointments a
       JOIN pets p ON a.pet_id = p.id
       WHERE a.id = ? AND a.user_id = ?`,
      [req.params.id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found or unauthorized' });
    }

    const r = rows[0];
    const formatted = {
      ...r,
      start_time: r.start_time instanceof Date ? r.start_time.toISOString() : r.start_time,
      end_time: r.end_time instanceof Date ? r.end_time.toISOString() : r.end_time
    };

    res.status(200).json({ appointment: formatted });
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
      `SELECT a.id, a.start_time, a.end_time, a.status, a.notes, a.created_at,
              p.id AS pet_id, p.name AS pet_name, p.breed AS pet_breed,
              u.id AS user_id, u.username AS client_username, u.encrypted_name, u.encrypted_email, u.encrypted_phone
       FROM appointments a
       JOIN pets p ON a.pet_id = p.id
       JOIN users u ON a.user_id = u.id
       ORDER BY a.start_time DESC`
    );

    // Decrypt the personal client information in each row
    const decryptedAppointments = rows.map(row => {
      const appt = { ...row };
      appt.start_time = row.start_time instanceof Date ? row.start_time.toISOString() : row.start_time;
      appt.end_time = row.end_time instanceof Date ? row.end_time.toISOString() : row.end_time;
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
