import { getServerSupabase } from '@/lib/supabase-server';
import { verifyVendorSession, getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { LayoutDashboard, Clock, CheckCircle2, AlertTriangle, Activity, Zap, Star, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import DashboardActiveProjects from './DashboardActiveProjects';

export const dynamic = 'force-dynamic';

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

function getTotal(project) {
    const hub = project.projects_hub?.[0] || {};
    const hubTargets = Array.isArray(hub.targets) ? hub.targets : [];
    return hubTargets.length > 0
        ? hubTargets.reduce((acc, t) => acc + (parseInt(t.quantity || '0', 10)), 0)
        : (project.total_quantity || 0);
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
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
    // (projects where all URLs are already submitted belong in the pending-index warning instead)
    const urgentProjects = activeProjects.filter(p => {
        const d = getRemainingDays(p.deadline);
        if (d === null || d > 0) return false;
        const { completed, total } = getProgress(p);
        return !(total > 0 && completed >= total);
    });

    // Any project (active or completed) where all URLs are submitted but index status not yet recorded
    // Uses vendor_staging_data via getProgress() — same source as the "Completed — Pending Index Status" label
    const pendingIndexProjects = allProjects.filter(p => {
        const { completed, indexedCount, total } = getProgress(p);
        return total > 0 && completed >= total && indexedCount < total;
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

            {/* Pending index warning */}
            {pendingIndexProjects.length > 0 && (
                <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg overflow-hidden text-sm text-yellow-800">
                    <details>
                        <summary className="flex items-start gap-3 p-4 cursor-pointer select-none hover:bg-yellow-100/60 transition-colors list-none">
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-yellow-500" />
                            <p>
                                <span className="font-bold">{pendingIndexProjects.length} completed project{pendingIndexProjects.length !== 1 ? 's' : ''}</span>
                                {' '}
                                <span className="underline underline-offset-2 decoration-yellow-500 font-semibold hover:text-yellow-900">
                                    {pendingIndexProjects.length !== 1 ? 'are' : 'is'} awaiting index status verification
                                </span>
                                {' — click to view.'}
                            </p>
                        </summary>
                        <div className="border-t border-yellow-200 px-4 pb-4 pt-3">
                            <ul className="space-y-2">
                                {pendingIndexProjects.map(p => {
                                    const { completed, indexedCount, total } = getProgress(p);
                                    return (
                                        <li key={p.id} className="flex items-center gap-2 text-xs text-yellow-800">
                                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
                                            <span className="font-semibold">{p.project_name || 'Unnamed'}</span>
                                            {p.country && (
                                                <span className="font-mono text-[10px] bg-yellow-100 border border-yellow-200 px-1.5 py-0.5 rounded">{p.country}</span>
                                            )}
                                            <span className="text-yellow-600 ml-auto tabular-nums">{indexedCount}/{total} indexed</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </details>
                </div>
            )}

            {/* Urgent alert */}
            {urgentProjects.length > 0 && (
                <div className="mb-6 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
                    <p>
                        <span className="font-bold">{urgentProjects.length} project{urgentProjects.length > 1 ? 's are' : ' is'} overdue or due today.</span>
                        {' '}Please submit your URLs as soon as possible.
                    </p>
                </div>
            )}

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
            {activeProjects.filter(p => p.is_priority).length > 0 && (
                <section className="mb-8">
                    <div className="flex items-center gap-2 mb-3">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                        <h2 className="text-lg font-bold text-gray-800">Focus</h2>
                        <span className="ml-1 px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-700">
                            {activeProjects.filter(p => p.is_priority).length}
                        </span>
                    </div>
                    <div className="space-y-2">
                        {activeProjects.filter(p => p.is_priority).map(p => {
                            const { completed, total, percent } = getProgress(p);
                            const daysLeft = getRemainingDays(p.deadline);
                            const hash = p.projects_hub?.[0]?.hash;
                            return (
                                <div key={p.id} className="bg-white rounded-xl ring-1 ring-amber-200 border-l-4 border-l-amber-400 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                                            <span className="font-bold text-gray-900 text-sm">{p.project_name || 'Unnamed'}</span>
                                            {p.country && <span className="text-xs font-mono text-gray-400 uppercase">{p.country}</span>}
                                        </div>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-2">
                                            <span>Qty: <span className="font-semibold text-gray-700">{total}</span></span>
                                            <span>Deadline: <span className={`font-semibold ${daysLeft !== null && daysLeft <= 0 ? 'text-red-600' : 'text-gray-700'}`}>{formatDate(p.deadline)}</span></span>
                                            {daysLeft !== null && daysLeft <= 3 && (
                                                <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${daysLeft < 0 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                    {daysLeft < 0 ? `${Math.abs(daysLeft)}d late` : daysLeft === 0 ? 'Today' : `${daysLeft}d left`}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden max-w-[160px]">
                                                <div className="h-1.5 rounded-full bg-amber-400 transition-all" style={{ width: `${percent}%` }} />
                                            </div>
                                            <span className="text-xs text-gray-500 tabular-nums">{completed}/{total} ({percent}%)</span>
                                        </div>
                                    </div>
                                    {hash && (
                                        <Link
                                            href={`/vendor/${vendorName}/${hash}`}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 transition-colors shadow-sm shrink-0"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            Open
                                        </Link>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* Active Projects */}
            <DashboardActiveProjects activeProjects={activeProjects} vendorName={vendorName} />
        </div>
    );
}
