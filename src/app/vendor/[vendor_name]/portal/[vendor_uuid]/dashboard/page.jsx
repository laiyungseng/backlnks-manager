import { getServerSupabase } from '@/lib/supabase-server';
import { verifyVendorSession, getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { LayoutDashboard, CheckCircle2, Activity, Zap, Star } from 'lucide-react';
import DashboardActiveProjects from './DashboardActiveProjects';
import DashboardTriage from './DashboardTriage';
import DashboardFocus from './DashboardFocus';

export const dynamic = 'force-dynamic';

function isWithinLastDays(dateStr, days) {
    if (!dateStr) return false;
    const ms = days * 24 * 60 * 60 * 1000;
    return (Date.now() - new Date(dateStr).getTime()) <= ms;
}

function getRemainingDays(deadline) {
    if (!deadline) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(deadline);
    due.setHours(0, 0, 0, 0);
    return Math.floor((due - now) / (1000 * 60 * 60 * 24));
}

function getProjectStatus(daysLeft, completed, total, indexedCount) {
    if (total > 0 && completed >= total) {
        if (indexedCount >= total) return { label: 'Completed', color: 'teal' };
        return { label: 'Completed — Pending Index Status', color: 'blue' };
    }
    if (daysLeft === null) return { label: 'In Progress', color: 'green' };
    if (daysLeft < 0) return { label: `Late — ${Math.abs(daysLeft)}d overdue`, color: 'red' };
    if (daysLeft === 0) return { label: 'Due Today', color: 'orange' };
    if (daysLeft <= 3) return { label: `In Progress — ${daysLeft}d remaining`, color: 'yellow' };
    return { label: 'In Progress', color: 'green' };
}

const statusColorMap = {
    green: 'bg-green-50 text-green-700 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    teal: 'bg-teal-50 text-teal-700 border-teal-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
};

const progressBarColorMap = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-400',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
    teal: 'bg-teal-500',
    blue: 'bg-blue-500',
};

