const { Client } = require('pg');

const host = 'db.mcolsszozjnveoommnuk.supabase.co';
const user = 'postgres';
const passwords = [
  'Cw@adloaf#root$Admin',
  'ChubAdmin$2027#',
  'SuperAdmin@123'
];

async function testPg() {
  for (const password of passwords) {
    console.log(`Connecting to ${host}:5432 with password: ${password}`);
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
      console.log(`🎉 SUCCESS! Connected using password: ${password}`);
      await client.end();
      return;
    } catch (err) {
      console.log(`❌ Failed: ${err.message}`);
    }
  }
}

testPg();
