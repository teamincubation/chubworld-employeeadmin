const { Client } = require('pg');

const regions = [
  'ap-south-2',       // Hyderabad
  'ap-southeast-3',   // Jakarta
  'ap-southeast-4',   // Melbourne
  'ap-east-1',        // Hong Kong
  'eu-south-1',       // Milan
  'eu-south-2',       // Spain
  'eu-central-2',     // Zurich
  'me-south-1',       // Bahrain
  'af-south-1',       // Cape Town
  'ca-west-1',        // Calgary
  'il-central-1'      // Tel Aviv
];

const passwords = [
  'Cw@adloaf#root$Admin',
  'ChubAdmin$2027#',
  'SuperAdmin@123'
];

const tenant = 'mcolsszozjnveoommnuk';

async function testAll() {
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    for (const password of passwords) {
      console.log(`Testing ${region}...`);
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
        console.log(`Region ${region} error: ${err.message}`);
      }
    }
  }
  console.log('Finished testing remaining regions. None connected.');
}

testAll();
