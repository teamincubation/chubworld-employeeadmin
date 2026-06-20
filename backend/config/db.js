const { createClient } = require('@supabase/supabase-js');

// Initialize the Supabase client using environment variables
// Make sure SUPABASE_URL and SUPABASE_API_KEY are set in your Hostinger environment
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_API_KEY;

let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('✅ Supabase Client Initialized Successfully.');
} else {
  console.warn('⚠️ SUPABASE_URL or SUPABASE_API_KEY is missing. Database connection will fail.');
  // Create a dummy client to prevent instant crash before env vars are loaded
  supabase = createClient('https://dummy.supabase.co', 'dummy-key'); 
}

module.exports = supabase;
