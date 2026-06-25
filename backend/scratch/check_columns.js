module.paths.push('d:/Adnan Vellicheri/WORKS/CHUB/ERP/backend/node_modules');
require('dotenv').config({ path: 'd:/Adnan Vellicheri/WORKS/CHUB/ERP/backend/.env' });
const supabase = require('d:/Adnan Vellicheri/WORKS/CHUB/ERP/backend/config/db');

async function checkColumns() {
  try {
    console.log('Querying audit_logs columns using Supabase client...');
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, latitude, longitude')
      .limit(1);
    
    if (error) {
      console.log('Error querying audit_logs:', error.message);
    } else {
      console.log('Successfully queried! Columns exist. Data:', data);
    }
  } catch (err) {
    console.error('Unexpected error:', err.message);
  }
}

checkColumns();
