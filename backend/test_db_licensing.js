require('dotenv').config();
const supabase = require('./config/db');

async function test() {
  try {
    const { data: employees, error } = await supabase.from('employees').select('id, employee_id, full_name, photo_path');
    if (error) {
      console.error('Error loading employees:', error);
    } else {
      console.log('Employees:', employees);
    }
  } catch (err) {
    console.error('Unexpected error:', err.message);
  }
}

test();