function getProgress(project) {
    const hub = project.projects_hub?.[0] || {};
    const stagingData = Array.isArray(hub.vendor_staging_data) ? hub.vendor_staging_data : [];
    const hubTargets = Array.isArray(hub.targets) ? hub.targets : [];
    const completed = stagingData.filter(s => s.published_url && s.published_url.trim().length > 0).length;
    const indexedCount = stagingData.filter(s => s.indexed_status && s.indexed_status.trim().length > 0).length;
    const total = hubTargets.length > 0
        ? hubTargets.reduce((acc, t) => acc + (parseInt(t.quantity || '0', 10)), 0)
        : (project.total_quantity || 0);
    return { completed, indexedCount, total, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
}


export default async function VendorDashboardPage({ params }) {
    const supabase = getServerSupabase();
    const resolvedParams = await params;
    const vendorName = resolvedParams?.vendor_name;
    const vendorUuid = resolvedParams?.vendor_uuid;

    if (!vendorName || !vendorUuid) redirect('/vendor');

    // Admin users bypass vendor session check — allow read-only preview
    const adminSession = await getSession();
    if (!adminSession) {
        const session = await verifyVendorSession(supabase);
        if (!session?.vendorId || session.vendorId !== vendorUuid) redirect('/vendor');
    }

    const { data: vendor } = await supabase
        .from('vendors')
        .select('id, vendor_name')
        .eq('id', vendorUuid)
        .maybeSingle();

    if (!vendor) redirect('/vendor');

    const expectedSlug = vendor.vendor_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (expectedSlug !== vendorName) redirect('/unauthorized');

    const displayName = vendor.vendor_name;

    const { data: projects, error } = await supabase
        .from('projects')
        .select(`
            id,
            project_name,
            status,
            is_approved,
            country,
            total_quantity,
            created_date,
            start_date,
            deadline,
            completed_date,
            is_priority,
            project_targets ( category ),
            project_plans ( campaign_id, project_campaigns ( id, title ) ),
            projects_hub ( hash, vendor_staging_data, is_locked, targets ),
            placements ( id )
        `)
        .eq('vendor_id', vendor.id)
        .order('created_date', { ascending: false });

    if (error) console.error('Vendor Dashboard fetch error:', error);

    const allProjects = projects || [];

    const activeProjects = allProjects.filter(p => {
        const hasPlacements = p.placements && p.placements.length > 0;
        return p.is_approved && p.status !== 'Finalized' && !hasPlacements;
    });
    const completedProjects = allProjects.filter(p => {
        const hasPlacements = p.placements && p.placements.length > 0;
        return p.status === 'Finalized' || hasPlacements;
    });

    // Avg submission speed: days from start_date to completed_date
    const speedData = completedProjects
        .filter(p => p.start_date && p.completed_date)
        .map(p => {
            const days = Math.round((new Date(p.completed_date) - new Date(p.start_date)) / (1000 * 60 * 60 * 24));
            return days;
        });
    const avgSpeed = speedData.length > 0
        ? Math.round(speedData.reduce((a, b) => a + b, 0) / speedData.length)
        : null;

    const completionRate = allProjects.length > 0
        ? Math.round((completedProjects.length / allProjects.length) * 100)
        : 0;

    // Urgent: active projects past deadline where vendor has NOT yet submitted all URLs
    const urgentProjects = activeProjects.filter(p => {
        const d = getRemainingDays(p.deadline);
        if (d === null || d > 0) return false;
        const { completed, total } = getProgress(p);
        return !(total > 0 && completed >= total);
    });

    // Due today/tomorrow: incomplete and 0 or 1 days remaining (excludes already-overdue)
    const dueTodayProjects = activeProjects.filter(p => {
        const d = getRemainingDays(p.deadline);
        if (d === null || d < 0 || d > 1) return false;
        const { completed, total } = getProgress(p);
        return !(total > 0 && completed >= total);
    });

    // New: active, 0 URLs entered, created within last 14 days
    const newAssignmentProjects = activeProjects.filter(p => {
        const { completed } = getProgress(p);
        if (completed !== 0) return false;
        return isWithinLastDays(p.created_date, 14);
    });

    // Pending index: any project where all URLs are submitted but index status not yet recorded
    const pendingIndexProjects = allProjects.filter(p => {
        const { completed, indexedCount, total } = getProgress(p);
        return total > 0 && completed >= total && indexedCount < total;
    });

    function toFocusItem(p, meta) {
        const hash = p.projects_hub?.[0]?.hash || null;
        const campaignTitle = p.project_plans?.[0]?.project_campaigns?.title || p.project_name || 'Unnamed';
        const category = p.project_targets?.[0]?.category || null;
        return {
            id: p.id,
            label: campaignTitle,
            category,
            hash,
            meta,
        };
    }

    const overdueItems = urgentProjects.map(p => {
        const d = getRemainingDays(p.deadline);
        return toFocusItem(p, `${Math.abs(d)}d late`);
    });
    const dueTodayItems = dueTodayProjects.map(p => {
        const d = getRemainingDays(p.deadline);
        return toFocusItem(p, d === 0 ? 'Today' : '1d left');
    });
    const newItems = newAssignmentProjects.map(p => {
        const { total } = getProgress(p);
        return toFocusItem(p, `0/${total}`);
    });
    const pendingIndexItems = pendingIndexProjects.map(p => {
        const { indexedCount, total } = getProgress(p);
        return toFocusItem(p, `${indexedCount}/${total} indexed`);
    });

    return (
        <div className="max-w-6xl mx-auto px-6 py-8 pb-20">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-2 mb-1">
                    <LayoutDashboard className="w-6 h-6 text-indigo-600" />
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
                </div>
                <p className="text-sm text-gray-500">
                    Overview for <span className="font-semibold text-indigo-600">{displayName}</span>
                </p>
            </div>

            <DashboardTriage
                overdue={overdueItems}
                dueToday={dueTodayItems}
                newAssignments={newItems}
                pendingIndex={pendingIndexItems}
                vendorName={vendorName}
                vendorUuid={vendorUuid}
            />

            {/* KPI Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
                <div className="bg-white rounded-xl ring-1 ring-gray-200 px-5 py-4 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium uppercase tracking-wide">
                        <Activity className="w-3.5 h-3.5" /> Active
                    </div>
                    <div className="text-3xl font-bold text-gray-900">{activeProjects.length}</div>
                    <div className="text-xs text-gray-400">In-progress projects</div>
                </div>
                <div className="bg-white rounded-xl ring-1 ring-gray-200 px-5 py-4 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-xs text-amber-500 font-medium uppercase tracking-wide">
                        <Star className="w-3.5 h-3.5" /> Focus
                    </div>
                    <div className="text-3xl font-bold text-gray-900">{activeProjects.filter(p => p.is_priority).length}</div>
                    <div className="text-xs text-gray-400">Priority projects</div>
                </div>
                <div className="bg-white rounded-xl ring-1 ring-gray-200 px-5 py-4 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium uppercase tracking-wide">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                    </div>
                    <div className="text-3xl font-bold text-gray-900">{completedProjects.length}</div>
                    <div className="text-xs text-gray-400">{completionRate}% completion rate</div>
                </div>
                <div className="bg-white rounded-xl ring-1 ring-gray-200 px-5 py-4 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-xs text-indigo-500 font-medium uppercase tracking-wide">
                        <Zap className="w-3.5 h-3.5" /> Avg Speed
                    </div>
                    <div className="text-3xl font-bold text-gray-900">{avgSpeed !== null ? avgSpeed : '—'}</div>
                    <div className="text-xs text-gray-400">{avgSpeed !== null ? 'days per project' : 'No completed projects'}</div>
                </div>
            </div>

            {/* Focus Section — priority projects */}
            <DashboardFocus
                priorityProjects={activeProjects.filter(p => p.is_priority)}
                vendorName={vendorName}
                vendorUuid={vendorUuid}
            />

            {/* Active Projects */}
            <DashboardActiveProjects activeProjects={activeProjects} vendorName={vendorName} vendorUuid={vendorUuid} />
        </div>
    );
}
