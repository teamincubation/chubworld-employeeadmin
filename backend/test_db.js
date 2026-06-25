require('dotenv').config();
const supabase = require('./config/db');

async function run() {
  try {
    const { data, error } = await supabase
      .from('designations')
      .select(`
        id, name, department_id,
        departments(name)
      `);
    if (error) {
      console.error('Error querying designations:', error);
    } else {
      console.log('Designations query result:', data);
    }
  } catch (err) {
    console.error('Unexpected error:', err.message);
  }
}

run();
