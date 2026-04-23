'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader, ExternalLink, Search } from 'lucide-react';

function getRemainingDays(deadline) {
    if (!deadline) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(deadline);
    due.setHours(0, 0, 0, 0);
    return Math.floor((due - now) / (1000 * 60 * 60 * 24));
}

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

const STATUS_FILTERS = [
    { key: 'all',     label: 'All' },
    { key: 'inprogress', label: 'In Progress' },
    { key: 'pending-index', label: 'Pending Index' },
    { key: 'completed',  label: 'Completed' },
];

function getStatusCategory(project) {
    const hub = project.projects_hub?.[0] || {};
    const stagingData = Array.isArray(hub.vendor_staging_data) ? hub.vendor_staging_data : [];
    const hubTargets = Array.isArray(hub.targets) ? hub.targets : [];
    const completed = stagingData.filter(s => s.published_url && s.published_url.trim().length > 0).length;
    const indexedCount = stagingData.filter(s => s.indexed_status && s.indexed_status.trim().length > 0).length;
    const total = hubTargets.length > 0
        ? hubTargets.reduce((acc, t) => acc + (parseInt(t.quantity || '0', 10)), 0)
        : (project.total_quantity || 0);
    if (total > 0 && completed >= total) {
        return indexedCount >= total ? 'completed' : 'pending-index';
    }
    return 'inprogress';
}

export default function DashboardActiveProjects({ activeProjects, vendorName }) {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const counts = {
        all: activeProjects.length,
        inprogress: activeProjects.filter(p => getStatusCategory(p) === 'inprogress').length,
        'pending-index': activeProjects.filter(p => getStatusCategory(p) === 'pending-index').length,
        completed: activeProjects.filter(p => getStatusCategory(p) === 'completed').length,
    };

    let filtered = statusFilter === 'all'
        ? activeProjects
        : activeProjects.filter(p => getStatusCategory(p) === statusFilter);

    if (search.trim()) {
        filtered = filtered.filter(p => (p.project_name || '').toLowerCase().includes(search.toLowerCase().trim()));
    }

    return (
        <section>
            <div className="flex flex-wrap items-center gap-2 mb-3">
                <Loader className="w-4 h-4 text-indigo-500" />
                <h2 className="text-lg font-bold text-gray-800">Active Projects</h2>
                <span className="ml-1 px-2 py-0.5 text-xs font-bold rounded-full bg-indigo-100 text-indigo-700">{activeProjects.length}</span>
                <div className="ml-auto relative w-full sm:w-56">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search projects..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="block w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    />
                </div>
            </div>

            {/* Status filter pills */}
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
                <div className="space-y-3">
                    {filtered.map(p => {
                        const daysLeft = getRemainingDays(p.deadline);
                        const progress = getProgress(p);
                        const { label, color } = getProjectStatus(daysLeft, progress.completed, progress.total, progress.indexedCount);
                        const hash = p.projects_hub?.[0]?.hash;
                        const category = p.project_targets?.[0]?.category;

                        return (
                            <div key={p.id} className="bg-white rounded-xl ring-1 ring-gray-200 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                        <span className="font-bold text-gray-900 text-sm">{p.project_name || 'Unnamed'}</span>
                                        {category && (
                                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-purple-50 text-purple-700 border border-purple-100">{category}</span>
                                        )}
                                        <span className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded border ${statusColorMap[color]}`}>
                                            {label}
                                        </span>
                                    </div>

                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
                                        <span>Qty: <span className="font-semibold text-gray-700">{getTotal(p)}</span></span>
                                        {p.country && <span>Country: <span className="font-semibold text-gray-700 uppercase">{p.country}</span></span>}
                                        <span>Submission: <span className="font-semibold text-gray-700">{formatDate(p.deadline)}</span></span>
                                        {p.start_date && <span>Kickoff: <span className="font-semibold text-gray-700">{formatDate(p.start_date)}</span></span>}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className={`h-1.5 rounded-full transition-all ${progressBarColorMap[color]}`}
                                                style={{ width: `${progress.percent}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-gray-500 shrink-0 tabular-nums">
                                            {progress.completed}/{progress.total}
                                            <span className="ml-1 text-gray-400">({progress.percent}%)</span>
                                        </span>
                                    </div>
                                </div>

                                {hash && (
                                    <Link
                                        href={`/vendor/${vendorName}/${hash}`}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm shrink-0"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        Open
                                    </Link>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-10 bg-white rounded-xl border border-dashed border-gray-200">
                    <p className="text-gray-400 text-sm">
                        {search.trim() || statusFilter !== 'all' ? 'No projects match your filters.' : 'No active projects right now.'}
                    </p>
                </div>
            )}
        </section>
    );
}
