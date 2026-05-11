'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { getSession } from '@/lib/session';
import { revalidatePath } from 'next/cache';

async function requireAdmin() {
    const session = await getSession();
    if (!session?.id) throw new Error('Unauthorized');
    return session;
}

function formatDateOnly(date) {
    const yr = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const dy = String(date.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${dy}`;
}

function addDaysToDateStr(dateStr, days) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + days);
    return formatDateOnly(date);
}

function getDateDurationDays(startDate, deadline) {
    if (!startDate || !deadline) return 0;
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${deadline}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

async function approveProjectSchedule(supabase, projectId, includeProjectApproval = false) {
    const { data: ownPlan, error: ownPlanError } = await supabase
        .from('project_plans')
        .select('campaign_id')
        .eq('project_id', projectId)
        .maybeSingle();
    if (ownPlanError) throw ownPlanError;

    if (!ownPlan?.campaign_id) {
        const updatePayload = includeProjectApproval
            ? { is_approved: true, payment_status: 'approved' }
            : { payment_status: 'approved' };
        const { error } = await supabase.from('projects').update(updatePayload).eq('id', projectId);
        if (error) throw error;
        return [projectId];
    }

    const { data: campaignPlans, error: campaignPlansError } = await supabase
        .from('project_plans')
        .select('project_id, step_order, start_date, end_date')
        .eq('campaign_id', ownPlan.campaign_id)
        .order('step_order', { ascending: true });
    if (campaignPlansError) throw campaignPlansError;

    const projectIds = [...new Set((campaignPlans || []).map(plan => plan.project_id).filter(Boolean))];
    if (projectIds.length === 0) return [];

    const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, start_date, deadline')
        .in('id', projectIds);
    if (projectsError) throw projectsError;
    const projectById = new Map((projects || []).map(project => [project.id, project]));

    let nextStart = formatDateOnly(new Date());
    const touchedIds = [];

    for (const plan of campaignPlans || []) {
        if (!plan.project_id || touchedIds.includes(plan.project_id)) continue;

        const project = projectById.get(plan.project_id) || {};
        const originalStart = project.start_date || plan.start_date;
        const originalDeadline = project.deadline || plan.end_date;
        const durationDays = getDateDurationDays(originalStart, originalDeadline);
        const newDeadline = addDaysToDateStr(nextStart, durationDays);
        const updatePayload = {
            start_date: nextStart,
            deadline: newDeadline,
            payment_status: 'approved'
        };
        if (includeProjectApproval || plan.project_id === projectId) updatePayload.is_approved = true;

        const { error: updateProjectError } = await supabase
            .from('projects')
            .update(updatePayload)
            .eq('id', plan.project_id);
        if (updateProjectError) throw updateProjectError;

        const { error: updatePlanError } = await supabase
            .from('project_plans')
            .update({ start_date: nextStart, end_date: newDeadline })
            .eq('campaign_id', ownPlan.campaign_id)
            .eq('project_id', plan.project_id);
        if (updatePlanError) throw updatePlanError;

        touchedIds.push(plan.project_id);
        nextStart = addDaysToDateStr(newDeadline, 1);
    }

    return touchedIds;
}

export async function deleteProject(projectId) {
    try { await requireAdmin(); } catch { return { success: false, message: 'Unauthorized.' }; }
    if (!projectId) return { success: false, message: 'Project ID is missing.' };

    const supabase = getServerSupabase();
    try {
        // 0.5 Delete from project_languages and project_targets
        const { error: langError } = await supabase.from('project_languages').delete().eq('project_id', projectId);
        if (langError) console.error('Failed to delete languages:', langError);

        const { error: targetsError } = await supabase.from('project_targets').delete().eq('project_id', projectId);
        if (targetsError) console.error('Failed to delete targets:', targetsError);

        // 1. Delete associated placements first to respect foreign key constraints (if any)
        const { error: placementsError } = await supabase
            .from('placements')
            .delete()
            .eq('project_id', projectId);

        if (placementsError) {
            console.error('Failed to delete placements:', placementsError);
            return { success: false, message: 'Failed to delete vendor tasks.' };
        }

        // 1.5 Delete from projects_hub (Explicitly, in case ON DELETE CASCADE is missing)
        const { error: hubError } = await supabase
            .from('projects_hub')
            .delete()
            .eq('project_id', projectId);

        if (hubError) {
            console.error('Failed to delete projects_hub record:', hubError);
            return { success: false, message: 'Failed to delete hub records.' };
        }

        // 2. Delete the project itself
        const { error: projectError } = await supabase
            .from('projects')
            .delete()
            .eq('id', projectId);

        if (projectError) {
            console.error('Failed to delete project:', projectError);
            return { success: false, message: 'Failed to delete project record.' };
        }

        // 3. Revalidate the admin dashboard page so it refreshes immediately
        revalidatePath('/admin', 'layout');

        return { success: true, message: 'Project deleted successfully.' };

    } catch (error) {
        console.error('Server error deleting project:', error);
        return { success: false, message: 'An unexpected error occurred.' };
    }
}

export async function approveProject(projectId) {
    try { await requireAdmin(); } catch { return { success: false, message: 'Unauthorized.' }; }
    if (!projectId) return { success: false, message: 'Project ID is missing.' };

    const supabase = getServerSupabase();
    try {
        const approvedProjectIds = await approveProjectSchedule(supabase, projectId, true);

        revalidatePath('/admin', 'layout');
        return { success: true, message: 'Project approved successfully.', approvedProjectIds };
    } catch (error) {
        console.error('Server error approving project:', error);
        return { success: false, message: 'An unexpected error occurred.' };
    }
}

async function resolveVendor(supabase, vendorName) {
    const { data: existing } = await supabase
        .from('vendors').select('id').eq('vendor_name', vendorName).maybeSingle();
    if (existing) return existing.id;
    const { data: newV, error } = await supabase
        .from('vendors').insert({ vendor_name: vendorName }).select('id').single();
    if (error) throw new Error(`Failed to create vendor: ${error.message}`);
    return newV.id;
}

export async function updateDashboardProjects(projectsArray) {
    try { await requireAdmin(); } catch { return { success: false, message: 'Unauthorized.' }; }
    if (!Array.isArray(projectsArray) || projectsArray.length === 0) return { success: true };

    const supabase = getServerSupabase();
    try {
        for (const p of projectsArray) {
            // Resolve vendor_id if vendor name was edited
            const updatePayload = {
                project_name: p.project_name,
                country: p.country,
                start_date: p.start_date,
                deadline: p.deadline,
                price: parseFloat(p.price || 0),
                price_type: p.price_type
            };

            const editedVendorName = p.vendorNameEdit?.trim();
            const originalVendorName = p.vendors?.vendor_name || '';
            if (editedVendorName && editedVendorName !== originalVendorName) {
                updatePayload.vendor_id = await resolveVendor(supabase, editedVendorName);
            }

            const { error: projError } = await supabase.from('projects')
                .update(updatePayload)
                .eq('id', p.id);
            if (projError) throw projError;

            // Update category mappings if provided
            if (p.categoryUpdates && Object.keys(p.categoryUpdates).length > 0) {
                for (const [oldCategory, newCategory] of Object.entries(p.categoryUpdates)) {
                    if (oldCategory !== newCategory && newCategory && newCategory.trim() !== '') {
                        const { error: catError } = await supabase
                            .from('project_targets')
                            .update({ category: newCategory.trim() })
                            .eq('project_id', p.id)
                            .eq('category', oldCategory);
                        if (catError) throw catError;
                    }
                }
            }
        }

        revalidatePath('/admin', 'layout');
        return { success: true, message: 'Changes saved successfully.' };
    } catch (error) {
        console.error('Server error updating projects:', error);
        return { success: false, message: 'An unexpected error occurred while saving edits.' };
    }
}

export async function approvePaymentAction(projectId) {
    try { await requireAdmin(); } catch { return { success: false, message: 'Unauthorized.' }; }
    if (!projectId) return { success: false, message: 'Project ID missing.' };
    const supabase = getServerSupabase();
    try {
        const approvedProjectIds = await approveProjectSchedule(supabase, projectId);
        revalidatePath('/admin', 'layout');
        return { success: true, approvedProjectIds };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

export async function markPaymentPendingAction(projectId) {
    try { await requireAdmin(); } catch { return { success: false, message: 'Unauthorized.' }; }
    if (!projectId) return { success: false, message: 'Project ID missing.' };
    const supabase = getServerSupabase();
    const { error } = await supabase
        .from('projects')
        .update({ payment_status: 'pending' })
        .eq('id', projectId);
    if (error) return { success: false, message: error.message };
    revalidatePath('/admin', 'layout');
    return { success: true };
}
