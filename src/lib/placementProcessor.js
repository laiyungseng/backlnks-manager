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
        const { data: rawProjectsHub, error: fetchError } = await supabase
            .from('projects_hub')
            .select(`
                id, project_id, vendor_staging_data,
                projects ( id, project_details )
            `)
            .eq('hash', projectHash)
            .single();

        if (fetchError) throw new Error(`Project fetch error: ${fetchError.message}`);
        if (!rawProjectsHub || !rawProjectsHub.vendor_staging_data) {
            return { success: false, message: 'No vendor staging data found for this project.' };
        }

        const hubRow = rawProjectsHub;
        const stagingData = hubRow.vendor_staging_data;
        if (!Array.isArray(stagingData) || stagingData.length === 0) {
            return { success: false, message: 'Staging data is empty or invalid format.' };
        }

        const projectRow = hubRow.projects;
        if (!projectRow) {
            return { success: false, message: 'No project details found for this project.' };
        }

        const details = projectRow.project_details?.[0] || {};

        // Extract primary language logic from new format
        let primaryLanguage = details.language || 'EN';
        if (Array.isArray(details['languages-ratio']) && details['languages-ratio'].length > 0) {
            primaryLanguage = details['languages-ratio'][0]['lang-code']?.toUpperCase() || primaryLanguage;
        }

        const projectUUID = hubRow.project_id;
        const vendorName = details.vendor_name || 'Unknown Vendor';
        const category = details.backlinks_category || 'Uncategorized';
        const country = details.country || 'GLOBAL';
        const sheetName = details.sheet_name || null;
        const createdAt = details.created_at || null;

        const rawDataArray = stagingData;

        const nowIso = new Date().toISOString();

        // -------------------------------------------------------------
        // PRIORITY 1: VENDORS — resolved first so vendor_id is available
        // -------------------------------------------------------------
        const targetVendorId = await (async () => {
            const { data: existingVendor } = await supabase
                .from('vendors')
                .select('id, vendor_details, created_at')
                .filter('vendor_details', 'cs', `[{"vendor_name": "${vendorName}"}]`)
                .maybeSingle();

            if (existingVendor) {
                return existingVendor.id;
            } else {
                const { data: newV, error: vendorInsertErr } = await supabase
                    .from('vendors')
                    .insert({
                        vendor_details: [{
                            vendor_name: vendorName,
                            contact: null,
                            product_types: null,
                            performance: null,
                            price: null,
                            quality: null,
                            option_stock: null,
                            max_discount_pct: null
                        }]
                    })
                    .select('id')
                    .single();

                if (vendorInsertErr && vendorInsertErr.code !== '23505') {
                    throw new Error(`Vendors Insert Error: ${vendorInsertErr.message}`);
                }
                return newV?.id;
            }
        })();

        if (!targetVendorId) {
            throw new Error('Failed to resolve Vendor ID during generation.');
        }

        // -------------------------------------------------------------
        // PRIORITY 2: DOMAINS — runs after vendor so vendor_id can be included
        // -------------------------------------------------------------
        const domainMap = await (async () => {
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

            const uniqueDomainList = Array.from(uniqueDomainsSet);
            if (uniqueDomainList.length === 0) return new Map();

            // 1. Fetch existing domains for these URLs
            let existingDomains = [];
            const { data: extD, error: fetchErr } = await supabase
                .from('domains')
                .select('id, domain_details');

            if (fetchErr) throw new Error(`Existing Domains Fetch Error: ${fetchErr.message}`);

            // Filter in JS to find matching ones by hostname
            existingDomains = (extD || []).filter(d => {
                const details = Array.isArray(d.domain_details) ? d.domain_details[0] : d.domain_details;
                const domainUrl = details?.domain_url || '';
                try {
                    // Try to compare as hostnames
                    const dbHost = domainUrl.includes('://') ? new URL(domainUrl).hostname : domainUrl;
                    return uniqueDomainsSet.has(dbHost);
                } catch (e) {
                    return uniqueDomainsSet.has(domainUrl);
                }
            });

            const existingUrls = new Set(existingDomains.map(d => {
                const details = Array.isArray(d.domain_details) ? d.domain_details[0] : d.domain_details;
                return details?.domain_url;
            }));

            // 2. Prepare ALL domains (new and existing) to be upserted to ensure vendor_id link
            const domainsToUpsert = uniqueDomainList.map(url => {
                const existing = (existingDomains || []).find(d => {
                    const details = Array.isArray(d.domain_details) ? d.domain_details[0] : d.domain_details;
                    return (details?.domain_url === url);
                });

                if (existing) {
                    return {
                        id: existing.id,
                        vendor_id: targetVendorId,
                        domain_details: existing.domain_details
                    };
                } else {
                    return {
                        domain_details: [{
                            domain_url: url,
                            DR: null,
                            Traffic: null,
                            Domain_age: null,
                            Spam_Score: null,
                            Last_checked_at: nowIso
                        }],
                        vendor_id: targetVendorId
                    };
                }
            });

            // 3. Upsert domains
            let allUpsertedDomains = [];
            if (domainsToUpsert.length > 0) {
                const chunkSize = 1000;
                for (let i = 0; i < domainsToUpsert.length; i += chunkSize) {
                    const chunk = domainsToUpsert.slice(i, i + chunkSize);
                    const { data: dData, error: domainsErr } = await supabase
                        .from('domains')
                        .upsert(chunk, { onConflict: 'id' })
                        .select('id, domain_details');

                    if (domainsErr) {
                        console.error('Domains Upsert Error Object:', domainsErr);
                        throw new Error(`Domains Upsert Error (Chunk ${i}): ${domainsErr.message}${domainsErr.details ? ' - ' + domainsErr.details : ''}`);
                    }
                    allUpsertedDomains = allUpsertedDomains.concat(dData || []);
                }
            }

            // 4. Map domains explicitly for memory binding
            return new Map(allUpsertedDomains.map(d => {
                const domDetails = Array.isArray(d.domain_details) ? d.domain_details[0] : d.domain_details;
                return [domDetails.domain_url, d.id];
            }));
        })();

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

        // Derive arrays for dynamic properties 
        const cats = details.backlinks_category ? [details.backlinks_category] :
            Array.isArray(details.project_info) ? Array.from(new Set(details.project_info.map(i => i.category).filter(c => c && c !== 'NULL'))) : null;
        const mappedCategoriesArray = (cats && cats.length > 0) ? cats : null;

        const sheets = details.sheet_name ? [details.sheet_name] :
            Array.isArray(details.project_info) ? Array.from(new Set(details.project_info.map(i => i.sheet_name).filter(Boolean))) : [];
        const mappedSheetNameStr = sheets.length > 0 ? sheets.join(', ') : null;

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
                    sheet_name: mappedSheetNameStr,
                    backlinks_quantity: 1,
                    anchor_text: row.anchor_text || null,
                    target_url: row.target_url || null,
                    language: primaryLanguage,
                    start_date: details.start_date || null,
                    published_url: row.published_url,
                    published_date: row.published_date, // Mapped deliberately per user instruction. If schema has a typo, this matches it. 
                    status: resolvedStatus,
                    indexed_status: row.indexed_status || null,
                    indexed_checked_at: null,
                    last_vendor_update_at: nowIso,
                    notes: row.remark || null, // Maps the user UI 'remark' directly to DB 'notes'
                    country: country,
                    category: mappedCategoriesArray,
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
        // Fetch current project_details first
        const { data: projData, error: projErr } = await supabase
            .from('projects')
            .select('project_details')
            .eq('id', projectUUID)
            .single();

        if (projErr) throw new Error(`Project fetch error for finalize: ${projErr.message}`);

        const projDetails = projData.project_details || [];
        if (projDetails.length > 0) {
            projDetails[0].status = 'Finalized';
        }

        const { error: finalizeErr } = await supabase
            .from('projects')
            .update({ project_details: projDetails })
            .eq('id', projectUUID);

        if (finalizeErr) throw new Error(`Project finalize error: ${finalizeErr.message}`);

        // AUTO-LOCK: Prevent vendor edits after finalization
        const { error: lockErr } = await supabase
            .from('projects_hub')
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
