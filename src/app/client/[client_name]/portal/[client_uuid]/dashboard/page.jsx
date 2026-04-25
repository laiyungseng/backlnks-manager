import { getServerSupabase } from '@/lib/supabase-server';
import { verifyClientSession, getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { LayoutDashboard, Activity, CheckCircle2, Link2, AlertTriangle, TrendingUp, Clock, AlertCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

function getRemainingDays(deadline) {
    if (!deadline) return null;
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const due = new Date(deadline); due.setHours(0, 0, 0, 0);
    return Math.floor((due - now) / (1000 * 60 * 60 * 24));
}

function getProgress(project) {
    const hub = project.projects_hub?.[0] || {};
    const stagingData = Array.isArray(hub.vendor_staging_data) ? hub.vendor_staging_data : [];
    const hubTargets = Array.isArray(hub.targets) ? hub.targets : [];
    const completed = stagingData.filter(s => s.published_url?.trim()).length;
    const indexedCount = stagingData.filter(s => s.indexed_status?.trim()).length;
    const total = hubTargets.length > 0
        ? hubTargets.reduce((acc, t) => acc + (parseInt(t.quantity || '0', 10)), 0)
        : (project.total_quantity || 0);
    return { completed, indexedCount, total, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
}

function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default async function ClientDashboardPage({ params }) {
    const supabase = getServerSupabase();
    const resolvedParams = await params;
    const clientName = resolvedParams?.client_name;
    const clientUuid = resolvedParams?.client_uuid;

    if (!clientName || !clientUuid) redirect('/client');

    const adminSession = await getSession();
    if (!adminSession) {
        const session = await verifyClientSession(supabase);
        if (!session?.clientId || session.clientId !== clientUuid) redirect('/client');
    }

    const { data: client } = await supabase
        .from('clients')
        .select('id, client_name')
        .eq('id', clientUuid)
        .maybeSingle();

    if (!client) redirect('/client');

    const expectedSlug = client.client_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (expectedSlug !== clientName) redirect('/unauthorized');

    const displayName = client.client_name;

    const { data: projects, error } = await supabase
        .from('projects')
        .select(`
            id, project_name, status, is_approved, country, total_quantity,
            created_date, start_date, deadline, completed_date, payment_status,
            project_targets ( category ),
            projects_hub ( vendor_staging_data, targets ),
            placements ( id ),
            vendors ( vendor_name )
        `)
        .eq('client_name', displayName)
        .order('created_date', { ascending: false });

    if (error) console.error('Client Dashboard fetch error:', error);

    const allProjects = projects || [];

    const activeProjects = allProjects.filter(p =>
        p.is_approved && p.status === 'Inprogress' && p.payment_status !== 'pending'
    );
    const completedProjects = allProjects.filter(p => {
        const hasPlacements = p.placements?.length > 0;
        return (p.status === 'Finalized' || hasPlacements) && p.payment_status !== 'pending';
    });
    const outstandingProjects = allProjects.filter(p => p.payment_status === 'pending');
    const pendingProjects = allProjects.filter(p => !p.is_approved && p.payment_status !== 'pending');

    // Aggregate link counts
    const totalLinks = allProjects.reduce((acc, p) => acc + getProgress(p).total, 0);
    const completedLinks = allProjects.reduce((acc, p) => acc + getProgress(p).completed, 0);
    const indexedLinks = allProjects.reduce((acc, p) => acc + getProgress(p).indexedCount, 0);
    const overallPercent = totalLinks > 0 ? Math.round((completedLinks / totalLinks) * 100) : 0;
    const indexRate = completedLinks > 0 ? Math.round((indexedLinks / completedLinks) * 100) : 0;

    // Deadline alerts — active projects past/due deadline
    const urgentProjects = activeProjects.filter(p => {
        const d = getRemainingDays(p.deadline);
        return d !== null && d <= 0;
    });

    // Top domains from completed placements
    const { data: placementRows } = await supabase
        .from('placements')
        .select('domain_url, domains ( domain_url )')
        .in('project_id', completedProjects.map(p => p.id).slice(0, 100));

    const domainCounts = {};
    (placementRows || []).forEach(row => {
        const d = row.domains?.domain_url || row.domain_url || 'Unknown';
        domainCounts[d] = (domainCounts[d] || 0) + 1;
    });
    const topDomains = Object.entries(domainCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    // Recent completions (last 5)
    const recentCompleted = completedProjects.slice(0, 5);

    return (
        <div className="max-w-6xl mx-auto px-6 py-8 pb-20">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-2 mb-1">
                    <LayoutDashboard className="w-6 h-6 text-emerald-600" />
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
                </div>
                <p className="text-sm text-gray-500">
                    Campaign overview for <span className="font-semibold text-emerald-600">{displayName}</span>
                </p>
            </div>

            {/* Deadline alerts */}
            {urgentProjects.length > 0 && (
                <div className="mb-6 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
                    <p>
                        <span className="font-bold">{urgentProjects.length} project{urgentProjects.length > 1 ? 's are' : ' is'} overdue or due today.</span>
                        {' '}Your account manager has been notified.
                    </p>
                </div>
            )}

            {/* KPI strip */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-10">
                {[
                    { label: 'Active', value: activeProjects.length, sub: 'In-progress campaigns', icon: Activity, color: 'text-emerald-600' },
                    { label: 'Outstanding', value: outstandingProjects.length, sub: 'Pending payment', icon: AlertCircle, color: 'text-amber-600' },
                    { label: 'Completed', value: completedProjects.length, sub: `${allProjects.length} total campaigns`, icon: CheckCircle2, color: 'text-teal-600' },
                    { label: 'Links Built', value: completedLinks, sub: `of ${totalLinks} requested`, icon: Link2, color: 'text-indigo-600' },
                    { label: 'Indexed', value: indexedLinks, sub: `${indexRate}% index rate`, icon: TrendingUp, color: 'text-blue-600' },
                ].map(({ label, value, sub, icon: Icon, color }) => (
                    <div key={label} className="bg-white rounded-xl ring-1 ring-gray-200 px-5 py-4 flex flex-col gap-1">
                        <div className={`flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide ${color}`}>
                            <Icon className="w-3.5 h-3.5" /> {label}
                        </div>
                        <div className="text-3xl font-bold text-gray-900">{value}</div>
                        <div className="text-xs text-gray-400">{sub}</div>
                    </div>
                ))}
            </div>

            {/* Delivery progress */}
            <section className="mb-10">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" /> Overall Delivery Progress
                </h2>
                <div className="bg-white rounded-xl ring-1 ring-gray-200 p-6">
                    <div className="flex items-end justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-700">{completedLinks} / {totalLinks} links submitted</span>
                        <span className="text-2xl font-black text-emerald-600">{overallPercent}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                        <div className="h-3 rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${overallPercent}%` }} />
                    </div>
                    <div className="mt-3 flex gap-6 text-xs text-gray-500">
                        <span><span className="font-semibold text-gray-700">{indexedLinks}</span> indexed</span>
                        <span><span className="font-semibold text-gray-700">{completedLinks - indexedLinks}</span> submitted, pending index</span>
                        <span><span className="font-semibold text-gray-700">{totalLinks - completedLinks}</span> outstanding</span>
                    </div>
                </div>
            </section>

            {/* Active campaigns */}
            {activeProjects.length > 0 && (
                <section className="mb-10">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-500" /> Active Campaigns
                        <span className="ml-1 px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700">{activeProjects.length}</span>
                    </h2>
                    <div className="bg-white rounded-xl ring-1 ring-gray-200 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Campaign</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Deadline</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Progress</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {activeProjects.map(p => {
                                    const { completed, total, percent } = getProgress(p);
                                    const daysLeft = getRemainingDays(p.deadline);
                                    return (
                                        <tr key={p.id} className="hover:bg-gray-50/50">
                                            <td className="px-4 py-3 font-semibold text-gray-900">{p.project_name || 'Unnamed'}</td>
                                            <td className="px-4 py-3 text-gray-500">
                                                {formatDate(p.deadline)}
                                                {daysLeft !== null && daysLeft <= 3 && (
                                                    <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded ${daysLeft < 0 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                        {daysLeft < 0 ? `${Math.abs(daysLeft)}d late` : daysLeft === 0 ? 'Today' : `${daysLeft}d left`}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 bg-gray-100 rounded-full h-2 max-w-[120px]">
                                                        <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
                                                    </div>
                                                    <span className="text-xs text-gray-500 tabular-nums">{completed}/{total}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* Top domains */}
            {topDomains.length > 0 && (
                <section className="mb-10">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-indigo-500" /> Top Placement Domains
                    </h2>
                    <div className="bg-white rounded-xl ring-1 ring-gray-200 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Domain</th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Placements</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {topDomains.map(([domain, count]) => (
                                    <tr key={domain} className="hover:bg-gray-50/50">
                                        <td className="px-4 py-3 font-medium text-gray-700 truncate max-w-xs">{domain}</td>
                                        <td className="px-4 py-3 text-right font-bold text-gray-900 tabular-nums">{count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* Recent completions */}
            {recentCompleted.length > 0 && (
                <section className="mb-10">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-teal-500" /> Recently Completed
                    </h2>
                    <div className="bg-white rounded-xl ring-1 ring-gray-200 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Campaign</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Links</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Completed</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {recentCompleted.map(p => {
                                    const { completed, total } = getProgress(p);
                                    return (
                                        <tr key={p.id} className="hover:bg-gray-50/50">
                                            <td className="px-4 py-3 font-semibold text-gray-900">{p.project_name || 'Unnamed'}</td>
                                            <td className="px-4 py-3 text-gray-500 tabular-nums">{completed}/{total}</td>
                                            <td className="px-4 py-3 text-gray-500">{formatDate(p.completed_date)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {allProjects.length === 0 && (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-200">
                    <p className="text-gray-400 text-sm">No campaigns found for your account.</p>
                </div>
            )}
        </div>
    );
}
