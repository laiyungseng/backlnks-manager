'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ExternalLink, Clock, Search, Star, Layers, ChevronDown, X } from 'lucide-react';
import {
    getProgress,
    formatTitleWithDate,
    formatCompact,
    buildCampaignGroups,
} from '../_lib/campaignGrouping';
import { useDebouncedUrlParam, useUrlParam } from '../_lib/usePortalFilters';

// Bucket the dynamic status badge labels (e.g. "3d overdue", "Due today", "2d left")
// into stable canonical values used for filtering.
function canonicalStatusBucket(label) {
    if (!label) return 'In Progress';
    if (label === 'Completed') return 'Completed';
    if (label === 'Pending Index') return 'Pending Index';
    if (label.endsWith(' overdue')) return 'Overdue';
    if (label === 'Due today' || label.endsWith(' left')) return 'Due Soon';
    return 'In Progress';
}

function formatDateKey(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function SearchSelect({ label, value, onChange, options, placeholder }) {
    const [open, setOpen] = useState(false);
    const [typed, setTyped] = useState('');
    const wrapRef = useRef(null);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        function onDocClick(e) {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [open]);

    // When closed, the input shows the selected value. When open, the input shows what user typed.
    const displayValue = open ? typed : (value || '');
    const filterText = open ? typed : '';
    const filteredOptions = filterText
        ? options.filter(o => o.toLowerCase().includes(filterText.toLowerCase()))
        : options;

    function pick(opt) {
        onChange(opt);
        setTyped(opt || '');
        setOpen(false);
    }

    return (
        <div ref={wrapRef} className="relative">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">{label}</label>
            <div className="relative">
                <input
                    type="text"
                    value={displayValue}
                    placeholder={placeholder}
                    onFocus={() => { setOpen(true); setTyped(''); }}
                    onChange={(e) => { setOpen(true); setTyped(e.target.value); }}
                    className="block w-full pl-3 pr-16 py-2 border border-gray-200 rounded-lg text-sm bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
                    {value && (
                        <button
                            type="button"
                            onClick={() => { onChange(null); setTyped(''); }}
                            className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                            title="Clear"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => { setOpen(o => !o); setTyped(''); }}
                        className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                        title="Toggle"
                    >
                        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </div>
            {open && (
                <div className="absolute z-20 mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg max-h-64 overflow-y-auto">
                    <button
                        type="button"
                        onClick={() => pick(null)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 ${value === null ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-700'}`}
                    >
                        All
                    </button>
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map(opt => (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => pick(opt)}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 truncate ${value === opt ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-700'}`}
                                title={opt}
                            >
                                {opt}
                            </button>
                        ))
                    ) : (
                        <div className="px-3 py-2 text-xs text-gray-400">No matches</div>
                    )}
                </div>
            )}
        </div>
    );
}

function getAggregatedStatusBadge(g) {
    const { completed, total, indexedCount } = g;
    if (total > 0 && completed >= total) {
        if (indexedCount >= total) return { label: 'Completed', cls: 'text-teal-700 bg-teal-50 border-teal-200' };
        return { label: 'Pending Index', cls: 'text-blue-700 bg-blue-50 border-blue-200' };
    }
    const daysLeft = g.earliestDeadline
        ? Math.floor((new Date(g.earliestDeadline) - new Date(new Date().setHours(0, 0, 0, 0))) / 86400000)
        : null;
    if (daysLeft !== null && daysLeft < 0) return { label: `${Math.abs(daysLeft)}d overdue`, cls: 'text-red-700 bg-red-50 border-red-200' };
    if (daysLeft !== null && daysLeft === 0) return { label: 'Due today', cls: 'text-orange-700 bg-orange-50 border-orange-200' };
    if (daysLeft !== null && daysLeft <= 3) return { label: `${daysLeft}d left`, cls: 'text-yellow-700 bg-yellow-50 border-yellow-200' };
    return { label: 'In Progress', cls: 'text-yellow-700 bg-yellow-50 border-yellow-200' };
}

function getPlanStatusBadge(project, progress) {
    const { completed, total, indexedCount } = progress;
    if (total > 0 && completed >= total) {
        if (indexedCount >= total) return { label: 'Completed', cls: 'text-teal-700 bg-teal-50 border border-teal-200' };
        return { label: 'Completed — Pending Index', cls: 'text-blue-700 bg-blue-50 border border-blue-200' };
    }
    return { label: project.status || 'In Progress', cls: 'text-yellow-700' };
}

function formatLanguages(project) {
    if (project.project_languages && project.project_languages.length > 0) {
        return project.project_languages.map(l => `${l.lang_code} (${l.ratio}%)`).join(', ');
    }
    return project.language ? `${project.language} (100%)` : '—';
}

function PlanDetailRow({ project, vendorName, vendorUuid }) {
    const hash = project.projects_hub?.[0]?.hash;
    const progress = getProgress(project);
    const statusBadge = getPlanStatusBadge(project, progress);
    const category = project.project_targets?.[0]?.category;

    return (
        <div className="px-5 py-4 border-t border-gray-100 bg-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        <div className="flex items-center gap-1">
                            <span className="text-gray-400">Status: </span>
                            <span className={`font-semibold text-xs px-1.5 py-0.5 rounded ${statusBadge.cls}`}>{statusBadge.label}</span>
                        </div>
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
                        {project.deadline && (
                            <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-red-500" />
                                <span className="text-gray-400">Deadline: </span>
                                <span className="font-semibold text-red-600">{new Date(project.deadline).toLocaleDateString()}</span>
                            </div>
                        )}
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

                <div className="flex items-center gap-4 shrink-0">
                    <div className="text-center">
                        <div className="text-sm font-bold text-gray-900">
                            {progress.completed} <span className="text-gray-400 font-normal">/ {progress.total}</span>
                        </div>
                        <div className="w-28 bg-gray-100 rounded-full h-1.5 mt-1 overflow-hidden">
                            <div className="bg-indigo-600 h-1.5 transition-all" style={{ width: `${progress.percent}%` }} />
                        </div>
                    </div>
                    {hash && (
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

export default function InProgressProjectList({ projects, vendorName, vendorUuid, displayName }) {
    const [search, setSearch] = useDebouncedUrlParam('q', 300);
    const [statusRaw, setStatusRaw] = useUrlParam('istatus');
    const [dateRaw, setDateRaw] = useUrlParam('idate');
    const [nameRaw, setNameRaw] = useUrlParam('iname');
    const statusFilter = statusRaw || null;
    const dateFilter = dateRaw || null;
    const nameFilter = nameRaw || null;
    const setStatusFilter = (v) => setStatusRaw(v || null);
    const setDateFilter = (v) => setDateRaw(v || null);
    const setNameFilter = (v) => setNameRaw(v || null);
    const [expandedIds, setExpandedIds] = useState(new Set());

    const grouped = useMemo(() => buildCampaignGroups(projects), [projects]);

    // Build filter option lists from grouped data
    const { statusOptions, dateOptions, nameOptions } = useMemo(() => {
        const statuses = new Set();
        const dates = new Set();
        const names = new Set();
        for (const g of grouped) {
            statuses.add(canonicalStatusBucket(getAggregatedStatusBadge(g).label));
            const dk = formatDateKey(g.earliestCreated);
            if (dk) dates.add(dk);
            if (g.title) names.add(g.title);
        }
        return {
            statusOptions: ['Overdue', 'Due Soon', 'In Progress', 'Pending Index', 'Completed'].filter(s => statuses.has(s)),
            dateOptions: Array.from(dates).sort().reverse(),
            nameOptions: Array.from(names).sort(),
        };
    }, [grouped]);

    const filtered = grouped.filter(g => {
        if (search.trim() && !(g.title || '').toLowerCase().includes(search.toLowerCase().trim())) return false;
        if (statusFilter && canonicalStatusBucket(getAggregatedStatusBadge(g).label) !== statusFilter) return false;
        if (dateFilter && formatDateKey(g.earliestCreated) !== dateFilter) return false;
        if (nameFilter && g.title !== nameFilter) return false;
        return true;
    });

    const hasActiveFilters = !!(search.trim() || statusFilter || dateFilter || nameFilter);

    function toggleExpand(id) {
        setExpandedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    return (
        <div>
            <div className="mb-4 pr-40">
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">In Progress Projects</h1>
                <p className="mt-2 text-sm text-gray-500">
                    All active assignments for <span className="font-semibold text-indigo-600">{displayName}</span>
                </p>
            </div>

            <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <SearchSelect
                    label="Status"
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={statusOptions}
                    placeholder="All statuses"
                />
                <SearchSelect
                    label="Date Created"
                    value={dateFilter}
                    onChange={setDateFilter}
                    options={dateOptions}
                    placeholder="All dates"
                />
                <SearchSelect
                    label="Project Name"
                    value={nameFilter}
                    onChange={setNameFilter}
                    options={nameOptions}
                    placeholder="All projects"
                />
            </div>

            <div className="mb-5 flex justify-end">
                <div className="relative w-full sm:w-64">
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

            <div className="space-y-4">
                {filtered.length > 0 ? (
                    filtered.map(g => {
                        const rowKey = g.campaignId || `orphan-${g.plans[0]?.id}`;
                        const isExpanded = expandedIds.has(rowKey);
                        const statusBadge = getAggregatedStatusBadge(g);

                        return (
                            <div
                                key={rowKey}
                                className={`bg-white rounded-xl shadow-sm overflow-hidden transition-shadow hover:shadow-md ${
                                    g.anyPriority ? 'ring-1 ring-amber-200 border-l-4 border-l-amber-400' : 'ring-1 ring-gray-200'
                                }`}
                            >
                                {/* Campaign header — always clickable, always shows chevron */}
                                <div
                                    className="px-5 py-3.5 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
                                    onClick={() => toggleExpand(rowKey)}
                                >
                                    <Star className={`w-4 h-4 shrink-0 ${g.anyPriority ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />

                                    <span className="font-mono text-sm font-semibold text-gray-900 truncate flex-1 min-w-0" title={g.title}>
                                        {formatTitleWithDate(g.earliestCreated, g.title)}
                                    </span>

                                    <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 text-xs font-bold rounded bg-purple-50 text-purple-700 border border-purple-100 shrink-0 min-w-[72px]">
                                        <Layers className="w-3 h-3" />
                                        {g.plans.length} {g.plans.length === 1 ? 'plan' : 'plans'}
                                    </span>

                                    <span className={`text-xs font-bold px-2 py-0.5 rounded border shrink-0 text-center min-w-[110px] ${statusBadge.cls}`}>
                                        {statusBadge.label}
                                    </span>

                                    <span className="hidden lg:inline-block font-mono text-xs text-gray-400 shrink-0 text-center min-w-[100px]">
                                        {formatCompact(g.earliestStart)}<span className="text-gray-300 mx-0.5">→</span>{formatCompact(g.earliestDeadline)}
                                    </span>

                                    <div className="hidden sm:flex items-center gap-2 shrink-0 w-32">
                                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                            <div className={`h-1.5 rounded-full transition-all ${g.anyPriority ? 'bg-amber-400' : 'bg-indigo-500'}`} style={{ width: `${g.percent}%` }} />
                                        </div>
                                        <span className="text-xs text-gray-500 tabular-nums">{g.completed}/{g.total}</span>
                                    </div>

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
                            {hasActiveFilters ? 'No campaigns match the current filters.' : 'No active projects at the moment.'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
