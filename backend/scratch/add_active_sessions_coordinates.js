module.paths.push('d:/Adnan Vellicheri/WORKS/CHUB/ERP/backend/node_modules');
require('dotenv').config({ path: 'd:/Adnan Vellicheri/WORKS/CHUB/ERP/backend/.env' });
const supabase = require('d:/Adnan Vellicheri/WORKS/CHUB/ERP/backend/config/db');

async function runMigration() {
  console.log('Initiating database migration via Supabase exec_sql RPC...');
  const sql = `
    ALTER TABLE active_sessions ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8) NULL;
    ALTER TABLE active_sessions ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8) NULL;
  `;
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (error) {
      console.error('❌ RPC Migration failed:', error.message);
      process.exit(1);
    } else {
      console.log('🎉 RPC Migration succeeded! Columns latitude and longitude added to active_sessions table.');
      process.exit(0);
    }
  } catch (err) {
    console.error('❌ Unexpected error during RPC migration:', err.message);
    process.exit(1);
  }
}

runMigration();
