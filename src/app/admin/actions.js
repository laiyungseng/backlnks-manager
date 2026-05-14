'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { getSession } from '@/lib/session';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';

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

async function approveSinglePlan(supabase, projectId) {
    const { error } = await supabase
        .from('projects')
        .update({ is_approved: true })
        .eq('id', projectId);
    if (error) throw error;
    return [projectId];
}

async function payAndShiftSinglePlan(supabase, projectId) {
    const { data: targetProject, error: targetError } = await supabase
        .from('projects')
        .select('id, start_date, deadline, dripfeed_enabled, dripfeed_period')
        .eq('id', projectId)
        .single();
    if (targetError) throw targetError;

    const { data: ownPlan, error: ownPlanError } = await supabase
        .from('project_plans')
        .select('campaign_id')
        .eq('project_id', projectId)
        .maybeSingle();
    if (ownPlanError) throw ownPlanError;

    let latestPaidEnd = null;
    if (ownPlan?.campaign_id) {
        const { data: campaignPlans, error: campaignPlansError } = await supabase
            .from('project_plans')
            .select('project_id')
            .eq('campaign_id', ownPlan.campaign_id);
        if (campaignPlansError) throw campaignPlansError;

        const siblingIds = [...new Set((campaignPlans || [])
            .map(plan => plan.project_id)
            .filter(id => id && id !== projectId))];

        if (siblingIds.length) {
            const { data: paidSiblings, error: siblingsError } = await supabase
                .from('projects')
                .select('deadline')
                .in('id', siblingIds)
                .eq('payment_status', 'approved');
            if (siblingsError) throw siblingsError;
            for (const sibling of paidSiblings || []) {
                if (sibling.deadline && (!latestPaidEnd || sibling.deadline > latestPaidEnd)) {
                    latestPaidEnd = sibling.deadline;
                }
            }
        }
    }

    const todayStr = formatDateOnly(new Date());
    const chainedStart = latestPaidEnd ? addDaysToDateStr(latestPaidEnd, 1) : todayStr;
    const newStart = chainedStart > todayStr ? chainedStart : todayStr;

    const durationDays = targetProject.dripfeed_enabled && Number(targetProject.dripfeed_period) > 0
        ? Number(targetProject.dripfeed_period)
        : getDateDurationDays(targetProject.start_date, targetProject.deadline);
    const newDeadline = addDaysToDateStr(newStart, durationDays);

    const { error: updateProjectError } = await supabase
        .from('projects')
        .update({
            payment_status: 'approved',
            start_date: newStart,
            deadline: newDeadline,
        })
        .eq('id', projectId);
    if (updateProjectError) throw updateProjectError;

    if (ownPlan?.campaign_id) {
        const { error: updatePlanError } = await supabase
            .from('project_plans')
            .update({ start_date: newStart, end_date: newDeadline })
            .eq('campaign_id', ownPlan.campaign_id)
            .eq('project_id', projectId);
        if (updatePlanError) throw updatePlanError;
    }

    return { approvedProjectIds: [projectId], newStart, newDeadline };
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
        const approvedProjectIds = await approveSinglePlan(supabase, projectId);

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

function normalizeDateInput(value) {
    return value ? String(value).substring(0, 10) : null;
}

function computePlanTotal(groups) {
    return (groups || []).reduce((acc, group) =>
        acc + (group.placement_target || []).reduce((sum, target) => sum + (parseInt(target.ratio || '0', 10) || 0), 0), 0);
}

function flattenPlanTargets(groups) {
    const targets = [];
    (groups || []).forEach(group => {
        (group.placement_target || []).forEach(target => {
            const quantity = parseInt(target.ratio || '0', 10) || 0;
            if (!target.target_url && !target.anchor_text && quantity <= 0) return;
            targets.push({
                anchor_text: target.anchor_text || '',
                target_url: target.target_url || '',
                quantity: String(quantity),
                category: group.category || 'NULL',
                sheet_name: group.sheet_name || null,
                created_at: new Date().toISOString()
            });
        });
    });
    return targets;
}

async function fetchProjectDetailsRow(supabase, projectId) {
    const { data, error } = await supabase
        .from('projects')
        .select(`
            id, owner, created_date, completed_date,
            project_name, country, total_quantity,
            status, is_approved, start_date, deadline, price, price_type,
            dripfeed_enabled, dripfeed_period, urls_per_day, payment_status,
            vendors ( vendor_name ),
            projects_hub ( targets, vendor_staging_data ),
            placements ( id ),
            project_languages ( lang_code, ratio ),
            project_targets ( category, sheet_name ),
            project_plans ( id, campaign_id, step_order, category, plan_info, created_at, start_date, end_date, total_quantity )
        `)
        .eq('id', projectId)
        .single();
    if (error) throw error;
    return data;
}

export async function addPlanToCampaignAction(campaignId, planPayload) {
    try { await requireAdmin(); } catch { return { success: false, message: 'Unauthorized.' }; }
    if (!campaignId) return { success: false, message: 'Campaign ID is missing.' };
    if (!planPayload || typeof planPayload !== 'object') return { success: false, message: 'Plan payload is missing.' };

    const supabase = getServerSupabase();
    let projectId = null;

    try {
        const { data: campaign, error: campaignError } = await supabase
            .from('project_campaigns')
            .select('id, title, person_in_charge, client_name')
            .eq('id', campaignId)
            .single();
        if (campaignError || !campaign) throw new Error('Campaign not found.');

        const vendorName = planPayload.vendor_name?.trim();
        if (!vendorName) return { success: false, message: 'Vendor name is required.' };

        const groups = Array.isArray(planPayload.project_info_groups) ? planPayload.project_info_groups : [];
        const flattenedTargets = flattenPlanTargets(groups);
        if (flattenedTargets.length === 0) return { success: false, message: 'At least one target row is required.' };

        const totalQuantity = computePlanTotal(groups);
        if (totalQuantity <= 0) return { success: false, message: 'Plan quantity must be greater than zero.' };

        const languages = Array.isArray(planPayload.languages) ? planPayload.languages : [];
        const validLanguages = languages
            .map(lang => ({ code: (lang.code || '').trim().toUpperCase(), ratio: parseInt(lang.ratio || '0', 10) || 0 }))
            .filter(lang => lang.code && lang.ratio > 0);

        const vendorId = await resolveVendor(supabase, vendorName);
        const startDate = normalizeDateInput(planPayload.start_date);
        const deadline = normalizeDateInput(planPayload.deadline);
        const activateImmediately = !!planPayload.activate_immediately;
        const projectHash = crypto.randomBytes(32).toString('hex');

        const { data: existingPlans, error: existingPlansError } = await supabase
            .from('project_plans')
            .select('step_order')
            .eq('campaign_id', campaignId);
        if (existingPlansError) throw existingPlansError;
        const nextStepOrder = (existingPlans || []).reduce((max, plan) => Math.max(max, plan.step_order ?? 0), -1) + 1;

        const { data: project, error: projectError } = await supabase
            .from('projects')
            .insert({
                project_name: campaign.title,
                owner: campaign.person_in_charge || '',
                start_date: startDate,
                deadline,
                vendor_id: vendorId,
                country: (planPayload.country || 'GLOBAL').toUpperCase(),
                language: validLanguages[0]?.code || 'EN',
                total_quantity: totalQuantity,
                remarks: planPayload.remarks || null,
                dripfeed_enabled: !!planPayload.dripfeed_enabled,
                dripfeed_period: planPayload.dripfeed_enabled ? (planPayload.dripfeed_period || null) : null,
                urls_per_day: planPayload.dripfeed_enabled ? (parseInt(planPayload.urls_per_day || '0', 10) || null) : null,
                url_entry_enabled: false,
                price: parseFloat(planPayload.price || 0) || 0,
                price_type: planPayload.price_type || 'per_url',
                package_id: null,
                randomize_languages: !!planPayload.randomize_languages,
                status: 'Inprogress',
                is_approved: activateImmediately,
                payment_status: activateImmediately ? 'approved' : 'pending',
                created_date: new Date().toISOString(),
                client_name: campaign.client_name || null
            })
            .select('id')
            .single();
        if (projectError) throw new Error(`Project insert failed: ${projectError.message}`);
        projectId = project.id;

        const rollback = async () => {
            if (!projectId) return;
            await supabase.from('project_languages').delete().eq('project_id', projectId);
            await supabase.from('project_targets').delete().eq('project_id', projectId);
            await supabase.from('projects_hub').delete().eq('project_id', projectId);
            await supabase.from('project_plans').delete().eq('project_id', projectId);
            await supabase.from('projects').delete().eq('id', projectId);
        };

        if (validLanguages.length > 0) {
            const { error: languageError } = await supabase.from('project_languages').insert(
                validLanguages.map(lang => ({ project_id: projectId, lang_code: lang.code, ratio: lang.ratio }))
            );
            if (languageError) { await rollback(); throw new Error(`Languages insert failed: ${languageError.message}`); }
        }

        const { error: targetError } = await supabase.from('project_targets').insert(
            flattenedTargets.map(target => ({
                project_id: projectId,
                category: target.category || 'NULL',
                anchor_text: target.anchor_text,
                target_url: target.target_url,
                quantity_requested: parseInt(target.quantity, 10),
                sheet_name: target.sheet_name
            }))
        );
        if (targetError) { await rollback(); throw new Error(`Targets insert failed: ${targetError.message}`); }

        const { error: hubError } = await supabase.from('projects_hub').insert({
            project_id: projectId,
            hash: projectHash,
            targets: flattenedTargets,
            vendor_staging_data: null,
            is_locked: false
        });
        if (hubError) { await rollback(); throw new Error(`Hub insert failed: ${hubError.message}`); }

        const planRows = groups.map((group, idx) => ({
            campaign_id: campaignId,
            project_id: projectId,
            step_order: nextStepOrder + idx,
            category: group.category || null,
            plan_info: group.sheet_name || null,
            vendor_id: vendorId,
            country: (planPayload.country || 'GLOBAL').toUpperCase(),
            start_date: startDate,
            end_date: deadline,
            dripfeed_enabled: !!planPayload.dripfeed_enabled,
            dripfeed_period: planPayload.dripfeed_enabled ? String(planPayload.dripfeed_period || '') : null,
            links_per_day: planPayload.dripfeed_enabled ? (parseInt(planPayload.urls_per_day || '0', 10) || null) : null,
            total_quantity: (group.placement_target || []).reduce((sum, target) => sum + (parseInt(target.ratio || '0', 10) || 0), 0)
        }));

        const { error: planError } = await supabase.from('project_plans').insert(planRows);
        if (planError) { await rollback(); throw new Error(`Plan link insert failed: ${planError.message}`); }

        const hydratedProject = await fetchProjectDetailsRow(supabase, projectId);

        revalidatePath('/admin', 'layout');
        revalidatePath('/admin/projects');
        revalidatePath('/admin/placements');
        revalidatePath('/admin/completed');

        return {
            success: true,
            message: activateImmediately ? 'Plan added and activated.' : 'Plan added as pending.',
            project: hydratedProject
        };
    } catch (error) {
        console.error('Server error adding campaign plan:', error);
        return { success: false, message: error.message || 'An unexpected error occurred while adding the plan.' };
    }
}

export async function updateDashboardProjects(projectsArray) {
    try { await requireAdmin(); } catch { return { success: false, message: 'Unauthorized.' }; }
    if (!Array.isArray(projectsArray) || projectsArray.length === 0) return { success: true };
    const projectsToUpdate = projectsArray.filter(p => p?.id);
    if (projectsToUpdate.length === 0) return { success: true };

    const supabase = getServerSupabase();
    try {
        for (const p of projectsToUpdate) {
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
        return { success: true, message: `${projectsToUpdate.length} project update${projectsToUpdate.length === 1 ? '' : 's'} saved successfully.` };
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
        const result = await payAndShiftSinglePlan(supabase, projectId);
        revalidatePath('/admin', 'layout');
        return {
            success: true,
            approvedProjectIds: result.approvedProjectIds,
            newStart: result.newStart,
            newDeadline: result.newDeadline,
        };
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
