module.paths.push('d:/Adnan Vellicheri/WORKS/CHUB/ERP/backend/node_modules');
require('dotenv').config({ path: 'd:/Adnan Vellicheri/WORKS/CHUB/ERP/backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_API_KEY;

async function fetchSchema() {
  try {
    console.log('Fetching OpenAPI schema from Supabase root...');
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch schema: ${res.statusText}`);
    }

    const schema = await res.json();
    console.log('--- PATHS ---');
    const paths = Object.keys(schema.paths || {});
    console.log('Found paths:', paths.filter(p => p.startsWith('/rpc/')));
  } catch (err) {
    console.error('Error fetching schema:', err.message);
  }
}

fetchSchema();
