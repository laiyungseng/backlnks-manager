'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { getSession } from '@/lib/session';
import { vendorSchema } from '../../../schemas/vendorSchema';

async function requireAdmin() {
    const session = await getSession();
    if (!session?.id) throw new Error('Unauthorized');
    return session;
}

export async function getVendors() {
    try { await requireAdmin(); } catch { return { success: false, message: 'Unauthorized.' }; }
    const supabase = getServerSupabase();

    try {
        const { data, error } = await supabase
            .from('vendors')
            .select('*')
            .order('id', { ascending: false });

        if (error) {
            console.error('Error fetching vendors:', error);
            return { success: false, message: error.message };
        }

        // Fetch projects to compute total price per vendor
        const { data: projectsData } = await supabase
            .from('projects')
            .select('vendor_id, price, total_quantity, price_type');

        // Fetch placements to compute product types
        const { data: placementsData } = await supabase
            .from('placements')
            .select('vendor_id, category');

        // Map data checking normalized columns first, fallback to JSONB legacy if necessary
        const vendors = data.map(v => {
            const legacyDetails = (Array.isArray(v.vendor_details) ? v.vendor_details[0] : v.vendor_details) || {};

            let dynamicPrice = 0;
            if (projectsData) {
                projectsData.forEach(p => {
                    if (p.vendor_id === v.id) {
                        const pr = parseFloat(p.price) || 0;
                        if (p.price_type === 'package') dynamicPrice += pr;
                        else dynamicPrice += pr * (parseInt(p.total_quantity || 1, 10));
                    }
                });
            }

            let productTypesSet = new Set();
            if (placementsData) {
                placementsData.forEach(pl => {
                    if (pl.vendor_id === v.id && pl.category) {
                        if (Array.isArray(pl.category)) {
                            pl.category.forEach(c => productTypesSet.add(c));
                        } else {
                            productTypesSet.add(pl.category);
                        }
                    }
                });
            }
            let dynamicProductTypes = Array.from(productTypesSet).join(', ');

            return {
                id: v.id,
                vendor_name: v.vendor_name || legacyDetails.vendor_name || 'Missing Name',
                contact: v.contact || legacyDetails.contact || '',
                product_types: dynamicProductTypes || '',
                performance: v.performance !== null ? v.performance : (legacyDetails.performance || 0),
                price: dynamicPrice || 0,
                quality: v.quality !== null ? v.quality : (legacyDetails.quality || 0),
                option_stock: v.option_stock !== null ? v.option_stock : (legacyDetails.option_stock || false),
                max_discount_pct: v.max_discount_pct !== null ? v.max_discount_pct : (legacyDetails.max_discount_pct || 0),
                employ_status: v.employ_status || 'continue',
                remark: v.remark || ''
            };
        });

        return { success: true, vendors };
    } catch (e) {
        console.error('Unexpected error in getVendors:', e);
        return { success: false, message: 'An unexpected error occurred.' };
    }
}

export async function saveVendors(rows) {
    try { await requireAdmin(); } catch { return { success: false, message: 'Unauthorized.' }; }
    const supabase = getServerSupabase();
    try {
        const rowsToUpsert = await Promise.all(rows.map(async (r) => {
            let existingRecord = {};

            if (r.id && !r.id.startsWith('new_')) {
                const { data } = await supabase.from('vendors').select('*').eq('id', r.id).maybeSingle();
                if (data) {
                    existingRecord = data;
                }
            }

            // Normalize payload
            const mergedPayload = {
                vendor_name: r.vendor_name,
                contact: r.contact !== undefined ? r.contact : existingRecord.contact,
                product_types: r.product_types !== undefined ? r.product_types : existingRecord.product_types,
                performance: r.performance !== undefined ? r.performance : existingRecord.performance,
                price: r.price !== undefined ? r.price : existingRecord.price,
                quality: r.quality !== undefined ? r.quality : existingRecord.quality,
                option_stock: r.option_stock !== undefined ? r.option_stock : existingRecord.option_stock,
                max_discount_pct: r.max_discount_pct !== undefined ? r.max_discount_pct : existingRecord.max_discount_pct,
                employ_status: r.employ_status !== undefined ? r.employ_status : existingRecord.employ_status,
                remark: r.remark !== undefined ? r.remark : existingRecord.remark,
            };

            const parsedResult = vendorSchema.safeParse(mergedPayload);

            if (!parsedResult.success) {
                const errorMessages = parsedResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
                throw new Error(`Validation failed for vendor "${r.vendor_name}": ${errorMessages}`);
            }

            const details = parsedResult.data;

            const row = {
                vendor_name: details.vendor_name,
                contact: details.contact,
                product_types: details.product_types,
                performance: details.performance,
                price: details.price,
                quality: details.quality,
                option_stock: details.option_stock,
                max_discount_pct: details.max_discount_pct,
                employ_status: details.employ_status,
                remark: details.remark,
                // Keep keeping legacy blob alive for other old views just in case for now
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
    try { await requireAdmin(); } catch { return { success: false, message: 'Unauthorized.' }; }
    const supabase = getServerSupabase();
    try {
        const validIds = rowIds.filter(id => id && !id.startsWith('new_'));

        if (validIds.length === 0) {
            return { success: true, message: 'Only unsaved rows were removed.' };
        }

        // STEP 1: Unlink any domains associated with these vendors
        const { error: unlinkError } = await supabase
            .from('domains')
            .update({ vendor_id: null })
            .in('vendor_id', validIds);

        if (unlinkError) {
            console.error('Error unlinking domains before vendor deletion:', unlinkError);
            return { success: false, message: 'Failed to unlink domains from vendor before deletion.' };
        }

        // STEP 2: Delete the vendors
        const { error } = await supabase
            .from('vendors')
            .delete()
            .in('id', validIds);

        if (error) {
            console.error('Error deleting vendors:', error);
            return { success: false, message: error.message };
        }

        return { success: true, message: 'Selected vendors deleted (and any linked domains have been unlinked).' };
    } catch (e) {
        console.error('Unexpected error in deleteVendors:', e);
        return { success: false, message: 'Failed to delete vendors.' };
    }
}

export async function getLinkedDomains(vendorIds) {
    try { await requireAdmin(); } catch { return { success: false, message: 'Unauthorized.' }; }
    const supabase = getServerSupabase();
    try {
        const validIds = vendorIds.filter(id => id && !id.startsWith('new_'));
        if (validIds.length === 0) return { success: true, domains: [] };

        const { data, error } = await supabase
            .from('domains')
            .select('id, vendor_id, domain_url, domain_details')
            .in('vendor_id', validIds);

        if (error) {
            console.error('Error fetching linked domains:', error);
            return { success: false, message: error.message };
        }

        // Parse JSONB block fallback
        const domains = data.map(d => {
            const details = Array.isArray(d.domain_details) ? d.domain_details[0] : (d.domain_details || {});
            return {
                id: d.id,
                vendor_id: d.vendor_id,
                url: d.domain_url || details.domain_url || 'Unknown URL'
            };
        });

        return { success: true, domains };
    } catch (e) {
        console.error('Unexpected error in getLinkedDomains:', e);
        return { success: false, message: 'Failed to fetch linked domains.' };
    }
}
