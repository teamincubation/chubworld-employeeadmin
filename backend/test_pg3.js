const { Client } = require('pg');

const host = 'aws-0-ap-south-1.pooler.supabase.com';
const user = 'postgres.mcolsszozjnveoommnuk';

const passwords = [
  'Cw@adloaf#root$Admin',
  'ChubAdmin$2027#',
  'SuperAdmin@123'
];

async function testPg() {
  for (const password of passwords) {
    console.log(`Connecting to ${host}:6543 with user ${user} and password: ${password}`);
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
      console.log(`🎉 SUCCESS! Connected using password: ${password}`);
      await client.end();
      return;
    } catch (err) {
      console.log(`❌ Failed: ${err.message}`);
    }
  }
}

testPg();
