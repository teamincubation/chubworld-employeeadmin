const { Client } = require('pg');

const host = '2406:da18:e5c:b700:2c87:2c04:550f:4a2d';
const user = 'postgres';

const passwords = [
  'Cw@adloaf#root$Admin',
  'ChubAdmin$2027#',
  'SuperAdmin@123'
];

async function testPg() {
  for (const password of passwords) {
    console.log(`Connecting directly to IPv6 [${host}]:5432 with user ${user} and password: ${password}`);
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
