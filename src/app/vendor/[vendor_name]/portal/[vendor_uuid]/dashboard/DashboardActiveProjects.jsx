'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ListChecks, ExternalLink, Search, Star, Layers, ChevronDown } from 'lucide-react';
import {
    getProgress,
    formatTitleWithDate,
    formatCompact,
    buildCampaignGroups,
} from '../_lib/campaignGrouping';
import { useDebouncedUrlParam, useUrlParam } from '../_lib/usePortalFilters';

function getPlanStatusKey(p) {
    const { completed, total } = getProgress(p);
    if (total > 0 && completed >= total) return 'done';
    if (completed > 0) return 'progress';
    return 'pending';
}

function getCampaignStatusCategory(group) {
    const { completed, total, indexedCount } = group;
    if (total > 0 && completed >= total) {
        return indexedCount >= total ? 'completed' : 'pending-index';
    }
    return 'inprogress';
}

function getCampaignPill(group) {
    const statusCat = getCampaignStatusCategory(group);
    if (statusCat === 'completed') return { label: 'Done', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (statusCat === 'pending-index') return { label: 'Pending Index', cls: 'bg-blue-50 text-blue-700 border-blue-200' };
    const daysLeft = group.earliestDeadline
        ? Math.floor((new Date(group.earliestDeadline) - new Date(new Date().setHours(0, 0, 0, 0))) / 86400000)
        : null;
    if (daysLeft === null) return { label: 'In Progress', cls: 'bg-gray-50 text-gray-600 border-gray-200' };
    if (daysLeft < 0) return { label: `${Math.abs(daysLeft)}d overdue`, cls: 'bg-red-50 text-red-700 border-red-200' };
    if (daysLeft === 0) return { label: 'Due Today', cls: 'bg-orange-50 text-orange-700 border-orange-200' };
    if (daysLeft <= 3) return { label: `${daysLeft}d left`, cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' };
    return { label: `${daysLeft}d left`, cls: 'bg-gray-50 text-gray-600 border-gray-200' };
}

const PLAN_STATUS_CLS = {
    done: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    progress: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    pending: 'bg-gray-50 text-gray-500 border-gray-200',
};
const PLAN_STATUS_LABEL = { done: 'Done', progress: 'In Progress', pending: 'Pending' };

const STATUS_FILTERS = [
    { key: 'all',           label: 'All' },
    { key: 'inprogress',    label: 'In Progress' },
    { key: 'pending-index', label: 'Pending Index' },
    { key: 'completed',     label: 'Completed' },
];

export default function DashboardActiveProjects({ activeProjects, vendorName, vendorUuid }) {
    const buildHref = (h) => vendorUuid
        ? `/vendor/${vendorName}/portal/${vendorUuid}/project/${h}`
        : `/vendor/${vendorName}/${h}`;
    const [search, setSearch] = useDebouncedUrlParam('q', 300);
    const [statusFilterRaw, setStatusFilterRaw] = useUrlParam('dstatus');
    const statusFilter = statusFilterRaw || 'all';
    const setStatusFilter = (k) => setStatusFilterRaw(k === 'all' ? null : k);
    const [expandedIds, setExpandedIds] = useState(new Set());

    const aggregated = useMemo(() => {
        const groups = buildCampaignGroups(activeProjects);
        return groups.sort((a, b) => {
            const pa = a.anyPriority ? 1 : 0;
            const pb = b.anyPriority ? 1 : 0;
            if (pa !== pb) return pb - pa;
            const da = a.earliestDeadline ? new Date(a.earliestDeadline).getTime() : Infinity;
            const db = b.earliestDeadline ? new Date(b.earliestDeadline).getTime() : Infinity;
            if (da !== db) return da - db;
            const ca = a.earliestCreated ? new Date(a.earliestCreated).getTime() : 0;
            const cb = b.earliestCreated ? new Date(b.earliestCreated).getTime() : 0;
            return cb - ca;
        });
    }, [activeProjects]);

    const counts = useMemo(() => ({
        all: aggregated.length,
        inprogress: aggregated.filter(g => getCampaignStatusCategory(g) === 'inprogress').length,
        'pending-index': aggregated.filter(g => getCampaignStatusCategory(g) === 'pending-index').length,
        completed: aggregated.filter(g => getCampaignStatusCategory(g) === 'completed').length,
    }), [aggregated]);

    let filtered = statusFilter === 'all' ? aggregated : aggregated.filter(g => getCampaignStatusCategory(g) === statusFilter);
    if (search.trim()) {
        const s = search.toLowerCase().trim();
        filtered = filtered.filter(g => (g.title || '').toLowerCase().includes(s));
    }

    function toggleExpand(id) {
        setExpandedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    return (
        <section>
            <div className="flex flex-wrap items-center gap-2 mb-3">
                <ListChecks className="w-4 h-4 text-indigo-500" />
                <h2 className="text-lg font-bold text-gray-800">Deadline Queue</h2>
                <span className="ml-1 px-2 py-0.5 text-xs font-bold rounded-full bg-indigo-100 text-indigo-700">{aggregated.length}</span>
                <div className="ml-auto relative w-full sm:w-56">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search campaigns..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="block w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    />
                </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
                {STATUS_FILTERS.map(f => (
                    <button
                        key={f.key}
                        onClick={() => setStatusFilter(f.key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                            statusFilter === f.key
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                        }`}
                    >
                        {f.label}
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                            statusFilter === f.key ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'
                        }`}>
                            {counts[f.key]}
                        </span>
                    </button>
                ))}
            </div>

            {filtered.length > 0 ? (
                <ul className="space-y-2">
                    {filtered.map(g => {
                        const pill = getCampaignPill(g);
                        const focusRow = !!g.anyPriority;
                        const planCount = g.plans.length;
                        const rowKey = g.campaignId || `orphan-${g.plans[0]?.id}`;
                        const isExpanded = expandedIds.has(rowKey);
                        const openHref = g.snapHash ? buildHref(g.snapHash) : '#';

                        return (
                            <li
                                key={rowKey}
                                className={`rounded-xl overflow-hidden ring-1 ${
                                    focusRow ? 'ring-amber-200' : 'ring-gray-200'
                                } bg-white`}
                            >
                                {/* Campaign header row */}
                                <div
                                    className={`flex items-center gap-3 px-4 py-3.5 text-base transition-colors cursor-pointer ${
                                        focusRow ? 'bg-amber-50 border-l-4 border-l-amber-400 hover:bg-amber-100/60' : 'hover:bg-gray-50'
                                    }`}
                                    onClick={() => toggleExpand(rowKey)}
                                >
                                    <Star className={`w-4 h-4 shrink-0 ${focusRow ? 'text-amber-500 fill-amber-400' : 'text-gray-200'}`} />

                                    <span className="font-mono text-[15px] font-semibold text-gray-900 truncate min-w-0 flex-1" title={g.title}>
                                        {formatTitleWithDate(g.earliestCreated, g.title)}
                                    </span>

                                    <span className="hidden md:inline-flex items-center justify-center gap-1 px-2 py-0.5 text-xs font-bold rounded bg-purple-50 text-purple-700 border border-purple-100 shrink-0 min-w-[80px]">
                                        <Layers className="w-3 h-3" />
                                        {planCount} plan{planCount !== 1 ? 's' : ''}
                                    </span>

                                    <span className="hidden lg:inline-block font-mono text-[13px] text-gray-500 tabular-nums shrink-0 text-center min-w-[110px]">
                                        {formatCompact(g.earliestStart)}<span className="text-gray-300 mx-0.5">→</span>{formatCompact(g.latestDeadline)}
                                    </span>

                                    <span className={`px-2 py-0.5 text-xs font-bold rounded border shrink-0 text-center min-w-[120px] ${pill.cls}`}>
                                        {pill.label}
                                    </span>

                                    <div className="hidden sm:flex items-center gap-2 shrink-0 w-36">
                                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className={`h-1.5 rounded-full transition-all ${focusRow ? 'bg-amber-400' : 'bg-indigo-500'}`}
                                                style={{ width: `${g.percent}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-gray-500 tabular-nums w-12 text-right">{g.completed}/{g.total}</span>
                                    </div>

                                    {openHref !== '#' && (
                                        <Link
                                            href={openHref}
                                            onClick={e => e.stopPropagation()}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md shrink-0 transition-colors ${
                                                focusRow
                                                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                                                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                            }`}
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            Open
                                        </Link>
                                    )}

                                    <ChevronDown className={`w-4 h-4 shrink-0 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>

                                {/* Expanded plan rows */}
                                {isExpanded && (
                                    <div className="border-t border-gray-100 bg-gray-50/60 divide-y divide-gray-100">
                                        {g.plans.map((p, idx) => {
                                            const planHash = p.projects_hub?.[0]?.hash;
                                            const planProgress = getProgress(p);
                                            const planStatusKey = getPlanStatusKey(p);
                                            const category = p.project_targets?.[0]?.category;
                                            return (
                                                <div key={p.id} className="flex items-center gap-3 px-5 py-2.5">
                                                    <span className="text-[11px] font-bold text-gray-400 w-14 shrink-0 tabular-nums">
                                                        Plan {idx + 1}
                                                    </span>
                                                    <span className="text-xs text-gray-600 truncate flex-1 min-w-0">
                                                        {category || '—'}
                                                    </span>
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${PLAN_STATUS_CLS[planStatusKey]}`}>
                                                        {PLAN_STATUS_LABEL[planStatusKey]}
                                                    </span>
                                                    <div className="hidden sm:flex items-center gap-1.5 w-28 shrink-0">
                                                        <div className="flex-1 bg-gray-200 rounded-full h-1 overflow-hidden">
                                                            <div className="h-1 rounded-full bg-indigo-400 transition-all" style={{ width: `${planProgress.percent}%` }} />
                                                        </div>
                                                        <span className="text-[10px] text-gray-500 tabular-nums w-10 text-right">{planProgress.completed}/{planProgress.total}</span>
                                                    </div>
                                                    <span className="text-[10px] font-mono text-gray-400 shrink-0 hidden md:block">
                                                        {formatCompact(p.deadline)}
                                                    </span>
                                                    {planHash && (
                                                        <Link
                                                            href={buildHref(planHash)}
                                                            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shrink-0"
                                                            onClick={e => e.stopPropagation()}
                                                        >
                                                            <ExternalLink className="w-3 h-3" />
                                                            Open
                                                        </Link>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <div className="text-center py-10 bg-white rounded-xl border border-dashed border-gray-200">
                    <p className="text-gray-400 text-sm">
                        {search.trim() || statusFilter !== 'all' ? 'No campaigns match your filters.' : 'No active campaigns right now.'}
                    </p>
                </div>
            )}
        </section>
    );
}
