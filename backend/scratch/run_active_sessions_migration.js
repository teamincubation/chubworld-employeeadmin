const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const host = 'db.mcolsszozjnveoommnuk.supabase.co';
const user = 'postgres';

const passwords = [
  'Cw@adloaf#root$Admin',
  'ChubAdmin$2027#',
  'SuperAdmin@123'
];

const sqlPath = path.join(__dirname, '../../database/create_active_sessions.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

async function run() {
  for (const password of passwords) {
    console.log(`Trying connection with password: ${password.substring(0, 3)}...`);
    const client = new Client({
      host: host,
      port: 5432,
      database: 'postgres',
      user: user,
      password: password,
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();
      console.log('Connected successfully. Executing create_active_sessions query...');
      await client.query(sql);
      console.log('Table active_sessions created successfully!');
      await client.end();
      return;
    } catch (err) {
      console.log(`Failed: ${err.message}`);
      try { await client.end(); } catch (e) {}
    }
  }
  process.exit(1);
}

run();
