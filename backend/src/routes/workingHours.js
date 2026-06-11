const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * Validates start and end times, and checks if date is in the past.
 */
function validateWorkingHours(startTimeStr, endTimeStr) {
  const start = new Date(startTimeStr);
  const end = new Date(endTimeStr);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 'Invalid date-time format. Expected ISO 8601 strings';
  }

  if (start >= end) {
    return 'startTime must be strictly before endTime';
  }

  // Check if start date-time is in the past (comparing with current time)
  const now = new Date();
  if (start < now) {
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
      'SELECT id, start_time, end_time FROM working_hours ORDER BY start_time ASC'
    );
    
    const formatted = rows.map(r => ({
      id: r.id,
      start_time: r.start_time instanceof Date ? r.start_time.toISOString() : r.start_time,
      end_time: r.end_time instanceof Date ? r.end_time.toISOString() : r.end_time
    }));

    res.status(200).json({ workingHours: formatted });
  } catch (err) {
    console.error('Error fetching working hours:', err);
    res.status(500).json({ error: 'An error occurred while fetching working hours' });
  }
});

/**
 * GET /api/working-hours/:date
 * Retrieves working hours for a specific UTC date.
 * Kept for test suite backward-compatibility.
 */
router.get('/:date', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, start_time, end_time FROM working_hours WHERE DATE(start_time) = ?',
      [req.params.date]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'No working hours scheduled for this date' });
    }
    
    const r = rows[0];
    res.status(200).json({ 
      workingHours: {
        id: r.id,
        date: req.params.date,
        start_time: r.start_time instanceof Date ? r.start_time.toISOString().replace('.000Z', 'Z') : r.start_time,
        end_time: r.end_time instanceof Date ? r.end_time.toISOString().replace('.000Z', 'Z') : r.end_time
      }
    });
  } catch (err) {
    console.error('Error fetching working hours for date:', err);
    res.status(500).json({ error: 'An error occurred while fetching working hours' });
  }
});

/**
 * POST /api/working-hours/admin
 * Admin-only: Adds working hours for a specific date/time window.
 * Returns 409 Conflict if hours overlap with an existing slot.
 */
router.post('/admin', authenticateToken, requireAdmin, async (req, res) => {
  const { startTime, endTime } = req.body;

  if (!startTime || !endTime) {
    return res.status(400).json({ error: 'startTime and endTime are required' });
  }

  const validationError = validateWorkingHours(startTime, endTime);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  // Convert inputs to JS Dates for comparison format matching
  const startObj = new Date(startTime);
  const endObj = new Date(endTime);

  try {
    // Check for overlapping intervals
    const [existing] = await db.query(
      'SELECT id FROM working_hours WHERE start_time < ? AND end_time > ?',
      [endObj, startObj]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Working hours are already set for this date' });
    }

    const slotId = crypto.randomUUID();
    
    await db.query(
      `INSERT INTO working_hours (id, start_time, end_time) 
       VALUES (?, ?, ?)`,
      [slotId, startObj, endObj]
    );

    res.status(201).json({
      message: 'Working hours set successfully',
      slotId,
      startTime,
      endTime
    });
  } catch (err) {
    console.error('Error setting working hours:', err);
    res.status(500).json({ error: 'An error occurred while setting working hours' });
  }
});

/**
 * PUT /api/working-hours/admin/:id
 * Admin-only: Updates existing working hours by ID.
 */
router.put('/admin/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { startTime, endTime } = req.body;

  if (!startTime || !endTime) {
    return res.status(400).json({ error: 'startTime and endTime are required' });
  }

  const validationError = validateWorkingHours(startTime, endTime);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const startObj = new Date(startTime);
  const endObj = new Date(endTime);

  try {
    // Check for overlapping intervals excluding this slot
    const [existing] = await db.query(
      'SELECT id FROM working_hours WHERE id != ? AND start_time < ? AND end_time > ?',
      [req.params.id, endObj, startObj]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Working hours are already set for this date' });
    }

    const [result] = await db.query(
      'UPDATE working_hours SET start_time = ?, end_time = ? WHERE id = ?',
      [startObj, endObj, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Working hours slot not found' });
    }

    res.status(200).json({
      message: 'Working hours updated successfully',
      slotId: req.params.id
    });
  } catch (err) {
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
