const express = require('express');
const cors = require('cors');
const db = require('./db');
const { encrypt, hashEmail } = require('./crypto');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const authRoutes = require('./routes/auth');
const petRoutes = require('./routes/pets');
const workingHoursRoutes = require('./routes/workingHours');
const appointmentRoutes = require('./routes/appointments');
const adminRoutes = require('./routes/admin');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/pets', petRoutes);
app.use('/api/working-hours', workingHoursRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Dogwash backend is healthy' });
});

// Admin seeding function with retries for database readiness
async function seedAdmin(retries = 15, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const [admins] = await db.query("SELECT id FROM users WHERE role = 'admin'");
      if (admins.length === 0) {
        console.log('No admin user found. Seeding default admin...');
        const userId = crypto.randomUUID();
        const username = 'admin';
        const password = 'adminpassword';
        const name = 'System Administrator';
        const email = 'admin@dogwash.com';
        const phone = '555-0199';

        const encryptedName = encrypt(name);
        const encryptedEmail = encrypt(email);
        const encryptedPhone = encrypt(phone);
        const emailHash = hashEmail(email);

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        await db.query(
          `INSERT INTO users (id, username, password_hash, email_hash, encrypted_name, encrypted_email, encrypted_phone, role, is_banned) 
           VALUES (?, ?, ?, ?, ?, ?, ?, 'admin', FALSE)`,
          [userId, username, passwordHash, emailHash, encryptedName, encryptedEmail, encryptedPhone]
        );
        console.log('Default admin seeded successfully. Username: "admin", Password: "adminpassword"');
      } else {
        console.log('Admin user already exists. Seeding skipped.');
      }
      return; // Exit function on success
    } catch (err) {
      console.warn(`Admin seed attempt ${i + 1}/${retries} failed: ${err.message}. Retrying in ${delay / 1000}s...`);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  console.error('Failed to seed default admin after maximum retries.');
}

// Start Server if run directly
if (require.main === module) {
  app.listen(port, async () => {
    console.log(`Backend server running on port ${port}`);
    
    // Seed the admin user if needed (retrying until DB is ready)
    await seedAdmin();
  });
}

module.exports = app;
