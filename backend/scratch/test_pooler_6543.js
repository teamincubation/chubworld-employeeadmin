const { Client } = require('pg');

const host = 'aws-0-ap-southeast-1.pooler.supabase.com';
const port = 6543;
const user = 'postgres.mcolsszozjnveoommnuk';

const passwords = [
  'Cw@adloaf#root$Admin',
  'ChubAdmin$2027#',
  'SuperAdmin@123'
];

async function testPg() {
  for (const password of passwords) {
    console.log(`Connecting to ${host}:${port} with user ${user} and password: ${password}`);
    const client = new Client({
      host: host,
      port: port,
      database: 'postgres',
      user: user,
      password: password,
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();
      console.log(`🎉 SUCCESS! Connected using password: ${password}`);
      const res = await client.query('SELECT NOW()');
      console.log('Query result:', res.rows[0]);
      await client.end();
      return;
    } catch (err) {
      console.log(`❌ Failed: ${err.message}`);
    }
  }
}

testPg();
