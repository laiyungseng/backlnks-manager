'use server';

import { normalizeProjectData } from '@/lib/placementProcessor';
import { getServerSupabase } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';


export async function autoCloseHighRiskProjects() {
    const supabase = getServerSupabase();

    // Query SQL view — project_closure_risk boolean is computed in Postgres (>30 days inactive)
    const { data: riskProjects, error } = await supabase
        .from('active_project_risks')
        .select('project_id, vendor_id, project_name, days_silent')
        .eq('project_closure_risk', true);

    if (error) {
        console.error('[AutoClose] Failed to query active_project_risks:', error.message);
        return { success: false, closed: 0 };
    }
    if (!riskProjects?.length) return { success: true, closed: 0 };

    // Group closure-risk projects by vendor
    const vendorMap = {};
    riskProjects.forEach(p => {
        if (!vendorMap[p.vendor_id]) vendorMap[p.vendor_id] = [];
        vendorMap[p.vendor_id].push(p);
    });

    const closedAt = new Date().toISOString();
    const closedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    let totalClosed = 0;

    for (const [vendorId, projects] of Object.entries(vendorMap)) {
        // Get vendor-level risk stats from view (ratio, tier, counts)
        const { data: vendorRisk } = await supabase
            .from('vendor_risk_tiers')
            .select('risk_tier, inactive_ratio, inactive_count, total_projects')
            .eq('vendor_id', vendorId)
            .single();

        const riskTier      = vendorRisk?.risk_tier     || 'POTENTIAL FRAUD — HIGH RISK';
        const inactiveRatio = vendorRisk?.inactive_ratio ?? 100;
        const inactiveCount = vendorRisk?.inactive_count ?? projects.length;
        const totalProjects = vendorRisk?.total_projects ?? projects.length;

        const closeReason = [
            `Auto-closed: Vendor inactivity exceeded 30-day threshold.`,
            `Inactive ratio: ${inactiveRatio}% (${inactiveCount} of ${totalProjects} active projects silent).`,
            `Risk tier: ${riskTier}.`,
            `Auto-closed on: ${closedDate}.`,
        ].join(' ');

        // Close all closure-risk projects for this vendor in one update
        const projectIds = projects.map(p => p.project_id);
        const { error: closeErr } = await supabase
            .from('projects')
            .update({ status: 'Closed', closed_date: closedAt })
            .in('id', projectIds);

        if (closeErr) {
            console.error(`[AutoClose] Failed to close projects for vendor ${vendorId}:`, closeErr.message);
            continue;
        }

        // Update vendor project_status and auto-generated close_reason
        await supabase
            .from('vendors')
            .update({ project_status: riskTier, close_reason: closeReason })
            .eq('id', vendorId);

        totalClosed += projects.length;
    }

    if (totalClosed > 0) {
        revalidatePath('/admin', 'layout');
    }

    return { success: true, closed: totalClosed };
}

export async function finalizeProjectAction(projectHash) {
    if (!projectHash) {
        return { success: false, message: 'Invalid project reference.' };
    }

    // Invoke the Normalization Engine
    const result = await normalizeProjectData(projectHash);

    // Clear entire admin cache tree to instantly update UI
    revalidatePath('/admin', 'layout');

    return result;
}

export async function toggleProjectLockAction(projectHash, newLockState) {
    if (!projectHash) {
        return { success: false, message: 'Invalid project reference.' };
    }

    const supabase = getServerSupabase();
    const { error } = await supabase
        .from('projects_hub')
        .update({ is_locked: newLockState })
        .eq('hash', projectHash);

    if (error) {
        return { success: false, message: `Failed to update lock state: ${error.message}` };
    }

    // Clear entire admin cache tree to instantly update UI
    revalidatePath('/admin', 'layout');

    return {
        success: true,
        message: newLockState ? 'Project locked successfully.' : 'Project unlocked for editing.'
    };
}

export async function closeProjectAction(projectId, vendorId, reason) {
    if (!projectId || !vendorId) {
        return { success: false, message: 'Invalid project or vendor reference.' };
    }

    const supabase = getServerSupabase();

    // Compute vendor-level risk tier using ratio logic:
    // inactive_projects / total_active_projects >= 80% → apply worst tier found
    const { data: projectRows } = await supabase
        .from('projects')
        .select('id, created_date, projects_hub(last_activity_at)')
        .eq('vendor_id', vendorId)
        .not('status', 'in', '("Finalized","Closed")');

    const total = projectRows?.length || 0;
    let inactiveCount = 0;
    let worstRank = 0;

    projectRows?.forEach(p => {
        const lastActivity = p.projects_hub?.[0]?.last_activity_at || p.created_date;
        const days = lastActivity
            ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86400000)
            : 0;
        const rank = days >= 30 ? 3 : days >= 14 ? 2 : days >= 7 ? 1 : 0;
        if (rank > 0) {
            inactiveCount++;
            worstRank = Math.max(worstRank, rank);
        }
    });

    const ratio = total > 0 ? (inactiveCount / total) * 100 : 0;
    const riskTier = ratio >= 80
        ? (worstRank === 3 ? 'POTENTIAL FRAUD — HIGH RISK' : worstRank === 2 ? 'POTENTIAL FRAUD' : 'NO RESPONSE')
        : 'CLOSED';
    const closedAt = new Date().toISOString();

    // Update project status
    const { error: projError } = await supabase
        .from('projects')
        .update({ status: 'Closed', closed_date: closedAt })
        .eq('id', projectId);

    if (projError) {
        return { success: false, message: `Failed to close project: ${projError.message}` };
    }

    // Update vendor project_status and close_reason
    await supabase
        .from('vendors')
        .update({ project_status: riskTier, close_reason: reason || null })
        .eq('id', vendorId);

    revalidatePath('/admin', 'layout');

    return { success: true, message: 'Project closed successfully.', riskTier };
}
