'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { vendorRateLimiter } from '@/lib/rateLimiter';
import { writeAuditLog } from '@/lib/auditLog';
import { z } from 'zod';

const vendorPayloadSchema = z.array(z.object({
    id: z.string(),
    target_id: z.string(),
    target_url: z.string(),
    anchor_text: z.string(),
    language: z.string().optional().or(z.literal('')),
    domain_url: z.string().optional().or(z.literal('')),
    published_url: z.string().url('Published URL must be a valid link').or(z.literal('')),
    published_date: z.string().or(z.literal('')),
    remark: z.string().optional().or(z.literal('')),
    indexed_status: z.string().optional().or(z.literal(''))
}));

export async function saveVendorProgress(hash, payload) {
    let supabase;
    try {
        supabase = getServerSupabase();
    } catch {
        return { success: false, message: 'Database connection not configured.' };
    }

    try {
        if (!hash || typeof hash !== 'string') {
            return { success: false, message: 'Unauthorized Request: Missing Security Hash' };
        }

        // Rate-limit per vendor hash
        const rl = vendorRateLimiter.check(hash);
        if (!rl.allowed) {
            return { success: false, message: `Too many save requests. Try again in ${rl.retryAfterSeconds}s.` };
        }

        const validatedData = vendorPayloadSchema.safeParse(payload);
        if (!validatedData.success) {
            return { success: false, message: 'Validation Error: Please ensure all provided URLs are valid format.' };
        }

        const validRows = validatedData.data;

        // Verify the project exists for this hash AND check lock status
        const { data: projectList, error: checkError } = await supabase
            .from('projects_hub')
            .select('id, project_id, is_locked')
            .eq('hash', hash)
            .single();

        if (checkError || !projectList) {
            return { success: false, message: 'Project context lost. Save Rejected.' };
        }

        // Server-side lock enforcement — UI lock is not enough
        if (projectList.is_locked) {
            return { success: false, message: 'This project has been locked and can no longer be edited.' };
        }

        // Optimization 1: Track strict completed_at timing
        const totalQuantity = validRows.length;
        const completedCount = validRows.filter(p =>
            p.published_url && p.published_url.trim().length > 0 &&
            p.published_date && p.published_date.trim().length > 0
        ).length;

        const updatePayload = { vendor_staging_data: validRows };
        if (completedCount === totalQuantity && totalQuantity > 0) {
            updatePayload.completed_at = new Date().toISOString();
        }

        const { error: updateError } = await supabase
            .from('projects_hub')
            .update(updatePayload)
            .eq('hash', hash);

        if (updateError) {
            console.error("Staging Data Update Error:", updateError);
            return { success: false, message: 'Supabase blocked staging push.' };
        }

        // Audit log the save
        await writeAuditLog(supabase, {
            action: 'vendor_save',
            targetId: projectList.project_id,
            detail: `hash=${hash} rows=${validRows.length} completed=${completedCount}`,
        });

        // --- STATUS CALCULATION ---
        const targetProjectId = projectList.project_id;
        if (targetProjectId) {
            const { data: targetsData } = await supabase
                .from('project_targets')
                .select('quantity_requested')
                .eq('project_id', targetProjectId);

            const hubTargets = targetsData || [];
            const totalLinksOrdered = hubTargets.length > 0
                ? hubTargets.reduce((acc, t) => acc + (t.quantity_requested || 0), 0)
                : completedCount;

            const newStatus = completedCount >= totalLinksOrdered && totalLinksOrdered > 0 ? 'Completed' : 'Inprogress';

            const { data: proj } = await supabase
                .from('projects')
                .select('status, completed_date')
                .eq('id', targetProjectId)
                .single();

            if (proj) {
                const isFinalized = proj.status === 'Finalized';
                const dbUpdatePayload = {};

                if (!isFinalized) {
                    dbUpdatePayload.status = newStatus;
                    if (newStatus === 'Completed' && !proj.completed_date) {
                        dbUpdatePayload.completed_date = new Date().toISOString();
                    }
                }

                if (Object.keys(dbUpdatePayload).length > 0) {
                    await supabase.from('projects').update(dbUpdatePayload).eq('id', targetProjectId);
                }

                // SYNC COMPLETED PLACEMENTS
                if (isFinalized) {
                    const nowIso = new Date().toISOString();
                    let syncSuccessCount = 0;

                    for (const row of validRows) {
                        if (row.published_url && row.published_url.trim() !== '') {
                            let normalizedIndexedStatus = null;
                            if (row.indexed_status) {
                                const l = row.indexed_status.toLowerCase().trim();
                                if (l.includes('not')) normalizedIndexedStatus = 'page_not_indexed';
                                else if (l.includes('index')) normalizedIndexedStatus = 'page_indexed';
                            }

                            const { data, error } = await supabase
                                .from('placements')
                                .update({
                                    indexed_status: normalizedIndexedStatus,
                                    notes: row.remark || null,
                                    last_vendor_update_at: nowIso
                                })
                                .eq('vendor_token', hash)
                                .eq('published_url', row.published_url)
                                .select('id');

                            if (error) {
                                console.error(`[saveVendorProgress] Sync Error for ${row.published_url}:`, error);
                            } else if (data?.length) {
                                syncSuccessCount += data.length;
                            }
                        }
                    }
                    console.log(`[saveVendorProgress] Sync Complete. Updated ${syncSuccessCount} matching placements.`);
                }
            }
        }

        return { success: true, message: 'All placements saved directly into Virtual Staging successfully!' };

    } catch (e) {
        console.error("Vendor Action Critical Error:", e);
        return { success: false, message: 'An unexpected server error occurred during JSON serialization.' };
    }
}

export async function toggleUrlEntryMode(hash, isEnabled) {
    let supabase;
    try {
        supabase = getServerSupabase();
    } catch {
        return { success: false, message: 'Database connection not configured.' };
    }

    try {
        if (!hash || typeof hash !== 'string') {
            return { success: false, message: 'Unauthorized Request: Missing Security Hash' };
        }

        const { data: projectList, error: checkError } = await supabase
            .from('projects_hub')
            .select('project_id, is_locked')
            .eq('hash', hash)
            .single();

        if (checkError || !projectList) {
            return { success: false, message: 'Project context lost. Action Rejected.' };
        }

        if (projectList.is_locked) {
            return { success: false, message: 'This project is locked.' };
        }

        const { error: updateError } = await supabase
            .from('projects')
            .update({ url_entry_enabled: isEnabled })
            .eq('id', projectList.project_id);

        if (updateError) {
            console.error("Toggle URL Entry Error:", updateError);
            return { success: false, message: 'Could not toggle URL entry.' };
        }

        return { success: true };

    } catch (e) {
        console.error("Toggle URL Entry Critical Error:", e);
        return { success: false, message: 'An unexpected error occurred.' };
    }
}
