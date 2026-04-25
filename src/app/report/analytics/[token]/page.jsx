import { verifyReportToken } from '@/lib/session';
import { getServerSupabase } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { BarChart2 } from 'lucide-react';
import ReportDashboard from './ReportDashboard';

export const dynamic = 'force-dynamic';

async function fetchReportStats(vendorId) {
    const supabase = getServerSupabase();

    let placQ = supabase
        .from('placements')
        .select('id, project_id, domain_id, category, anchor_text, status, indexed_status, published_url');
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

    if (placResult.error || projResult.error || vendorResult.error) return null;

    const placements = placResult.data || [];
    const projects = projResult.data || [];
    const allVendors = vendorResult.data || [];

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

    const totalPlacements = placements.length + stagingCount;
    const indexedCount = placements.filter(p => p.indexed_status === 'page_indexed').length;
    const indexRate = { indexed: indexedCount, total: placements.length };

    const monthCounts = {};
    projects.filter(p => p.completed_date).forEach(p => {
        const month = p.completed_date.slice(0, 7);
        monthCounts[month] = (monthCounts[month] || 0) + 1;
    });
    const monthlyCompletions = Object.entries(monthCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([month, count]) => ({ month, count }));

    const completedProjs = projects.filter(p => p.completed_date && p.start_date);
    let avgDays = 0;
    if (completedProjs.length > 0) {
        const totalDays = completedProjs.reduce((sum, p) =>
            sum + (new Date(p.completed_date) - new Date(p.start_date)) / 86400000, 0);
        avgDays = Math.round(totalDays / completedProjs.length);
    }
    const vendorSpeed = { avgDays, projectCount: completedProjs.length };

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

    const uniqueDomains = new Set(placements.map(p => p.domain_id).filter(Boolean)).size;
    const domainDiversity = { uniqueDomains, totalPlacements: placements.length };

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
            count,
        }));

    const statusCounts = {};
    placements.forEach(p => {
        const s = p.status || 'unknown';
        statusCounts[s] = (statusCounts[s] || 0) + 1;
    });
    const placementStatusDist = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

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
            key, label: INDEX_STATUS_LABELS[key] || key, count,
            pct: indexStatusTotal > 0 ? Math.round((count / indexStatusTotal) * 100) : 0,
        }));

    const publishedCatMap = {};
    placements.forEach(p => {
        if (!p.published_url?.trim()) return;
        const cats = Array.isArray(p.category) ? p.category : [p.category || 'Uncategorized'];
        cats.forEach(cat => {
            const label = cat || 'Uncategorized';
            publishedCatMap[label] = (publishedCatMap[label] || 0) + 1;
        });
    });
    const publishedPerCategory = Object.entries(publishedCatMap)
        .sort((a, b) => b[1] - a[1])
        .map(([category, count]) => ({ category, count }));

    const employCounts = {};
    allVendors.forEach(v => {
        const s = v.employ_status || 'unknown';
        employCounts[s] = (employCounts[s] || 0) + 1;
    });
    const employStatus = Object.entries(employCounts).map(([status, count]) => ({ status, count }));

    const totalSpend = projects.reduce((sum, p) => {
        const price = parseFloat(p.price) || 0;
        return sum + (p.price_type === 'package' ? price : price * (p.total_quantity || 1));
    }, 0);

    return {
        indexRate, indexStatusBreakdown, monthlyCompletions, vendorSpeed,
        costPerCategory, domainDiversity, anchorTextDist, placementStatusDist,
        publishedPerCategory, employStatus, totalSpend,
        totalProjects: projects.length, totalPlacements,
    };
}

export default async function ReportPage({ params }) {
    const { token } = await params;
    const tokenData = await verifyReportToken(token);

    if (!tokenData) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <p className="text-2xl font-black text-slate-800 mb-2">Link Expired or Invalid</p>
                    <p className="text-sm text-slate-500">Please ask your admin to generate a new report link.</p>
                </div>
            </div>
        );
    }

    const stats = await fetchReportStats(tokenData.vendorId);

    if (!stats) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <p className="text-slate-400 text-sm">Failed to load analytics data.</p>
            </div>
        );
    }

    const generatedAt = new Date().toLocaleString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });

    return (
        <div className="max-w-6xl mx-auto px-6 py-8">
            {/* Report header */}
            <div className="flex items-start justify-between mb-8 pb-6 border-b border-slate-200">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
                        <BarChart2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">Analytics Report</h1>
                        <p className="text-sm text-slate-500">
                            {tokenData.label} · Generated {generatedAt}
                        </p>
                    </div>
                </div>
                <div className="text-xs text-slate-400 text-right pt-1">
                    <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded-full font-medium">Read-only view</span>
                </div>
            </div>

            <ReportDashboard stats={stats} />
        </div>
    );
}
