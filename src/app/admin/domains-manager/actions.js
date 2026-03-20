'use server';

import { createClient } from '@supabase/supabase-js';
import { domainSchema } from '../../../schemas/domainSchema';
import { parseDomainUrl, parseMetric } from '../../../lib/utils';

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
                domain_url: parseDomainUrl(r.domain_url || existingRecord.domain_url),
                dr: r.domain_rating !== undefined ? parseMetric(r.domain_rating) : existingRecord.dr,
                traffic: r.traffic !== undefined ? parseMetric(r.traffic) : existingRecord.traffic,
                domain_age: r.domain_age !== undefined ? parseMetric(r.domain_age) : existingRecord.domain_age,
                spam_score: r.spam_score !== undefined ? parseMetric(r.spam_score, true) : existingRecord.spam_score,
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

export async function uploadDomainMetrics(rows) {
    if (!supabase) {
        return { success: false, message: 'Database client not initialized.' };
    }

    try {
        if (!Array.isArray(rows) || rows.length === 0) {
            return { success: false, message: 'No valid rows provided for upload.' };
        }

        // Fetch all existing domains to preserve UUIDs and Vendor mappings
        const { data: existingDomainsData, error: fetchError } = await supabase
            .from('domains')
            .select('id, vendor_id, domain_url');

        if (fetchError) {
            console.error('Error fetching existing domains for upload:', fetchError);
            return { success: false, message: 'Failed to fetch existing domains.' };
        }

        // Map existing domains by normalized URL
        const existingDomainsMap = new Map();
        existingDomainsData.forEach(d => {
            const normalized = parseDomainUrl(d.domain_url);
            if (normalized) {
                existingDomainsMap.set(normalized, d);
            }
        });

        const nowIso = new Date().toISOString();

        const rowsToUpsert = [];
        const validationErrors = [];

        for (let i = 0; i < rows.length; i++) {
            const rawRow = rows[i];
            const parsedUrl = parseDomainUrl(rawRow.domain_url);

            if (!parsedUrl) {
                validationErrors.push(`Row ${i + 1}: Invalid Domain URL "${rawRow.domain_url}"`);
                continue;
            }

            const existingRecord = existingDomainsMap.get(parsedUrl) || {};

            // We only override metrics that are provided in the upload.
            const payloadToValidate = {
                domain_url: parsedUrl,
                dr: rawRow.domain_rating !== undefined ? parseMetric(rawRow.domain_rating) : existingRecord.dr,
                traffic: rawRow.traffic !== undefined ? parseMetric(rawRow.traffic) : existingRecord.traffic,
                domain_age: rawRow.domain_age !== undefined ? parseMetric(rawRow.domain_age) : existingRecord.domain_age,
                spam_score: rawRow.spam_score !== undefined ? parseMetric(rawRow.spam_score, true) : existingRecord.spam_score,
                last_checked_at: nowIso,
            };

            const parsedResult = domainSchema.safeParse(payloadToValidate);

            if (!parsedResult.success) {
                const errorMessages = parsedResult.error.issues.map(iss => `${iss.path.join('.')}: ${iss.message}`).join(', ');
                validationErrors.push(`Row ${i + 1} (${parsedUrl}): ${errorMessages}`);
                continue;
            }

            const details = parsedResult.data;

            const rowToUpsert = {
                vendor_id: existingRecord.vendor_id || null, // Preserve vendor mapping if it exists
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

            if (existingRecord.id) {
                rowToUpsert.id = existingRecord.id;
            }

            rowsToUpsert.push(rowToUpsert);
        }

        if (validationErrors.length > 0) {
            // If there are validation errors, we reject the whole batch to ensure data integrity
            return {
                success: false,
                message: `Validation failed for ${validationErrors.length} rows. First error: ${validationErrors[0]}`
            };
        }

        if (rowsToUpsert.length === 0) {
            return { success: false, message: 'No valid rows to process after filtering.' };
        }

        // Upsert in chunks to avoid hitting payload limits
        const chunkSize = 1000;
        let insertedCount = 0;
        let updatedCount = 0;

        for (let i = 0; i < rowsToUpsert.length; i += chunkSize) {
            const chunk = rowsToUpsert.slice(i, i + chunkSize);
            
            chunk.forEach(r => {
                if(r.id) updatedCount++;
                else insertedCount++;
            });

            const { error } = await supabase
                .from('domains')
                .upsert(chunk, { onConflict: 'id' });

            if (error) {
                console.error('Error in bulk upsert chunk:', error);
                throw new Error(error.message);
            }
        }

        return { 
            success: true, 
            message: `Successfully processed ${rowsToUpsert.length} domains (${updatedCount} updated, ${insertedCount} new).` 
        };

    } catch (e) {
        console.error('Unexpected error in uploadDomainMetrics:', e);
        return { success: false, message: `Failed to process upload: ${e.message}` };
    }
}
