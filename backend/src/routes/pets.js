const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require user authentication
router.use(authenticateToken);

/**
 * POST /api/pets
 * Adds a new pet for the logged-in client.
 */
router.post('/', async (req, res) => {
  const { name, breed, age, special_notes } = req.body;

  if (!name || !breed) {
    return res.status(400).json({ error: 'Name and breed are required' });
  }

  try {
    const petId = crypto.randomUUID();
    
    await db.query(
      `INSERT INTO pets (id, user_id, name, breed, age, special_notes) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [petId, req.user.id, name, breed, age ?? null, special_notes || '']
    );

    res.status(201).json({
      message: 'Pet added successfully',
      petId
    });
  } catch (err) {
    console.error('Error adding pet:', err);
    res.status(500).json({ error: 'An error occurred while adding the pet' });
  }
});

/**
 * GET /api/pets
 * Retrieves all pets belonging to the logged-in client.
 */
router.get('/', async (req, res) => {
  try {
    const [pets] = await db.query(
      'SELECT id, name, breed, age, special_notes, created_at FROM pets WHERE user_id = ?',
      [req.user.id]
    );
    res.status(200).json({ pets });
  } catch (err) {
    console.error('Error fetching pets:', err);
    res.status(500).json({ error: 'An error occurred while fetching pets' });
  }
});

/**
 * GET /api/pets/:id
 * Retrieves a specific pet belonging to the logged-in client.
 */
router.get('/:id', async (req, res) => {
  try {
    const [pets] = await db.query(
      'SELECT id, user_id, name, breed, age, special_notes, created_at FROM pets WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (pets.length === 0) {
      return res.status(404).json({ error: 'Pet not found' });
    }

    res.status(200).json({ pet: pets[0] });
  } catch (err) {
    console.error('Error fetching pet:', err);
    res.status(500).json({ error: 'An error occurred while fetching the pet' });
  }
});

/**
 * PUT /api/pets/:id
 * Updates a pet's details (verifies ownership).
 */
router.put('/:id', async (req, res) => {
  const { name, breed, age, special_notes } = req.body;

  if (!name || !breed) {
    return res.status(400).json({ error: 'Name and breed are required' });
  }

  try {
    // Check ownership first
    const [existing] = await db.query(
      'SELECT id FROM pets WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Pet not found or unauthorized' });
    }

    await db.query(
      'UPDATE pets SET name = ?, breed = ?, age = ?, special_notes = ? WHERE id = ?',
      [name, breed, age ?? null, special_notes || '', req.params.id]
    );

    res.status(200).json({ message: 'Pet updated successfully' });
  } catch (err) {
    console.error('Error updating pet:', err);
    res.status(500).json({ error: 'An error occurred while updating the pet' });
  }
});

/**
 * DELETE /api/pets/:id
 * Deletes a pet (verifies ownership).
 */
router.delete('/:id', async (req, res) => {
  try {
    // Check ownership first
    const [existing] = await db.query(
      'SELECT id FROM pets WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Pet not found or unauthorized' });
    }

    await db.query('DELETE FROM pets WHERE id = ?', [req.params.id]);

    res.status(200).json({ message: 'Pet deleted successfully' });
  } catch (err) {
    console.error('Error deleting pet:', err);
    res.status(500).json({ error: 'An error occurred while deleting the pet' });
  }
});

module.exports = router;
