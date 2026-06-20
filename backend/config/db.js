const mysql = require('mysql2/promise');
require('dotenv').config();

const poolConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'chub_hr',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+05:30', // Ensure database works with Asia/Kolkata timezone
};

const pool = mysql.createPool(poolConfig);

// Keep-alive setup and test connection
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('Database Connected Successfully! Timezone set to IST (+05:30)');
    
    // Set session timezone explicitly to confirm
    await conn.query("SET time_zone = '+05:30'");
    conn.release();
  } catch (err) {
    console.error('Database connection failed:', err.message);
  }
})();

module.exports = {
  pool,
  // Helper for direct queries
  query: async (sql, params) => {
    let conn;
    try {
      conn = await pool.getConnection();
      // Enforce time zone for each session
      await conn.query("SET time_zone = '+05:30'");
      const [results] = await conn.query(sql, params);
      return results;
    } catch (err) {
      console.error(`Query Error: [${sql}] - Details: ${err.message}`);
      throw err;
    } finally {
      if (conn) conn.release();
    }
  }
};
