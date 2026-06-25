module.paths.push('d:/Adnan Vellicheri/WORKS/CHUB/ERP/backend/node_modules');
require('dotenv').config({ path: 'd:/Adnan Vellicheri/WORKS/CHUB/ERP/backend/.env' });
const supabase = require('d:/Adnan Vellicheri/WORKS/CHUB/ERP/backend/config/db');

async function test() {
  try {
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: "ALTER TABLE employees ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NULL;" 
    });
    if (error) {
      console.log('RPC migration failed:', error.message);
    } else {
      console.log('RPC migration succeeded! Column added successfully:', data);
    }
  } catch (err) {
    console.error('Unexpected error:', err.message);
  }
}

test();
