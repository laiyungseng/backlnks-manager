'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Star, ExternalLink, ArrowUpDown } from 'lucide-react';
import { getProgress, formatTitleWithDate } from '../_lib/campaignGrouping';

function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getRemainingDays(deadline) {
    if (!deadline) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(deadline);
    due.setHours(0, 0, 0, 0);
    return Math.floor((due - now) / (1000 * 60 * 60 * 24));
}

export default function DashboardFocus({ priorityProjects, vendorName, vendorUuid }) {
    const [sortOrder, setSortOrder] = useState('newest');

    const sorted = useMemo(() => {
        const projects = [...priorityProjects];
        projects.sort((a, b) => {
            const da = a.created_date ? new Date(a.created_date).getTime() : 0;
            const db = b.created_date ? new Date(b.created_date).getTime() : 0;
            return sortOrder === 'newest' ? db - da : da - db;
        });
        return projects;
    }, [priorityProjects, sortOrder]);

    if (sorted.length === 0) return null;

    return (
        <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
                <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                <h2 className="text-lg font-bold text-gray-800">Focus</h2>
                <span className="ml-1 px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-700">
                    {sorted.length}
                </span>
                <div className="ml-auto flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                    <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 ml-1.5" />
                    <button
                        onClick={() => setSortOrder('newest')}
                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                            sortOrder === 'newest'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Newest
                    </button>
                    <button
                        onClick={() => setSortOrder('oldest')}
                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                            sortOrder === 'oldest'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Oldest
                    </button>
                </div>
            </div>

            <div className="space-y-2">
                {sorted.map(p => {
                    const { completed, total, percent } = getProgress(p);
                    const daysLeft = getRemainingDays(p.deadline);
                    const hash = p.projects_hub?.[0]?.hash;
                    const campaignTitle = p.project_plans?.[0]?.project_campaigns?.title || p.project_name || 'Unnamed';
                    const displayTitle = formatTitleWithDate(p.created_date, campaignTitle);
                    const category = p.project_targets?.[0]?.category || null;

                    return (
                        <div
                            key={p.id}
                            className="bg-white rounded-xl ring-1 ring-amber-200 border-l-4 border-l-amber-400 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4"
                        >
                            <div className="flex-1 min-w-0">
                                {/* Title row */}
                                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                                    <span className="font-mono font-bold text-gray-900 text-sm truncate min-w-0" title={displayTitle}>
                                        {displayTitle}
                                    </span>
                                    {p.country && (
                                        <span className="text-xs font-mono text-gray-400 uppercase shrink-0">
                                            {p.country}
                                        </span>
                                    )}
                                    {category && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-100 shrink-0">
                                            {category}
                                        </span>
                                    )}
                                </div>

                                {/* Meta row */}
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-2">
                                    <span>
                                        Qty: <span className="font-semibold text-gray-700">{total}</span>
                                    </span>
                                    {p.start_date && (
                                        <span>
                                            Start: <span className="font-semibold text-gray-700">{formatDate(p.start_date)}</span>
                                        </span>
                                    )}
                                    <span>
                                        Deadline:{' '}
                                        <span className={`font-semibold ${daysLeft !== null && daysLeft <= 0 ? 'text-red-600' : 'text-gray-700'}`}>
                                            {formatDate(p.deadline)}
                                        </span>
                                    </span>
                                    {daysLeft !== null && daysLeft <= 3 && (
                                        <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${daysLeft < 0 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                            {daysLeft < 0 ? `${Math.abs(daysLeft)}d late` : daysLeft === 0 ? 'Today' : `${daysLeft}d left`}
                                        </span>
                                    )}
                                </div>

                                {/* Progress row */}
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden max-w-[160px]">
                                        <div
                                            className="h-1.5 rounded-full bg-amber-400 transition-all"
                                            style={{ width: `${percent}%` }}
                                        />
                                    </div>
                                    <span className="text-xs text-gray-500 tabular-nums">{completed}/{total} ({percent}%)</span>
                                </div>
                            </div>

                            {hash && (
                                <Link
                                    href={`/vendor/${vendorName}/portal/${vendorUuid}/project/${hash}`}
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
    );
}
