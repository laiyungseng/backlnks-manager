import { supabase } from './supabase';

/**
 * Normalizes vendor staging data from the project_list table
 * Pushes formatted data directly into Placements, Vendors, and Domains tables
 * 
 * @param {string} projectHash - The unique project hash identifying the vendor submission
 * @returns {object} - Success status and processed counts
 */
export async function normalizeProjectData(projectHash) {
    try {
        // 1. Fetch the overarching project and unverified vendor data
        const { data: projectRow, error: projectError } = await supabase
            .from('project_list')
            .select(`
                id,
                project_id,
                vendor_staging_data,
                projects (
                    vendor_name,
                    language,
                    country,
                    backlinks_category,
                    sheet_name,
                    created_at,
                    status
                )
            `)
            .eq('hash', projectHash)
            .single();

        if (projectError) throw new Error(`Project fetch error: ${projectError.message}`);
        if (!projectRow || !projectRow.vendor_staging_data) {
            return { success: false, message: 'No vendor staging data found for this project.' };
        }

        const projectUUID = projectRow.project_id;
        const vendorName = projectRow.projects?.vendor_name || 'Unknown Vendor';
        const rawDataArray = projectRow.vendor_staging_data;

        if (!Array.isArray(rawDataArray) || rawDataArray.length === 0) {
            return { success: false, message: 'Staging data is empty or invalid format.' };
        }

        const nowIso = new Date().toISOString();

        // -------------------------------------------------------------
        // PRIORITY 1 & 2: PARALLEL DOMAINS AND VENDORS EXTRACTION
        // -------------------------------------------------------------

        // Priority 1: Domains Promise
        const domainsPromise = (async () => {
            const uniqueDomainsSet = new Set();
            for (const row of rawDataArray) {
                if (row.published_url && row.published_date) {
                    try {
                        const parsedUrl = new URL(row.published_url);
                        uniqueDomainsSet.add(parsedUrl.hostname);
                    } catch (e) {
                        console.warn("Invalid URL skipped for domain extraction:", row.published_url);
                    }
                }
            }

            const domainsToUpsert = Array.from(uniqueDomainsSet).map(domain => ({
                domain_url: domain,
                last_checked_at: nowIso
            }));

            let allUpsertedDomains = [];
            const chunkSize = 1000;
            for (let i = 0; i < domainsToUpsert.length; i += chunkSize) {
                const chunk = domainsToUpsert.slice(i, i + chunkSize);
                const { data: dData, error: domainsErr } = await supabase
                    .from('domains')
                    .upsert(chunk, {
                        onConflict: 'domain_url',
                        ignoreDuplicates: false
                    })
                    .select('id, domain_url');

                if (domainsErr) throw new Error(`Domains Upsert Error (Chunk ${i}): ${domainsErr.message}`);
                allUpsertedDomains = allUpsertedDomains.concat(dData || []);
            }

            // Map domains explicitly for memory binding
            return new Map(allUpsertedDomains.map(d => [d.domain_url, d.id]));
        })();

        // Priority 2: Vendors Promise
        const vendorsPromise = (async () => {
            const { data: existingVendor } = await supabase
                .from('vendors')
                .select('id, vendor_name, created_at')
                .eq('vendor_name', vendorName)
                .single();

            if (existingVendor) {
                const { error: vendorUpdateErr } = await supabase
                    .from('vendors')
                    .update({ updated_at: nowIso })
                    .eq('id', existingVendor.id);
                if (vendorUpdateErr) throw new Error(`Vendors Update Error: ${vendorUpdateErr.message}`);
                return existingVendor.id;
            } else {
                const { data: newV, error: vendorInsertErr } = await supabase
                    .from('vendors')
                    .insert({
                        vendor_name: vendorName,
                        created_at: nowIso,
                        updated_at: nowIso
                    })
                    .select('id')
                    .single();

                if (vendorInsertErr && vendorInsertErr.code !== '23505') {
                    throw new Error(`Vendors Insert Error: ${vendorInsertErr.message}`);
                }
                return newV?.id;
            }
        })();

        // Execute independently and await synchronization
        const [domainMap, targetVendorId] = await Promise.all([domainsPromise, vendorsPromise]);

        if (!targetVendorId) {
            throw new Error('Failed to resolve Vendor ID during generation.');
        }

        // -------------------------------------------------------------
        // PRIORITY 2.5: FETCH EXISTING PLACEMENTS FOR STATUS PRESERVATION
        // -------------------------------------------------------------
        // Query existing active placements linked to this project to preserve statuses
        const { data: existingPlacements, error: existingPlacementsErr } = await supabase
            .from('placements')
            .select('vendor_id, domain_id, status')
            .eq('project_id', projectUUID);

        if (existingPlacementsErr) throw new Error(`Existing Placements Fetch Error: ${existingPlacementsErr.message}`);

        const placementStatusMap = new Map();
        if (existingPlacements) {
            existingPlacements.forEach(p => {
                placementStatusMap.set(`${p.vendor_id}_${p.domain_id}`, p.status);
            });
        }

        // -------------------------------------------------------------
        // PRIORITY 3: PLACEMENTS RELATIONAL MATRIX
        // -------------------------------------------------------------
        const placementsToInsert = [];

        for (const row of rawDataArray) {
            if (row.published_url && row.published_date) {

                let matchingDomainId = null;
                try {
                    const hostname = new URL(row.published_url).hostname;
                    matchingDomainId = domainMap.get(hostname) || null;
                } catch (e) { }

                // Try to resolve existing status based on alignment key: vendor_id, domain_id
                const alignmentKey = `${targetVendorId}_${matchingDomainId}`;
                const resolvedStatus = placementStatusMap.get(alignmentKey) || 'published';

                // Architecting exactly per the user's schema bindings
                placementsToInsert.push({
                    project_id: projectUUID,
                    vendor_id: targetVendorId,
                    domain_id: matchingDomainId,
                    sheet_name: projectRow.projects?.sheet_name || null,
                    backlinks_quantity: 1,
                    anchor_text: row.anchor_text || null,
                    target_url: row.target_url || null,
                    language: projectRow.projects?.language || null,
                    start_date: projectRow.projects?.created_at || null,
                    published_url: row.published_url,
                    published_date: row.published_date, // Mapped deliberately per user instruction. If schema has a typo, this matches it. 
                    status: resolvedStatus,
                    indexed_status: row.indexed_status || null,
                    indexed_checked_at: null,
                    last_vendor_update_at: nowIso,
                    notes: row.remark || null, // Maps the user UI 'remark' directly to DB 'notes'
                    created_at: nowIso,
                    updated_at: nowIso,
                    country: projectRow.projects?.country || null,
                    category: projectRow.projects?.backlinks_category ? [projectRow.projects.backlinks_category] : null,
                    vendor_token: projectHash
                });
            }
        }

        if (placementsToInsert.length === 0) {
            return { success: false, message: 'No valid completed placements found in staging.' };
        }

        const { error: placementsErr } = await supabase
            .from('placements')
            .insert(placementsToInsert);

        if (placementsErr) throw new Error(`Placements Injection Crash: ${placementsErr.message}`);

        // -------------------------------------------------------------
        // PRIORITY 4: FINALIZE PROJECT
        // -------------------------------------------------------------
        const { error: finalizeErr } = await supabase
            .from('projects')
            .update({ status: 'Finalized' })
            .eq('id', projectUUID);

        if (finalizeErr) throw new Error(`Project finalize error: ${finalizeErr.message}`);

        // AUTO-LOCK: Prevent vendor edits after finalization
        const { error: lockErr } = await supabase
            .from('project_list')
            .update({ is_locked: true })
            .eq('hash', projectHash);

        if (lockErr) {
            console.warn('Auto-lock warning:', lockErr.message);
            // Non-fatal: finalization succeeded even if lock failed
        }

        return {
            success: true,
            message: `Successfully mapped ${placementsToInsert.length} placements perfectly to ${domainMap.size} relational domains.`
        };

    } catch (error) {
        console.error("Normalization Engine Database Crash:", error);
        return { success: false, message: error.message };
    }
}
