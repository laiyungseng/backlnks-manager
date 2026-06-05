'use client';

import { useMemo, useState } from 'react';
import { CheckCircle, Clock, AlertTriangle, DollarSign, TrendingUp, BarChart4, CalendarClock, CalendarCheck2, Copy, Check, CircleDollarSign } from 'lucide-react';

function getDaysLeft(endDate) {
    if (!endDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
}

function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function DaysLeftBadge({ endDate }) {
    const days = getDaysLeft(endDate);
    if (days === null) return <span className="text-slate-300 text-xs">-</span>;
    if (days < 0) return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-red-100 text-red-700">{Math.abs(days)}d overdue</span>;
    if (days === 0) return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-red-100 text-red-700 animate-pulse">Due today</span>;
    if (days <= 2) return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-700">{days}d left</span>;
    return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-50 text-indigo-600">{days}d left</span>;
}

function computeProjectCost(project) {
    const targets = Array.isArray(project.project_targets) ? project.project_targets : [];
    if (targets.length > 0 && targets.some(t => parseFloat(t.price) > 0)) {
        return targets.reduce((sum, t) => sum + (parseFloat(t.price) || 0) * (parseInt(t.quantity_requested) || 0), 0);
    }
    const price = parseFloat(project.price) || 0;
    if (project.price_type === 'package') return price;
    return price * (parseInt(project.total_quantity) || 0);
}

function getPlanCompleted(plan) {
    const project = Array.isArray(plan.projects) ? plan.projects[0] : plan.projects;
    const hub = Array.isArray(project?.projects_hub) ? project.projects_hub[0] : project?.projects_hub || {};
    return hub?.completed_count ?? 0;
}

function CopyId({ id }) {
    const [copied, setCopied] = useState(false);
    if (!id) return null;
    const copy = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(id).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };
    return (
        <button onClick={copy} className="flex items-center gap-0.5 text-[9px] font-mono text-slate-400 hover:text-indigo-500 transition-colors group mt-0.5">
            <span>{id.slice(0, 8)}…</span>
            {copied
                ? <Check className="w-2.5 h-2.5 text-emerald-500 flex-shrink-0" />
                : <Copy className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 flex-shrink-0" />}
        </button>
    );
}

export default function DashboardLanding({ placements = [], projects = [], weekPlans = [], upcomingPlans = [], packages = [] }) {

    const { displayWeekPlans, displayUpcomingPlans } = useMemo(() => {
        const isFinalized = (p) => {
            const project = Array.isArray(p.projects) ? p.projects[0] : p.projects;
            return project?.status === 'Finalized';
        };
        const started = upcomingPlans.filter(p => {
            if (isFinalized(p)) return false;
            const project = Array.isArray(p.projects) ? p.projects[0] : p.projects;
            return getPlanCompleted(p) > 0 || project?.is_priority === true;
        });
        const truly_upcoming = upcomingPlans.filter(p => !started.includes(p));
        return {
            displayWeekPlans: [...weekPlans, ...started].filter(p => !isFinalized(p)),
            displayUpcomingPlans: truly_upcoming,
        };
    }, [weekPlans, upcomingPlans]);

    const metrics = useMemo(() => {
        const totalPlacements = placements.length;
        const indexedPlacements = placements.filter(p =>
            p.indexed_status && p.indexed_status.toLowerCase() === 'page_indexed'
        ).length;
        const indexRate = totalPlacements > 0 ? ((indexedPlacements / totalPlacements) * 100).toFixed(1) : 0;

        const errorPlacements = placements.filter(p =>
            p.status === 'rejected' || (p.indexed_status && p.indexed_status.toLowerCase().includes('error'))
        ).length;
        const errorRate = totalPlacements > 0 ? ((errorPlacements / totalPlacements) * 100).toFixed(1) : 0;

        const completedProjectsList = projects.filter(p => p.status === 'Finalized' || p.completed_date);
        let totalDays = 0, speedCount = 0;
        completedProjectsList.forEach(p => {
            if (p.created_date && p.completed_date) {
                const diffDays = Math.ceil(Math.abs(new Date(p.completed_date) - new Date(p.created_date)) / (1000 * 60 * 60 * 24));
                totalDays += diffDays;
                speedCount++;
            }
        });
        const avgSpeed = speedCount > 0 ? (totalDays / speedCount).toFixed(1) : 0;

        let approvedCost = 0;
        let outstandingCost = 0;
        projects.forEach(p => {
            const cost = computeProjectCost(p);
            if (p.payment_status === 'approved') approvedCost += cost;
            else if (p.payment_status === 'pending') outstandingCost += cost;
        });
        // Add package spend to cost cards
        packages.forEach(pkg => {
            const price = parseFloat(pkg.total_price) || 0;
            if (pkg.payment_status === 'approved') approvedCost += price;
            else if (pkg.payment_status === 'pending') outstandingCost += price;
        });

        return { indexRate, errorRate, avgSpeed, approvedCost, outstandingCost, totalPlacements };
    }, [placements, projects, packages]);

    const MetricCard = ({ title, value, subtitle, icon: Icon, color, bg }) => (
        <div className={`p-6 rounded-2xl border ${bg} shadow-sm flex items-start gap-4 transition-all duration-300 hover:shadow-md`}>
            <div className={`p-3 rounded-xl ${color}`}>
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">{title}</h3>
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-slate-800">{value}</span>
                </div>
                <p className="text-xs font-medium text-slate-400 mt-1">{subtitle}</p>
            </div>
        </div>
    );

    return (
        <div className="max-w-screen-2xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-3">
                    <BarChart4 className="w-10 h-10 text-indigo-600" />
                    Operations Dashboard
                </h1>
                <p className="mt-2 text-sm font-medium text-slate-500 max-w-2xl">
                    Weekly operational view — track active submissions, upcoming campaigns, and outstanding costs.
                </p>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <MetricCard
                    title="Index Rate"
                    value={`${metrics.indexRate}%`}
                    subtitle={`${metrics.totalPlacements} total placements`}
                    icon={TrendingUp}
                    color="bg-emerald-100 text-emerald-600"
                    bg="border-emerald-100 bg-emerald-50/30"
                />
                <MetricCard
                    title="Avg Submission Speed"
                    value={`${metrics.avgSpeed}d`}
                    subtitle="start → finalized"
                    icon={Clock}
                    color="bg-amber-100 text-amber-600"
                    bg="border-amber-100 bg-amber-50/30"
                />
                <MetricCard
                    title="Error Rate"
                    value={`${metrics.errorRate}%`}
                    subtitle="Rejected or Error status"
                    icon={AlertTriangle}
                    color="bg-red-100 text-red-600"
                    bg="border-red-100 bg-red-50/30"
                />
                <MetricCard
                    title="Approved Cost"
                    value={`$${metrics.approvedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    subtitle="Payment approved projects"
                    icon={DollarSign}
                    color="bg-indigo-100 text-indigo-600"
                    bg="border-indigo-100 bg-indigo-50/30"
                />
                <MetricCard
                    title="Outstanding Cost"
                    value={`$${metrics.outstandingCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    subtitle="Pending payment approval"
                    icon={CheckCircle}
                    color="bg-amber-100 text-amber-700"
                    bg="border-amber-200 bg-amber-50/40"
                />
            </div>

            {/* This Week Submissions */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                    <CalendarClock className="w-5 h-5 text-indigo-500" />
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">This Week Submissions</h2>
                    <span className="ml-auto text-[10px] font-black text-slate-400 uppercase tracking-widest">{displayWeekPlans.length} active plans</span>
                </div>
                <div className="overflow-y-auto max-h-72">
                    <table className="w-full table-fixed divide-y divide-slate-100">
                        <colgroup>
                            <col className="w-[22%]" />
                            <col className="w-[20%]" />
                            <col className="w-[12%]" />
                            <col className="w-[18%]" />
                            <col className="w-[14%]" />
                            <col className="w-[8%]" />
                            <col className="w-[6%]" />
                        </colgroup>
                        <thead className="bg-slate-50 sticky top-0 z-10">
                            <tr>
                                {['Campaign', 'Project / Plan', 'Category', 'Vendor', 'Start → End', 'Remaining', '%'].map(h => (
                                    <th key={h} className="px-3 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-50">
                            {displayWeekPlans.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-10 text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                                        No active plans this week
                                    </td>
                                </tr>
                            ) : [...displayWeekPlans].sort((a, b) => (a.start_date || '') < (b.start_date || '') ? -1 : 1).map(plan => {
                                const project = Array.isArray(plan.projects) ? plan.projects[0] : plan.projects;
                                const hub = project?.projects_hub?.[0] || {};
                                const completed = hub.completed_count ?? 0;
                                const total = plan.total_quantity || 0;
                                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                                const campaignTitle = plan.project_campaigns?.title || plan.campaign_id?.slice(0, 8) || '-';
                                const vendorName = plan.vendors?.vendor_name || '-';
                                return (
                                    <tr key={plan.id} className="hover:bg-indigo-50/30 transition-colors">
                                        <td className="px-3 py-2.5 truncate">
                                            <span className="text-xs font-bold text-slate-700 truncate block" title={campaignTitle}>{campaignTitle}</span>
                                            <CopyId id={plan.campaign_id} />
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-xs font-bold text-slate-700 truncate" title={project?.project_name}>{project?.project_name || '-'}</span>
                                                <span className="text-[10px] font-semibold text-slate-400">Plan {(plan.step_order ?? 0) + 1}</span>
                                                {project?.payment_status === 'pending' && (
                                                    <span className="inline-flex items-center gap-0.5 mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-700 uppercase tracking-widest w-fit">
                                                        <CircleDollarSign className="w-2.5 h-2.5" />
                                                        Payment Pending
                                                    </span>
                                                )}
                                                <CopyId id={plan.id} />
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-600 uppercase tracking-widest truncate block">{plan.category || 'N/A'}</span>
                                        </td>
                                        <td className="px-3 py-2.5 text-xs font-semibold text-slate-600 truncate" title={vendorName}>{vendorName}</td>
                                        <td className="px-3 py-2.5">
                                            <div className="flex flex-col text-[10px] tabular-nums text-slate-500">
                                                <span>{formatDate(plan.start_date)}</span>
                                                <span className="text-slate-300">↓</span>
                                                <span>{formatDate(plan.end_date)}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <DaysLeftBadge endDate={plan.end_date} />
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className={`text-xs font-black tabular-nums ${pct === 100 ? 'text-emerald-600' : 'text-indigo-600'}`}>
                                                {pct}%
                                            </span>
                                            <span className="text-[10px] text-slate-400 block">{completed}/{total}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Upcoming Campaigns */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                    <CalendarCheck2 className="w-5 h-5 text-amber-500" />
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Upcoming Campaigns</h2>
                    <span className="text-[10px] font-semibold text-slate-400 ml-1">Starting within 5 days</span>
                    <span className="ml-auto text-[10px] font-black text-slate-400 uppercase tracking-widest">{displayUpcomingPlans.length} plans</span>
                </div>
                <div className="overflow-y-auto max-h-72">
                    <table className="w-full table-fixed divide-y divide-slate-100">
                        <colgroup>
                            <col className="w-[22%]" />
                            <col className="w-[20%]" />
                            <col className="w-[12%]" />
                            <col className="w-[18%]" />
                            <col className="w-[14%]" />
                            <col className="w-[7%]" />
                            <col className="w-[7%]" />
                        </colgroup>
                        <thead className="bg-slate-50 sticky top-0 z-10">
                            <tr>
                                {['Campaign', 'Project / Plan', 'Category', 'Vendor', 'Start → End', 'Qty', 'Status'].map(h => (
                                    <th key={h} className="px-3 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-50">
                            {displayUpcomingPlans.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-10 text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                                        No upcoming campaigns in the next 5 days
                                    </td>
                                </tr>
                            ) : [...displayUpcomingPlans].sort((a, b) => (a.start_date || '') < (b.start_date || '') ? -1 : 1).map(plan => {
                                const project = Array.isArray(plan.projects) ? plan.projects[0] : plan.projects;
                                const campaignTitle = plan.project_campaigns?.title || plan.campaign_id?.slice(0, 8) || '-';
                                const vendorName = plan.vendors?.vendor_name || '-';
                                const daysUntil = getDaysLeft(plan.start_date);
                                return (
                                    <tr key={plan.id} className="hover:bg-amber-50/30 transition-colors">
                                        <td className="px-3 py-2.5 truncate">
                                            <span className="text-xs font-bold text-slate-700 truncate block" title={campaignTitle}>{campaignTitle}</span>
                                            <CopyId id={plan.campaign_id} />
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-xs font-bold text-slate-700 truncate" title={project?.project_name}>{project?.project_name || '-'}</span>
                                                <span className="text-[10px] font-semibold text-slate-400">Plan {(plan.step_order ?? 0) + 1}</span>
                                                <CopyId id={plan.id} />
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-600 uppercase tracking-widest truncate block">{plan.category || 'N/A'}</span>
                                        </td>
                                        <td className="px-3 py-2.5 text-xs font-semibold text-slate-600 truncate" title={vendorName}>{vendorName}</td>
                                        <td className="px-3 py-2.5">
                                            <div className="flex flex-col text-[10px] tabular-nums text-slate-500">
                                                <span className="font-semibold text-slate-700">{formatDate(plan.start_date)}</span>
                                                {daysUntil !== null && (
                                                    <span className="font-bold text-amber-600">in {daysUntil}d</span>
                                                )}
                                                <span className="text-slate-300">↓</span>
                                                <span>{formatDate(plan.end_date)}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5 text-xs font-mono text-slate-600">{plan.total_quantity ?? '-'}</td>
                                        <td className="px-3 py-2.5">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-700 w-fit">Upcoming</span>
                                                {project?.payment_status === 'pending' && (
                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-50 text-amber-600 border border-amber-200 uppercase tracking-widest w-fit">
                                                        <CircleDollarSign className="w-2.5 h-2.5" />
                                                        Unpaid
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
