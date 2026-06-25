module.paths.push('d:/Adnan Vellicheri/WORKS/CHUB/ERP/backend/node_modules');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_API_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    console.log('Querying one active employee...');
    const { data: emps, error: err } = await supabase
      .from('employees')
      .select('*')
      .is('deleted_at', null)
      .limit(1);

    if (err) {
      console.error('Query error:', err.message);
      return;
    }

    if (!emps || emps.length === 0) {
      console.log('No employees found.');
      return;
    }

    const emp = emps[0];
    console.log(`Found employee: ${emp.full_name} (ID: ${emp.id}) with type: ${emp.employment_type}`);

    console.log('Attempting to update employment_type to Remote (WFH)...');
    const { data: updated, error: updateErr } = await supabase
      .from('employees')
      .update({ employment_type: 'Remote (WFH)' })
      .eq('id', emp.id)
      .select();

    if (updateErr) {
      console.error('Update failed:', updateErr.message);
    } else {
      console.log('🎉 Update succeeded! Employee is now Remote (WFH):', updated);
      
      // Restore the old employment type
      console.log(`Restoring old employment type: ${emp.employment_type}`);
      await supabase
        .from('employees')
        .update({ employment_type: emp.employment_type })
        .eq('id', emp.id);
      console.log('Restored.');
    }
  } catch (err) {
    console.error('Unexpected error:', err.message);
  }
}
run();
