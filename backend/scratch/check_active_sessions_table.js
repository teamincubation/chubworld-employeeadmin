module.paths.push('d:/Adnan Vellicheri/WORKS/CHUB/ERP/backend/node_modules');
require('dotenv').config({ path: 'd:/Adnan Vellicheri/WORKS/CHUB/ERP/backend/.env' });
const supabase = require('d:/Adnan Vellicheri/WORKS/CHUB/ERP/backend/config/db');

async function test() {
  try {
    const { data, error } = await supabase.from('active_sessions').select('*').limit(1);
    if (error) {
      console.log('❌ active_sessions table does not exist or query failed:', error.message);
    } else {
      console.log('✅ active_sessions table exists! Data:', data);
    }
  } catch (err) {
    console.error('Unexpected error:', err.message);
  }
}

test();
