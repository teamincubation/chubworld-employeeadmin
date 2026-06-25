const { Client } = require('pg');

const regions = [
  'ap-south-1',       // Mumbai
  'ap-southeast-1',   // Singapore
  'us-east-1',        // N. Virginia
  'us-east-2',        // Ohio
  'us-west-1',        // N. California
  'us-west-2',        // Oregon
  'eu-central-1',     // Frankfurt
  'eu-west-1',        // Ireland
  'eu-west-2',        // London
  'eu-west-3',        // Paris
  'sa-east-1'         // São Paulo
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
        console.log(`Region: ${region}, Password: ${password} => Error: ${err.message}`);
      }
    }
  }
  console.log('Finished testing all regions. None connected.');
}

testAll();
