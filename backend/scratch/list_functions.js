module.paths.push('d:/Adnan Vellicheri/WORKS/CHUB/ERP/backend/node_modules');
require('dotenv').config({ path: 'd:/Adnan Vellicheri/WORKS/CHUB/ERP/backend/.env' });
const supabase = require('d:/Adnan Vellicheri/WORKS/CHUB/ERP/backend/config/db');

async function listRoutines() {
  try {
    console.log('Querying info schema routines...');
    // We can run a query on a view or try a direct request
    const { data, error } = await supabase
      .from('pg_catalog.pg_proc')
      .select('proname')
      .ilike('proname', '%sql%');
    
    if (error) {
      console.log('Error querying pg_catalog.pg_proc:', error.message);
    } else {
      console.log('Found SQL routines:', data);
    }
  } catch (err) {
    console.error('Unexpected error:', err.message);
  }
}

listRoutines();
