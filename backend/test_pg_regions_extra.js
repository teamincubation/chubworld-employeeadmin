const { Client } = require('pg');

const regions = [
  'ap-northeast-1',   // Tokyo
  'ap-northeast-2',   // Seoul
  'ap-southeast-2',   // Sydney
  'eu-north-1',       // Stockholm
  'ca-central-1',     // Canada Central
  'me-central-1'      // Middle East
];

const passwords = [
  'Cw@adloaf#root$Admin',
  'ChubAdmin$2027#'
];

const tenant = 'mcolsszozjnveoommnuk';

async function testAll() {
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    for (const password of passwords) {
      const client = new Client({
        host: host,
        port: 6543,
        database: 'postgres',
        user: `postgres.${tenant}`,
        password: password,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 3000
      });

      try {
        await client.connect();
        console.log(`🎉 SUCCESS! Region: ${region}, Host: ${host}, Password: ${password}`);
        await client.end();
        return;
      } catch (err) {
        console.log(`Region: ${region} => Error: ${err.message}`);
      }
    }
  }
  console.log('Finished testing remaining regions.');
}

testAll();
