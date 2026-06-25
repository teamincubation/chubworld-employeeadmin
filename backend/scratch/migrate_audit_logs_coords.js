const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const host = 'aws-0-ap-southeast-1.pooler.supabase.com';
const user = 'postgres.mcolsszozjnveoommnuk';

const passwords = [
  'Cw@adloaf#root$Admin',
  'ChubAdmin$2027#',
  'SuperAdmin@123'
];

const sqlPath = path.join(__dirname, '../../database/add_audit_logs_coordinates.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

async function run() {
  for (const password of passwords) {
    console.log(`Trying connection with password: ${password.substring(0, 3)}...`);
    const client = new Client({
      host: host,
      port: 6543,
      database: 'postgres',
      user: user,
      password: password,
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();
      console.log('Connected successfully. Executing add_audit_logs_coordinates query...');
      await client.query(sql);
      console.log('Table audit_logs altered successfully!');
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
