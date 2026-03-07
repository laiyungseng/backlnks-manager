const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(url, key);

async function checkDuplicates() {
    console.log('--- Checking for Duplicates in Database ---');

    // Check Projects (by project_name in project_details)
    const { data: projects, error: pErr } = await supabase.from('projects').select('id, project_details');
    if (pErr) console.error('Projects Error:', pErr);
    else {
        const names = projects.map(p => p.project_details?.[0]?.project_name).filter(Boolean);
        const uniqueNames = new Set(names);
        if (names.length !== uniqueNames.size) {
            console.log(`⚠️ Duplicates found in Projects! Total: ${names.length}, Unique: ${uniqueNames.size}`);
            const counts = {};
            names.forEach(n => counts[n] = (counts[n] || 0) + 1);
            Object.entries(counts).filter(([_, c]) => c > 1).forEach(([n, c]) => console.log(`   - ${n}: ${c} times`));
        } else {
            console.log(`✅ No duplicates in Projects (Total: ${names.length})`);
        }
    }

    // Check Vendors (by vendor_name)
    const { data: vendors, error: vErr } = await supabase.from('vendors').select('id, vendor_details');
    if (vErr) console.error('Vendors Error:', vErr);
    else {
        const vNames = vendors.map(v => Array.isArray(v.vendor_details) ? v.vendor_details[0]?.vendor_name : v.vendor_details?.vendor_name).filter(Boolean);
        const uniqueVNames = new Set(vNames);
        if (vNames.length !== uniqueVNames.size) {
            console.log(`⚠️ Duplicates found in Vendors! Total: ${vNames.length}, Unique: ${uniqueVNames.size}`);
            const counts = {};
            vNames.forEach(n => counts[n] = (counts[n] || 0) + 1);
            Object.entries(counts).filter(([_, c]) => c > 1).forEach(([n, c]) => console.log(`   - ${n}: ${c} times`));
        } else {
            console.log(`✅ No duplicates in Vendors (Total: ${vNames.length})`);
        }
    }

    // Check Domains (by domain_url)
    const { data: domains, error: dErr } = await supabase.from('domains').select('id, domain_details');
    if (dErr) console.error('Domains Error:', dErr);
    else {
        const urls = domains.map(d => Array.isArray(d.domain_details) ? d.domain_details[0]?.domain_url : d.domain_details?.domain_url).filter(Boolean);
        const uniqueUrls = new Set(urls);
        if (urls.length !== uniqueUrls.size) {
            console.log(`⚠️ Duplicates found in Domains! Total: ${urls.length}, Unique: ${uniqueUrls.size}`);
            const counts = {};
            urls.forEach(n => counts[n] = (counts[n] || 0) + 1);
            Object.entries(counts).filter(([_, c]) => c > 1).forEach(([n, c]) => console.log(`   - ${n}: ${c} times`));
        } else {
            console.log(`✅ No duplicates in Domains (Total: ${urls.length})`);
        }
    }

    // Check Placements
    const { data: placements, error: plErr } = await supabase.from('placements').select('id, project_id, target_url, url');
    if (plErr) console.error('Placements Error:', plErr);
    else {
        console.log(`✅ Retrieved ${placements.length} Placements (No strict uniqueness constraint defined here, but good to know count).`);
    }

    console.log('--- Check Complete ---');
}

checkDuplicates();
