require('dotenv').config({ path: 'd:/Adnan Vellicheri/WORKS/CHUB/ERP/backend/.env' });
const supabase = require('../config/db');

async function test() {
  const { data, error } = await supabase.from('system_settings').upsert({
    setting_key: 'auto_clockout_duration',
    setting_value: '12',
    description: 'Auto Clock-out Duration Threshold (Hours)'
  }, { onConflict: 'setting_key' }).select();

  console.log('Error:', error);
  console.log('Data:', data);
}

test();
