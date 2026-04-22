'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { getSession } from '@/lib/session';

async function requireAdmin() {
    const session = await getSession();
    if (!session?.id) throw new Error('Unauthorized');
    return session;
}

export async function getVendorList() {
    try { await requireAdmin(); } catch { return { success: false, message: 'Unauthorized.' }; }
    const supabase = getServerSupabase();
    const { data, error } = await supabase
        .from('vendors')
        .select('id, vendor_name, employ_status')
        .order('vendor_name');
    if (error) return { success: false, message: error.message };
    return { success: true, vendors: data || [] };
}

export async function getVendorStats(vendorId) {
    try { await requireAdmin(); } catch { return { success: false, message: 'Unauthorized.' }; }
    const supabase = getServerSupabase();

    let placQ = supabase
        .from('placements')
        .select('id, project_id, domain_id, category, anchor_text, status, indexed_status');
    let projQ = supabase
        .from('projects')
        .select('id, vendor_id, start_date, completed_date, price, price_type, total_quantity, status');

    if (vendorId) {
        placQ = placQ.eq('vendor_id', vendorId);
        projQ = projQ.eq('vendor_id', vendorId);
    }

    const [placResult, projResult, vendorResult] = await Promise.all([
        placQ,
        projQ,
        supabase.from('vendors').select('id, employ_status'),
    ]);

    if (placResult.error || projResult.error || vendorResult.error) {
        return { success: false, message: 'Failed to fetch analytics data.' };
    }

    const placements = placResult.data || [];
    const projects = projResult.data || [];
    const allVendors = vendorResult.data || [];

    // Count in-progress staging rows (projects not yet finalized → rows still in vendor_staging_data)
    const inProgressIds = projects.filter(p => p.status !== 'Finalized').map(p => p.id);
    let stagingCount = 0;
    if (inProgressIds.length > 0) {
        const { data: stagingHubs } = await supabase
            .from('projects_hub')
            .select('vendor_staging_data')
            .in('project_id', inProgressIds);
        stagingCount = (stagingHubs || []).reduce((sum, hub) =>
            sum + (Array.isArray(hub.vendor_staging_data) ? hub.vendor_staging_data.length : 0), 0);
    }

    // 1. Index Rate
    const totalPlacements = placements.length + stagingCount;
    const indexedCount = placements.filter(p => p.indexed_status === 'page_indexed').length;
    const indexRate = { indexed: indexedCount, total: placements.length };

    // 2. Monthly Completions (last 12 months)
    const monthCounts = {};
    projects.filter(p => p.completed_date).forEach(p => {
        const month = p.completed_date.slice(0, 7);
        monthCounts[month] = (monthCounts[month] || 0) + 1;
    });
    const monthlyCompletions = Object.entries(monthCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([month, count]) => ({ month, count }));

    // 3. Vendor Speed
    const completedProjs = projects.filter(p => p.completed_date && p.start_date);
    let avgDays = 0;
    if (completedProjs.length > 0) {
        const totalDays = completedProjs.reduce((sum, p) => {
            return sum + (new Date(p.completed_date) - new Date(p.start_date)) / 86400000;
        }, 0);
        avgDays = Math.round(totalDays / completedProjs.length);
    }
    const vendorSpeed = { avgDays, projectCount: completedProjs.length };

    // 4. Cost Per Category (via project_targets proportional allocation)
    const projectIds = projects.map(p => p.id);
    let costPerCategory = [];
    if (projectIds.length > 0) {
        const { data: targets } = await supabase
            .from('project_targets')
            .select('project_id, category, quantity_requested')
            .in('project_id', projectIds);

        if (targets && targets.length > 0) {
            const projectCostMap = {};
            projects.forEach(p => {
                const price = parseFloat(p.price) || 0;
                projectCostMap[p.id] = p.price_type === 'package' ? price : price * (p.total_quantity || 1);
            });

            const projectTotalQty = {};
            const catCostMap = {};
            targets.forEach(t => {
                projectTotalQty[t.project_id] = (projectTotalQty[t.project_id] || 0) + (t.quantity_requested || 0);
            });
            targets.forEach(t => {
                const projectCost = projectCostMap[t.project_id] || 0;
                const total = projectTotalQty[t.project_id] || 1;
                const share = ((t.quantity_requested || 0) / total) * projectCost;
                catCostMap[t.category] = (catCostMap[t.category] || 0) + share;
            });

            costPerCategory = Object.entries(catCostMap)
                .sort((a, b) => b[1] - a[1])
                .map(([category, cost]) => ({ category, cost: Math.round(cost * 100) / 100 }));
        }
    }

    // 5. Domain Diversity (finalized placements only — staging rows have no domain_id)
    const uniqueDomains = new Set(placements.map(p => p.domain_id).filter(Boolean)).size;
    const domainDiversity = { uniqueDomains, totalPlacements: placements.length };

    // 6. Anchor Text Distribution (top 10)
    const anchorCounts = {};
    placements.forEach(p => {
        if (p.anchor_text) {
            const key = p.anchor_text.trim().toLowerCase();
            anchorCounts[key] = (anchorCounts[key] || 0) + 1;
        }
    });
    const anchorTextDist = Object.entries(anchorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([text, count]) => ({
            text: text.length > 28 ? text.slice(0, 28) + '…' : text,
            count
        }));

    // 7. Placement Status Distribution
    const statusCounts = {};
    placements.forEach(p => {
        const s = p.status || 'unknown';
        statusCounts[s] = (statusCounts[s] || 0) + 1;
    });
    const placementStatusDist = Object.entries(statusCounts)
        .map(([status, count]) => ({ status, count }));

    // 8. Employ Status — always fleet-wide
    const employCounts = {};
    allVendors.forEach(v => {
        const s = v.employ_status || 'unknown';
        employCounts[s] = (employCounts[s] || 0) + 1;
    });
    const employStatus = Object.entries(employCounts)
        .map(([status, count]) => ({ status, count }));

    // Total spend
    const totalSpend = projects.reduce((sum, p) => {
        const price = parseFloat(p.price) || 0;
        return sum + (p.price_type === 'package' ? price : price * (p.total_quantity || 1));
    }, 0);

    return {
        success: true,
        indexRate,
        monthlyCompletions,
        vendorSpeed,
        costPerCategory,
        domainDiversity,
        anchorTextDist,
        placementStatusDist,
        employStatus,
        totalSpend,
        totalProjects: projects.length,
        totalPlacements,
    };
}
