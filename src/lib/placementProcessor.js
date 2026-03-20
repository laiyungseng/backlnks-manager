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
                projects(
                    id, project_name, owner, start_date, deadline, vendor_id, country, language,
                    total_quantity, remarks, status, created_date, completed_date,
                    project_languages(id, lang_code, ratio),
                    project_targets(id, category, anchor_text, target_url, quantity_requested, sheet_name)
                )
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

        // Use normalized columns
        const projectUUID = projectRow.id;
        const targetVendorId = projectRow.vendor_id;

        if (!targetVendorId) {
            throw new Error('Project is missing a vendor relationship (vendor_id is null).');
        }

        // Primary Language logic now looks at child table
        let primaryLanguage = projectRow.language || 'EN';
        if (projectRow.project_languages && projectRow.project_languages.length > 0) {
            // Fallback to the first connected language code if the legacy column isn't set
            primaryLanguage = projectRow.project_languages[0].lang_code || primaryLanguage;
        }

        const country = projectRow.country || 'GLOBAL';
        const rawDataArray = stagingData;
        const nowIso = new Date().toISOString();

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

            // 1. Fetch existing domains for these URLs using normalized schema
            let existingDomains = [];
            const { data: extD, error: fetchErr } = await supabase
                .from('domains')
                .select('id, domain_url');

            if (fetchErr) throw new Error(`Existing Domains Fetch Error: ${fetchErr.message}`);

            // Filter in JS to find matching ones by hostname
            existingDomains = (extD || []).filter(d => {
                const domainUrl = d.domain_url || '';
                try {
                    // Try to compare as hostnames
                    const dbHost = domainUrl.includes('://') ? new URL(domainUrl).hostname : domainUrl;
                    return uniqueDomainsSet.has(dbHost);
                } catch (e) {
                    return uniqueDomainsSet.has(domainUrl);
                }
            });

            // 2. Prepare ALL domains (new and existing) to be upserted to ensure vendor_id link
            const domainsToUpsert = uniqueDomainList.map(url => {
                const existing = (existingDomains || []).find(d => d.domain_url === url);

                if (existing) {
                    return {
                        id: existing.id,
                        vendor_id: targetVendorId,
                        domain_url: url
                    };
                } else {
                    return {
                        domain_url: url,
                        vendor_id: targetVendorId,
                        dr: null,
                        traffic: null,
                        domain_age: null,
                        spam_score: null,
                        last_checked_at: nowIso
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
                        .select('id, domain_url');

                    if (domainsErr) {
                        console.error('Domains Upsert Error Object:', domainsErr);
                        throw new Error(`Domains Upsert Error(Chunk ${i}): ${domainsErr.message}${domainsErr.details ? ' - ' + domainsErr.details : ''}`);
                    }
                    allUpsertedDomains = allUpsertedDomains.concat(dData || []);
                }
            }

            // 4. Map domains explicitly for memory binding
            return new Map(allUpsertedDomains.map(d => [d.domain_url, d.id]));
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

        // Derive arrays for dynamic properties reading from new child table
        const targets = projectRow.project_targets || [];
        const mappedCategoriesArray = targets.length > 0 ? Array.from(new Set(targets.map(t => t.category).filter(c => c && c !== 'NULL'))) : null;
        const sheets = targets.length > 0 ? Array.from(new Set(targets.map(t => t.sheet_name).filter(Boolean))) : [];
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

                // Architecting exactly per the Zod baclinkSchema
                placementsToInsert.push({
                    project_id: projectUUID,
                    vendor_id: targetVendorId,
                    domain_id: matchingDomainId,
                    sheet_name: mappedSheetNameStr,
                    category: mappedCategoriesArray && mappedCategoriesArray.length > 0 ? mappedCategoriesArray : null,
                    language: row.language || primaryLanguage,
                    anchor_text: row.anchor_text || null,
                    target_url: row.target_url || null,
                    published_url: row.published_url,
                    published_date: row.published_date,
                    status: resolvedStatus,
                    indexed_status: row.indexed_status || null,
                    indexed_checked_at: null,
                    last_vendor_update_at: nowIso,
                    notes: row.remark || null, // Maps the user UI 'remark' directly to DB 'notes'
                    country: country,
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
            .update({
                status: 'Finalized',
                completed_date: new Date().toISOString()
            })
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
