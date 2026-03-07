import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    // We can't query information_schema easily via the client, but we can just fetch 1 row
    const { data: v, error: ve } = await supabase.from('vendors').select('*').limit(1);
    if (v && v.length > 0) {
        console.log('Vendors columns:', Object.keys(v[0]));
    } else {
        console.log('Vendors table empty or not accessible');
    }

    const { data: d, error: de } = await supabase.from('domains').select('*').limit(1);
    if (d && d.length > 0) {
        console.log('Domains columns:', Object.keys(d[0]));
    } else {
        console.log('Domains table empty or not accessible');
    }
}

checkSchema();
