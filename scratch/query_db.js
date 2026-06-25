const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL or SUPABASE_API_KEY is not defined in backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    console.log('Connecting to Supabase at:', supabaseUrl);
    
    // Check designations columns
    const { data: desigs, error: desigErr } = await supabase.from('designations').select('*').limit(1);
    if (desigErr) {
      console.error('Error querying designations:', desigErr.message);
    } else {
      console.log('Designations in DB:', desigs);
    }

  } catch (err) {
    console.error('Unexpected error:', err.message);
  }
}

run();
