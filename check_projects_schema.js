const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProjectsSchema() {
    const { data, error } = await supabase.from('projects').select('*').limit(1);
    if (error) {
        console.error('Error:', error.message);
        return;
    }
    if (data && data.length > 0) {
        console.log('Projects columns:', Object.keys(data[0]));
    } else {
        console.log('Projects table is empty.');
        // Try to get column names via RPC or a different way if possible, 
        // but usually select * limit 1 works if there is at least 1 row.
    }
}

checkProjectsSchema();
