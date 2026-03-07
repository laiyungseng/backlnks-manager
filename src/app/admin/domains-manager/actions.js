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
            .select('id, vendor_id, domain_details, vendors(vendor_details)')
            .order('id', { ascending: false });

        if (error) {
            console.error('Error fetching domains:', error);
            return { success: false, message: error.message };
        }

        // Flatten domain_details and vendor_details for the frontend
        const domains = data.map(d => {
            const details = (Array.isArray(d.domain_details) ? d.domain_details[0] : (d.domain_details || {}));
            const vendorDetails = d.vendors?.vendor_details;
            const vendorName = Array.isArray(vendorDetails) ? vendorDetails[0]?.vendor_name : vendorDetails?.vendor_name;

            return {
                id: d.id,
                vendor_id: d.vendor_id,
                domain_url: details.domain_url || '',
                domain_rating: details.DR || null,
                traffic: details.Traffic || null,
                domain_age: details.Domain_age || null,
                spam_score: details.Spam_Score || null,
                last_checked_at: details.Last_checked_at || null,
                vendors: { vendor_name: vendorName || 'Unknown Vendor' }
            };
        });

        // Fetch vendor options for dropdown
        const vendorRes = await supabase.from('vendors').select('id, vendor_details');
        const vendorOptions = (vendorRes.data || []).map(v => ({
            id: v.id,
            vendor_name: (Array.isArray(v.vendor_details) ? v.vendor_details[0]?.vendor_name : v.vendor_details?.vendor_name) || 'Unnamed Vendor'
        }));

        return {
            success: true,
            domains,
            vendorOptions
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
        const rowsToUpsert = await Promise.all(rows.map(async (r) => {
            let existingDetails = {};
            if (r.id && !r.id.startsWith('new_')) {
                const { data } = await supabase.from('domains').select('domain_details').eq('id', r.id).maybeSingle();
                if (data?.domain_details) {
                    existingDetails = Array.isArray(data.domain_details) ? data.domain_details[0] : data.domain_details;
                }
            }

            const details = {
                ...existingDetails,
                domain_url: r.domain_url || existingDetails.domain_url,
                DR: r.domain_rating !== undefined ? (r.domain_rating ? parseInt(r.domain_rating) : null) : existingDetails.DR,
                Traffic: r.traffic !== undefined ? (r.traffic ? parseInt(r.traffic) : null) : existingDetails.Traffic,
                Domain_age: r.domain_age !== undefined ? (r.domain_age ? parseInt(r.domain_age) : null) : existingDetails.Domain_age,
                Spam_Score: r.spam_score !== undefined ? (r.spam_score ? parseFloat(r.spam_score) : null) : existingDetails.Spam_Score,
                Last_checked_at: r.last_checked_at !== undefined ? r.last_checked_at : existingDetails.Last_checked_at,
            };

            const row = {
                vendor_id: r.vendor_id || null,
                domain_details: [details]
            };

            if (r.id && !r.id.startsWith('new_')) {
                row.id = r.id;
            }

            return row;
        }));

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
