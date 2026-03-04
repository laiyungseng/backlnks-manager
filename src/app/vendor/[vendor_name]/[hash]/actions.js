'use server';

import { supabase } from '@/lib/supabase';
import { z } from 'zod';

const vendorPayloadSchema = z.array(z.object({
    id: z.string(),
    target_id: z.string(),
    target_url: z.string(),
    anchor_text: z.string(),
    language: z.string().optional().or(z.literal('')),
    published_url: z.string().url('Published URL must be a valid link').or(z.literal('')),
    published_date: z.string().or(z.literal('')),
    remark: z.string().optional().or(z.literal('')),
    indexed_status: z.string().optional().or(z.literal(''))
}));

export async function saveVendorProgress(hash, payload) {
    if (!supabase) {
        return { success: false, message: 'Database connection not configured.' };
    }

    try {
        if (!hash || typeof hash !== 'string') {
            return { success: false, message: 'Unauthorized Request: Missing Security Hash' };
        }

        const validatedData = vendorPayloadSchema.safeParse(payload);
        if (!validatedData.success) {
            return { success: false, message: 'Validation Error: Please ensure all provided URLs are valid format.' };
        }

        const validRows = validatedData.data;

        // Verify the Project exists matching that hash before pushing JSON payload
        const { data: projectList, error: checkError } = await supabase
            .from('projects_hub')
            .select('id, project_id')
            .eq('hash', hash)
            .single();

        if (checkError || !projectList) {
            return { success: false, message: 'Project context lost. Save Rejected.' };
        }

        // Optimization 1: Track strict completed_at timing
        const totalQuantity = validRows.length;
        const completedCount = validRows.filter(p => p.published_url && p.published_url.trim().length > 0 && p.published_date && p.published_date.trim().length > 0).length;

        const updatePayload = {
            vendor_staging_data: validRows
        };

        if (completedCount === totalQuantity && totalQuantity > 0) {
            updatePayload.completed_at = new Date().toISOString();
        }

        // Push precisely the virtual JSON array into the staging column
        const { error: updateError } = await supabase
            .from('projects_hub')
            .update(updatePayload)
            .eq('hash', hash);

        if (updateError) {
            console.error("Staging Data Update Error:", updateError);
            return { success: false, message: 'Supabase blocked staging push.' };
        }

        // --- WORKFLOW 3 REWORK: STATUS CALCULATION ON VIRTUAL JSON ---
        const targetProjectId = projectList.project_id;
        if (targetProjectId) {
            const newStatus = completedCount === totalQuantity ? 'Completed' : 'Inprogress';

            await supabase
                .from('projects')
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', targetProjectId);
        }

        return {
            success: true,
            message: 'All placements saved directly into Virtual Staging successfully!'
        };

    } catch (e) {
        console.error("Vendor Action Critical Error:", e);
        return { success: false, message: 'An unexpected server error occurred during JSON serialization.' };
    }
}
