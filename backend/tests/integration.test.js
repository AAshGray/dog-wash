const request = require('supertest');
const app = require('../src/index');
const db = require('../src/db');
const { encrypt, hashEmail } = require('../src/crypto');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

describe('Dog Wash E2E Integration Tests', () => {
  let adminToken;
  let clientToken;
  let clientId;
  let petId;
  let appointmentId;
  
  const suffix = Math.random().toString(36).substring(2, 10);
  const clientUsername = `client_jest_${suffix}`;
  const clientEmail = `client_jest_${suffix}@example.com`;
  const adminUsername = `admin_jest_${suffix}`;
  const adminEmail = `admin_jest_${suffix}@example.com`;
  const password = 'testpassword';

  beforeAll(async () => {
    // Clean up any test state for the date
    await db.query("DELETE FROM appointments WHERE date = '2026-07-01'");
    await db.query("DELETE FROM working_hours WHERE date = '2026-07-01'");

    // 1. Manually seed an admin directly in the database (bypassing the public registration endpoint)
    const adminId = crypto.randomUUID();
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    await db.query(
      `INSERT INTO users (id, username, password_hash, email_hash, encrypted_name, encrypted_email, encrypted_phone, role, is_banned) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'admin', FALSE)`,
      [adminId, adminUsername, passwordHash, hashEmail(adminEmail), encrypt('Jest Admin'), encrypt(adminEmail), encrypt('555-555-5555')]
    );

    // Login using the seeded admin credentials
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({
        loginIdentifier: adminUsername,
        password
      });
    adminToken = adminLogin.body.token;

    // 2. Register and login a client
    await request(app)
      .post('/api/auth/register')
      .send({
        username: clientUsername,
        password,
        name: 'Jest Client',
        email: clientEmail,
        phone: '555-123-4567'
      });

    const clientLogin = await request(app)
      .post('/api/auth/login')
      .send({
        loginIdentifier: clientUsername,
        password
      });
    clientToken = clientLogin.body.token;
    clientId = clientLogin.body.user.id;
  });

  afterAll(async () => {
    // Close connection pool to allow Jest process to exit cleanly
    await db.end();
  });

  test('Security: Registering with role admin results in client role', async () => {
    const attackerUsername = `attacker_${suffix}`;
    const attackerEmail = `attacker_${suffix}@example.com`;
    
    // Attempting to register as an admin
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        username: attackerUsername,
        password,
        name: 'Privilege Escalation Attempt',
        email: attackerEmail,
        phone: '555-666-7777',
        role: 'admin'
      });
    expect(regRes.statusCode).toBe(201);
    
    // Login to verify role is client
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        loginIdentifier: attackerUsername,
        password
      });
    expect(loginRes.body.user.role).toBe('client'); // Escalation blocked!
  });

  test('Flow 1: Register, add pet, add appointment, and verify admin visibility', async () => {
    // 1. Add working hours for 2026-07-01 (09:00 - 17:00) so we can book
    const whRes = await request(app)
      .post('/api/working-hours/admin')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        date: '2026-07-01',
        startTime: '09:00:00',
        endTime: '17:00:00'
      });
    expect(whRes.statusCode).toBe(201);

    // 2. Add a pet
    const petRes = await request(app)
      .post('/api/pets')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        name: 'Fido',
        breed: 'Pug',
        age: 2,
        special_notes: 'Sensitive skin'
      });
    expect(petRes.statusCode).toBe(201);
    petId = petRes.body.petId;

    // 3. Book an appointment
    const apptRes = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        petId,
        date: '2026-07-01',
        startTime: '10:00:00',
        endTime: '11:00:00',
        notes: 'Oatmeal bath'
      });
    expect(apptRes.statusCode).toBe(201);
    appointmentId = apptRes.body.appointmentId;

    // 4. Verify visibility to admin with decrypted personal info
    const adminView = await request(app)
      .get('/api/appointments/admin/all')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminView.statusCode).toBe(200);
    
    const matching = adminView.body.appointments.find(a => a.id === appointmentId);
    expect(matching).toBeDefined();
    expect(matching.pet_name).toBe('Fido');
    expect(matching.client_name).toBe('Jest Client');
    expect(matching.client_email).toBe(clientEmail);
    expect(matching.client_phone).toBe('555-123-4567');
  });

  test('Flow 2: Admin bans user, and banned user cannot add pets or create appointments', async () => {
    // 1. Admin bans the client
    const banRes = await request(app)
      .patch(`/api/admin/clients/${clientId}/ban`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isBanned: true });
    expect(banRes.statusCode).toBe(200);

    // 2. Client attempts to add another pet (should fail with 403)
    const petRes = await request(app)
      .post('/api/pets')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        name: 'Rex',
        breed: 'German Shepherd',
        age: 3
      });
    expect(petRes.statusCode).toBe(403);

    // 3. Client attempts to create an appointment (should fail with 403)
    const apptRes = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        petId,
        date: '2026-07-01',
        startTime: '13:00:00',
        endTime: '14:00:00'
      });
    expect(apptRes.statusCode).toBe(403);
  });

  test('Flow 3: Admin working hours limits booking scope', async () => {
    // Create another client (non-banned) to test booking
    const newClientUsername = `client_limit_${suffix}`;
    const newClientEmail = `limit_${suffix}@example.com`;
    
    await request(app)
      .post('/api/auth/register')
      .send({
        username: newClientUsername,
        password,
        name: 'Limit Client',
        email: newClientEmail,
        phone: '555-999-9999'
      });

    const clientLogin = await request(app)
      .post('/api/auth/login')
      .send({
        loginIdentifier: newClientUsername,
        password
      });
    const activeToken = clientLogin.body.token;

    // Register pet
    const petRes = await request(app)
      .post('/api/pets')
      .set('Authorization', `Bearer ${activeToken}`)
      .send({
        name: 'Spot',
        breed: 'Dalmatian',
        age: 5
      });
    const activePetId = petRes.body.petId;

    // Try to book outside working hours (work is 09:00 - 17:00, try 18:00 - 19:00)
    const apptRes = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${activeToken}`)
      .send({
        petId: activePetId,
        date: '2026-07-01',
        startTime: '18:00:00',
        endTime: '19:00:00'
      });
    expect(apptRes.statusCode).toBe(400);
    expect(apptRes.body.error).toContain('fall outside working hours');
  });
});
