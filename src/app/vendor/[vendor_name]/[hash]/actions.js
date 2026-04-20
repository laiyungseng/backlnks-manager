'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { vendorRateLimiter } from '@/lib/rateLimiter';
import { writeAuditLog } from '@/lib/auditLog';
import { setVendorSessionCookie, getVendorSession, verifyVendorSession } from '@/lib/session';
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
    indexed_status: z.string().optional().or(z.literal('')),
    indexed_datetime: z.string().optional().or(z.literal(''))
}));

const syncIndexPayloadSchema = z.array(z.object({
    published_url: z.string().url('Published URL must be a valid link').or(z.literal('')),
    indexed_status: z.string().optional().or(z.literal('')),
    indexed_datetime: z.string().optional().or(z.literal('')),
    remark: z.string().optional().or(z.literal(''))
}));

/**
 * Called from VendorSessionSetter client component on hash page mount.
 * Validates the hash, resolves vendor_id, sets a signed vendor session cookie.
 */
export async function establishVendorSession(hash) {
    let supabase;
    try { supabase = getServerSupabase(); } catch { return { success: false }; }

    if (!hash || typeof hash !== 'string') return { success: false };

    const { data: hub } = await supabase
        .from('projects_hub')
        .select('project_id')
        .eq('hash', hash)
        .single();

    if (!hub?.project_id) return { success: false };

    const { data: project } = await supabase
        .from('projects')
        .select('vendor_id')
        .eq('id', hub.project_id)
        .single();

    if (!project?.vendor_id) return { success: false };

    const { data: vendor } = await supabase
        .from('vendors')
        .select('session_version')
        .eq('id', project.vendor_id)
        .maybeSingle();

    await setVendorSessionCookie(project.vendor_id, vendor?.session_version ?? 1);
    return { success: true };
}

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

        // Session guard — verify cookie + DB session_version (revocation check)
        const session = await verifyVendorSession(supabase);
        if (!session?.vendorId) {
            return { success: false, message: 'Unauthorized: No active vendor session.' };
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
            .select('id, project_id, is_locked, vendor_staging_data, projects(vendor_id)')
            .eq('hash', hash)
            .single();

        if (checkError || !projectList) {
            return { success: false, message: 'Project context lost. Save Rejected.' };
        }

        // Verify session vendor matches the project's vendor
        if (projectList.projects?.vendor_id !== session.vendorId) {
            return { success: false, message: 'Unauthorized: Session does not match project vendor.' };
        }

        // Server-side lock enforcement — UI lock is not enough
        if (projectList.is_locked) {
            return { success: false, message: 'This project has been locked and can no longer be edited.' };
        }

        // --- DELETION DIFF TRACKING ---
        const oldStaging = Array.isArray(projectList.vendor_staging_data) ? projectList.vendor_staging_data : [];
        const trackedFields = ['published_url', 'published_date', 'domain_url', 'remark', 'indexed_status', 'indexed_datetime'];
        const deletions = [];

        for (const newRow of validRows) {
            const oldRow = oldStaging.find(o => o.id === newRow.id);
            if (!oldRow) continue;
            for (const field of trackedFields) {
                const oldVal = oldRow[field];
                const newVal = newRow[field];
                const wasSet = oldVal !== undefined && oldVal !== null && String(oldVal).trim() !== '';
                const nowEmpty = !newVal || String(newVal).trim() === '';
                if (wasSet && nowEmpty) {
                    deletions.push({ rowId: newRow.id, field, oldValue: String(oldVal).slice(0, 200) });
                }
            }
        }

        if (deletions.length > 0) {
            await writeAuditLog(supabase, {
                action: 'vendor_data_deletion',
                actorId: session.vendorId,
                targetId: projectList.project_id,
                detail: `${deletions.length} field(s) cleared`,
                meta: { deletions },
            });
        }

        const completedCount = validRows.filter(p =>
            p.published_url && p.published_url.trim().length > 0 &&
            p.published_date && p.published_date.trim().length > 0
        ).length;

        // --- STATUS CALCULATION ---
        const targetProjectId = projectList.project_id;

        // Fetch authoritative total from project_targets (used for both completed_at and status)
        const { data: targetsData } = await supabase
            .from('project_targets')
            .select('quantity_requested')
            .eq('project_id', targetProjectId);

        const hubTargets = targetsData || [];
        const totalLinksOrdered = hubTargets.length > 0
            ? hubTargets.reduce((acc, t) => acc + (t.quantity_requested || 0), 0)
            : validRows.length;

        const updatePayload = { vendor_staging_data: validRows };
        if (completedCount >= totalLinksOrdered && totalLinksOrdered > 0) {
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
            actorId: session.vendorId,
            targetId: projectList.project_id,
            detail: `rows=${validRows.length} completed=${completedCount}`,
        });

        if (targetProjectId) {
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

                // SYNC TO PLACEMENTS: if Finalized, write indexed_status directly to placements table
                // This handles the case where the admin has unlocked the project for vendor edits
                if (isFinalized) {
                    const nowIso = new Date().toISOString();
                    let syncSuccessCount = 0;
                    const syncErrors = [];

                    for (const row of validRows) {
                        if (!row.published_url || row.published_url.trim() === '') continue;

                        let normalizedIndexedStatus = null;
                        if (row.indexed_status) {
                            const l = row.indexed_status.toLowerCase().trim();
                            if (l.includes('not')) normalizedIndexedStatus = 'page_not_indexed';
                            else if (l.includes('index')) normalizedIndexedStatus = 'page_indexed';
                        }

                        const { data: syncData, error: syncError } = await supabase
                            .from('placements')
                            .update({
                                indexed_status: normalizedIndexedStatus,
                                indexed_checked_at: row.indexed_datetime || null,
                                notes: row.remark || null,
                                last_vendor_update_at: nowIso
                            })
                            .eq('vendor_token', hash)
                            .eq('published_url', row.published_url)
                            .select('id');

                        if (syncError) {
                            console.error(`[saveVendorProgress] Sync Error for ${row.published_url}:`, syncError);
                            syncErrors.push(row.published_url);
                        } else if (!syncData?.length) {
                            console.warn(`[saveVendorProgress] No placement matched for ${row.published_url}`);
                            syncErrors.push(row.published_url);
                        } else {
                            syncSuccessCount += syncData.length;
                        }
                    }

                    if (syncErrors.length > 0) {
                        return { success: false, message: `Placements sync failed for ${syncErrors.length} row(s). Staging was saved.` };
                    }
                    console.log(`[saveVendorProgress] Finalized sync complete. Updated ${syncSuccessCount} placements.`);
                }
            }
        }

        return { success: true, message: 'All placements saved directly into Virtual Staging successfully!' };

    } catch (e) {
        console.error("Vendor Action Critical Error:", e);
        return { success: false, message: 'An unexpected server error occurred during JSON serialization.' };
    }
}

