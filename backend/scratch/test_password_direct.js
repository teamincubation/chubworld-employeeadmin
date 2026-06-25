const { Client } = require('pg');

const host = 'aws-0-ap-southeast-1.pooler.supabase.com';
const user = 'postgres.mcolsszozjnveoommnuk';
const password = process.env.SB_PASSWORD || 'your-supabase-db-password';

async function testPg() {
  console.log(`Connecting to ${host}:6543 with user ${user} and password: ${password.substring(0, 9)}...`);
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
    console.log(`🎉 SUCCESS! Connected successfully!`);
    const res = await client.query('SELECT NOW()');
    console.log('Query result:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.log(`❌ Failed: ${err.message}`);
  }
}

testPg();
