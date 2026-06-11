const express = require('express');
const db = require('../db');
const { decrypt } = require('../crypto');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All routes here are admin-only
router.use(authenticateToken, requireAdmin);

/**
 * GET /api/admin/clients
 * Retrieves all clients, decrypts their personal information in memory,
 * and allows filtering/searching by username, name, email, or phone.
 */
router.get('/clients', async (req, res) => {
  const query = (req.query.q || '').trim().toLowerCase();

  try {
    // Fetch all users with role 'client'
    const [rows] = await db.query(
      'SELECT id, username, encrypted_name, encrypted_email, encrypted_phone, role, is_banned, created_at FROM users WHERE role = "client" ORDER BY username ASC'
    );

    // Decrypt details in memory
    const clients = rows.map(row => {
      const client = { ...row };
      client.name = decrypt(row.encrypted_name);
      client.email = decrypt(row.encrypted_email);
      client.phone = decrypt(row.encrypted_phone);
      
      // Remove encrypted ciphertexts so we don't return them to the frontend
      delete client.encrypted_name;
      delete client.encrypted_email;
      delete client.encrypted_phone;
      
      return client;
    });

    // If query filter is provided, filter clients in memory
    if (query) {
      const filtered = clients.filter(client => {
        return (
          client.username.toLowerCase().includes(query) ||
          client.name.toLowerCase().includes(query) ||
          client.email.toLowerCase().includes(query) ||
          client.phone.includes(query)
        );
      });
      return res.status(200).json({ clients: filtered });
    }

    res.status(200).json({ clients });
  } catch (err) {
    console.error('Error fetching clients:', err);
    res.status(500).json({ error: 'An error occurred while fetching clients' });
  }
});

/**
 * PATCH /api/admin/clients/:id/ban
 * Bans or unbans a client.
 */
router.patch('/clients/:id/ban', async (req, res) => {
  const { isBanned } = req.body;

  if (isBanned === undefined) {
    return res.status(400).json({ error: 'isBanned field is required' });
  }

  try {
    // Check if the target user is an admin (cannot ban admin users)
    const [target] = await db.query('SELECT role FROM users WHERE id = ?', [req.params.id]);
    if (target.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (target[0].role === 'admin') {
      return res.status(400).json({ error: 'Cannot ban administrative users' });
    }

    await db.query(
      'UPDATE users SET is_banned = ? WHERE id = ?',
      [isBanned ? 1 : 0, req.params.id]
    );

    res.status(200).json({
      message: `User account has been ${isBanned ? 'banned' : 'unbanned'} successfully`,
      userId: req.params.id,
      isBanned: !!isBanned
    });
  } catch (err) {
    console.error('Error toggling ban status:', err);
    res.status(500).json({ error: 'An error occurred while updating the ban status' });
  }
});

module.exports = router;
