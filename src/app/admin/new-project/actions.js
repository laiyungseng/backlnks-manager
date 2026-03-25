'use server';

import { supabase } from '@/lib/supabase';
import { projectFormPayloadSchema } from '@/schemas/projectSchema';
import crypto from 'crypto';

export async function createProjectAction(prevState, formData) {
    if (!supabase) {
        return { success: false, message: 'Database connection not configured.' };
    }

    try {
        const rawData = {
            project_name: formData.get('project_name'),
            owner: formData.get('owner'),
            start_date: formData.get('start_date'),
            deadline: formData.get('deadline'),
            vendor_name: formData.get('vendor_name'),
            country: formData.get('country'),
            language: formData.get('language'),
            languages_json: formData.get('languages_json'),
            project_info_json: formData.get('project_info_json'),
            quantity: formData.get('quantity'),
            remarks: formData.get('remarks') || '',
            dripfeed_enabled: formData.has('dripfeed_enabled'),
            dripfeed_period: formData.get('dripfeed_period') || null,
            urls_per_day: formData.get('urls_per_day') || null,
            url_entry_enabled: formData.get('url_entry_enabled') === 'true',
            price: formData.get('price'),
            price_type: formData.get('price_type'),
            randomize_languages: formData.get('randomize_languages') === 'true'
        };

        // 1. Strict Validation
        const validatedData = projectFormPayloadSchema.safeParse(rawData);

        if (!validatedData.success) {
            return {
                success: false,
                errors: validatedData.error.flatten().fieldErrors,
                message: 'Validation failed. Please check the dynamic row quantities.'
            };
        }

        const projectData = validatedData.data;
        const projectInfoArray = projectData.project_info_json;
        const languagesArray = projectData.languages_json;

        // Flatten the required targets for the projects_hub 
        const flattenedTargets = [];
        let allocatedCount = 0;

        projectInfoArray.forEach(infoGroup => {
            infoGroup.placement_target.forEach(target => {
                const absoluteQuantity = Math.round(projectData.quantity * target.ratio / 100);
                allocatedCount += absoluteQuantity;
                
                flattenedTargets.push({
                    anchor_text: target.anchor_text || "",
                    target_url: target.target_url || "",
                    quantity: String(absoluteQuantity),
                    category: infoGroup.category,
                    sheet_name: infoGroup.sheet_name || null,
                    created_at: new Date().toISOString()
                });
            });
        });

        // Resolve rounding discrepancies (e.g. 33% * 3 = 99%)
        const discrepancy = projectData.quantity - allocatedCount;
        if (discrepancy !== 0 && flattenedTargets.length > 0) {
            const adjustedQty = parseInt(flattenedTargets[0].quantity, 10) + discrepancy;
            flattenedTargets[0].quantity = String(Math.max(0, adjustedQty));
        }

        // 2. Generate secure crypt-hash for Vendor allocation URL
        const rawString = `${projectData.project_name}-${Date.now()}-${Math.random()}`;
        const projectHash = crypto.createHash('sha256').update(rawString).digest('hex');

        // 3. Generate vendor_name slug for URL
        const vendorSlug = projectData.vendor_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        // 4. Resolve Vendor ID based on Vendor Name
        let targetVendorId = null;
        const { data: existingVendor } = await supabase
            .from('vendors')
            .select('id')
            .eq('vendor_name', projectData.vendor_name)
            .maybeSingle();

        if (existingVendor) {
            targetVendorId = existingVendor.id;
        } else {
            // Check legacy JSONB
            const { data: legacyVendor } = await supabase
                .from('vendors')
                .select('id')
                .filter('vendor_details', 'cs', `[{"vendor_name": "${projectData.vendor_name}"}]`)
                .maybeSingle();

            if (legacyVendor) {
                targetVendorId = legacyVendor.id;
            } else {
                const { data: newV, error: vendorInsertErr } = await supabase
                    .from('vendors')
                    .insert({ vendor_name: projectData.vendor_name })
                    .select('id')
                    .single();
                if (vendorInsertErr) throw new Error(`Failed to create vendor: ${vendorInsertErr.message}`);
                targetVendorId = newV.id;
            }
        }

        // 5. Insert Master Project into normalized columns
        const { data: projectInsertResult, error: projectError } = await supabase
            .from('projects')
            .insert({
                project_name: projectData.project_name,
                owner: projectData.owner,
                start_date: projectData.start_date,
                deadline: projectData.deadline,
                vendor_id: targetVendorId,
                country: projectData.country.toUpperCase(),
                language: (languagesArray[0]?.code || 'EN').toUpperCase(), // Legacy fallback
                total_quantity: projectData.quantity,
                remarks: projectData.remarks || null,
                dripfeed_enabled: projectData.dripfeed_enabled,
                dripfeed_period: projectData.dripfeed_enabled ? projectData.dripfeed_period : null,
                urls_per_day: projectData.dripfeed_enabled ? projectData.urls_per_day : null,
                url_entry_enabled: projectData.url_entry_enabled,
                price: projectData.price || 0,
                price_type: projectData.price_type || 'per_url',
                randomize_languages: projectData.randomize_languages || false,
                status: 'Inprogress',
                created_date: new Date().toISOString()
            })
            .select('id')
            .single();

        if (projectError) {
            console.error('Projects Insert Error:', projectError);
            return { success: false, message: `Failed to create Core Project in database: ${projectError.message}` };
        }

        const projectId = projectInsertResult.id;

        // Helper: roll back the project row if a child insert fails
        const rollbackProject = async () => {
            await supabase.from('projects').delete().eq('id', projectId);
        };

        // 6. Insert Languages into child table (FATAL — roll back project on failure)
        if (languagesArray && languagesArray.length > 0) {
            const languagesToInsert = languagesArray.map(l => ({
                project_id: projectId,
                lang_code: l.code.toUpperCase(),
                ratio: l.ratio
            }));
            const { error: langErr } = await supabase.from('project_languages').insert(languagesToInsert);
            if (langErr) {
                await rollbackProject();
                return { success: false, message: `Failed to insert project languages: ${langErr.message}` };
            }
        }

        // 7. Insert Targets into child table (FATAL — roll back project on failure)
        const targetsToInsert = flattenedTargets.map(t => ({
            project_id: projectId,
            category: t.category || 'NULL',
            anchor_text: t.anchor_text,
            target_url: t.target_url,
            quantity_requested: parseInt(t.quantity, 10),
            sheet_name: t.sheet_name
        }));

        if (targetsToInsert.length > 0) {
            const { error: targetsErr } = await supabase.from('project_targets').insert(targetsToInsert);
            if (targetsErr) {
                await rollbackProject();
                return { success: false, message: `Failed to insert project targets: ${targetsErr.message}` };
            }
        }

        // 8. Provision projects_hub (Hash Tracker + Virtual Targets legacy sync)
        const { error: projectsHubError } = await supabase
            .from('projects_hub')
            .insert({
                project_id: projectId,
                hash: projectHash,
                targets: flattenedTargets, // Keeping legacy JSONB alive here until specific refactor of Vendor Page
                vendor_staging_data: null,
                is_locked: false
            });

        if (projectsHubError) {
            console.error('Projects Hub Insert Error:', projectsHubError);
            return { success: false, message: 'Project mapped, but failed to mint secure Vendor Hub.' };
        }

        return {
            success: true,
            message: 'Complex SEO Kickoff successful.',
            hash: projectHash,
            vendorSlug: vendorSlug
        };

    } catch (error) {
        console.error('Unhandled Kickoff error:', error);
        return { success: false, message: 'An unexpected architectural server error occurred.' };
    }
}
