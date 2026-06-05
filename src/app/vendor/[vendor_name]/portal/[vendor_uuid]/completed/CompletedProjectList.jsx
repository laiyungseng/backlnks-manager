'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Lock, ExternalLink, CheckCircle2, Search, Star, Layers, ChevronDown, Calendar, X } from 'lucide-react';
import {
    formatTitleWithDate,
    formatCompact,
    buildCampaignGroups,
} from '../_lib/campaignGrouping';
import { useDebouncedUrlParam, useUrlParam } from '../_lib/usePortalFilters';

function getTotal(project) {
    const hub = project.projects_hub?.[0] || {};
    const hubTargets = Array.isArray(hub.targets) ? hub.targets : [];
    return hubTargets.length > 0
        ? hubTargets.reduce((acc, t) => acc + (parseInt(t.quantity || '0', 10)), 0)
        : (project.total_quantity || 0);
}

function formatLanguages(project) {
    if (project.project_languages && project.project_languages.length > 0) {
        return project.project_languages.map(l => `${l.lang_code} (${l.ratio}%)`).join(', ');
    }
    return project.language ? `${project.language} (100%)` : '—';
}

function PlanDetailRow({ project, vendorName, vendorUuid }) {
    const hash = project.projects_hub?.[0]?.hash;
    const isLocked = project.projects_hub?.[0]?.is_locked || false;
    const category = project.project_targets?.[0]?.category;
    const qty = getTotal(project);

    return (
        <div className="px-5 py-4 border-t border-gray-100 bg-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        {project.country && (
                            <div>
                                <span className="text-gray-400">Country: </span>
                                <span className="font-semibold text-gray-700 uppercase">{project.country}</span>
                            </div>
                        )}
                        <div>
                            <span className="text-gray-400">Language: </span>
                            <span className="font-semibold text-gray-700 uppercase">{formatLanguages(project)}</span>
                        </div>
                        {category && (
                            <div>
                                <span className="text-gray-400">Category: </span>
                                <span className="font-semibold text-purple-700">{category}</span>
                            </div>
                        )}
                        <div>
                            <span className="text-gray-400">Qty: </span>
                            <span className="font-semibold text-gray-700">{qty}</span>
                        </div>
                        <div>
                            <span className="text-gray-400">Target Domain: </span>
                            {(() => {
                                const hubTargets = project.projects_hub?.[0]?.targets || [];
                                const safeHostname = (url) => { try { return new URL(url).hostname; } catch { return url; } };
                                if (hubTargets.length === 0) return <span className="italic text-gray-400">No Targets</span>;
                                if (hubTargets.length === 1) return <span className="font-semibold text-indigo-600 truncate max-w-[200px] inline-block align-bottom">{safeHostname(hubTargets[0].target_url)}</span>;
                                return <span className="font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-xs">{hubTargets.length} Target URLs</span>;
                            })()}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    <span className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded ${
                        isLocked
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}>
                        {isLocked ? <Lock className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
                        {isLocked ? 'Locked' : 'Editable'}
                    </span>

                    {hash && !isLocked && (
                        <Link
                            href={vendorUuid ? `/vendor/${vendorName}/portal/${vendorUuid}/project/${hash}` : `/vendor/${vendorName}/${hash}`}
                            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Open
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}

function isoToDateInput(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CompletedProjectList({ projects, vendorName, vendorUuid, displayName }) {
    const [search, setSearch] = useDebouncedUrlParam('q', 300);
    const [from, setFrom] = useUrlParam('from');
    const [to, setTo] = useUrlParam('to');
    const [expandedIds, setExpandedIds] = useState(new Set());

    const grouped = useMemo(() => buildCampaignGroups(projects), [projects]);

    const fromTs = from ? new Date(from).setHours(0, 0, 0, 0) : null;
    const toTs = to ? new Date(to).setHours(23, 59, 59, 999) : null;

    const filtered = grouped.filter(g => {
        if (search.trim() && !(g.title || '').toLowerCase().includes(search.toLowerCase().trim())) return false;
        if (fromTs || toTs) {
            const ts = g.earliestCreated ? new Date(g.earliestCreated).getTime() : null;
            if (ts === null) return false;
            if (fromTs && ts < fromTs) return false;
            if (toTs && ts > toTs) return false;
        }
        return true;
    });

    const hasActiveFilters = !!(search.trim() || from || to);

    function clearDateRange() {
        setFrom(null);
        setTo(null);
    }

    function toggleExpand(id) {
        setExpandedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    return (
        <div>
            <div className="mb-6">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Completed Projects</h1>
                        <p className="mt-2 text-sm text-gray-500">
                            Finalized assignments for <span className="font-semibold text-indigo-600">{displayName}</span>
                        </p>
                    </div>
                    <div className="relative w-full sm:w-64 mt-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search campaigns..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="block w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                        />
                    </div>
                </div>

                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">From</label>
                        <div className="relative">
                            <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                            <input
                                type="date"
                                value={isoToDateInput(from)}
                                onChange={e => setFrom(e.target.value || null)}
                                className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">To</label>
                        <div className="relative">
                            <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                            <input
                                type="date"
                                value={isoToDateInput(to)}
                                onChange={e => setTo(e.target.value || null)}
                                className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                    </div>
                    {(from || to) && (
                        <button
                            type="button"
                            onClick={clearDateRange}
                            className="flex items-center gap-1 px-2.5 py-2 mb-0 rounded-lg text-xs font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                            Clear dates
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                {filtered.length > 0 ? (
                    filtered.map(g => {
                        const rowKey = g.campaignId || `orphan-${g.plans[0]?.id}`;
                        const isExpanded = expandedIds.has(rowKey);

                        const lockedCount = g.plans.filter(p => p.projects_hub?.[0]?.is_locked).length;
                        const lockLabel = lockedCount === g.plans.length
                            ? 'All Locked'
                            : lockedCount > 0
                                ? `${lockedCount}/${g.plans.length} Locked`
                                : 'Editable';
                        const lockCls = lockedCount === g.plans.length
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : lockedCount > 0
                                ? 'bg-orange-50 text-orange-700 border-orange-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200';

                        return (
                            <div
                                key={rowKey}
                                className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                            >
                                {/* Campaign header — always clickable, always shows chevron */}
                                <div
                                    className="px-5 py-3.5 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
                                    onClick={() => toggleExpand(rowKey)}
                                >
                                    <Star className="w-4 h-4 shrink-0 text-gray-200" />

                                    <span className="font-mono text-sm font-semibold text-gray-900 truncate flex-1 min-w-0" title={g.title}>
                                        {formatTitleWithDate(g.earliestCreated, g.title)}
                                    </span>

                                    <span className="flex items-center justify-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-green-50 text-green-700 border border-green-200 shrink-0 min-w-[80px]">
                                        <CheckCircle2 className="w-3 h-3" /> Finalized
                                    </span>

                                    <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 text-xs font-bold rounded bg-purple-50 text-purple-700 border border-purple-100 shrink-0 min-w-[72px]">
                                        <Layers className="w-3 h-3" />
                                        {g.plans.length} {g.plans.length === 1 ? 'plan' : 'plans'}
                                    </span>

                                    <span className={`hidden sm:inline-flex items-center justify-center gap-1.5 px-2.5 py-0.5 text-xs font-bold rounded border shrink-0 min-w-[120px] ${lockCls}`}>
                                        {lockedCount > 0 ? <Lock className="w-3 h-3" /> : <ExternalLink className="w-3 h-3" />}
                                        {lockLabel}
                                    </span>

                                    <span className="hidden lg:inline-block font-mono text-xs text-gray-400 shrink-0 text-center min-w-[50px]">
                                        {formatCompact(g.earliestCreated)}
                                    </span>

                                    <ChevronDown className={`w-4 h-4 shrink-0 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>

                                {/* Plan detail rows */}
                                {isExpanded && g.plans.map(p => (
                                    <PlanDetailRow key={p.id} project={p} vendorName={vendorName} vendorUuid={vendorUuid} />
                                ))}
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                        <p className="text-gray-500">
                            {hasActiveFilters ? 'No campaigns match the current filters.' : 'No completed projects yet.'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
