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
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching vendors:', error);
            return { success: false, message: error.message };
        }

        return { success: true, vendors: data };
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
        const rowsToUpsert = rows.map(r => {
            const row = {
                vendor_name: r.vendor_name,
                contact_email: r.contact_email || null,
                contact_phone: r.contact_phone || null,
                website: r.website || null,
                status: r.status || 'Active',
                remark: r.remark || null,
            };

            if (r.id && !r.id.startsWith('new_')) {
                row.id = r.id; // Only include valid UUIDs for existing rows
            }

            return row;
        });

        // Upsert allows inserting new rows and updating existing ones by unique constraint (like ID)
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
