'use server';

import { createClient } from '@supabase/supabase-js';
import { domainSchema } from '../../../schemas/domainSchema';

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
            .select('id, vendor_id, domain_url, dr, traffic, domain_age, spam_score, last_checked_at, domain_details, vendors(vendor_name, vendor_details)')
            .order('id', { ascending: false });

        if (error) {
            console.error('Error fetching domains:', error);
            return { success: false, message: error.message };
        }

        // Flatten domain_details and vendor_details for the frontend, defaulting to top-level cols
        const domains = data.map(d => {
            const legacyDetails = (Array.isArray(d.domain_details) ? d.domain_details[0] : d.domain_details) || {};

            const vendorDetails = d.vendors?.vendor_details;
            const legacyVendorName = Array.isArray(vendorDetails) ? vendorDetails[0]?.vendor_name : vendorDetails?.vendor_name;
            const vendorName = d.vendors?.vendor_name || legacyVendorName || 'Unknown Vendor';

            return {
                id: d.id,
                vendor_id: d.vendor_id,
                domain_url: d.domain_url || legacyDetails.domain_url || '',
                domain_rating: d.dr !== null ? d.dr : (legacyDetails.DR || null),
                traffic: d.traffic !== null ? d.traffic : (legacyDetails.Traffic || null),
                domain_age: d.domain_age !== null ? d.domain_age : (legacyDetails.Domain_age || null),
                spam_score: d.spam_score !== null ? d.spam_score : (legacyDetails.Spam_Score || null),
                last_checked_at: d.last_checked_at || legacyDetails.Last_checked_at || null,
                vendors: { vendor_name: vendorName }
            };
        });

        // Fetch vendor options for dropdown
        const vendorRes = await supabase.from('vendors').select('id, vendor_name, vendor_details');
        const vendorOptions = (vendorRes.data || []).map(v => ({
            id: v.id,
            vendor_name: v.vendor_name || (Array.isArray(v.vendor_details) ? v.vendor_details[0]?.vendor_name : v.vendor_details?.vendor_name) || 'Unnamed Vendor'
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
            let existingRecord = {};
            if (r.id && !r.id.startsWith('new_')) {
                const { data } = await supabase.from('domains').select('*').eq('id', r.id).maybeSingle();
                if (data) existingRecord = data;
            }

            const payloadToValidate = {
                domain_url: r.domain_url || existingRecord.domain_url,
                dr: r.domain_rating !== undefined ? (r.domain_rating ? parseInt(r.domain_rating) : null) : existingRecord.dr,
                traffic: r.traffic !== undefined ? (r.traffic ? parseInt(r.traffic) : null) : existingRecord.traffic,
                domain_age: r.domain_age !== undefined ? (r.domain_age ? parseInt(r.domain_age) : null) : existingRecord.domain_age,
                spam_score: r.spam_score !== undefined ? (r.spam_score ? parseFloat(r.spam_score) : null) : existingRecord.spam_score,
                last_checked_at: r.last_checked_at !== undefined ? r.last_checked_at : existingRecord.last_checked_at,
            };

            const parsedResult = domainSchema.safeParse(payloadToValidate);

            if (!parsedResult.success) {
                const errorMessages = parsedResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
                throw new Error(`Validation failed for domain "${r.domain_url}": ${errorMessages}`);
            }

            const details = parsedResult.data;

            const row = {
                vendor_id: r.vendor_id || existingRecord.vendor_id || null,
                domain_url: details.domain_url,
                dr: details.dr,
                traffic: details.traffic,
                domain_age: details.domain_age,
                spam_score: details.spam_score,
                last_checked_at: details.last_checked_at,
                // Legacy support
                domain_details: [{
                    domain_url: details.domain_url,
                    DR: details.dr,
                    Traffic: details.traffic,
                    Domain_age: details.domain_age,
                    Spam_Score: details.spam_score,
                    Last_checked_at: details.last_checked_at
                }]
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
