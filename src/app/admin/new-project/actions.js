'use server';

import { supabase } from '@/lib/supabase';
import { projectSchema } from '@/schemas/projectSchema';
import crypto from 'crypto';

export async function createProjectAction(prevState, formData) {
    try {
        const rawData = {
            project_name: formData.get('project_name'),
            owner: formData.get('owner'),
            start_date: formData.get('start_date'),
            deadline: formData.get('deadline'),
            vendor_name: formData.get('vendor_name'),
            country: formData.get('country'),
            language: formData.get('language'),
            targets_json: formData.get('targets_json'),
            backlinks_category: formData.get('backlinks_category'),
            sheet_name: formData.get('sheet_name') || null,
            quantity: formData.get('quantity'),
            remarks: formData.get('remarks') || '',
            dripfeed_enabled: formData.has('dripfeed_enabled'),
            dripfeed_period: formData.get('dripfeed_period') || null,
            urls_per_day: formData.get('urls_per_day') || null,
        };

        // 1. Strict Validation
        const validatedData = projectSchema.safeParse(rawData);

        if (!validatedData.success) {
            return {
                success: false,
                errors: validatedData.error.flatten().fieldErrors,
                message: 'Validation failed. Please check the dynamic row quantities.'
            };
        }

        const projectData = validatedData.data;
        const targetsArray = projectData.targets_json;

        const sumOfTargets = targetsArray.reduce((acc, row) => acc + row.quantity, 0);
        if (sumOfTargets !== projectData.quantity) {
            return {
                success: false,
                message: `Validation Error: Target sub-quantities (${sumOfTargets}) do not match Master Quantity (${projectData.quantity}).`
            };
        }

        // 2. Generate secure crypt-hash for Vendor allocation URL
        const rawString = `${projectData.project_name}-${Date.now()}-${Math.random()}`;
        const projectHash = crypto.createHash('sha256').update(rawString).digest('hex');

        // 3. Insert Master Project
        const { data: projectInsertResult, error: projectError } = await supabase
            .from('projects')
            .insert([
                {
                    project_name: projectData.project_name,
                    owner: projectData.owner,
                    start_date: projectData.start_date,
                    deadline: projectData.deadline,
                    vendor_name: projectData.vendor_name,
                    // target_url and anchor_text logically dropped, 
                    // replaced by country and language
                    country: projectData.country.toUpperCase(),
                    language: projectData.language.toUpperCase(),
                    backlinks_category: projectData.backlinks_category,
                    sheet_name: projectData.sheet_name || null,
                    quantity: projectData.quantity,
                    remarks: projectData.remarks,
                    dripfeed_enabled: projectData.dripfeed_enabled,
                    dripfeed_period: projectData.dripfeed_enabled && projectData.dripfeed_period ? parseInt(projectData.dripfeed_period) : null,
                    urls_per_day: projectData.dripfeed_enabled && projectData.urls_per_day ? parseInt(projectData.urls_per_day) : null,
                    status: 'Inprogress',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }
            ])
            .select()
            .single();

        if (projectError) {
            console.error('Projects Insert Error:', projectError);
            return { success: false, message: 'Failed to create Core Project in database. Have you run the Schema Migrations?' };
        }

        const projectId = projectInsertResult.id;

        // 4. Provision project_list (Hash Tracker / Virtual Hub)
        const { error: projectListError } = await supabase
            .from('project_list')
            .insert([{
                project_id: projectId,
                hash: projectHash,
                vendor_staging_data: null, // Initially blank
                created_at: new Date().toISOString()
            }]);

        if (projectListError) {
            console.error('Project List Insert Error:', projectListError);
            return { success: false, message: 'Project created, but failed to mint secure Vendor Hash.' };
        }

        // 5. Bulk Insert Dynamic Targets Array matching `project_id`
        const targetRowsMapping = targetsArray.map(target => ({
            project_id: projectId,
            anchor_text: target.anchor_text,
            target_url: target.target_url,
            quantity: target.quantity,
            created_at: new Date().toISOString()
        }));

        const { error: projectTargetsError } = await supabase
            .from('project_targets')
            .insert(targetRowsMapping);

        if (projectTargetsError) {
            console.error('Project Targets Error:', projectTargetsError);
            return { success: false, message: 'Project mapped, but failed to explicitly allocate placement targets.' };
        }

        return {
            success: true,
            message: 'Complex SEO Kickoff successful.',
            hash: projectHash
        };

    } catch (error) {
        console.error('Unhandled Kickoff error:', error);
        return { success: false, message: 'An unexpected architectural server error occurred.' };
    }
}
