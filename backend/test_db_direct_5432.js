const { Client } = require('pg');
const client = new Client({
  host: 'db.mcolsszozjnveoommnuk.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'Cw@adloaf#root$Admin',
  ssl: { rejectUnauthorized: false }
});
client.connect()
  .then(() => {
    console.log('SUCCESS!');
    return client.end();
  })
  .catch(err => {
    console.error('FAILED:', err.message);
  });
