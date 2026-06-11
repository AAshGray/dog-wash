const mysql = require('mysql2/promise');

// Create the connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'dogwash_user',
  password: process.env.DB_PASSWORD || 'dogwash_password',
  database: process.env.DB_NAME || 'dog_wash',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Verify connection on pool initialization
pool.getConnection()
  .then(connection => {
    console.log('Database connection pool established successfully.');
    connection.release();
  })
  .catch(err => {
    console.error('Database connection failed:', err.message);
  });

module.exports = pool;
