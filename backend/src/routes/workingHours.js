const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * Validates start and end times, and checks if date is in the past.
 */
function validateWorkingHours(dateStr, startTimeStr, endTimeStr) {
  // Check if start_time is before end_time
  // Format is assumed to be HH:MM:SS or HH:MM
  const startParts = startTimeStr.split(':').map(Number);
  const endParts = endTimeStr.split(':').map(Number);
  
  const startVal = startParts[0] * 60 + startParts[1];
  const endVal = endParts[0] * 60 + endParts[1];

  if (startVal >= endVal) {
    return 'startTime must be strictly before endTime';
  }

  // Check if date is in the past (comparing dates, ignoring current time)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(`${dateStr}T00:00:00`);
  if (isNaN(targetDate.getTime())) {
    return 'Invalid date format. Expected YYYY-MM-DD';
  }

  if (targetDate < today) {
    return 'Cannot set working hours for a past date';
  }

  return null;
}

/**
 * GET /api/working-hours
 * Retrieves all set working hours.
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, date, start_time, end_time FROM working_hours ORDER BY date ASC'
    );
    res.status(200).json({ workingHours: rows });
  } catch (err) {
    console.error('Error fetching working hours:', err);
    res.status(500).json({ error: 'An error occurred while fetching working hours' });
  }
});

/**
 * GET /api/working-hours/:date
 * Retrieves working hours for a specific date.
 */
router.get('/:date', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, date, start_time, end_time FROM working_hours WHERE date = ?',
      [req.params.date]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'No working hours scheduled for this date' });
    }
    res.status(200).json({ workingHours: rows[0] });
  } catch (err) {
    console.error('Error fetching working hours for date:', err);
    res.status(500).json({ error: 'An error occurred while fetching working hours' });
  }
});

/**
 * POST /api/working-hours/admin
 * Admin-only: Adds working hours for a specific date.
 * Returns 409 Conflict if hours are already set for the date.
 */
router.post('/admin', authenticateToken, requireAdmin, async (req, res) => {
  const { date, startTime, endTime } = req.body;

  if (!date || !startTime || !endTime) {
    return res.status(400).json({ error: 'Date, startTime, and endTime are required' });
  }

  const validationError = validateWorkingHours(date, startTime, endTime);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const slotId = crypto.randomUUID();
    
    await db.query(
      `INSERT INTO working_hours (id, date, start_time, end_time) 
       VALUES (?, ?, ?, ?)`,
      [slotId, date, startTime, endTime]
    );

    res.status(201).json({
      message: 'Working hours set successfully',
      slotId,
      date
    });
  } catch (err) {
    // Catch MySQL duplicate unique key constraint
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Working hours are already set for this date' });
    }
    console.error('Error setting working hours:', err);
    res.status(500).json({ error: 'An error occurred while setting working hours' });
  }
});

/**
 * PUT /api/working-hours/admin/:id
 * Admin-only: Updates existing working hours by ID.
 */
router.put('/admin/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { date, startTime, endTime } = req.body;

  if (!date || !startTime || !endTime) {
    return res.status(400).json({ error: 'Date, startTime, and endTime are required' });
  }

  const validationError = validateWorkingHours(date, startTime, endTime);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const [result] = await db.query(
      'UPDATE working_hours SET date = ?, start_time = ?, end_time = ? WHERE id = ?',
      [date, startTime, endTime, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Working hours slot not found' });
    }

    res.status(200).json({
      message: 'Working hours updated successfully',
      slotId: req.params.id
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Working hours are already set for this date' });
    }
    console.error('Error updating working hours:', err);
    res.status(500).json({ error: 'An error occurred while updating working hours' });
  }
});

/**
 * DELETE /api/working-hours/admin/:id
 * Admin-only: Deletes working hours slot by ID.
 */
router.delete('/admin/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM working_hours WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Working hours slot not found' });
    }
    res.status(200).json({ message: 'Working hours removed successfully' });
  } catch (err) {
    console.error('Error deleting working hours:', err);
    res.status(500).json({ error: 'An error occurred while deleting working hours' });
  }
});

module.exports = router;
