require('dotenv').config();
const supabase = require('./config/db');

async function test() {
  try {
    const { data, error } = await supabase.from('admin_controller_access').select('*');
    if (error) {
      console.error('Error querying admin_controller_access:', error);
    } else {
      console.log('admin_controller_access rows:', data);
    }
  } catch (err) {
    console.error('Unexpected error:', err.message);
  }
}

test();
