require('dotenv').config({ path: 'd:/Adnan Vellicheri/WORKS/CHUB/ERP/backend/.env' });
const supabase = require('../config/db');

async function check() {
  const { data, error } = await supabase.from('system_settings').select('*');
  console.log('Error:', error);
  console.log('Settings:', data);
}

check();
