'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { getSession, createReportToken } from '@/lib/session';
import { headers } from 'next/headers';

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
        .select('id, project_id, domain_id, category, anchor_text, status, indexed_status, published_url');
    let projQ = supabase
        .from('projects')
        .select('id, vendor_id, project_name, start_date, completed_date, price, price_type, total_quantity, status, vendors(vendor_name)');

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

    // 4. Cost Per Category + Cost Per Project + Vendor Cost Per Project
    const projectIds = projects.map(p => p.id);
    let costPerCategory = [];
    let costPerProject = { data: [], categories: [] };
    let vendorCostPerProject = { data: [], vendorNames: [] };

    if (projectIds.length > 0) {
        const { data: targets } = await supabase
            .from('project_targets')
            .select('project_id, category, quantity_requested')
            .in('project_id', projectIds);

        if (targets && targets.length > 0) {
            // Build project cost map (total cost per project row)
            const projectCostMap = {};
            const projectNameMap = {};
            projects.forEach(p => {
                const price = parseFloat(p.price) || 0;
                projectCostMap[p.id] = p.price_type === 'package' ? price : price * (p.total_quantity || 1);
                projectNameMap[p.id] = p.project_name || 'Unnamed';
            });

            // Total quantity per project (for proportional split)
            const projectTotalQty = {};
            targets.forEach(t => {
                projectTotalQty[t.project_id] = (projectTotalQty[t.project_id] || 0) + (t.quantity_requested || 0);
            });

            // --- Cost Per Category (existing metric) ---
            const catCostMap = {};
            targets.forEach(t => {
                const projectCost = projectCostMap[t.project_id] || 0;
                const total = projectTotalQty[t.project_id] || 1;
                const share = ((t.quantity_requested || 0) / total) * projectCost;
                catCostMap[t.category] = (catCostMap[t.category] || 0) + share;
            });
            costPerCategory = Object.entries(catCostMap)
                .sort((a, b) => b[1] - a[1])
                .map(([category, cost]) => ({ category, cost: Math.round(cost * 100) / 100 }));

            // --- Cost Per Project (stacked by category) ---
            const allCategories = [...new Set(targets.map(t => t.category).filter(Boolean))];
            const projNameCatMap = {};
            targets.forEach(t => {
                const name = projectNameMap[t.project_id];
                if (!name) return;
                const cost = projectCostMap[t.project_id] || 0;
                const total = projectTotalQty[t.project_id] || 1;
                const share = ((t.quantity_requested || 0) / total) * cost;
                if (!projNameCatMap[name]) projNameCatMap[name] = {};
                projNameCatMap[name][t.category] = (projNameCatMap[name][t.category] || 0) + share;
            });
            const costPerProjectData = Object.entries(projNameCatMap).map(([projectName, catMap]) => {
                const row = { projectName };
                let total = 0;
                allCategories.forEach(cat => {
                    row[cat] = Math.round((catMap[cat] || 0) * 100) / 100;
                    total += row[cat];
                });
                row.totalCost = Math.round(total * 100) / 100;
                return row;
            }).sort((a, b) => b.totalCost - a.totalCost);
            costPerProject = { data: costPerProjectData, categories: allCategories };

            // --- Vendor Cost Per Project (stacked by vendor) ---
            const allVendorNames = [...new Set(projects.map(p => p.vendors?.vendor_name).filter(Boolean))];
            const projNameVendorMap = {};
            projects.forEach(p => {
                const name = p.project_name || 'Unnamed';
                const vendor = p.vendors?.vendor_name || 'Unknown';
                const cost = projectCostMap[p.id] || 0;
                if (!projNameVendorMap[name]) projNameVendorMap[name] = {};
                projNameVendorMap[name][vendor] = (projNameVendorMap[name][vendor] || 0) + cost;
            });
            const vendorCostData = Object.entries(projNameVendorMap).map(([projectName, vendorMap]) => {
                const row = { projectName };
                let total = 0;
                allVendorNames.forEach(v => {
                    row[v] = Math.round((vendorMap[v] || 0) * 100) / 100;
                    total += row[v];
                });
                row.totalCost = Math.round(total * 100) / 100;
                return row;
            }).sort((a, b) => b.totalCost - a.totalCost);
            vendorCostPerProject = { data: vendorCostData, vendorNames: allVendorNames };
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

    // 7. Published Status Distribution
    const publishedCount = placements.filter(p => p.published_url?.trim()).length;
    const publishedStatusDist = [
        { status: 'Published', count: publishedCount },
        { status: 'Not Published', count: placements.length - publishedCount },
    ].filter(d => d.count > 0);

    // 8. Index Status Breakdown (all statuses incl. null)
    const indexStatusMap = {};
    placements.forEach(p => {
        const key = p.indexed_status || 'not_checked';
        indexStatusMap[key] = (indexStatusMap[key] || 0) + 1;
    });
    const indexStatusTotal = placements.length;
    const INDEX_STATUS_LABELS = {
        page_indexed: 'Indexed',
        page_not_indexed: 'Not Indexed',
        no_data: 'No Data',
        not_checked: 'Not Checked',
    };
    const indexStatusBreakdown = Object.entries(indexStatusMap)
        .sort((a, b) => b[1] - a[1])
        .map(([key, count]) => ({
            key,
            label: INDEX_STATUS_LABELS[key] || key,
            count,
            pct: indexStatusTotal > 0 ? Math.round((count / indexStatusTotal) * 100) : 0,
        }));

    // 9. Published Placements per Category
    const publishedCatMap = {};
    placements.forEach(p => {
        if (!p.published_url || !p.published_url.trim()) return;
        const cats = Array.isArray(p.category) ? p.category : [p.category || 'Uncategorized'];
        cats.forEach(cat => {
            const label = cat || 'Uncategorized';
            publishedCatMap[label] = (publishedCatMap[label] || 0) + 1;
        });
    });
    const publishedPerCategory = Object.entries(publishedCatMap)
        .sort((a, b) => b[1] - a[1])
        .map(([category, count]) => ({ category, count }));

    // 10. Employ Status — always fleet-wide
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
        indexStatusBreakdown,
        monthlyCompletions,
        vendorSpeed,
        costPerCategory,
        costPerProject,
        vendorCostPerProject,
        domainDiversity,
        anchorTextDist,
        publishedStatusDist,
        publishedPerCategory,
        employStatus,
        totalSpend,
        totalProjects: projects.length,
        totalPlacements,
    };
}

export async function generateReportLinkAction(vendorId, vendorLabel) {
    try { await requireAdmin(); } catch { return { success: false, message: 'Unauthorized.' }; }
    const token = await createReportToken(vendorId ?? null, vendorLabel ?? 'All Vendors');
    const headersList = await headers();
    const host = headersList.get('host') || 'localhost:3000';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const url = `${protocol}://${host}/report/analytics/${token}`;
    return { success: true, url };
}
