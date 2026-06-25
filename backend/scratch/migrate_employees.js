const { Client } = require('pg');

const host = 'aws-0-ap-south-1.pooler.supabase.com';
const user = 'postgres.mcolsszozjnveoommnuk';
const passwords = [
  'Cw@adloaf#root$Admin',
  'ChubAdmin$2027#',
  'SuperAdmin@123'
];

async function run() {
  for (const password of passwords) {
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
      console.log(`🎉 Connected successfully using password.`);
      
      console.log('Altering employees table to add password_hash column...');
      await client.query('ALTER TABLE employees ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);');
      console.log('Success! Column password_hash added.');

      await client.end();
      return;
    } catch (err) {
      console.log(`Failed with password: ${err.message}`);
    }
  }
}

run();
