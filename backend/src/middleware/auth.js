const jwt = require('jsonwebtoken');
const db = require('../db');
const { decrypt } = require('../crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_12345';

/**
 * Middleware to authenticate requests using JWT.
 * Verifies the token and checks if the user is banned.
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Fetch user from DB to verify existence and check ban status
    const [users] = await db.query(
      'SELECT id, username, encrypted_name, encrypted_email, encrypted_phone, role, is_banned FROM users WHERE id = ?',
      [decoded.id]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'User no longer exists' });
    }

    const user = users[0];

    // CRITICAL: Block access if the user is banned
    if (user.is_banned) {
      return res.status(403).json({ error: 'Access denied. This user account has been banned.' });
    }

    // Decrypt personal information for use in subsequent middleware/handlers
    req.user = {
      id: user.id,
      username: user.username,
      name: decrypt(user.encrypted_name),
      email: decrypt(user.encrypted_email),
      phone: decrypt(user.encrypted_phone),
      role: user.role
    };

    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired access token' });
  }
}

/**
 * Middleware to ensure the authenticated user has an 'admin' role.
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = {
  authenticateToken,
  requireAdmin
};
