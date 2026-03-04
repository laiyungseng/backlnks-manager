'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function getDomains() {
    if (!supabase) {
        return { success: false, message: 'Database client not initialized.' };
    }

    try {
        const { data, error } = await supabase
            .from('domains')
            .select('*, vendors(vendor_name)')
            .order('domain_url', { ascending: true });

        if (error) {
            console.error('Error fetching domains:', error);
            return { success: false, message: error.message };
        }

        // We want to fetch all available vendors to populate dropdown options for vendor_id editing
        const vendorRes = await supabase.from('vendors').select('id, vendor_name');

        return {
            success: true,
            domains: data,
            vendorOptions: vendorRes.data || []
        };
    } catch (e) {
        console.error('Unexpected error in getDomains:', e);
        return { success: false, message: 'An unexpected error occurred.' };
    }
}

export async function saveDomains(rows) {
    if (!supabase) {
        return { success: false, message: 'Database client not initialized.' };
    }

    try {
        const rowsToUpsert = rows.map(r => {
            const row = {
                vendor_id: r.vendor_id || null, // Ensure numeric/UUID validity (depends on your actual DB schema)
                domain_url: r.domain_url || null,
                domain_rating: r.domain_rating ? parseInt(r.domain_rating) : null,
                traffic: r.traffic ? parseInt(r.traffic) : null,
                domain_age: r.domain_age ? parseInt(r.domain_age) : null,
                spam_score: r.spam_score ? parseFloat(r.spam_score) : null,
                last_checked_at: r.last_checked_at || null,
            };

            if (r.id && !r.id.startsWith('new_')) {
                row.id = r.id;
            }

            return row;
        });

        const { error } = await supabase
            .from('domains')
            .upsert(rowsToUpsert, { onConflict: 'id' });

        if (error) {
            console.error('Error saving domains:', error);
            return { success: false, message: error.message };
        }

        return { success: true, message: 'Domains updated successfully.' };
    } catch (e) {
        console.error('Unexpected error in saveDomains:', e);
        return { success: false, message: 'Failed to update domains.' };
    }
}

export async function deleteDomains(rowIds) {
    if (!supabase) {
        return { success: false, message: 'Database client not initialized.' };
    }

    try {
        const validIds = rowIds.filter(id => id && !id.startsWith('new_'));

        if (validIds.length === 0) {
            return { success: true, message: 'Only unsaved rows were removed.' };
        }

        const { error } = await supabase
            .from('domains')
            .delete()
            .in('id', validIds);

        if (error) {
            console.error('Error deleting domains:', error);
            return { success: false, message: error.message };
        }

        return { success: true, message: 'Selected domains deleted successfully.' };
    } catch (e) {
        console.error('Unexpected error in deleteDomains:', e);
        return { success: false, message: 'Failed to delete domains.' };
    }
}
