const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // Built-in Node crypto module
const db = require('../db');
const { encrypt, hashEmail } = require('../crypto');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_12345';

/**
 * POST /api/auth/register
 * Registers a new user. Personal information is stored encrypted, and email hash is stored for search.
 */
router.post('/register', async (req, res) => {
  const { username, password, name, email, phone, role } = req.body;

  if (!username || !password || !name || !email || !phone) {
    return res.status(400).json({ error: 'All fields (username, password, name, email, phone) are required' });
  }

  try {
    // Force role to 'client' to prevent admin privilege escalation
    const targetRole = 'client';

    // Check if username already exists
    const [existingUsernames] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existingUsernames.length > 0) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    // Calculate email hash and check for duplicates
    const emailHash = hashEmail(email);
    const [existingEmails] = await db.query('SELECT id FROM users WHERE email_hash = ?', [emailHash]);
    if (existingEmails.length > 0) {
      return res.status(400).json({ error: 'An account with this email address already exists' });
    }

    // Encrypt sensitive personal information
    const encryptedName = encrypt(name);
    const encryptedEmail = encrypt(email);
    const encryptedPhone = encrypt(phone);

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate a random UUID identifier
    const userId = crypto.randomUUID();

    // Insert new user into the database
    await db.query(
      `INSERT INTO users (id, username, password_hash, email_hash, encrypted_name, encrypted_email, encrypted_phone, role, is_banned) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
      [userId, username, passwordHash, emailHash, encryptedName, encryptedEmail, encryptedPhone, targetRole]
    );

    res.status(201).json({ 
      message: 'Registration successful',
      userId,
      role: targetRole
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'An error occurred during registration' });
  }
});

/**
 * POST /api/auth/login
 * Authenticates a user and returns a JWT token. Handles search by username or email.
 */
router.post('/login', async (req, res) => {
  const { loginIdentifier, password } = req.body; // Can be username or email

  if (!loginIdentifier || !password) {
    return res.status(400).json({ error: 'Login identifier and password are required' });
  }

  try {
    // Generate email hash in case the identifier is an email address
    const emailHash = hashEmail(loginIdentifier);

    // Query for the user by username OR email_hash
    const [users] = await db.query(
      'SELECT id, username, password_hash, role, is_banned FROM users WHERE username = ? OR email_hash = ?',
      [loginIdentifier, emailHash]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = users[0];

    // Check if the user is banned
    if (user.is_banned) {
      return res.status(403).json({ error: 'Access denied. Your account has been banned.' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'An error occurred during login' });
  }
});

/**
 * GET /api/auth/me
 * Retrieves current user profile details (automatically decrypted).
 */
router.get('/me', authenticateToken, (req, res) => {
  res.status(200).json({ user: req.user });
});

module.exports = router;
