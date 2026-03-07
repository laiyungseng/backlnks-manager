'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function getVendors() {
    if (!supabase) {
        return { success: false, message: 'Database client not initialized. Check your environment variables.' };
    }

    try {
        const { data, error } = await supabase
            .from('vendors')
            .select('id, vendor_details')
            .order('id', { ascending: false });

        if (error) {
            console.error('Error fetching vendors:', error);
            return { success: false, message: error.message };
        }

        // Flatten vendor_details for the frontend if it's an array
        const vendors = data.map(v => ({
            id: v.id,
            ...(Array.isArray(v.vendor_details) ? v.vendor_details[0] : (v.vendor_details || {}))
        }));

        return { success: true, vendors };
    } catch (e) {
        console.error('Unexpected error in getVendors:', e);
        return { success: false, message: 'An unexpected error occurred.' };
    }
}

export async function saveVendors(rows) {
    if (!supabase) {
        return { success: false, message: 'Database client not initialized.' };
    }

    try {
        const rowsToUpsert = await Promise.all(rows.map(async (r) => {
            let existingDetails = {};
            if (r.id && !r.id.startsWith('new_')) {
                const { data } = await supabase.from('vendors').select('vendor_details').eq('id', r.id).maybeSingle();
                if (data?.vendor_details) {
                    existingDetails = Array.isArray(data.vendor_details) ? data.vendor_details[0] : data.vendor_details;
                }
            }

            const details = {
                ...existingDetails,
                vendor_name: r.vendor_name,
                contact: r.contact !== undefined ? r.contact : existingDetails.contact,
                product_types: r.product_types !== undefined ? r.product_types : existingDetails.product_types,
                performance: r.performance !== undefined ? r.performance : existingDetails.performance,
                price: r.price !== undefined ? r.price : existingDetails.price,
                quality: r.quality !== undefined ? r.quality : existingDetails.quality,
                option_stock: r.option_stock !== undefined ? r.option_stock : existingDetails.option_stock,
                max_discount_pct: r.max_discount_pct !== undefined ? r.max_discount_pct : existingDetails.max_discount_pct,
            };

            const row = {
                vendor_details: [details]
            };

            if (r.id && !r.id.startsWith('new_')) {
                row.id = r.id;
            }

            return row;
        }));

        const { error } = await supabase
            .from('vendors')
            .upsert(rowsToUpsert, { onConflict: 'id' });

        if (error) {
            console.error('Error saving vendors:', error);
            return { success: false, message: error.message };
        }

        return { success: true, message: 'Vendors updated successfully.' };
    } catch (e) {
        console.error('Unexpected error in saveVendors:', e);
        return { success: false, message: 'Failed to update vendors due to a network or server error.' };
    }
}

export async function deleteVendors(rowIds) {
    if (!supabase) {
        return { success: false, message: 'Database client not initialized.' };
    }

    try {
        // Filter out temporary IDs (like 'new_1') before attempting DB deletion
        const validIds = rowIds.filter(id => id && !id.startsWith('new_'));

        if (validIds.length === 0) {
            return { success: true, message: 'Only unsaved rows were removed.' };
        }

        const { error } = await supabase
            .from('vendors')
            .delete()
            .in('id', validIds);

        if (error) {
            console.error('Error deleting vendors:', error);
            return { success: false, message: error.message };
        }

        return { success: true, message: 'Selected vendors deleted successfully.' };
    } catch (e) {
        console.error('Unexpected error in deleteVendors:', e);
        return { success: false, message: 'Failed to delete vendors.' };
    }
}
