module.paths.push('d:/Adnan Vellicheri/WORKS/CHUB/ERP/backend/node_modules');
const { Client } = require('pg');

const regions = ['ap-south-1', 'ap-southeast-1'];
const ports = [6543, 5432];
const passwords = [
  'Cw@adloaf#root$Admin',
  'ChubAdmin$2027#',
  'SuperAdmin@123'
];
const tenant = 'mcolsszozjnveoommnuk';

async function test() {
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    for (const port of ports) {
      for (const password of passwords) {
        console.log(`\nTesting ${host}:${port} with user postgres.${tenant} and password: ${password.substring(0, 3)}...`);
        const client = new Client({
          host: host,
          port: port,
          database: 'postgres',
          user: `postgres.${tenant}`,
          password: password,
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 5000
        });

        try {
          await client.connect();
          console.log(`🎉 SUCCESS! connected to ${host}:${port}`);
          await client.end();
          return;
        } catch (err) {
          console.log(`❌ Error: ${err.message} (Code: ${err.code})`);
        }
      }
    }
  }
}

test();