/**
 * syncFinalizedIndexStatus — Bypasses the lock check intentionally.
 * Called ONLY when the project is finalized/locked and the vendor is
 * updating indexed_status or remarks on already-committed placements.
 * Does NOT touch projects_hub staging data — writes directly to `placements`.
 */
export async function syncFinalizedIndexStatus(hash, payload) {
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

        // Session guard — verify cookie + DB session_version (revocation check)
        const session = await verifyVendorSession(supabase);
        if (!session?.vendorId) {
            return { success: false, message: 'Unauthorized: No active vendor session.' };
        }

        // Verify the project exists and IS finalized (lock must be true)
        const { data: projectList, error: checkError } = await supabase
            .from('projects_hub')
            .select('id, project_id, is_locked, projects(vendor_id)')
            .eq('hash', hash)
            .single();

        if (checkError || !projectList) {
            return { success: false, message: 'Project context lost. Sync Rejected.' };
        }

        // Verify session vendor matches the project's vendor
        if (projectList.projects?.vendor_id !== session.vendorId) {
            return { success: false, message: 'Unauthorized: Session does not match project vendor.' };
        }

        // Validate payload with Zod before any DB writes
        const validatedSync = syncIndexPayloadSchema.safeParse(payload);
        if (!validatedSync.success) {
            return { success: false, message: 'Validation Error: Invalid payload format.' };
        }
        const validSyncRows = validatedSync.data;

        // This action is for finalized projects — validates against project status, not is_locked
        // (Admin may have unlocked the hub row to allow edits, but the project itself remains Finalized)
        const { data: projectData } = await supabase
            .from('projects')
            .select('status')
            .eq('id', projectList.project_id)
            .single();

        if (!projectData || projectData.status !== 'Finalized') {
            return { success: false, message: 'Project is not finalized. Use the standard save instead.' };
        }

        const nowIso = new Date().toISOString();
        let syncSuccessCount = 0;
        const errors = [];

        for (const row of validSyncRows) {
            if (!row.published_url || row.published_url.trim() === '') continue;

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
                    indexed_checked_at: row.indexed_datetime || null,
                    notes: row.remark || null,
                    last_vendor_update_at: nowIso
                })
                .eq('vendor_token', hash)
                .eq('published_url', row.published_url)
                .select('id');

            if (error) {
                console.error(`[syncFinalizedIndexStatus] Error for ${row.published_url}:`, error);
                errors.push(row.published_url);
            } else if (data?.length) {
                syncSuccessCount += data.length;
            }
        }

        await writeAuditLog(supabase, {
            action: 'vendor_finalized_sync',
            targetId: projectList.project_id,
            detail: `synced=${syncSuccessCount} errors=${errors.length}`,
        });

        if (errors.length > 0) {
            return { success: false, message: `Sync partially failed for ${errors.length} row(s). Please retry.` };
        }

        return { success: true, message: `Indexed status synced for ${syncSuccessCount} placement(s).` };

    } catch (e) {
        console.error("syncFinalizedIndexStatus Critical Error:", e);
        return { success: false, message: 'An unexpected server error occurred.' };
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

        // Session guard — verify cookie + DB session_version (revocation check)
        const session = await verifyVendorSession(supabase);
        if (!session?.vendorId) {
            return { success: false, message: 'Unauthorized: No active vendor session.' };
        }

        const { data: projectList, error: checkError } = await supabase
            .from('projects_hub')
            .select('project_id, is_locked, projects(vendor_id)')
            .eq('hash', hash)
            .single();

        if (checkError || !projectList) {
            return { success: false, message: 'Project context lost. Action Rejected.' };
        }

        // Verify session vendor matches the project's vendor
        if (projectList.projects?.vendor_id !== session.vendorId) {
            return { success: false, message: 'Unauthorized: Session does not match project vendor.' };
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
