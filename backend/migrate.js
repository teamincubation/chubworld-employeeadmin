const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const dbPassword = process.argv[2] || process.env.SUPABASE_DB_PASSWORD;

if (!dbPassword) {
  console.error('Error: Please provide the database password as an argument, e.g.: node migrate.js MyPassword123');
  process.exit(1);
}

const client = new Client({
  host: 'db.mcolsszozjnveoommnuk.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: dbPassword,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const seedPath = path.join(__dirname, '../database/seed.sql');

    console.log('Reading schema.sql and seed.sql...');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    const seedSql = fs.readFileSync(seedPath, 'utf8');

    console.log('Connecting to PostgreSQL database...');
    await client.connect();
    console.log('Connected successfully.');

    console.log('Running schema.sql...');
    await client.query(schemaSql);
    console.log('Schema created.');

    console.log('Running seed.sql...');
    await client.query(seedSql);
    console.log('Seed data inserted.');

    await client.end();
    console.log('Migration completed successfully!');
  } catch (err) {
    if (client) {
      try { await client.end(); } catch (e) {}
    }
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

run();
